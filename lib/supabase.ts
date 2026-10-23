import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing";
const realSupabase = createClient(url, anon);

const STORAGE_KEY = "conectas_local_db_v2";
const SESSION_KEY = "conectas_local_session_v1";
const authListeners = new Set<(event: string, session: any) => void>();

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function seedDB() {
  const perfis = [
    {
      id: "u-carla",
      nome: "Carla Sanara",
      email: "carla.sanara@conectas.com.br",
      papel: "admin",
      fin: "validar",
      ativo: true,
      acesso_projetos: "todos",
      ver_geral: true,
      ver_impactometro: true,
      ver_pax_consultor: true,
      ver_capacidade: true,
      carga_horas_mes: 176,
    },
    {
      id: "u-ju",
      nome: "Ju Moura",
      email: "ju.moura@conectas.com.br",
      papel: "admin",
      fin: "validar",
      ativo: true,
      acesso_projetos: "todos",
      ver_geral: true,
      ver_impactometro: true,
      ver_pax_consultor: true,
      ver_capacidade: true,
      carga_horas_mes: 176,
    },
    {
      id: "u-financeiro",
      nome: "Financeiro Conectas",
      email: "financeiro@conectas.com.br",
      papel: "admin",
      fin: "validar",
      ativo: true,
      acesso_projetos: "todos",
      ver_geral: true,
      ver_impactometro: true,
      ver_pax_consultor: true,
      ver_capacidade: true,
      carga_horas_mes: 176,
    },
    {
      id: "u-angelica",
      nome: "Angélica",
      email: "angelica@conectas.com.br",
      papel: "gestora",
      fin: "ver",
      ativo: true,
      acesso_projetos: "todos",
      ver_geral: true,
      ver_impactometro: true,
      ver_pax_consultor: false,
      ver_capacidade: true,
      carga_horas_mes: 176,
    },
    {
      id: "u-marcelle",
      nome: "Marcelle",
      email: "marcelle@conectas.com.br",
      papel: "gestora",
      fin: "ver",
      ativo: true,
      acesso_projetos: "todos",
      ver_geral: true,
      ver_impactometro: true,
      ver_pax_consultor: false,
      ver_capacidade: true,
      carga_horas_mes: 176,
    },
    {
      id: "u-rosangela",
      nome: "Rosângela",
      email: "rosangela@conectas.com.br",
      papel: "instrucional",
      fin: "nenhum",
      ativo: true,
      acesso_projetos: "todos",
      ver_geral: true,
      ver_impactometro: true,
      ver_pax_consultor: false,
      ver_capacidade: false,
      carga_horas_mes: 176,
    },
  ];

  const tipos_entregavel = [
    "Team Building",
    "PDL",
    "Coaching",
    "Assessment",
    "Assessment (MBTI)",
    "Treinamento Indoor",
    "Treinamento Outdoor",
    "PDE",
    "Diagnóstico",
    "Cargos e Salários",
    "Onboarding",
    "Entrevista",
    "Focus group",
    "Visita de campo",
    "Workshop",
    "Programa de desenvolvimento de liderança",
    "Mentoria",
    "Material instrucional",
    "Podcast",
    "Vídeo",
    "Reunião de alinhamento",
    "Kickoff",
    "Gestão de projeto",
    "Outro",
  ].map((nome, i) => ({ id: `tipo-${i + 1}`, nome, ativo: true }));

  const opcoes_sistema = [
    ...["Palestra", "Projeto", "Programa", "Workshop", "Consultoria"].map((nome, i) => ({
      id: `opt-tp-${i + 1}`,
      grupo: "tipo_projeto",
      nome,
      ordem: i + 1,
      ativo: true,
    })),
    ...["Logística", "Passagem", "Hospedagem", "Transporte", "Alimentação", "Material", "Impressão", "Parceiro", "Design", "Outros"].map((nome, i) => ({
      id: `opt-cat-${i + 1}`,
      grupo: "categoria_despesa",
      nome,
      ordem: i + 1,
      ativo: true,
    })),
    ...["Contextualização", "Conteúdo", "Conexão", "Consolidação", "Concretização"].map((nome, i) => ({
      id: `opt-mac-${i + 1}`,
      grupo: "macroetapa_padrao",
      nome,
      ordem: i + 1,
      ativo: true,
    })),
  ];

  return {
    perfis,
    tipos_entregavel,
    opcoes_sistema,
    clientes: [],
    projetos: [],
    escopos: [],
    macroetapas: [],
    entregaveis: [],
    alocacoes_valor: [],
    projeto_financeiro: [],
    atividades: [],
    eventos_receita: [],
    despesas: [],
    nps_respostas: [],
    avaliacoes_reacao: [],
    substituicoes: [],
    acessos_projeto: [],
    contatos: [],
    calendario_tokens: [],
    audit_log: [],
  };
}

