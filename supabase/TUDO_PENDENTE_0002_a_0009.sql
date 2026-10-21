-- ===== 0002_app.sql =====
-- Conectas | migração 0002: criação automática de perfil, tipos iniciais, criação de projeto

-- Primeiro usuário criado vira admin com permissão financeira total; demais entram como gestora sem acesso financeiro.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  select not exists (select 1 from perfis) into primeiro;
  insert into perfis(id, nome, email, papel, fin)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          new.email,
          case when primeiro then 'admin'::papel else 'gestora'::papel end,
          case when primeiro then 'validar'::nivel_fin else 'nenhum'::nivel_fin end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Tipos de entregável configuráveis (editáveis depois sem código)
insert into tipos_entregavel(nome) values
 ('Diagnóstico'),('Entrevista'),('Focus group'),('Assessment (MBTI)'),('Visita de campo'),('Workshop'),
 ('Programa de desenvolvimento de liderança'),('Mentoria'),('Material instrucional'),('Podcast'),('Vídeo'),
 ('Reunião de alinhamento'),('Kickoff'),('Gestão de projeto'),('Outro')
on conflict (nome) do nothing;

-- Criação de projeto + escopo contratado v1 em uma operação
create or replace function criar_projeto(
  p_codigo text, p_cliente uuid, p_nome text, p_descricao text, p_responsavel uuid, p_apoio uuid,
  p_inicio date, p_fim date) returns uuid language plpgsql security definer set search_path = public as $$
declare u perfis; pid uuid; eid uuid;
begin
  select * into u from perfis where id=auth.uid() and ativo and papel in ('admin','gestora');
  if u.id is null then raise exception 'sem permissão para criar projeto'; end if;
  -- gestora só atribui responsável por conta própria; admin atribui qualquer pessoa
  if u.papel='gestora' and p_responsavel is distinct from u.id and p_apoio is distinct from u.id then
    raise exception 'gestoras criam projetos em que são responsáveis ou apoio';
  end if;
  insert into projetos(codigo, cliente_id, nome, descricao, responsavel_id, apoio_id, inicio_previsto, fim_previsto, situacao, criado_por)
  values (p_codigo, p_cliente, p_nome, p_descricao, p_responsavel, p_apoio, p_inicio, p_fim, 'planejamento', u.id) returning id into pid;
  insert into escopos(projeto_id, versao, tipo, motivo, registrado_por) values (pid, 1, 'contratado', 'Escopo original da venda', u.id) returning id into eid;
  update projetos set escopo_vigente_id = eid where id = pid;
  return pid;
end $$;

-- Confirmar entrega: exige papel admin/gestora E edição no projeto (substituições valem)
create or replace function confirmar_entrega(p_entregavel uuid) returns void language plpgsql security definer set search_path = public as $$
declare e entregaveis; v numeric;
begin
  select * into e from entregaveis where id = p_entregavel;
  if e.id is null then raise exception 'entregável inexistente'; end if;
  if not pode_editar_projeto(e.projeto_id) then raise exception 'sem permissão para confirmar entrega deste projeto'; end if;
  if not exists (select 1 from perfis where id=auth.uid() and ativo and papel in ('admin','gestora')) then
    raise exception 'sem permissão para confirmar entrega'; end if;
  update entregaveis set status='concluido', data_realizada=current_date where id=p_entregavel;
  if e.gera_receita then
    select valor into v from alocacoes_valor where entregavel_id = p_entregavel;
    if v is not null then
      insert into eventos_receita(projeto_id, entregavel_id, valor, competencia, confirmado_por, confirmado_em)
      values (e.projeto_id, p_entregavel, v, date_trunc('month', current_date)::date, auth.uid(), now())
      on conflict do nothing;
    end if;
  end if;
end $$;


-- ===== 0003_marketing.sql =====
-- Conectas | migração 0003: Marketing (Impactômetro + NPS) e entrega paga
-- Rodar sozinha no SQL Editor (o ALTER TYPE precisa ser confirmado antes de usar o novo papel).

alter type papel add value if not exists 'marketing';

-- Pessoas impactadas (PAX) ficam NO ENTREGÁVEL: preenche-se uma vez e o Marketing apenas agrega.
alter table entregaveis add column if not exists pax_previsto int check (pax_previsto >= 0);
alter table entregaveis add column if not exists pax int check (pax >= 0);   -- realizado
comment on column entregaveis.gera_receita is 'Entrega paga: quando false, a entrega não gera evento de receita (ex.: cortesia/ação de relacionamento).';

-- NPS: várias respostas por projeto, opcionalmente ligadas a uma entrega
create table if not exists nps_respostas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  entregavel_id uuid references entregaveis(id) on delete set null,
  nota int not null check (nota between 0 and 10),
  data date not null default current_date,
  consultor_id uuid references perfis(id),
  respondente text, observacao text,
  registrado_por uuid references perfis(id) default auth.uid(),
  criado_em timestamptz default now()
);
alter table nps_respostas enable row level security;
drop policy if exists ler_nps on nps_respostas;
create policy ler_nps on nps_respostas for select using (meu_papel() is not null);
drop policy if exists esc_nps on nps_respostas;
create policy esc_nps on nps_respostas for all using (pode_editar_projeto(projeto_id)) with check (pode_editar_projeto(projeto_id));
drop trigger if exists aud_nps_respostas on nps_respostas;
create trigger aud_nps_respostas after insert or update or delete on nps_respostas for each row execute function audit_trigger();


