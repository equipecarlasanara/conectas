import type { Resultado } from "./cronograma";

const SISTEMA = `Você lê o documento final de venda (proposta/resumo de entregáveis) da Conectas, consultoria de educação corporativa, e extrai a estrutura do projeto.
Regras obrigatórias:
- NUNCA invente quantidades, valores, datas, responsáveis ou condições. Se algo não estiver no documento, use null e registre em "lacunas".
- Para cada macroetapa e entregável, copie em "origem" o trecho curto (ou página/aba/célula) de onde veio a informação.
- Hierarquia: macroetapa > entregável (com quantidade) > atividades operacionais (só se o documento as citar).
- Valores em reais como número (sem R$). Datas em AAAA-MM-DD, somente se explícitas.
- Não presuma que logística pertence à Conectas; se o documento disser que é do cliente, registre em "lacunas" ou nas responsabilidades.
- Chame a ferramenta registrar_projeto uma única vez.`;

const FERRAMENTA = {
  name: "registrar_projeto", description: "Registra a estrutura extraída do documento.",
  input_schema: { type: "object", properties: {
    cliente: { type: ["string", "null"] }, projeto: { type: ["string", "null"] }, descricao: { type: ["string", "null"] },
    valor_total: { type: ["number", "null"] },
    macroetapas: { type: "array", items: { type: "object", properties: {
      nome: { type: "string" }, origem: { type: ["string", "null"] },
      entregaveis: { type: "array", items: { type: "object", properties: {
        nome: { type: "string" }, quantidade: { type: ["integer", "null"] }, valor: { type: ["number", "null"] },
        data_prevista: { type: ["string", "null"] }, origem: { type: ["string", "null"] },
        atividades: { type: "array", items: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] } },
      }, required: ["nome"] } },
    }, required: ["nome", "entregaveis"] } },
    lacunas: { type: "array", items: { type: "string" } },
  }, required: ["macroetapas", "lacunas"] },
};

export async function extrairComIA(conteudo: { texto?: string; pdfBase64?: string }): Promise<Resultado> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("SEM_CHAVE");
  const content: any[] = [];
  if (conteudo.pdfBase64) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: conteudo.pdfBase64 } });
  if (conteudo.texto) content.push({ type: "text", text: "Documento:\n\n" + conteudo.texto.slice(0, 150000) });
  content.push({ type: "text", text: "Extraia a estrutura do projeto e chame registrar_projeto." });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 8000, system: SISTEMA, tools: [FERRAMENTA], tool_choice: { type: "tool", name: "registrar_projeto" }, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error(`IA respondeu ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
  const j = await r.json();
  const uso = (j.content || []).find((c: any) => c.type === "tool_use");
  if (!uso) throw new Error("A IA não devolveu a estrutura.");
  const d = uso.input || {};
  const macros = (d.macroetapas || []).map((m: any) => ({ nome: String(m.nome || "Sem nome"), entregaveis: (m.entregaveis || []).map((e: any) => ({
    nome: String(e.nome || "Sem nome"), status: "nao_iniciado", data_prevista: /^\d{4}-\d{2}-\d{2}$/.test(e.data_prevista || "") ? e.data_prevista : null,
    quantidade: Number.isInteger(e.quantidade) && e.quantidade > 0 ? e.quantidade : 1, gera_receita: true, valor: typeof e.valor === "number" ? e.valor : null, origem: e.origem || m.origem || null,
    atividades: (e.atividades || []).map((a: any) => ({ nome: String(a.nome), status: "nao_iniciado", data_prevista: null, horas_previstas: null, local: null, participantes: null })),
  })) }));
  const ne = macros.reduce((s: number, m: any) => s + m.entregaveis.length, 0), na = macros.reduce((s: number, m: any) => s + m.entregaveis.reduce((t: number, e: any) => t + e.atividades.length, 0), 0);
  return { fonte: "ia", cliente: d.cliente || null, projeto: d.projeto || null, descricao: d.descricao || null, valor_total: typeof d.valor_total === "number" ? d.valor_total : null,
    macroetapas: macros, avisos: ["Extraído por IA. Confira cada item, principalmente quantidades e valores, antes de criar."], lacunas: d.lacunas || [], total: { macroetapas: macros.length, entregaveis: ne, atividades: na } };
}
