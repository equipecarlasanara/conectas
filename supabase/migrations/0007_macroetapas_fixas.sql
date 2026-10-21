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