-- ===== 0004_responsaveis_alertas.sql =====
-- Conectas | migração 0004: responsável por entregável + base de alertas por e-mail/agenda

alter table entregaveis add column if not exists responsavel_id uuid references perfis(id);

-- Fila de e-mails (o envio em si é feito pelo servidor; ver README). Só administração lê.
create table if not exists email_fila (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references perfis(id),
  para text not null, assunto text not null, corpo text not null,
  ics text,                              -- convite de agenda (.ics) opcional
  criado_em timestamptz default now(), enviado_em timestamptz, erro text
);
alter table email_fila enable row level security;
drop policy if exists ler_fila on email_fila;
create policy ler_fila on email_fila for select using (meu_papel() = 'admin');

-- Ao atribuir (ou mudar responsável/prazo) de uma atividade ou entregável: notifica no sistema e enfileira e-mail
create or replace function notificar_atribuicao() returns trigger language plpgsql security definer set search_path = public as $$
declare dest perfis; pnome text; rotulo text; quando text;
begin
  if new.responsavel_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.responsavel_id is not distinct from new.responsavel_id and old.data_prevista is not distinct from new.data_prevista then return null; end if;
  if new.responsavel_id = auth.uid() then return null; end if;      -- não avisa quem se atribuiu
  select * into dest from perfis where id = new.responsavel_id and ativo;
  if dest.id is null then return null; end if;
  select nome into pnome from projetos where id = new.projeto_id;
  rotulo := case when tg_table_name = 'entregaveis' then 'entrega' else 'atividade' end;
  quando := case when new.data_prevista is null then 'sem prazo definido' else 'prazo ' || to_char(new.data_prevista, 'DD/MM/YYYY') end;
  insert into notificacoes(usuario_id, texto, link)
    values (dest.id, format('Você é responsável pela %s "%s" (%s), %s.', rotulo, new.nome, pnome, quando), '/projetos/' || new.projeto_id);
  insert into email_fila(usuario_id, para, assunto, corpo)
    values (dest.id, dest.email, format('Conectas: %s "%s"', rotulo, new.nome),
            format('Olá, %s. Você é responsável pela %s "%s" do projeto "%s", %s.', dest.nome, rotulo, new.nome, pnome, quando));
  return null;
end $$;
drop trigger if exists notif_atividades on atividades;
create trigger notif_atividades after insert or update on atividades for each row execute function notificar_atribuicao();
drop trigger if exists notif_entregaveis on entregaveis;
create trigger notif_entregaveis after insert or update on entregaveis for each row execute function notificar_atribuicao();


-- ===== 0005_papeis_horario_alertas.sql =====
-- Conectas | migração 0005: papel Consultor, horário nas tarefas e base dos alertas/agenda

alter type papel add value if not exists 'consultor';   -- todos os papéis já enxergam o sistema (leitura); edição segue as regras de cada tabela

-- Horário e duração (para o convite de agenda). Sem horário = evento de dia inteiro.
alter table atividades add column if not exists hora_prevista time;
alter table atividades add column if not exists duracao_min int default 60 check (duracao_min > 0);
alter table entregaveis add column if not exists hora_prevista time;
alter table entregaveis add column if not exists duracao_min int default 60 check (duracao_min > 0);

-- Fila de e-mails passa a saber a qual tarefa se refere (para montar o convite .ics)
alter table email_fila add column if not exists tipo text default 'atribuicao';
alter table email_fila add column if not exists ref_tabela text;
alter table email_fila add column if not exists ref_id uuid;

-- Evita lembretes repetidos
create table if not exists lembretes_enviados (
  id uuid primary key default gen_random_uuid(),
  ref_tabela text not null, ref_id uuid not null, tipo text not null, data_prevista date not null,
  criado_em timestamptz default now(),
  unique (ref_tabela, ref_id, tipo, data_prevista)
);
alter table lembretes_enviados enable row level security;   -- sem policies: só o servidor (service_role) acessa

-- Atribuição agora grava a referência e inclui o horário no texto
create or replace function notificar_atribuicao() returns trigger language plpgsql security definer set search_path = public as $$
declare dest perfis; pnome text; rotulo text; quando text;
begin
  if new.responsavel_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.responsavel_id is not distinct from new.responsavel_id
     and old.data_prevista is not distinct from new.data_prevista
     and old.hora_prevista is not distinct from new.hora_prevista then return null; end if;
  if new.responsavel_id = auth.uid() then return null; end if;
  select * into dest from perfis where id = new.responsavel_id and ativo;
  if dest.id is null then return null; end if;
  select nome into pnome from projetos where id = new.projeto_id;
  rotulo := case when tg_table_name = 'entregaveis' then 'entrega' else 'atividade' end;
  quando := case when new.data_prevista is null then 'sem prazo definido'
                 else 'prazo ' || to_char(new.data_prevista, 'DD/MM/YYYY') || coalesce(' às ' || to_char(new.hora_prevista, 'HH24:MI'), '') end;
  insert into notificacoes(usuario_id, texto, link)
    values (dest.id, format('Você é responsável pela %s "%s" (%s), %s.', rotulo, new.nome, pnome, quando), '/projetos/' || new.projeto_id);
  insert into email_fila(usuario_id, para, assunto, corpo, tipo, ref_tabela, ref_id)
    values (dest.id, dest.email, format('Conectas: %s "%s"', rotulo, new.nome),
            format('Olá, %s. Você é responsável pela %s "%s" do projeto "%s", %s.', dest.nome, rotulo, new.nome, pnome, quando),
            'atribuicao', tg_table_name, new.id);
  return null;
