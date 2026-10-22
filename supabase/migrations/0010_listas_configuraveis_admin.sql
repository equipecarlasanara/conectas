-- Conectas | migração 0010: listas configuráveis do sistema (subtipos, tipos de projeto, categorias de despesa, macroetapas padrão) editáveis apenas por admin

create table if not exists opcoes_sistema (
  id uuid primary key default gen_random_uuid(),
  grupo text not null, -- 'subtipo_projeto' | 'tipo_projeto' | 'categoria_despesa' | 'macroetapa_padrao'
  nome text not null,
  ordem integer not null default 1,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (grupo, nome)
);

alter table opcoes_sistema enable row level security;

drop policy if exists "equipe le opcoes_sistema" on opcoes_sistema;
create policy "equipe le opcoes_sistema" on opcoes_sistema
  for select using (exists (select 1 from perfis where id = auth.uid() and ativo));

drop policy if exists "apenas admin edita opcoes_sistema" on opcoes_sistema;
create policy "apenas admin edita opcoes_sistema" on opcoes_sistema
  for all using (exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'admin'))
  with check (exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'admin'));

drop policy if exists "apenas admin edita tipos_entregavel" on tipos_entregavel;
create policy "apenas admin edita tipos_entregavel" on tipos_entregavel
  for all using (exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'admin'))
  with check (exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'admin'));

insert into opcoes_sistema (grupo, nome, ordem) values
  ('subtipo_projeto', 'PDL', 1),
  ('subtipo_projeto', 'Coaching', 2),
  ('subtipo_projeto', 'Assessment', 3),
  ('subtipo_projeto', 'Treinamento Indoor', 4),
  ('subtipo_projeto', 'Treinamento Outdoor', 5),
  ('subtipo_projeto', 'PDE', 6),
  ('subtipo_projeto', 'Team Building', 7),
  ('subtipo_projeto', 'Diagnóstico', 8),
  ('subtipo_projeto', 'Cargos e Salários', 9),
  ('subtipo_projeto', 'Onboarding', 10),
  ('tipo_projeto', 'Palestra', 1),
  ('tipo_projeto', 'Workshop', 2),
  ('tipo_projeto', 'Programa', 3),
  ('tipo_projeto', 'Projeto', 4),
  ('tipo_projeto', 'Consultoria', 5),
  ('categoria_despesa', 'Logística', 1),
  ('categoria_despesa', 'Passagem', 2),
  ('categoria_despesa', 'Hospedagem', 3),
  ('categoria_despesa', 'Transporte', 4),
  ('categoria_despesa', 'Alimentação', 5),
  ('categoria_despesa', 'Material', 6),
  ('categoria_despesa', 'Impressão', 7),
  ('categoria_despesa', 'Parceiro', 8),
  ('categoria_despesa', 'Design', 9),
  ('categoria_despesa', 'Outros', 10),
  ('macroetapa_padrao', 'Contextualização', 1),
  ('macroetapa_padrao', 'Conteúdo', 2),
  ('macroetapa_padrao', 'Conexão', 3),
  ('macroetapa_padrao', 'Consolidação', 4),
  ('macroetapa_padrao', 'Concretização', 5)
on conflict (grupo, nome) do nothing;