function getDB(): Record<string, any[]> {
  if (typeof window === "undefined") return seedDB();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.projetos)) {
        parsed.projetos.forEach((p: any) => {
          if (p.situacao === "execucao") p.situacao = "em_execucao";
        });
      }
      let changed = false;
      if (!Array.isArray(parsed.opcoes_sistema) || parsed.opcoes_sistema.length === 0) {
        parsed.opcoes_sistema = seedDB().opcoes_sistema;
        changed = true;
      } else if (parsed.opcoes_sistema.some((x: any) => x.grupo === "subtipo_projeto")) {
        parsed.opcoes_sistema = parsed.opcoes_sistema.filter((x: any) => x.grupo !== "subtipo_projeto");
        changed = true;
      }
      if (Array.isArray(parsed.tipos_entregavel)) {
        const existentes = new Set(parsed.tipos_entregavel.map((x: any) => String(x.nome).toLowerCase()));
        for (const item of seedDB().tipos_entregavel) {
          if (!existentes.has(item.nome.toLowerCase())) {
            parsed.tipos_entregavel.push({ id: uuid(), nome: item.nome, ativo: true });
            changed = true;
          }
        }
      }
      if (Array.isArray(parsed.perfis)) {
        const adminsFixos = [
          { id: "u-carla", nome: "Carla Sanara", email: "carla.sanara@conectas.com.br" },
          { id: "u-ju", nome: "Ju Moura", email: "ju.moura@conectas.com.br" },
          { id: "u-financeiro", nome: "Financeiro Conectas", email: "financeiro@conectas.com.br" },
        ];
        for (const adm of adminsFixos) {
          const ex = parsed.perfis.find((p: any) => String(p.email).toLowerCase() === adm.email);
          if (!ex) {
            parsed.perfis.unshift({
              ...adm,
              papel: "admin",
              fin: "validar",
              ativo: true,
              acesso_projetos: "todos",
              ver_geral: true,
              ver_impactometro: true,
              ver_pax_consultor: true,
              ver_capacidade: true,
              carga_horas_mes: 176,
            });
            changed = true;
          } else if (ex.papel !== "admin" || ex.fin !== "validar") {
            ex.papel = "admin";
            ex.fin = "validar";
            ex.ativo = true;
            changed = true;
          }
        }
      }
      if (changed) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {}
  const initial = seedDB();
  try {
    const oldRaw = window.localStorage.getItem("conectas_local_db_v1");
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      if (Array.isArray(old.perfis) && old.perfis.length) initial.perfis = old.perfis;
      if (Array.isArray(old.tipos_entregavel) && old.tipos_entregavel.length) {
        const existentes = new Set(old.tipos_entregavel.map((x: any) => String(x.nome).toLowerCase()));
        for (const item of initial.tipos_entregavel) {
          if (!existentes.has(item.nome.toLowerCase())) {
            old.tipos_entregavel.push(item);
          }
        }
        initial.tipos_entregavel = old.tipos_entregavel;
      }
      if (Array.isArray(old.opcoes_sistema) && old.opcoes_sistema.length) {
        initial.opcoes_sistema = old.opcoes_sistema.filter((x: any) => x.grupo !== "subtipo_projeto");
      }
      window.localStorage.removeItem("conectas_local_db_v1");
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveDB(db: Record<string, any[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {}
}

function getLocalSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalSession(session: any) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {}
  authListeners.forEach((cb) => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session));
}

