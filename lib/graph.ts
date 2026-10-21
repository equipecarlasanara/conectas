// Microsoft Graph (Outlook / Microsoft 365): envia os e-mails de alerta a partir de uma caixa da Conectas
// e cria o compromisso na agenda de quem recebeu a tarefa. Usa permissão de aplicativo (sem login de cada pessoa).
// Variáveis: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER (e-mail da caixa que envia, ex.: sistema@conectas.com.br)
// Permissões do aplicativo no Entra ID (consentimento do administrador do Microsoft 365): Mail.Send e Calendars.ReadWrite.
const BASE = "https://graph.microsoft.com/v1.0";
let cache: { token: string; exp: number } | null = null;

export const graphConfigurado = () => !!(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET && process.env.GRAPH_SENDER);

async function token() {
  if (cache && cache.exp > Date.now() + 60000) return cache.token;
  const r = await fetch(`https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GRAPH_CLIENT_ID!, client_secret: process.env.GRAPH_CLIENT_SECRET!, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Graph token ${r.status}: ${j.error_description || j.error || ""}`.slice(0, 300));
  cache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
  return cache.token;
}
async function chamar(metodo: string, caminho: string, corpo?: any) {
  const r = await fetch(BASE + caminho, { method: metodo, headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
  if (!r.ok) throw new Error(`Graph ${metodo} ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

export async function graphEnviar(m: { para: string; cc?: string; assunto: string; texto: string; html?: string; ics?: string }) {
  const message: any = {
    subject: m.assunto, body: { contentType: "HTML", content: m.html || `<p>${m.texto.replace(/\n/g, "<br>")}</p>` },
    toRecipients: [{ emailAddress: { address: m.para } }],
  };
  if (m.cc) message.ccRecipients = [{ emailAddress: { address: m.cc } }];
  if (m.ics) message.attachments = [{ "@odata.type": "#microsoft.graph.fileAttachment", name: "convite.ics", contentType: "text/calendar; method=REQUEST", contentBytes: Buffer.from(m.ics).toString("base64") }];
  await chamar("POST", `/users/${encodeURIComponent(process.env.GRAPH_SENDER!)}/sendMail`, { message, saveToSentItems: true });
}

// Cria (ou atualiza, se já existir) o compromisso na agenda de quem recebeu a tarefa. Retorna o id do evento.
export async function graphUpsertEvento(e: { email: string; graphId?: string | null; titulo: string; descricao?: string; data: string; hora?: string | null; duracaoMin?: number | null; url?: string }) {
  const tz = "E. South America Standard Time"; // horário de Brasília
  const dia = (d: string, n: number) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
  let start: any, end: any, isAllDay = false;
  if (e.hora) {
    const ini = new Date(`${e.data}T${e.hora.slice(0, 5)}:00Z`); const fim = new Date(ini.getTime() + (e.duracaoMin || 60) * 60000);
    start = { dateTime: ini.toISOString().slice(0, 19), timeZone: tz }; end = { dateTime: fim.toISOString().slice(0, 19), timeZone: tz };
  } else { isAllDay = true; start = { dateTime: e.data + "T00:00:00", timeZone: tz }; end = { dateTime: dia(e.data, 1) + "T00:00:00", timeZone: tz }; }
  const corpo = { subject: e.titulo, body: { contentType: "HTML", content: `${(e.descricao || "").replace(/\n/g, "<br>")}${e.url ? `<p><a href="${e.url}">Abrir no sistema</a></p>` : ""}` },
    start, end, isAllDay, isReminderOn: true, reminderMinutesBeforeStart: 30, categories: ["Conectas"] };
  const u = encodeURIComponent(e.email);
  if (e.graphId) {
    try { await chamar("PATCH", `/users/${u}/events/${e.graphId}`, corpo); return e.graphId; } catch (x: any) { if (!String(x.message).includes(" 404")) throw x; }
  }
  const r: any = await chamar("POST", `/users/${u}/events`, corpo);
  return r?.id as string;
}
