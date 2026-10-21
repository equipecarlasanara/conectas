-- Conectas | Gestão de Projetos e Receita Contábil — schema v1 (PostgreSQL / Supabase)
-- Dinheiro sempre em numeric(14,2). Nada é apagado: histórico via audit_log.

create extension if not exists pgcrypto;

-- ========== Perfis e usuários ==========
create type papel as enum ('admin','gestora','instrucional','comercial','financeiro');
create type nivel_fin as enum ('nenhum','ver','editar','validar'); -- ver != editar != validar

create table perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel papel not null default 'gestora',
  fin nivel_fin not null default 'nenhum',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Substituição temporária (férias): substituta ganha acesso de edição aos projetos da ausente
create table substituicoes (
  id uuid primary key default gen_random_uuid(),
  ausente_id uuid not null references perfis(id),
  substituta_id uuid not null references perfis(id),
  inicio date not null, fim date not null,
  criado_por uuid references perfis(id), criado_em timestamptz default now(),
  check (fim >= inicio), check (ausente_id <> substituta_id)
);

-- ========== Cadastros ==========
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, documento text, observacoes text,
  criado_em timestamptz default now()
);

create type situacao_projeto as enum ('em_recebimento','planejamento','em_execucao','pausado','concluido','cancelado');

create table projetos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                 -- identificador único
  cliente_id uuid not null references clientes(id),
  nome text not null,
  descricao text, objetivo text,
  responsavel_id uuid references perfis(id),
  apoio_id uuid references perfis(id),
  inicio_previsto date, fim_previsto date,
  situacao situacao_projeto not null default 'em_recebimento',
  resp_conectas text, resp_cliente text, observacoes text,
  escopo_vigente_id uuid,                      -- FK adicionada abaixo
  criado_por uuid references perfis(id), criado_em timestamptz default now()
);

-- Dados financeiros em tabela separada (RLS própria)
create table projeto_financeiro (
  projeto_id uuid primary key references projetos(id) on delete cascade,
  valor_contratado numeric(14,2) not null default 0 check (valor_contratado >= 0)
);

-- ========== Versões de escopo ==========
create type tipo_escopo as enum ('contratado','operacional');
create table escopos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  versao int not null,
  tipo tipo_escopo not null,
  motivo text, registrado_por uuid references perfis(id),
  aprovado_por uuid references perfis(id), aprovado_em timestamptz,
  criado_em timestamptz default now(),
  unique (projeto_id, versao)
);
alter table projetos add constraint fk_escopo_vigente foreign key (escopo_vigente_id) references escopos(id);

create table macroetapas (
  id uuid primary key default gen_random_uuid(),
  escopo_id uuid not null references escopos(id) on delete cascade,
  projeto_id uuid not null references projetos(id) on delete cascade,
  nome text not null, ordem int not null default 0
);

create type tipo_entregavel_enum as enum ('entrevista','focus_group','assessment','workshop','mentoria','pdl','visita_campo','material','podcast','video','reuniao','gestao','outro');
-- tipos configuráveis sem código:
create table tipos_entregavel (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique, ativo boolean default true
);

create type status_atividade as enum ('nao_iniciado','planejado','em_andamento','aguardando_cliente','aguardando_terceiro','concluido','cancelado');

create table entregaveis (
  id uuid primary key default gen_random_uuid(),
  macroetapa_id uuid not null references macroetapas(id) on delete cascade,
  projeto_id uuid not null references projetos(id) on delete cascade,
  escopo_id uuid not null references escopos(id),
  tipo_id uuid references tipos_entregavel(id),
  nome text not null, quantidade int not null default 1 check (quantidade > 0),
  data_prevista date, data_realizada date,
  status status_atividade not null default 'nao_iniciado',
  gera_receita boolean not null default true,   -- marco de reconhecimento?
  origem_id uuid references entregaveis(id)     -- item equivalente no escopo anterior
);

-- Valor por entregável (por escopo). Soma por escopo deve igualar o total aprovado.
create table alocacoes_valor (
  id uuid primary key default gen_random_uuid(),
  entregavel_id uuid not null unique references entregaveis(id) on delete cascade,
  valor numeric(14,2) not null check (valor >= 0)
);

create type responsavel_tipo as enum ('conectas','cliente','terceiro');
create type prioridade as enum ('baixa','media','alta');

