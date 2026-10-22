-- Conectas | migração 0010: listas configuráveis do sistema (macroetapas padrão, categorias de despesa, classificação do projeto e entregáveis) editáveis apenas por admin

create table if not exists opcoes_sistema (
  id uuid primary key default gen_random_uuid(),
  grupo text not null, -- 'macroetapa_padrao' | 'categoria_despesa' | 'tipo_projeto' (Classificação do projeto)
  nome text not null,
  ordem integer not null default 1,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (grupo, nome)
);

alter table atividades add column if not exists tipo_id uuid references tipos_entregavel(id);

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

delete from opcoes_sistema where grupo = 'subtipo_projeto';

insert into tipos_entregavel (nome) values
  ('Team Building'),
  ('PDL'),
  ('Coaching'),
  ('Assessment'),
  ('Assessment (MBTI)'),
  ('Treinamento Indoor'),
  ('Treinamento Outdoor'),
  ('PDE'),
  ('Diagnóstico'),
  ('Cargos e Salários'),
  ('Onboarding'),
  ('Entrevista'),
  ('Focus group'),
  ('Visita de campo'),
  ('Workshop'),
  ('Programa de desenvolvimento de liderança'),
  ('Mentoria'),
  ('Material instrucional'),
  ('Podcast'),
  ('Vídeo'),
  ('Reunião de alinhamento'),
  ('Kickoff'),
  ('Gestão de projeto'),
  ('Outro')
on conflict (nome) do nothing;

insert into opcoes_sistema (grupo, nome, ordem) values
  ('tipo_projeto', 'Palestra', 1),
  ('tipo_projeto', 'Projeto', 2),
  ('tipo_projeto', 'Programa', 3),
  ('tipo_projeto', 'Workshop', 4),
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
