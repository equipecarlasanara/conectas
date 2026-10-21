// Leitor determinístico (sem IA) do formato de cronograma da equipe: Projeto | Item | Ação | [HP] | [Local] | Participantes | Status | grade de datas.
export type Ativ = { nome: string; status: string; data_prevista: string | null; horas_previstas: number | null; local: string | null; participantes: string | null; datas_extra?: string[]; responsabilidade?: string };
export type Entreg = { nome: string; status: string; data_prevista: string | null; quantidade: number; gera_receita: boolean; atividades: Ativ[]; valor?: number | null; origem?: string | null };
export type Macro = { nome: string; entregaveis: Entreg[] };
export type Resultado = { fonte?: string; cliente: string | null; projeto: string | null; descricao?: string | null; valor_total?: number | null; macroetapas: Macro[]; avisos: string[]; lacunas?: string[]; total: { macroetapas: number; entregaveis: number; atividades: number } };

const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const txt = (v: any) => (v == null ? "" : v instanceof Date ? "" : String(v).replace(/\s+/g, " ").trim());
const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

export const STATUS_MAP: Record<string, string> = { "ok": "concluido", "em andamento": "em_andamento", "pendente": "nao_iniciado", "cancelado": "cancelado", "definir": "nao_iniciado", "n/a": "cancelado", "": "nao_iniciado" };
function mapStatus(s: string) { const k = norm(s).replace(/\./g, ""); return STATUS_MAP[k] ?? "nao_iniciado"; }

export function ehCronograma(rows: any[][]) { return achaCabecalho(rows) >= 0; }
function achaCabecalho(rows: any[][]) {
  for (let i = 0; i < Math.min(rows.length, 6); i++) if ((rows[i] || []).some(c => ["acao"].includes(norm(c)))) return i;
  return -1;
}