create table atividades (
  id uuid primary key default gen_random_uuid(),
  entregavel_id uuid not null references entregaveis(id) on delete cascade,
  projeto_id uuid not null references projetos(id) on delete cascade,
  nome text not null, descricao text,
  responsavel_id uuid references perfis(id),
  responsabilidade responsavel_tipo not null default 'conectas',
  logistica boolean not null default false,
  data_prevista date, data_realizada date,
  status status_atividade not null default 'nao_iniciado',
  prioridade prioridade not null default 'media',
  checklist jsonb not null default '[]',
  pendencia text,
  criado_em timestamptz default now()
);
create table dependencias (
  atividade_id uuid references atividades(id) on delete cascade,
  depende_de uuid references atividades(id) on delete cascade,
  primary key (atividade_id, depende_de), check (atividade_id <> depende_de)
);

create table comentarios (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  atividade_id uuid references atividades(id) on delete cascade,
  autor_id uuid references perfis(id), texto text not null, criado_em timestamptz default now()
);

-- ========== Mudanças de escopo ==========
create type decisao_valor as enum ('manter_redistribuir','alterar_valor','pendente');
create table mudancas_escopo (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  escopo_de uuid not null references escopos(id),
  escopo_para uuid not null references escopos(id),
  motivo text not null,
  decisao_valor decisao_valor not null default 'pendente',
  valor_total_antes numeric(14,2), valor_total_depois numeric(14,2),
  registrado_por uuid references perfis(id),
  aprovado_por uuid references perfis(id), aprovado_em timestamptz,
  criado_em timestamptz default now()
);

-- ========== Receita (conceitos separados) ==========
-- valor vendido = projeto_financeiro.valor_contratado
-- previsto      = alocacoes_valor do escopo vigente
-- reconhecido   = eventos_receita.status = 'reconhecida'
-- faturado / recebido = tabelas próprias (integração Financeiro futura)
create type status_receita as enum ('pendente','reconhecida','rejeitada','estornada');
create table eventos_receita (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  entregavel_id uuid not null references entregaveis(id),
  valor numeric(14,2) not null check (valor >= 0),
  competencia date,
  status status_receita not null default 'pendente',
  confirmado_por uuid references perfis(id), confirmado_em timestamptz,
  validado_por uuid references perfis(id), validado_em timestamptz,
  criado_em timestamptz default now()
);
-- Sem duplicidade: um único evento ativo por entregável
create unique index uq_evento_receita_ativo on eventos_receita(entregavel_id) where status in ('pendente','reconhecida');

create table faturamentos (id uuid primary key default gen_random_uuid(), projeto_id uuid references projetos(id), valor numeric(14,2) not null, data date, referencia text);
create table recebimentos (id uuid primary key default gen_random_uuid(), projeto_id uuid references projetos(id), valor numeric(14,2) not null, data date, referencia text);
create table metas_receita (mes date primary key, valor numeric(14,2) not null);

-- ========== Desenvolvimento instrucional ==========
create table demandas_instrucionais (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id), entregavel_id uuid references entregaveis(id),
  tipo_material text not null, descricao text,
  responsavel_id uuid references perfis(id),
  solicitada_em date default current_date, prazo date,
  prioridade prioridade default 'media', status status_atividade default 'nao_iniciado',
  esforco_horas numeric(6,1), horas_realizadas numeric(6,1),
  revisoes int default 0, aprovado_por uuid references perfis(id), aprovado_em timestamptz
);

-- ========== Documentos ==========
create type tipo_documento as enum ('proposta','resumo_entregaveis','precificacao','cronograma','ata','acordo_alteracao','material_instrucional','comprovante','outro');
create table documentos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id), cliente_id uuid references clientes(id),
  tipo tipo_documento not null, nome text not null,
  grupo_id uuid not null default gen_random_uuid(),   -- agrupa versões do mesmo documento
  versao int not null default 1, vigente boolean not null default true,
  storage_path text not null, enviado_por uuid references perfis(id), criado_em timestamptz default now()
);

-- ========== Importação assistida ==========
create type status_importacao as enum ('enviada','extraida','em_conferencia','aprovada','descartada');
create table importacoes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references documentos(id),
  status status_importacao default 'enviada',
  extracao jsonb,          -- cada campo: {valor, origem(trecho/página), confiança, pendente}
  corrigido jsonb,
  conferido_por uuid references perfis(id), conferido_em timestamptz,
  projeto_id uuid references projetos(id)
);

create table notificacoes (id uuid primary key default gen_random_uuid(), usuario_id uuid references perfis(id), texto text, link text, lida boolean default false, criado_em timestamptz default now());

-- ========== Auditoria (imutável) ==========
create table audit_log (
  id bigint generated always as identity primary key,
  tabela text not null, registro_id text, acao text not null,
  antes jsonb, depois jsonb, usuario_id uuid, em timestamptz not null default now()
);
create function audit_trigger() returns trigger language plpgsql security definer as $$
begin
  insert into audit_log(tabela, registro_id, acao, antes, depois, usuario_id)
  values (tg_table_name,
          coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'projeto_id'),
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          auth.uid());
  return null;