end $$;


-- ===== 0006_planilha_e_importacao.sql =====
-- Conectas | migração 0006: campos que faltavam vs. planilha de cronogramas + importação atômica

-- Classificação usada nos painéis da planilha (Tipo 1-DC / 2-DI / 3-DO, subtipo e full service)
alter table projetos add column if not exists tipo_projeto text;          -- DC, DI, DO (rótulos a confirmar)
alter table projetos add column if not exists subtipo text;              -- PDL, Coaching, Assessment, Treinamento Indoor...
alter table projetos add column if not exists modalidade text not null default 'projeto' check (modalidade in ('projeto','full_service'));
alter table projeto_financeiro add column if not exists valor_liquido numeric(14,2) check (valor_liquido >= 0);  -- planilha tem Bruto e Líquido

-- Colunas dos cronogramas: HP (horas), Local, Participantes (vários)
alter table atividades add column if not exists local text;
alter table atividades add column if not exists horas_previstas numeric(6,2) check (horas_previstas >= 0);
alter table atividades add column if not exists participantes text;      -- lista original (vários consultores); o responsável principal continua em responsavel_id

-- Fase do projeto (coluna Fase da Base Projetos): a iniciar, execução, entrega, finalizado
alter table projetos add column if not exists fase text check (fase in ('a_iniciar','execucao','entrega','finalizado'));

-- Notificações em massa ficam desligadas durante importações
create or replace function notificar_atribuicao() returns trigger language plpgsql security definer set search_path = public as $$
declare dest perfis; pnome text; rotulo text; quando text;
begin
  if coalesce(current_setting('app.silencioso', true), '') = 'on' then return null; end if;
  if new.responsavel_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.responsavel_id is not distinct from new.responsavel_id
     and old.data_prevista is not distinct from new.data_prevista
     and old.hora_prevista is not distinct from new.hora_prevista then return null; end if;
  if new.responsavel_id = auth.uid() then return null; end if;
  select * into dest from perfis where id = new.responsavel_id and ativo;
  if dest.id is null then return null; end if;
  select nome into pnome from projetos where id = new.projeto_id;
  rotulo := case when tg_table_name = 'entregaveis' then 'entrega' else 'atividade' end;
  quando := case when new.data_prevista is null then 'sem prazo definido'
                 else 'prazo ' || to_char(new.data_prevista, 'DD/MM/YYYY') || coalesce(' às ' || to_char(new.hora_prevista, 'HH24:MI'), '') end;
  insert into notificacoes(usuario_id, texto, link)
    values (dest.id, format('Você é responsável pela %s "%s" (%s), %s.', rotulo, new.nome, pnome, quando), '/projetos/' || new.projeto_id);
  insert into email_fila(usuario_id, para, assunto, corpo, tipo, ref_tabela, ref_id)
    values (dest.id, dest.email, format('Conectas: %s "%s"', rotulo, new.nome),
            format('Olá, %s. Você é responsável pela %s "%s" do projeto "%s", %s.', dest.nome, rotulo, new.nome, pnome, quando),
            'atribuicao', tg_table_name, new.id);
  return null;
end $$;

