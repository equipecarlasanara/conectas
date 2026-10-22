import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing";
const realSupabase = createClient(url, anon);

const STORAGE_KEY = "conectas_local_db_v1";
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
      nome: "Ju",
      email: "ju@conectas.com.br",
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
    "Diagnóstico",
    "Entrevista",
    "Focus group",
    "Assessment (MBTI)",
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
    ...["PDL", "Coaching", "Assessment", "Treinamento Indoor", "Treinamento Outdoor", "PDE", "Team Building", "Diagnóstico", "Cargos e Salários", "Onboarding"].map(
      (nome, i) => ({ id: `opt-sub-${i + 1}`, grupo: "subtipo_projeto", nome, ordem: i + 1, ativo: true })
    ),
    ...["Palestra", "Workshop", "Programa", "Projeto", "Consultoria"].map((nome, i) => ({
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

  const clientes = [
    { id: "cli-1", nome: "Empresa Exemplo A", documento: "12.345.678/0001-90", observacoes: "Conta estratégica — DHO e Liderança" },
    { id: "cli-2", nome: "Empresa Exemplo B", documento: "98.765.432/0001-10", observacoes: "Trilha executiva anual" },
    { id: "cli-3", nome: "Empresa Exemplo C", documento: "45.123.890/0001-55", observacoes: "Diagnóstico e cultura organizacional" },
  ];

  const projetos = [
    {
      id: "proj-1",
      codigo: "CON-2026-001",
      cliente_id: "cli-1",
      nome: "Programa de Liderança",
      descricao: "Programa de desenvolvimento de lideranças para gestores da Empresa Exemplo A.",
      objetivo: "Desenvolver competências de liderança colaborativa e gestão de equipes.",
      responsavel_id: "u-angelica",
      apoio_id: "u-marcelle",
      inicio_previsto: "2026-09-01",
      fim_previsto: "2026-12-30",
      situacao: "em_execucao",
      fase: "execucao",
      tipo_projeto: "Programa",
      subtipo: "PDL",
      modalidade: "projeto",
      prioridade: "alta",
      escopo_vigente_id: "esc-1",
      resp_conectas: "Conteúdo, facilitação, relatórios.",
      resp_cliente: "Local, convites e lista de participantes.",
      logistica_por: "cliente",
      logistica_obs: "Cliente providencia passagens e sala de treinamento.",
      criado_em: "2026-09-01T10:00:00Z",
    },
    {
      id: "proj-2",
      codigo: "CON-2026-002",
      cliente_id: "cli-2",
      nome: "Trilha de Mentorias",
      descricao: "Acompanhamento individual e em grupo de líderes sênior.",
      objetivo: "Apoiar transição de carreira executiva.",
      responsavel_id: "u-marcelle",
      apoio_id: "u-angelica",
      inicio_previsto: "2026-08-15",
      fim_previsto: "2026-11-20",
      situacao: "em_execucao",
      fase: "execucao",
      tipo_projeto: "Consultoria",
      subtipo: "Coaching",
      modalidade: "projeto",
      prioridade: "media",
      escopo_vigente_id: "esc-2",
      criado_em: "2026-08-15T10:00:00Z",
    },
    {
      id: "proj-3",
      codigo: "CON-2026-003",
      cliente_id: "cli-3",
      nome: "Diagnóstico Organizacional",
      descricao: "Mapeamento de clima, processos de RH e entrevistas com liderança.",
      objetivo: "Construir plano diretor de DHO 2027.",
      responsavel_id: "u-angelica",
      apoio_id: null,
      inicio_previsto: "2026-11-01",
      fim_previsto: "2027-02-28",
      situacao: "planejamento",
      fase: "a_iniciar",
      tipo_projeto: "Projeto",
      subtipo: "Diagnóstico",
      modalidade: "full_service",
      prioridade: "media",
      escopo_vigente_id: "esc-3",
      criado_em: "2026-10-01T10:00:00Z",
    },
  ];

  const escopos = [
    { id: "esc-1", projeto_id: "proj-1", versao: 1, tipo: "contratado", motivo: "Escopo original da venda" },
    { id: "esc-2", projeto_id: "proj-2", versao: 1, tipo: "contratado", motivo: "Escopo original da venda" },
    { id: "esc-3", projeto_id: "proj-3", versao: 1, tipo: "contratado", motivo: "Escopo original da venda" },
  ];

  const macroNomes = ["Contextualização", "Conteúdo", "Conexão", "Consolidação", "Concretização"];
  const macroetapas: any[] = [];
  escopos.forEach((esc) => {
    macroNomes.forEach((nome, idx) => {
      macroetapas.push({
        id: `mac-${esc.projeto_id}-${idx + 1}`,
        escopo_id: esc.id,
        projeto_id: esc.projeto_id,
        nome,
        ordem: idx + 1,
      });
    });
  });

  const entregaveis = [
    {
      id: "ent-1",
      macroetapa_id: "mac-proj-1-1",
      projeto_id: "proj-1",
      escopo_id: "esc-1",
      tipo_id: "tipo-2",
      nome: "Entrevistas com lideranças",
      quantidade: 4,
      data_prevista: "2026-09-25",
      data_realizada: "2026-09-25",
      hora_prevista: "10:00",
      status: "concluido",
      responsavel_id: "u-angelica",
      gera_receita: true,
      pax: 48,
      pax_previsto: 48,
      uf: "SP",
      cidade: "São Paulo",
    },
    {
      id: "ent-2",
      macroetapa_id: "mac-proj-1-1",
      projeto_id: "proj-1",
      escopo_id: "esc-1",
      tipo_id: "tipo-3",
      nome: "Focus group",
      quantidade: 1,
      data_prevista: "2026-10-09",
      data_realizada: null,
      hora_prevista: "14:00",
      status: "aguardando_cliente",
      responsavel_id: "u-marcelle",
      gera_receita: true,
      pax: null,
      pax_previsto: 25,
      uf: "SP",
      cidade: "São Paulo",
    },
    {
      id: "ent-3",
      macroetapa_id: "mac-proj-1-2",
      projeto_id: "proj-1",
      escopo_id: "esc-1",
      tipo_id: "tipo-6",
      nome: "Workshop 1 — Liderança Colaborativa",
      quantidade: 1,
      data_prevista: "2026-10-28",
      data_realizada: "2026-10-10",
      hora_prevista: "14:00",
      status: "concluido",
      responsavel_id: "u-angelica",
      gera_receita: true,
      pax: 120,
      pax_previsto: 120,
      uf: "SP",
      cidade: "São Paulo",
    },
    {
      id: "ent-4",
      macroetapa_id: "mac-proj-1-3",
      projeto_id: "proj-1",
      escopo_id: "esc-1",
      tipo_id: "tipo-7",
      nome: "Encontros de liderança",
      quantidade: 4,
      data_prevista: "2026-11-20",
      data_realizada: null,
      hora_prevista: "09:00",
      status: "em_andamento",
      responsavel_id: "u-angelica",
      gera_receita: true,
      pax: null,
      pax_previsto: 80,
      uf: "SP",
      cidade: "Campinas",
    },
    {
      id: "ent-5",
      macroetapa_id: "mac-proj-2-3",
      projeto_id: "proj-2",
      escopo_id: "esc-2",
      tipo_id: "tipo-8",
      nome: "Encontro 1 — Mentoria Executiva",
      quantidade: 1,
      data_prevista: "2026-09-25",
      data_realizada: "2026-09-25",
      hora_prevista: "15:00",
      status: "concluido",
      responsavel_id: "u-marcelle",
      gera_receita: true,
      pax: 80,
      pax_previsto: 80,
      uf: "RJ",
      cidade: "Rio de Janeiro",
    },
  ];

  const alocacoes_valor = [
    { id: "aloc-1", entregavel_id: "ent-1", valor: 6000 },
    { id: "aloc-2", entregavel_id: "ent-2", valor: 4000 },
    { id: "aloc-3", entregavel_id: "ent-3", valor: 16000 },
    { id: "aloc-4", entregavel_id: "ent-4", valor: 18000 },
    { id: "aloc-5", entregavel_id: "ent-5", valor: 22000 },
  ];

  const projeto_financeiro = [
    { projeto_id: "proj-1", valor_contratado: 44000, valor_liquido: 41300 },
    { projeto_id: "proj-2", valor_contratado: 46000, valor_liquido: 43200 },
    { projeto_id: "proj-3", valor_contratado: 30000, valor_liquido: 28200 },
  ];

  const atividades = [
    {
      id: "ativ-1",
      entregavel_id: "ent-1",
      projeto_id: "proj-1",
      nome: "Agendar entrevistas",
      responsavel_id: "u-angelica",
      responsabilidade: "conectas",
      data_prevista: "2026-09-15",
      data_realizada: "2026-09-15",
      hora_prevista: "10:00",
      status: "concluido",
      prioridade: "media",
      local: "Online",
      horas_previstas: 12,
      participantes: "Angélica, Marcelle",
      gera_receita: true,
      valor: 6000,
      logistica: false,
    },
    {
      id: "ativ-2",
      entregavel_id: "ent-2",
      projeto_id: "proj-1",
      nome: "Confirmar participantes",
      responsavel_id: "u-marcelle",
      responsabilidade: "cliente",
      data_prevista: "2026-10-05",
      data_realizada: null,
      hora_prevista: "14:00",
      status: "aguardando_cliente",
      prioridade: "alta",
      local: "Cliente",
      horas_previstas: 8,
      pendencia: "Cliente ainda não enviou a lista",
      gera_receita: true,
      valor: 4000,
      logistica: true,
    },
    {
      id: "ativ-3",
      entregavel_id: "ent-3",
      projeto_id: "proj-1",
      nome: "Preparar roteiro do workshop",
      responsavel_id: "u-marcelle",
      responsabilidade: "conectas",
      data_prevista: "2026-10-14",
      data_realizada: null,
      hora_prevista: "09:00",
      status: "nao_iniciado",
      prioridade: "media",
      local: "Conectas",
      horas_previstas: 16,
      gera_receita: false,
      valor: null,
      logistica: false,
    },
    {
      id: "ativ-4",
      entregavel_id: "ent-3",
      projeto_id: "proj-1",
      nome: "Desenvolver material instrucional",
      responsavel_id: "u-rosangela",
      responsabilidade: "conectas",
      data_prevista: "2026-10-24",
      data_realizada: null,
      hora_prevista: "11:00",
      status: "em_andamento",
      prioridade: "media",
      local: "Conectas",
      horas_previstas: 24,
      gera_receita: false,
      valor: null,
      logistica: false,
    },
    {
      id: "ativ-5",
      entregavel_id: "ent-4",
      projeto_id: "proj-1",
      nome: "Reservar sala e logística",
      responsavel_id: "u-angelica",
      responsabilidade: "conectas",
      data_prevista: "2026-10-28",
      data_realizada: null,
      hora_prevista: "16:00",
      status: "nao_iniciado",
      prioridade: "media",
      local: "Cliente",
      horas_previstas: 6,
      gera_receita: false,
      valor: null,
      logistica: true,
    },
  ];

  const eventos_receita = [
    {
      id: "ev-1",
      projeto_id: "proj-1",
      entregavel_id: "ent-1",
      valor: 22000,
      competencia: "2026-09-01",
      status: "reconhecida",
      validado_em: "2026-09-30",
      criado_em: "2026-09-25T14:00:00Z",
    },
    {
      id: "ev-2",
      projeto_id: "proj-2",
      entregavel_id: "ent-5",
      valor: 22000,
      competencia: "2026-10-01",
      status: "pendente",
      validado_em: null,
      criado_em: "2026-10-10T15:00:00Z",
    },
  ];

  const despesas = [
    {
      id: "desp-1",
      projeto_id: "proj-1",
      categoria: "Passagem",
      descricao: "Passagem aérea SP-Recife",
      fornecedor: "Companhia aérea",
      data: "2026-10-12",
      valor_orcado: 2000,
      valor_gasto: 1500,
      valor_reembolsado: 0,
      criado_por: "u-angelica",
    },
    {
      id: "desp-2",
      projeto_id: "proj-1",
      categoria: "Impressão",
      descricao: "Apostilas do workshop",
      fornecedor: "Gráfica Exemplo",
      data: "2026-10-14",
      valor_orcado: 1000,
      valor_gasto: 850,
      valor_reembolsado: 0,
      criado_por: "u-angelica",
    },
    {
      id: "desp-3",
      projeto_id: "proj-1",
      categoria: "Transporte",
      descricao: "Uber até o cliente",
      fornecedor: null,
      data: "2026-10-15",
      valor_orcado: null,
      valor_gasto: 300,
      valor_reembolsado: 300,
      criado_por: "u-marcelle",
    },
  ];

  const nps_respostas = [
    { id: "nps-1", projeto_id: "proj-1", nota: 10, data: "2026-10-10", consultor_id: "u-angelica", respondente: "Gestora RH", observacao: "Excelente condução" },
    { id: "nps-2", projeto_id: "proj-1", nota: 9, data: "2026-10-10", consultor_id: "u-angelica", respondente: "Gerente Industrial", observacao: "Muito prático" },
    { id: "nps-3", projeto_id: "proj-1", nota: 8, data: "2026-10-10", consultor_id: "u-marcelle", respondente: "Diretor", observacao: "Bom conteúdo" },
    { id: "nps-4", projeto_id: "proj-2", nota: 10, data: "2026-09-28", consultor_id: "u-marcelle", respondente: "VP Pessoas", observacao: "Transformador" },
  ];

  const avaliacoes_reacao = [
    {
      id: "reac-1",
      projeto_id: "proj-1",
      consultor_id: "u-angelica",
      origem: "cliente",
      nota: 9.2,
      escala_max: 10,
      respostas: 22,
      data: "2026-10-10",
      observacao: "Turma 1",
    },
    {
      id: "reac-2",
      projeto_id: "proj-2",
      consultor_id: "u-marcelle",
      origem: "conectas",
      nota: 4.7,
      escala_max: 5,
      respostas: 18,
      data: "2026-10-12",
      observacao: "Encontro de mentoria",
    },
  ];

  return {
    perfis,
    tipos_entregavel,
    opcoes_sistema,
    clientes,
    projetos,
    escopos,
    macroetapas,
    entregaveis,
    alocacoes_valor,
    projeto_financeiro,
    atividades,
    eventos_receita,
    despesas,
    nps_respostas,
    avaliacoes_reacao,
    substituicoes: [],
    acessos_projeto: [],
    contatos: [],
    calendario_tokens: [],
    audit_log: [
      { id: "aud-1", em: "2026-10-16T09:12:00Z", tabela: "entregaveis", acao: "UPDATE", resumo: "Workshop 1", usuario_id: "u-angelica" },
      { id: "aud-2", em: "2026-10-15T17:40:00Z", tabela: "alocacoes_valor", acao: "UPDATE", resumo: "R$ 44.000,00", usuario_id: "u-carla" },
    ],
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
      if (!Array.isArray(parsed.opcoes_sistema) || parsed.opcoes_sistema.length === 0) {
        parsed.opcoes_sistema = seedDB().opcoes_sistema;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {}
  const initial = seedDB();
  try {
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
    copy.entregaveis = db.entregaveis.find((e) => e.id === row.entregavel_id) || null;
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
      let perfil = db.perfis.find((p) => p.email.toLowerCase() === cleanEmail);
      if (!perfil) {
        const nomeBase = cleanEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        perfil = {
          id: uuid(),
          nome: nomeBase || "Carla Sanara",
          email: cleanEmail,
          papel: "admin",
          fin: "validar",
          ativo: true,
          acesso_projetos: "todos",
          ver_geral: true,
          ver_impactometro: true,
          ver_pax_consultor: true,
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
