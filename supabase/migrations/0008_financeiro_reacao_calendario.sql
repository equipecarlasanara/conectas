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