-- Importa a estrutura (macroetapas > entregáveis > atividades) já conferida pelo usuário, em uma única transação.
-- p_dados: {"macroetapas":[{"nome":"","entregaveis":[{"nome":"","quantidade":1,"status":"nao_iniciado","data_prevista":"2026-01-31",
--           "valor":0,"gera_receita":true,"atividades":[{"nome":"","status":"concluido","data_prevista":null,"responsavel_id":null,
--           "participantes":"","local":"","horas_previstas":1.5,"logistica":false,"responsabilidade":"conectas"}]}]}]}
create or replace function importar_estrutura(p_projeto uuid, p_dados jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare esc uuid; m jsonb; e jsonb; a jsonb; mid uuid; eid uuid; mi int := 0; nm int := 0; ne int := 0; na int := 0;
        pode_valor boolean;
begin
  if not pode_editar_projeto(p_projeto) then raise exception 'sem permissão para editar este projeto'; end if;
  select escopo_vigente_id into esc from projetos where id = p_projeto;
  if esc is null then raise exception 'projeto sem escopo vigente'; end if;
  pode_valor := meu_fin() in ('editar','validar');
  perform set_config('app.silencioso', 'on', true);
  for m in select * from jsonb_array_elements(coalesce(p_dados->'macroetapas', '[]'::jsonb)) loop
    mi := mi + 1;
    insert into macroetapas(escopo_id, projeto_id, nome, ordem) values (esc, p_projeto, left(m->>'nome', 300), mi) returning id into mid; nm := nm + 1;
    for e in select * from jsonb_array_elements(coalesce(m->'entregaveis', '[]'::jsonb)) loop
      insert into entregaveis(macroetapa_id, projeto_id, escopo_id, nome, quantidade, data_prevista, status, gera_receita)
      values (mid, p_projeto, esc, left(e->>'nome', 300), greatest(coalesce((e->>'quantidade')::int, 1), 1), nullif(e->>'data_prevista','')::date,
              coalesce(nullif(e->>'status','')::status_atividade, 'nao_iniciado'), coalesce((e->>'gera_receita')::boolean, true)) returning id into eid; ne := ne + 1;
      if pode_valor and nullif(e->>'valor','') is not null and (e->>'valor')::numeric > 0 then
        insert into alocacoes_valor(entregavel_id, valor) values (eid, (e->>'valor')::numeric);
      end if;
      for a in select * from jsonb_array_elements(coalesce(e->'atividades', '[]'::jsonb)) loop
        insert into atividades(entregavel_id, projeto_id, nome, responsavel_id, responsabilidade, logistica, data_prevista, status, local, horas_previstas, participantes, pendencia)
        values (eid, p_projeto, left(a->>'nome', 500), nullif(a->>'responsavel_id','')::uuid,
                coalesce(nullif(a->>'responsabilidade','')::responsavel_tipo, 'conectas'), coalesce((a->>'logistica')::boolean, false),
                nullif(a->>'data_prevista','')::date, coalesce(nullif(a->>'status','')::status_atividade, 'nao_iniciado'),
                nullif(a->>'local',''), nullif(a->>'horas_previstas','')::numeric, nullif(a->>'participantes',''), nullif(a->>'pendencia','')); na := na + 1;
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('macroetapas', nm, 'entregaveis', ne, 'atividades', na);
end $$;


-- ===== 0007_macroetapas_fixas.sql =====
-- Conectas | migração 0007: as 5 macroetapas fixas em todo projeto novo

create or replace function norm_nome(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') $$;

-- Novo projeto já nasce com: Contextualização, Conteúdo, Conexão, Consolidação e Concretização
create or replace function criar_projeto(
  p_codigo text, p_cliente uuid, p_nome text, p_descricao text, p_responsavel uuid, p_apoio uuid,
  p_inicio date, p_fim date) returns uuid language plpgsql security definer set search_path = public as $$
declare u perfis; pid uuid; eid uuid; n text; i int := 0;
begin
  select * into u from perfis where id=auth.uid() and ativo and papel in ('admin','gestora');
  if u.id is null then raise exception 'sem permissão para criar projeto'; end if;
  if u.papel='gestora' and p_responsavel is distinct from u.id and p_apoio is distinct from u.id then
    raise exception 'gestoras criam projetos em que são responsáveis ou apoio';
  end if;
  insert into projetos(codigo, cliente_id, nome, descricao, responsavel_id, apoio_id, inicio_previsto, fim_previsto, situacao, criado_por)
  values (p_codigo, p_cliente, p_nome, p_descricao, p_responsavel, p_apoio, p_inicio, p_fim, 'planejamento', u.id) returning id into pid;
  insert into escopos(projeto_id, versao, tipo, motivo, registrado_por) values (pid, 1, 'contratado', 'Escopo original da venda', u.id) returning id into eid;
  update projetos set escopo_vigente_id = eid where id = pid;
  foreach n in array array['Contextualização','Conteúdo','Conexão','Consolidação','Concretização'] loop
    i := i + 1;
    insert into macroetapas(escopo_id, projeto_id, nome, ordem) values (eid, pid, n, i);
  end loop;
  return pid;
end $$;

create or replace function importar_estrutura(p_projeto uuid, p_dados jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare esc uuid; m jsonb; e jsonb; a jsonb; mid uuid; eid uuid; mi int := 0; nm int := 0; ne int := 0; na int := 0;
        pode_valor boolean;
begin
  if not pode_editar_projeto(p_projeto) then raise exception 'sem permissão para editar este projeto'; end if;
  select escopo_vigente_id into esc from projetos where id = p_projeto;
  if esc is null then raise exception 'projeto sem escopo vigente'; end if;
  pode_valor := meu_fin() in ('editar','validar');
  perform set_config('app.silencioso', 'on', true);
  for m in select * from jsonb_array_elements(coalesce(p_dados->'macroetapas', '[]'::jsonb)) loop
    mi := mi + 1;
    select id into mid from macroetapas where escopo_id = esc and norm_nome(nome) = norm_nome(m->>'nome') limit 1;
    if mid is null then
      insert into macroetapas(escopo_id, projeto_id, nome, ordem) values (esc, p_projeto, left(m->>'nome', 300), 5 + mi) returning id into mid; nm := nm + 1;
    end if;
    for e in select * from jsonb_array_elements(coalesce(m->'entregaveis', '[]'::jsonb)) loop
      insert into entregaveis(macroetapa_id, projeto_id, escopo_id, nome, quantidade, data_prevista, status, gera_receita)
      values (mid, p_projeto, esc, left(e->>'nome', 300), greatest(coalesce((e->>'quantidade')::int, 1), 1), nullif(e->>'data_prevista','')::date,
              coalesce(nullif(e->>'status','')::status_atividade, 'nao_iniciado'), coalesce((e->>'gera_receita')::boolean, true)) returning id into eid; ne := ne + 1;
      if pode_valor and nullif(e->>'valor','') is not null and (e->>'valor')::numeric > 0 then
        insert into alocacoes_valor(entregavel_id, valor) values (eid, (e->>'valor')::numeric);
      end if;
      for a in select * from jsonb_array_elements(coalesce(e->'atividades', '[]'::jsonb)) loop
        insert into atividades(entregavel_id, projeto_id, nome, responsavel_id, responsabilidade, logistica, data_prevista, status, local, horas_previstas, participantes, pendencia)
        values (eid, p_projeto, left(a->>'nome', 500), nullif(a->>'responsavel_id','')::uuid,
                coalesce(nullif(a->>'responsabilidade','')::responsavel_tipo, 'conectas'), coalesce((a->>'logistica')::boolean, false),
                nullif(a->>'data_prevista','')::date, coalesce(nullif(a->>'status','')::status_atividade, 'nao_iniciado'),
                nullif(a->>'local',''), nullif(a->>'horas_previstas','')::numeric, nullif(a->>'participantes',''), nullif(a->>'pendencia','')); na := na + 1;
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('macroetapas', nm, 'entregaveis', ne, 'atividades', na);
end $$;


-- ===== 0008_financeiro_reacao_calendario.sql =====
-- Conectas | migração 0008: gestão financeira por projeto (despesas), avaliação de reação e calendário (Outlook)

-- ========== Despesas do projeto ==========
create table if not exists despesas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  categoria text not null,                    -- Logística, Material, Impressão, Passagem, Hospedagem, Transporte, Parceiro, Design, Outros...
  descricao text not null,
  fornecedor text,                            -- parceiro / fornecedor (permite comparar preços)
  data date not null default current_date,
  valor_orcado numeric(14,2) check (valor_orcado >= 0),   -- opcional: se houver, o saving = orçado - gasto
  valor_gasto numeric(14,2) check (valor_gasto >= 0),
  valor_reembolsado numeric(14,2) not null default 0 check (valor_reembolsado >= 0),
  lancado_por uuid references perfis(id) default auth.uid(),
  criado_em timestamptz default now()
);
alter table despesas enable row level security;
drop policy if exists ler_despesas on despesas;
create policy ler_despesas on despesas for select using (meu_papel() in ('admin','gestora','financeiro') or meu_fin() <> 'nenhum');
drop policy if exists esc_despesas on despesas;
create policy esc_despesas on despesas for all using (pode_editar_projeto(projeto_id) or meu_fin() in ('editar','validar'))
  with check (pode_editar_projeto(projeto_id) or meu_fin() in ('editar','validar'));
drop trigger if exists aud_despesas on despesas;
create trigger aud_despesas after insert or update or delete on despesas for each row execute function audit_trigger();

-- ========== Saving vira receita contábil (lançamento manual da administração) ==========
alter table eventos_receita alter column entregavel_id drop not null;
alter table eventos_receita add column if not exists origem text not null default 'entrega' check (origem in ('entrega','saving'));
alter table eventos_receita add column if not exists descricao text;

create or replace function lancar_saving(p_projeto uuid, p_valor numeric, p_descricao text) returns void language plpgsql security definer set search_path = public as $$
begin
  if meu_fin() <> 'validar' then raise exception 'sem permissão para lançar receita'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'informe um valor maior que zero'; end if;
  insert into eventos_receita(projeto_id, entregavel_id, valor, competencia, status, origem, descricao, confirmado_por, confirmado_em, validado_por, validado_em)
  values (p_projeto, null, p_valor, date_trunc('month', current_date)::date, 'reconhecida', 'saving', coalesce(nullif(p_descricao,''), 'Saving do projeto'), auth.uid(), now(), auth.uid(), now());
end $$;

-- ========== Avaliação de reação (pode vir de arquivo enviado pelo cliente) ==========
create table if not exists avaliacoes_reacao (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  entregavel_id uuid references entregaveis(id) on delete set null,
  consultor_id uuid references perfis(id),
  consultor_nome text,                                -- para consultores/experts sem cadastro
  data date not null default current_date,
  nota numeric(5,2) not null check (nota >= 0),
  escala_max numeric(5,2) not null check (escala_max > 0),   -- ex.: 5 ou 10
  respostas int check (respostas >= 0),
  origem text not null default 'conectas' check (origem in ('conectas','cliente')),
  arquivo_path text,                                  -- arquivo original no armazenamento
  observacao text,
  registrado_por uuid references perfis(id) default auth.uid(),
  criado_em timestamptz default now(),
  check (nota <= escala_max)
);
alter table avaliacoes_reacao enable row level security;
drop policy if exists ler_reacao on avaliacoes_reacao;
create policy ler_reacao on avaliacoes_reacao for select using (meu_papel() is not null);
drop policy if exists esc_reacao on avaliacoes_reacao;
create policy esc_reacao on avaliacoes_reacao for all using (pode_editar_projeto(projeto_id)) with check (pode_editar_projeto(projeto_id));
drop trigger if exists aud_avaliacoes_reacao on avaliacoes_reacao;
create trigger aud_avaliacoes_reacao after insert or update or delete on avaliacoes_reacao for each row execute function audit_trigger();

-- Armazenamento privado dos arquivos de avaliação
insert into storage.buckets (id, name, public) values ('avaliacoes', 'avaliacoes', false) on conflict (id) do nothing;
drop policy if exists avaliacoes_ler on storage.objects;
create policy avaliacoes_ler on storage.objects for select to authenticated using (bucket_id = 'avaliacoes' and meu_papel() is not null);
drop policy if exists avaliacoes_enviar on storage.objects;
create policy avaliacoes_enviar on storage.objects for insert to authenticated with check (bucket_id = 'avaliacoes' and meu_papel() in ('admin','gestora'));

-- ========== Calendário assinado no Outlook (link privado por pessoa) ==========
create table if not exists calendario_tokens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfis(id) on delete cascade default auth.uid(),
  tipo text not null check (tipo in ('minhas','geral')),
  token uuid not null unique default gen_random_uuid(),
  criado_em timestamptz default now(),
  unique (usuario_id, tipo)
);
alter table calendario_tokens enable row level security;
drop policy if exists tokens_dono on calendario_tokens;
create policy tokens_dono on calendario_tokens for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());