end $$;
create function audit_imutavel() returns trigger language plpgsql as $$
begin raise exception 'audit_log é imutável'; end $$;
create trigger audit_no_change before update or delete on audit_log for each row execute function audit_imutavel();

do $$ declare t text; begin
  foreach t in array array['projetos','projeto_financeiro','escopos','macroetapas','entregaveis','alocacoes_valor','atividades','mudancas_escopo','eventos_receita','documentos','demandas_instrucionais','substituicoes','perfis']
  loop execute format('create trigger aud_%1$s after insert or update or delete on %1$s for each row execute function audit_trigger()', t); end loop;
end $$;

-- ========== Regras de negócio no banco ==========
-- 1) Soma das alocações de um escopo deve igualar o valor total aprovado (checada ao aprovar/redistribuir)
create function total_alocado(p_escopo uuid) returns numeric language sql stable as $$
  select coalesce(sum(a.valor),0) from alocacoes_valor a join entregaveis e on e.id=a.entregavel_id where e.escopo_id=p_escopo $$;

-- 2) Reconhecimento: apenas quem tem fin='validar' e quem confirmou != quem valida opcional (configurável)
create function validar_receita(p_evento uuid) returns void language plpgsql security definer as $$
declare u perfis;
begin
  select * into u from perfis where id = auth.uid() and ativo;
  if u.id is null or u.fin <> 'validar' then raise exception 'sem permissão para validar receita'; end if;
  update eventos_receita set status='reconhecida', validado_por=u.id, validado_em=now()
   where id=p_evento and status='pendente';
  if not found then raise exception 'evento inexistente ou já processado'; end if;
end $$;

-- 3) Confirmar entrega -> cria 1 evento pendente (idempotente pelo índice único)
create function confirmar_entrega(p_entregavel uuid) returns void language plpgsql security definer as $$
declare e entregaveis; u perfis; v numeric;
begin
  select * into u from perfis where id=auth.uid() and ativo and papel in ('admin','gestora');
  if u.id is null then raise exception 'sem permissão para confirmar entrega'; end if;
  select * into e from entregaveis where id=p_entregavel;
  update entregaveis set status='concluido', data_realizada=current_date where id=p_entregavel;
  if e.gera_receita then
    select valor into v from alocacoes_valor where entregavel_id=p_entregavel;
    if v is not null then
      insert into eventos_receita(projeto_id, entregavel_id, valor, competencia, confirmado_por, confirmado_em)
      values (e.projeto_id, p_entregavel, v, date_trunc('month', current_date)::date, u.id, now())
      on conflict do nothing;
    end if;
  end if;
end $$;

-- 4) Redistribuir valor preservando o total (resto de centavos vai ao último item)
create function redistribuir_valor(p_escopo uuid, p_total numeric) returns void language plpgsql security definer as $$
declare ids uuid[]; n int; base numeric; resto numeric; i int;
begin
  if not exists (select 1 from perfis where id=auth.uid() and ativo and fin in ('editar','validar')) then
    raise exception 'sem permissão financeira'; end if;
  select array_agg(id order by id) into ids from entregaveis where escopo_id=p_escopo and gera_receita;
  n := coalesce(array_length(ids,1),0);
  if n=0 then raise exception 'escopo sem entregáveis com receita'; end if;
  base := trunc(p_total/n, 2); resto := p_total - base*n;
  for i in 1..n loop
    insert into alocacoes_valor(entregavel_id, valor) values (ids[i], base + case when i=n then resto else 0 end)
    on conflict (entregavel_id) do update set valor = excluded.valor;
  end loop;
end $$;

-- ========== RLS ==========
create function meu_papel() returns papel language sql stable security definer as $$ select papel from perfis where id=auth.uid() and ativo $$;
create function meu_fin() returns nivel_fin language sql stable security definer as $$ select fin from perfis where id=auth.uid() and ativo $$;
create function pode_editar_projeto(p uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from perfis u where u.id=auth.uid() and u.ativo and u.papel='admin')
      or exists (select 1 from projetos pr join perfis u on u.id=auth.uid() and u.ativo and u.papel='gestora'
                 where pr.id=p and (pr.responsavel_id=u.id or pr.apoio_id=u.id
                   or exists (select 1 from substituicoes s where s.substituta_id=u.id and s.ausente_id in (pr.responsavel_id, pr.apoio_id) and current_date between s.inicio and s.fim)))
$$;

