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