-- ===== 0009_cronograma_permissoes_alertas.sql =====
-- Conectas | migração 0009: cronograma com receita por linha, status automático, permissões por pessoa e por projeto,
-- contatos externos, código automático, transferência de GP, capacidade, localização do PAX, histórico com alertas

-- ========== Projeto: prioridade, logística (nossa/do cliente), código automático ==========
alter table projetos add column if not exists prioridade prioridade not null default 'media';
alter table projetos add column if not exists logistica_por text check (logistica_por in ('conectas','cliente','compartilhada'));
alter table projetos add column if not exists logistica_obs text;

create or replace function proximo_codigo() returns text language plpgsql security definer set search_path = public as $$
declare ano text := to_char(current_date, 'YYYY'); n int;
begin
  select coalesce(max(substring(codigo from '^CNX-' || ano || '-(\d+)$')::int), 0) + 1 into n from projetos where codigo ~ ('^CNX-' || ano || '-\d+$');
  return 'CNX-' || ano || '-' || lpad(n::text, 3, '0');
end $$;

-- ========== Contatos externos (cliente, parceiros, especialistas) ==========
create table if not exists contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null, email text, organizacao text,
  tipo text not null default 'cliente' check (tipo in ('cliente','terceiro','especialista')),
  ativo boolean not null default true, criado_em timestamptz default now()
);
alter table contatos enable row level security;
drop policy if exists ler_contatos on contatos;
create policy ler_contatos on contatos for select using (meu_papel() is not null);
drop policy if exists esc_contatos on contatos;
create policy esc_contatos on contatos for all using (meu_papel() in ('admin','gestora')) with check (meu_papel() in ('admin','gestora'));

