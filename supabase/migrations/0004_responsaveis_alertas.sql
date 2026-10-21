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