export function lerCronograma(rows: any[][], nomeAba = ""): Resultado {
  const avisos: string[] = [];
  const h = achaCabecalho(rows);
  if (h < 0) return { cliente: null, projeto: null, macroetapas: [], avisos: ["Não encontrei a coluna 'Ação' na aba."], total: { macroetapas: 0, entregaveis: 0, atividades: 0 } };
  const hdr = rows[h].map(norm);
  const col = (...nomes: string[]) => hdr.findIndex(x => nomes.some(n => x === n || x.startsWith(n)));
  const cP = col("projeto"), cI = col("item"), cA = col("acao"), cHP = col("hp", "horas"), cL = col("local"), cPart = col("participantes"), cS = col("status");
  const cI2 = cI >= 0 ? cI : col("item");
  const fimMeta = Math.max(cP, cI2, cA, cHP, cL, cPart, cS);

  // Cliente: "Cronograma - NOME"
  const a1 = txt(rows[0]?.[0]); const cliente = a1.includes("-") ? a1.split("-").slice(1).join("-").replace(/\(.*\)/, "").trim() : (nomeAba.trim() || null);

  // Marcadores de mês na linha 1: data mal interpretada (out/23 virou 23/10) ou texto "jan/25"
  const marcas: { col: number; ano: number; mes: number }[] = [];
  (rows[0] || []).forEach((v, c) => {
    if (c <= fimMeta) return;
    if (v instanceof Date) { const d = v.getUTCDate(); if (d >= 19 && d <= 35) marcas.push({ col: c, ano: 2000 + d, mes: v.getUTCMonth() + 1 }); }
    else if (typeof v === "string") { const m = v.toLowerCase().match(/^([a-zç]{3})\w*\s*\/\s*(\d{2,4})$/); if (m && MESES[m[1]]) marcas.push({ col: c, ano: m[2].length === 2 ? 2000 + +m[2] : +m[2], mes: MESES[m[1]] }); }
  });
  const dataDaCelula = (v: any, c: number): string | null => {
    if (v instanceof Date) { const y = v.getUTCFullYear(); return y >= 2019 && y <= 2032 ? `${y}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}` : null; }
    const n = typeof v === "number" ? v : /^\d{1,2}$/.test(txt(v)) ? Number(txt(v)) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 31) return null;
    const mk = [...marcas].filter(x => x.col <= c).pop();
    return mk ? `${mk.ano}-${pad(mk.mes)}-${pad(n)}` : null;
  };

  const macros: Macro[] = []; let macro: Macro | null = null; let ent: Entreg | null = null; let blocoProj = "";
  const novaMacro = (nome: string) => { macro = { nome, entregaveis: [] }; macros.push(macro); ent = null; };
  const novoEnt = (nome: string) => { if (!macro) novaMacro(blocoProj || "Geral"); ent = { nome, status: "nao_iniciado", data_prevista: null, quantidade: 1, gera_receita: true, atividades: [] }; macro!.entregaveis.push(ent); };

  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const acao = txt(row[cA]); const proj = cP >= 0 ? txt(row[cP]) : "";
    if (!acao) continue;
    if (proj) { blocoProj = proj; }
    const status = cS >= 0 ? txt(row[cS]) : ""; const partRaw = cPart >= 0 ? txt(row[cPart]) : ""; const part = norm(partRaw) === "definir" ? "" : partRaw; const local = cL >= 0 ? txt(row[cL]) : "";
    const hpRaw = cHP >= 0 ? row[cHP] : null;
    const datas: string[] = []; for (let c = fimMeta + 1; c < row.length; c++) { const d = row[c] != null && row[c] !== "" ? dataDaCelula(row[c], c) : null; if (d) datas.push(d); }
    const temMeta = !!(status || part || local || hpRaw || datas.length);
    if (!temMeta) { // linha de cabeçalho de grupo
      const maiusc = acao === acao.toUpperCase() && /[A-ZÀ-Ú]/.test(acao);
      if (maiusc || (proj && !macro)) { novaMacro(acao); if (proj && proj !== acao) { /* rótulo do bloco guardado em blocoProj */ } }
      else novoEnt(acao);
      continue;
    }
    if (proj && !macro) novaMacro(proj);
    if (!ent) novoEnt(macro ? "Atividades" : "Atividades"); // garante um entregável
    let hp: number | null = null;
    if (hpRaw != null && hpRaw !== "") { const s = norm(hpRaw); const n = parseFloat(s.replace(",", ".")); if (!isNaN(n)) hp = /^\d+(\.\d+)?\s*'/.test(s) || /min/.test(s) ? Math.round(n / 60 * 100) / 100 : n; }
    ent!.atividades.push({ nome: acao, status: mapStatus(status), data_prevista: datas[0] || null, datas_extra: datas.length > 1 ? datas.slice(1) : undefined, horas_previstas: hp, local: local || null, participantes: part || null });
  }
  // Entregável sem atividades com meta = um entregável simples; derive status/data
  for (const m of macros) {
    m.entregaveis = m.entregaveis.filter(e => e.atividades.length > 0 || true);
    for (const e of m.entregaveis) {
      const st = e.atividades.map(a => a.status).filter(s => s !== "cancelado");
      e.status = st.length === 0 ? "nao_iniciado" : st.every(s => s === "concluido") ? "concluido" : st.some(s => s === "concluido" || s === "em_andamento") ? "em_andamento" : "nao_iniciado";
      const ds = e.atividades.map(a => a.data_prevista).filter(Boolean) as string[]; e.data_prevista = ds.length ? ds.sort().pop()! : null;
    }
  }
  const mm = macros.filter(m => m.entregaveis.length > 0);
  const ne = mm.reduce((s, m) => s + m.entregaveis.length, 0), na = mm.reduce((s, m) => s + m.entregaveis.reduce((t, e) => t + e.atividades.length, 0), 0);
  const semData = mm.reduce((s, m) => s + m.entregaveis.reduce((t, e) => t + e.atividades.filter(a => !a.data_prevista).length, 0), 0);
  if (semData > 0) avisos.push(`${semData} de ${na} atividades ficaram sem data (a planilha não trazia data legível). Confira antes de criar.`);
  if (marcas.length === 0) avisos.push("Não identifiquei os meses da grade de datas; as datas só foram lidas quando estavam completas na célula.");
  avisos.push("Valores (R$) não existem nesta planilha e ficam em branco. Participantes foram guardados como texto; o responsável principal precisa ser atribuído no sistema.");
  return { cliente, projeto: mm[0]?.nome || null, macroetapas: mm, avisos, total: { macroetapas: mm.length, entregaveis: ne, atividades: na } };
}