-- ========== Cronograma: cada linha tem valor e pode gerar receita ==========
alter table atividades add column if not exists valor numeric(14,2) check (valor >= 0);
alter table atividades add column if not exists gera_receita boolean not null default false;
alter table atividades add column if not exists contato_id uuid references contatos(id);
alter table entregaveis add column if not exists uf text;
alter table entregaveis add column if not exists cidade text;

alter table eventos_receita add column if not exists atividade_id uuid references atividades(id) on delete set null;
alter table eventos_receita drop constraint if exists eventos_receita_origem_check;
alter table eventos_receita add constraint eventos_receita_origem_check check (origem in ('entrega','saving','atividade'));
create unique index if not exists uq_evento_receita_atividade on eventos_receita(atividade_id) where atividade_id is not null and status in ('pendente','reconhecida');

-- Concluir uma linha do cronograma com valor cria 1 evento pendente (a validação continua com quem tem "editar e validar")
create or replace function receita_por_atividade() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' and new.gera_receita and coalesce(new.valor, 0) > 0 then
    insert into eventos_receita(projeto_id, entregavel_id, atividade_id, origem, descricao, valor, competencia, confirmado_por, confirmado_em)
    values (new.projeto_id, null, new.id, 'atividade', new.nome, new.valor, date_trunc('month', current_date)::date, auth.uid(), now())
    on conflict do nothing;
  elsif old.status = 'concluido' and new.status <> 'concluido' then
    update eventos_receita set status = 'estornada' where atividade_id = new.id and status = 'pendente';
  end if;
  return null;
end $$;
drop trigger if exists rec_atividade on atividades;
create trigger rec_atividade after update of status on atividades for each row execute function receita_por_atividade();

-- Entrega confirmada manualmente não duplica a receita quando o valor está nas linhas do cronograma
create or replace function confirmar_entrega(p_entregavel uuid) returns void language plpgsql security definer set search_path = public as $$
declare e entregaveis; v numeric;
begin
  select * into e from entregaveis where id = p_entregavel;
  if e.id is null then raise exception 'entregável inexistente'; end if;
  if not pode_editar_projeto(e.projeto_id) then raise exception 'sem permissão para confirmar entrega deste projeto'; end if;
  if not exists (select 1 from perfis where id=auth.uid() and ativo and papel in ('admin','gestora')) then
    raise exception 'sem permissão para confirmar entrega'; end if;
  update entregaveis set status='concluido', data_realizada=current_date where id=p_entregavel;
  if e.gera_receita and not exists (select 1 from atividades where entregavel_id = p_entregavel and gera_receita and coalesce(valor,0) > 0) then
    select valor into v from alocacoes_valor where entregavel_id = p_entregavel;
    if v is not null then
      insert into eventos_receita(projeto_id, entregavel_id, valor, competencia, confirmado_por, confirmado_em)
      values (e.projeto_id, p_entregavel, v, date_trunc('month', current_date)::date, auth.uid(), now())
      on conflict do nothing;
    end if;
  end if;
end $$;

-- ========== Status do entregável calculado pelas atividades ==========
create or replace function recalcular_entregavel() returns trigger language plpgsql security definer set search_path = public as $$
declare eid uuid; ativas int; conc int; andam int; ult date; novo status_atividade;
begin
  eid := coalesce(new.entregavel_id, old.entregavel_id);
  select count(*) filter (where status <> 'cancelado'), count(*) filter (where status = 'concluido'),
         count(*) filter (where status in ('em_andamento','aguardando_cliente','aguardando_terceiro')),
         max(data_realizada) filter (where status = 'concluido')
    into ativas, conc, andam, ult from atividades where entregavel_id = eid;
  if not exists (select 1 from atividades where entregavel_id = eid) then return null; end if;
  novo := case when ativas = 0 then 'cancelado' when conc = ativas then 'concluido'
               when conc > 0 or andam > 0 then 'em_andamento' else 'nao_iniciado' end;
  update entregaveis set status = novo, data_realizada = case when novo = 'concluido' then coalesce(ult, current_date) else null end
   where id = eid and (status is distinct from novo);
  return null;
