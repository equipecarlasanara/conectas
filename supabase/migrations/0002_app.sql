-- Conectas | migração 0002: criação automática de perfil, tipos iniciais, criação de projeto

-- Primeiro usuário criado vira admin com permissão financeira total; demais entram como gestora sem acesso financeiro.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  select not exists (select 1 from perfis) into primeiro;
  insert into perfis(id, nome, email, papel, fin)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          new.email,
          case when primeiro then 'admin'::papel else 'gestora'::papel end,
          case when primeiro then 'validar'::nivel_fin else 'nenhum'::nivel_fin end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Tipos de entregável configuráveis (editáveis depois sem código)
insert into tipos_entregavel(nome) values
 ('Diagnóstico'),('Entrevista'),('Focus group'),('Assessment (MBTI)'),('Visita de campo'),('Workshop'),
 ('Programa de desenvolvimento de liderança'),('Mentoria'),('Material instrucional'),('Podcast'),('Vídeo'),
 ('Reunião de alinhamento'),('Kickoff'),('Gestão de projeto'),('Outro')
on conflict (nome) do nothing;

-- Criação de projeto + escopo contratado v1 em uma operação
create or replace function criar_projeto(
  p_codigo text, p_cliente uuid, p_nome text, p_descricao text, p_responsavel uuid, p_apoio uuid,
  p_inicio date, p_fim date) returns uuid language plpgsql security definer set search_path = public as $$
declare u perfis; pid uuid; eid uuid;
begin
  select * into u from perfis where id=auth.uid() and ativo and papel in ('admin','gestora');
  if u.id is null then raise exception 'sem permissão para criar projeto'; end if;
  -- gestora só atribui responsável por conta própria; admin atribui qualquer pessoa
  if u.papel='gestora' and p_responsavel is distinct from u.id and p_apoio is distinct from u.id then
    raise exception 'gestoras criam projetos em que são responsáveis ou apoio';
  end if;
  insert into projetos(codigo, cliente_id, nome, descricao, responsavel_id, apoio_id, inicio_previsto, fim_previsto, situacao, criado_por)
  values (p_codigo, p_cliente, p_nome, p_descricao, p_responsavel, p_apoio, p_inicio, p_fim, 'planejamento', u.id) returning id into pid;
  insert into escopos(projeto_id, versao, tipo, motivo, registrado_por) values (pid, 1, 'contratado', 'Escopo original da venda', u.id) returning id into eid;
  update projetos set escopo_vigente_id = eid where id = pid;
  return pid;
end $$;

-- Confirmar entrega: exige papel admin/gestora E edição no projeto (substituições valem)
create or replace function confirmar_entrega(p_entregavel uuid) returns void language plpgsql security definer set search_path = public as $$
declare e entregaveis; v numeric;
begin
  select * into e from entregaveis where id = p_entregavel;
  if e.id is null then raise exception 'entregável inexistente'; end if;
  if not pode_editar_projeto(e.projeto_id) then raise exception 'sem permissão para confirmar entrega deste projeto'; end if;
  if not exists (select 1 from perfis where id=auth.uid() and ativo and papel in ('admin','gestora')) then
    raise exception 'sem permissão para confirmar entrega'; end if;
  update entregaveis set status='concluido', data_realizada=current_date where id=p_entregavel;
  if e.gera_receita then
    select valor into v from alocacoes_valor where entregavel_id = p_entregavel;
    if v is not null then
      insert into eventos_receita(projeto_id, entregavel_id, valor, competencia, confirmado_por, confirmado_em)
      values (e.projeto_id, p_entregavel, v, date_trunc('month', current_date)::date, auth.uid(), now())
      on conflict do nothing;
    end if;
  end if;
end $$;