function enrichRow(table: string, row: any, db: Record<string, any[]>) {
  if (!row) return row;
  const copy = { ...row };
  if (table === "projetos") {
    copy.clientes = db.clientes.find((c) => c.id === row.cliente_id) || null;
    copy.perfis = db.perfis.find((p) => p.id === row.responsavel_id) || null;
    copy.resp = copy.perfis;
    copy.lt = db.perfis.find((p) => p.id === row.apoio_id) || null;
    copy.entregaveis = db.entregaveis.filter((e) => e.projeto_id === row.id);
    copy.projeto_financeiro = db.projeto_financeiro.filter((pf) => pf.projeto_id === row.id);
  } else if (table === "entregaveis") {
    const aloc = db.alocacoes_valor.find((a) => a.entregavel_id === row.id);
    copy.alocacoes_valor = aloc ? { valor: aloc.valor } : null;
    copy.tipos_entregavel = db.tipos_entregavel.find((t) => t.id === row.tipo_id) || null;
    copy.resp = db.perfis.find((p) => p.id === row.responsavel_id) || null;
    copy.projetos = db.projetos.find((p) => p.id === row.projeto_id) || null;
  } else if (table === "atividades") {
    copy.resp = db.perfis.find((p) => p.id === row.responsavel_id) || null;
    copy.contato = db.contatos.find((c) => c.id === row.contato_id) || null;
    const ent = db.entregaveis.find((e) => e.id === row.entregavel_id) || null;
    copy.entregaveis = ent
      ? {
          ...ent,
          tipos_entregavel: db.tipos_entregavel.find((t) => t.id === ent.tipo_id) || null,
          macroetapas: db.macroetapas.find((m) => m.id === ent.macroetapa_id) || null,
        }
      : null;
    copy.tipos_entregavel = db.tipos_entregavel.find((t) => t.id === (row.tipo_id || ent?.tipo_id)) || null;
    copy.projetos = db.projetos.find((p) => p.id === row.projeto_id) || null;
  } else if (table === "clientes") {
    copy.projetos = db.projetos.filter((p) => p.cliente_id === row.id);
  } else if (table === "eventos_receita") {
    const pr = db.projetos.find((p) => p.id === row.projeto_id);
    copy.projetos = pr ? { ...pr, clientes: db.clientes.find((c) => c.id === pr.cliente_id) || null } : null;
    copy.entregaveis = db.entregaveis.find((e) => e.id === row.entregavel_id) || null;
  } else if (table === "despesas") {
    copy.projetos = db.projetos.find((p) => p.id === row.projeto_id) || null;
    copy.quem = db.perfis.find((p) => p.id === row.criado_por) || db.perfis[0] || null;
  } else if (table === "avaliacoes_reacao") {
    copy.consultor = db.perfis.find((p) => p.id === row.consultor_id) || null;
  }
  return copy;
}