end $$;
drop trigger if exists status_entregavel on atividades;
create trigger status_entregavel after insert or update of status or delete on atividades for each row execute function recalcular_entregavel();

-- ========== Permissões por pessoa ==========
alter table perfis add column if not exists acesso_projetos text not null default 'todos' check (acesso_projetos in ('todos','selecionados'));
alter table perfis add column if not exists ver_geral boolean not null default true;
alter table perfis add column if not exists ver_impactometro boolean not null default true;
alter table perfis add column if not exists ver_pax_consultor boolean not null default false;
alter table perfis add column if not exists ver_capacidade boolean not null default false;
alter table perfis add column if not exists carga_horas_mes numeric(6,1) not null default 176;
update perfis set ver_pax_consultor = true, ver_capacidade = true where papel = 'admin';
update perfis set ver_capacidade = true where papel = 'gestora';

create table if not exists acessos_projeto (
  usuario_id uuid not null references perfis(id) on delete cascade,
  projeto_id uuid not null references projetos(id) on delete cascade,
  nivel text not null default 'ver' check (nivel in ('ver','editar')),
  primary key (usuario_id, projeto_id)
);
alter table acessos_projeto enable row level security;
drop policy if exists ler_acessos on acessos_projeto;
create policy ler_acessos on acessos_projeto for select using (usuario_id = auth.uid() or meu_papel() = 'admin');
drop policy if exists ger_acessos on acessos_projeto;
create policy ger_acessos on acessos_projeto for all using (meu_papel() = 'admin') with check (meu_papel() = 'admin');
drop trigger if exists aud_acessos on acessos_projeto;
create trigger aud_acessos after insert or update or delete on acessos_projeto for each row execute function audit_trigger();

create or replace function pode_editar_projeto(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis u where u.id=auth.uid() and u.ativo and u.papel='admin')
      or exists (select 1 from acessos_projeto a join perfis u on u.id=a.usuario_id and u.ativo where a.usuario_id=auth.uid() and a.projeto_id=p and a.nivel='editar')
      or exists (select 1 from projetos pr join perfis u on u.id=auth.uid() and u.ativo and u.papel='gestora'
                 where pr.id=p and (pr.responsavel_id=u.id or pr.apoio_id=u.id
                   or exists (select 1 from substituicoes s where s.substituta_id=u.id and s.ausente_id in (pr.responsavel_id, pr.apoio_id) and current_date between s.inicio and s.fim)))
$$;

create or replace function vejo_projeto(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis u where u.id=auth.uid() and u.ativo and (u.papel='admin' or u.acesso_projetos='todos'))
      or exists (select 1 from acessos_projeto a where a.usuario_id=auth.uid() and a.projeto_id=p)
      or exists (select 1 from projetos pr where pr.id=p and auth.uid() in (pr.responsavel_id, pr.apoio_id))
      or exists (select 1 from atividades x where x.projeto_id=p and x.responsavel_id=auth.uid())
      or exists (select 1 from entregaveis x where x.projeto_id=p and x.responsavel_id=auth.uid())
      or pode_editar_projeto(p)
$$;

drop policy if exists ler_projetos on projetos;      create policy ler_projetos on projetos for select using (vejo_projeto(id));
drop policy if exists ler_estrutura_esc on escopos;  create policy ler_estrutura_esc on escopos for select using (vejo_projeto(projeto_id));
drop policy if exists ler_macro on macroetapas;      create policy ler_macro on macroetapas for select using (vejo_projeto(projeto_id));
drop policy if exists ler_entreg on entregaveis;     create policy ler_entreg on entregaveis for select using (vejo_projeto(projeto_id));
drop policy if exists ler_ativ on atividades;        create policy ler_ativ on atividades for select using (vejo_projeto(projeto_id));
drop policy if exists ler_despesas on despesas;
create policy ler_despesas on despesas for select using (vejo_projeto(projeto_id) and (meu_papel() in ('admin','gestora','financeiro') or meu_fin() <> 'nenhum'));

-- ========== Transferir projetos (férias, desligamento) ==========
create or replace function transferir_projetos(p_de uuid, p_para uuid, p_projeto uuid default null) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from perfis where id = p_para and ativo) then raise exception 'destino inválido'; end if;
  if not (exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'admin')
          or (p_de = auth.uid() and exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'gestora'))) then
    raise exception 'sem permissão para transferir estes projetos'; end if;
  update projetos set responsavel_id = p_para where responsavel_id = p_de and (p_projeto is null or id = p_projeto)
     and situacao not in ('concluido','cancelado');
  get diagnostics n = row_count;
  return n;
end $$;

-- ========== Código automático no novo projeto ==========
create or replace function criar_projeto(
  p_codigo text, p_cliente uuid, p_nome text, p_descricao text, p_responsavel uuid, p_apoio uuid,
  p_inicio date, p_fim date) returns uuid language plpgsql security definer set search_path = public as $$