do $$ declare t text; begin
  foreach t in array array['perfis','substituicoes','clientes','projetos','projeto_financeiro','escopos','macroetapas','tipos_entregavel','entregaveis','alocacoes_valor','atividades','dependencias','comentarios','mudancas_escopo','eventos_receita','faturamentos','recebimentos','metas_receita','demandas_instrucionais','documentos','importacoes','notificacoes','audit_log']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

-- Leitura: toda equipe autenticada ativa vê projetos (visibilidade compartilhada)
create policy ler_perfis on perfis for select using (meu_papel() is not null);
create policy ler_clientes on clientes for select using (meu_papel() is not null);
create policy esc_clientes on clientes for all using (meu_papel() in ('admin','gestora')) with check (meu_papel() in ('admin','gestora'));
create policy ler_projetos on projetos for select using (meu_papel() is not null);
create policy ins_projetos on projetos for insert with check (meu_papel() in ('admin','gestora'));
create policy upd_projetos on projetos for update using (pode_editar_projeto(id));
create policy ler_estrutura_esc on escopos for select using (meu_papel() is not null);
create policy ler_macro on macroetapas for select using (meu_papel() is not null);
create policy ler_entreg on entregaveis for select using (meu_papel() is not null);
create policy ler_ativ on atividades for select using (meu_papel() is not null);
create policy esc_escopos on escopos for all using (pode_editar_projeto(projeto_id)) with check (pode_editar_projeto(projeto_id));
create policy esc_macro on macroetapas for all using (pode_editar_projeto(projeto_id)) with check (pode_editar_projeto(projeto_id));
create policy esc_entreg on entregaveis for all using (pode_editar_projeto(projeto_id)) with check (pode_editar_projeto(projeto_id));
create policy esc_ativ on atividades for all using (pode_editar_projeto(projeto_id) or responsavel_id=auth.uid()) with check (pode_editar_projeto(projeto_id) or responsavel_id=auth.uid());
create policy ler_tipos on tipos_entregavel for select using (meu_papel() is not null);
create policy esc_tipos on tipos_entregavel for all using (meu_papel()='admin');
create policy ler_coment on comentarios for select using (meu_papel() is not null);
create policy ins_coment on comentarios for insert with check (autor_id=auth.uid());
create policy ler_dep on dependencias for select using (meu_papel() is not null);
create policy ler_mud on mudancas_escopo for select using (meu_papel() is not null);
create policy esc_mud on mudancas_escopo for all using (pode_editar_projeto(projeto_id)) with check (pode_editar_projeto(projeto_id));

-- Financeiro: visualizar != editar != validar
create policy ler_fin on projeto_financeiro for select using (meu_fin() in ('ver','editar','validar'));
create policy esc_fin on projeto_financeiro for all using (meu_fin() in ('editar','validar')) with check (meu_fin() in ('editar','validar'));
create policy ler_aloc on alocacoes_valor for select using (meu_fin() in ('ver','editar','validar'));
create policy esc_aloc on alocacoes_valor for all using (meu_fin() in ('editar','validar')) with check (meu_fin() in ('editar','validar'));
create policy ler_rec on eventos_receita for select using (meu_fin() in ('ver','editar','validar'));
-- eventos_receita só mudam via funções security definer (sem policy de escrita)
create policy ler_fat on faturamentos for select using (meu_fin() in ('ver','editar','validar'));
create policy ler_recb on recebimentos for select using (meu_fin() in ('ver','editar','validar'));
create policy ler_metas on metas_receita for select using (meu_fin() in ('ver','editar','validar'));
create policy esc_metas on metas_receita for all using (meu_fin() in ('editar','validar'));

create policy ler_dem on demandas_instrucionais for select using (meu_papel() is not null);
create policy esc_dem on demandas_instrucionais for all using (meu_papel() in ('admin','gestora') or responsavel_id=auth.uid());
create policy ler_docs on documentos for select using (meu_papel() is not null);
create policy esc_docs on documentos for insert with check (meu_papel() in ('admin','gestora','instrucional'));
create policy ler_imp on importacoes for select using (meu_papel() in ('admin','gestora'));
create policy esc_imp on importacoes for all using (meu_papel() in ('admin','gestora'));
create policy ler_not on notificacoes for select using (usuario_id=auth.uid());
create policy upd_not on notificacoes for update using (usuario_id=auth.uid());
create policy ler_audit on audit_log for select using (meu_papel()='admin');
create policy ger_perfis on perfis for all using (meu_papel()='admin');
create policy ger_subst on substituicoes for all using (meu_papel()='admin');
create policy ler_subst on substituicoes for select using (meu_papel() is not null);