class LocalQueryBuilder {
  private table: string;
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private upsertOpts: any = null;
  private filters: ((row: any) => boolean)[] = [];
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string) {
    return this;
  }

  insert(rows: any) {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(fields: any) {
    this.op = "update";
    this.payload = fields;
    return this;
  }

  upsert(rows: any, opts?: any) {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.upsertOpts = opts;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push((r) => r[col] != null && r[col] >= val);
    return this;
  }

  lt(col: string, val: any) {
    this.filters.push((r) => r[col] != null && r[col] < val);
    return this;
  }

  not(col: string, operator: string, val: any) {
    if (operator === "is" && val === null) {
      this.filters.push((r) => r[col] != null);
    } else {
      this.filters.push((r) => r[col] !== val);
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private execute() {
    const db = getDB();
    if (!db[this.table]) db[this.table] = [];
    const list = db[this.table];
    const match = (r: any) => this.filters.every((fn) => fn(r));

    if (this.op !== "select" && (this.table === "opcoes_sistema" || this.table === "tipos_entregavel")) {
      const sess = getLocalSession();
      const me = db.perfis.find((p) => p.id === sess?.user?.id);
      if (!me || me.papel !== "admin") {
        return { data: null, error: { message: "Apenas a administração pode alterar parâmetros fixos do sistema." } };
      }
    }

    let resultRows: any[] = [];

    if (this.op === "select") {
      resultRows = list.filter(match).map((r) => enrichRow(this.table, r, db));
      if (this.orderCol) {
        const c = this.orderCol;
        const dir = this.orderAsc ? 1 : -1;
        resultRows.sort((a, b) => (a[c] > b[c] ? dir : a[c] < b[c] ? -dir : 0));
      }
      if (this.limitCount != null) resultRows = resultRows.slice(0, this.limitCount);
    } else if (this.op === "insert") {
      const inserted = this.payload.map((item: any) => {
        const novo: any = {
          id: item.id || uuid(),
          criado_em: item.criado_em || new Date().toISOString(),
          ...item,
        };
        if (this.table === "atividades" && !novo.status) novo.status = "nao_iniciado";
        if (this.table === "entregaveis" && !novo.status) novo.status = "nao_iniciado";
        if (this.table === "calendario_tokens" && !novo.token) novo.token = uuid().replace(/-/g, "");
        list.push(novo);
        return enrichRow(this.table, novo, db);
      });
      saveDB(db);
      resultRows = inserted;
    } else if (this.op === "update") {
      const updated: any[] = [];
      list.forEach((r, idx) => {
        if (match(r)) {
          list[idx] = { ...r, ...this.payload };
          if (this.table === "atividades" && this.payload.status === "concluido" && list[idx].gera_receita && Number(list[idx].valor) > 0) {
            const ja = db.eventos_receita.find((ev) => ev.atividade_id === list[idx].id);
            if (!ja) {
              db.eventos_receita.unshift({
                id: uuid(),
                projeto_id: list[idx].projeto_id,
                entregavel_id: list[idx].entregavel_id,
                atividade_id: list[idx].id,
                valor: Number(list[idx].valor),
                competencia: hojeISO().slice(0, 7) + "-01",
                status: "pendente",
                criado_em: new Date().toISOString(),
              });
            }
          }
          updated.push(enrichRow(this.table, list[idx], db));
        }
      });
      saveDB(db);
      resultRows = updated;
    } else if (this.op === "upsert") {
      const conflictKey = this.upsertOpts?.onConflict || (this.table === "projeto_financeiro" ? "projeto_id" : "id");
      const upserted: any[] = [];
      this.payload.forEach((item: any) => {
        const idx = list.findIndex((r) => r[conflictKey] === item[conflictKey]);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...item };
          upserted.push(enrichRow(this.table, list[idx], db));
        } else {
          const novo = { id: item.id || uuid(), ...item };
          list.push(novo);
          upserted.push(enrichRow(this.table, novo, db));
        }
      });
      saveDB(db);
      resultRows = upserted;
    } else if (this.op === "delete") {
      const remaining: any[] = [];
      const removed: any[] = [];
      list.forEach((r) => {
        if (match(r)) removed.push(r);
        else remaining.push(r);
      });
      db[this.table] = remaining;
      saveDB(db);
      resultRows = removed;
    }

    if (this.isSingle || this.isMaybeSingle) {
      return { data: resultRows[0] ?? null, error: null };
    }
    return { data: resultRows, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

async function handleLocalRpc(fn: string, args: any = {}) {
  const db = getDB();
  const sess = getLocalSession();
  const uid = sess?.user?.id || "u-carla";

  if (fn === "pode_editar_projeto") {
    return { data: true, error: null };
  }
  if (fn === "historico_alertas") {
    return { data: [], error: null };
  }
  if (fn === "historico_projeto") {
    return { data: db.audit_log || [], error: null };
  }
  if (fn === "criar_projeto") {
    const pid = uuid();
    const eid = uuid();
    const codigo = args.p_codigo || `CON-2026-00${db.projetos.length + 1}`;
    const novoProj = {
      id: pid,
      codigo,
      cliente_id: args.p_cliente,
      nome: args.p_nome,
      descricao: args.p_descricao,
      responsavel_id: args.p_responsavel || uid,
      apoio_id: args.p_apoio || null,
      inicio_previsto: args.p_inicio || hojeISO(),
      fim_previsto: args.p_fim || null,
      situacao: "planejamento",
      escopo_vigente_id: eid,
      criado_por: uid,
      criado_em: new Date().toISOString(),
    };
    db.projetos.unshift(novoProj);
    db.escopos.push({ id: eid, projeto_id: pid, versao: 1, tipo: "contratado", motivo: "Escopo original da venda" });
    const macrosPadrao = (db.opcoes_sistema || [])
      .filter((o: any) => o.grupo === "macroetapa_padrao" && o.ativo !== false)
      .sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0))
      .map((o: any) => o.nome);
    const listaMacros = macrosPadrao.length > 0 ? macrosPadrao : ["Contextualização", "Conteúdo", "Conexão", "Consolidação", "Concretização"];
    listaMacros.forEach((nome: string, idx: number) => {
      db.macroetapas.push({ id: uuid(), escopo_id: eid, projeto_id: pid, nome, ordem: idx + 1 });
    });
    saveDB(db);
    return { data: pid, error: null };
  }
  if (fn === "importar_estrutura") {
    const pid = args.p_projeto;
    const pr = db.projetos.find((p) => p.id === pid);
    if (!pr) return { data: null, error: { message: "Projeto não encontrado" } };
    const macros = args.p_dados?.macroetapas || [];
    macros.forEach((m: any, idx: number) => {
      let mac = db.macroetapas.find((x) => x.escopo_id === pr.escopo_vigente_id && x.nome.toLowerCase() === String(m.nome).toLowerCase());
      if (!mac) {
        mac = { id: uuid(), escopo_id: pr.escopo_vigente_id, projeto_id: pid, nome: m.nome, ordem: idx + 1 };
        db.macroetapas.push(mac);
      }
      (m.entregaveis || []).forEach((e: any) => {
        const eid = uuid();
        db.entregaveis.push({
          id: eid,
          macroetapa_id: mac.id,
          projeto_id: pid,
          escopo_id: pr.escopo_vigente_id,
          nome: e.nome,
          quantidade: e.quantidade || 1,
          status: e.status || "nao_iniciado",
          data_prevista: e.data_prevista || null,
          gera_receita: e.gera_receita !== false,
        });
        if (e.valor != null) {
          db.alocacoes_valor.push({ id: uuid(), entregavel_id: eid, valor: Number(e.valor) });
        }
        (e.atividades || []).forEach((a: any) => {
          db.atividades.push({
            id: uuid(),
            entregavel_id: eid,
            projeto_id: pid,
            nome: a.nome,
            status: a.status || "nao_iniciado",
            data_prevista: a.data_prevista || null,
            horas_previstas: a.horas_previstas || null,
            local: a.local || null,
            participantes: a.participantes || null,
            responsavel_id: a.responsavel_id || null,
            responsabilidade: "conectas",
            prioridade: "media",
          });
        });
      });
    });
    saveDB(db);
    return { data: true, error: null };
  }
  if (fn === "confirmar_entrega") {
    const ent = db.entregaveis.find((e) => e.id === args.p_entregavel);
    if (!ent) return { data: null, error: { message: "Entregável inexistente" } };
    ent.status = "concluido";
    ent.data_realizada = hojeISO();
    if (ent.gera_receita) {
      const aloc = db.alocacoes_valor.find((a) => a.entregavel_id === ent.id);
      if (aloc && Number(aloc.valor) > 0) {
        db.eventos_receita.unshift({
          id: uuid(),
          projeto_id: ent.projeto_id,
          entregavel_id: ent.id,
          valor: Number(aloc.valor),
          competencia: hojeISO().slice(0, 7) + "-01",
          status: "pendente",
          criado_em: new Date().toISOString(),
        });
      }
    }
    saveDB(db);
    return { data: null, error: null };
  }
  if (fn === "validar_receita") {
    const ev = db.eventos_receita.find((x) => x.id === args.p_evento);
    if (ev) {
      ev.status = "reconhecida";
      ev.validado_em = hojeISO();
      saveDB(db);
    }
    return { data: null, error: null };
  }
  if (fn === "lancar_saving") {
    db.eventos_receita.unshift({
      id: uuid(),
      projeto_id: args.p_projeto,
      descricao: args.p_descricao || "Saving do projeto",
      origem: "saving",
      valor: Number(args.p_valor || 0),
      competencia: hojeISO().slice(0, 7) + "-01",
      status: "reconhecida",
      validado_em: hojeISO(),
      criado_em: new Date().toISOString(),
    });
    saveDB(db);
    return { data: null, error: null };
  }
  if (fn === "transferir_projetos") {
    const pr = db.projetos.find((p) => p.id === args.p_projeto);
    if (pr) {
      pr.responsavel_id = args.p_para;
      saveDB(db);
    }
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

export const supabase: any = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const cleanEmail = (email || "").trim().toLowerCase();
      try {
        const res = await realSupabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (!res.error && res.data?.session) {
          const check = await realSupabase.from("perfis").select("id").eq("id", res.data.session.user.id).maybeSingle();
          if (!check.error && check.data) {
            return res;
          }
        }
      } catch {}

      // Fallback local: permite entrar imediatamente (o 1º usuário / carla.sanara vira Admin com financeiro completo)
      const db = getDB();
      const adminsEmails = ["carla.sanara@conectas.com.br", "ju.moura@conectas.com.br", "financeiro@conectas.com.br"];
      const ehAdminFixo = adminsEmails.includes(cleanEmail);
      let perfil = db.perfis.find((p) => p.email.toLowerCase() === cleanEmail);
      if (!perfil) {
        const nomeBase = cleanEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        perfil = {
          id: uuid(),
          nome: nomeBase || "Usuária Conectas",
          email: cleanEmail,
          papel: ehAdminFixo ? "admin" : "gestora",
          fin: ehAdminFixo ? "validar" : "nenhum",
          ativo: true,
          acesso_projetos: "todos",
          ver_geral: true,
          ver_impactometro: true,
          ver_pax_consultor: ehAdminFixo,
          ver_capacidade: true,
          carga_horas_mes: 176,
        };
        db.perfis.unshift(perfil);
        saveDB(db);
      }
      const session = {
        access_token: "local-token-" + perfil.id,
        user: { id: perfil.id, email: perfil.email, user_metadata: { nome: perfil.nome } },
      };
      setLocalSession(session);
      return { data: { user: session.user, session }, error: null };
    },

    async getSession() {
      const local = getLocalSession();
      if (local) return { data: { session: local }, error: null };
      try {
        const res = await realSupabase.auth.getSession();
        if (res.data?.session) return res;
      } catch {}
      return { data: { session: null }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.add(callback);
      const sub = realSupabase.auth.onAuthStateChange((ev, sess) => {
        if (!getLocalSession()) callback(ev, sess);
      });
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
              sub.data?.subscription?.unsubscribe();
            },
          },
        },
      };
    },

    async signOut() {
      setLocalSession(null);
      try {
        await realSupabase.auth.signOut();
      } catch {}
      return { error: null };
    },
  },

  from(table: string) {
    return new LocalQueryBuilder(table);
  },

  rpc(fn: string, args?: any) {
    return handleLocalRpc(fn, args);
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, _file: File) {
          return { data: { path }, error: null };
        },
        async createSignedUrl(path: string) {
          return { data: { signedUrl: "#" + path }, error: null };
        },
      };
    },
  },
};