declare u perfis; pid uuid; eid uuid; n text; i int := 0; cod text;
begin
  select * into u from perfis where id=auth.uid() and ativo and papel in ('admin','gestora');
  if u.id is null then raise exception 'sem permissão para criar projeto'; end if;
  if u.papel='gestora' and p_responsavel is distinct from u.id and p_apoio is distinct from u.id then
    raise exception 'gestoras criam projetos em que são GP ou líder técnico';
  end if;
  cod := coalesce(nullif(trim(p_codigo), ''), proximo_codigo());
  insert into projetos(codigo, cliente_id, nome, descricao, responsavel_id, apoio_id, inicio_previsto, fim_previsto, situacao, criado_por)
  values (cod, p_cliente, p_nome, p_descricao, p_responsavel, p_apoio, p_inicio, p_fim, 'planejamento', u.id) returning id into pid;
  insert into escopos(projeto_id, versao, tipo, motivo, registrado_por) values (pid, 1, 'contratado', 'Escopo original da venda', u.id) returning id into eid;
  update projetos set escopo_vigente_id = eid where id = pid;
  foreach n in array array['Contextualização','Conteúdo','Conexão','Consolidação','Concretização'] loop
    i := i + 1;
    insert into macroetapas(escopo_id, projeto_id, nome, ordem) values (eid, pid, n, i);
  end loop;
  return pid;
end $$;

-- ========== Histórico do projeto (alterações + alertas) visível ao GP e a quem edita ==========
create or replace function historico_projeto(p_projeto uuid)
returns table(em timestamptz, tabela text, acao text, resumo text, usuario_id uuid) language sql stable security definer set search_path = public as $$
  select a.em, a.tabela, a.acao, coalesce(a.depois->>'nome', a.antes->>'nome', a.depois->>'descricao', ''), a.usuario_id
    from audit_log a
   where pode_editar_projeto(p_projeto)
     and a.tabela in ('projetos','macroetapas','entregaveis','atividades','despesas','eventos_receita')
     and (a.registro_id = p_projeto::text or a.depois->>'projeto_id' = p_projeto::text or a.antes->>'projeto_id' = p_projeto::text)
   order by a.em desc limit 300
$$;

create or replace function historico_alertas(p_projeto uuid)
returns table(criado_em timestamptz, para text, assunto text, tipo text, enviado_em timestamptz, erro text) language sql stable security definer set search_path = public as $$
  select f.criado_em, f.para, f.assunto, f.tipo, f.enviado_em, f.erro
    from email_fila f
   where pode_editar_projeto(p_projeto)
     and ((f.ref_tabela = 'atividades' and f.ref_id in (select id from atividades where projeto_id = p_projeto))
       or (f.ref_tabela = 'entregaveis' and f.ref_id in (select id from entregaveis where projeto_id = p_projeto)))
   order by f.criado_em desc limit 300
$$;

-- ========== Agenda do Outlook (Microsoft Graph): guarda o evento criado para atualizar/remover depois ==========
create table if not exists agenda_graph (
  ref_tabela text not null, ref_id uuid not null, email text not null, graph_id text not null,
  atualizado_em timestamptz default now(), primary key (ref_tabela, ref_id, email)
);
alter table agenda_graph enable row level security;   -- sem policies: só o servidor
-- e-mail enfileirado pode ter destinatário externo (contato) e cópia
alter table email_fila add column if not exists cc text;

-- ========== Alertas passam a sair das linhas do cronograma (atividades) ==========
-- Entregáveis não avisam mais na criação (as linhas do cronograma avisam), evitando e-mail em duplicidade.
create or replace function notificar_atribuicao() returns trigger language plpgsql security definer set search_path = public as $$
declare dest perfis; pnome text; quando text;
begin
  if tg_table_name = 'entregaveis' then return null; end if;
  if coalesce(current_setting('app.silencioso', true), '') = 'on' then return null; end if;
  if new.responsavel_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.responsavel_id is not distinct from new.responsavel_id
     and old.data_prevista is not distinct from new.data_prevista
     and old.hora_prevista is not distinct from new.hora_prevista then return null; end if;
  if new.responsavel_id = auth.uid() then return null; end if;
  select * into dest from perfis where id = new.responsavel_id and ativo;
  if dest.id is null then return null; end if;
  -- várias linhas criadas de uma vez (ex.: entregável com quantidade 10) geram um único aviso
  if exists (select 1 from notificacoes n where n.usuario_id = dest.id and n.link = '/projetos/' || new.projeto_id and n.criado_em > now() - interval '2 minutes') then return null; end if;
  select nome into pnome from projetos where id = new.projeto_id;
  quando := case when new.data_prevista is null then 'sem prazo definido'
                 else 'prazo ' || to_char(new.data_prevista, 'DD/MM/YYYY') || coalesce(' às ' || to_char(new.hora_prevista, 'HH24:MI'), '') end;
  insert into notificacoes(usuario_id, texto, link)
    values (dest.id, format('Nova tarefa: "%s" (%s), %s.', new.nome, pnome, quando), '/projetos/' || new.projeto_id);
  insert into email_fila(usuario_id, para, assunto, corpo, tipo, ref_tabela, ref_id)
    values (dest.id, dest.email, format('Conectas: nova tarefa "%s"', new.nome),
            format('Olá, %s. Você recebeu a tarefa "%s" do projeto "%s", %s.', dest.nome, new.nome, pnome, quando),
            'criacao', 'atividades', new.id);
  return null;
end $$;
