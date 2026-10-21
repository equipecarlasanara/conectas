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
