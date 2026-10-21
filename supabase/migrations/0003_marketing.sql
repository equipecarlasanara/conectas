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
