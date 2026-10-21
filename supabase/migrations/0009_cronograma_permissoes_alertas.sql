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
