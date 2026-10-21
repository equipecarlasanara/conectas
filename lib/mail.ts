// Envio de e-mail por API HTTPS (SMTP é bloqueado no Railway). Usa SendGrid ou Resend, o que estiver configurado.
import { graphConfigurado, graphEnviar } from "./graph";
export type Mail = { para: string; cc?: string; assunto: string; texto: string; html?: string; ics?: string };

export async function enviarEmail(m: Mail) {
  if (graphConfigurado()) return graphEnviar(m);     // Outlook / Microsoft 365
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM não configurado");
  const html = m.html || `<p>${m.texto.replace(/\n/g, "<br>")}</p>`;
  if (process.env.SENDGRID_API_KEY) {
    const body: any = {
      personalizations: [{ to: [{ email: m.para }] }],
      from: parseFrom(from), subject: m.assunto,
      content: [{ type: "text/plain", value: m.texto }, { type: "text/html", value: html }],
    };
    if (m.ics) body.attachments = [{ content: Buffer.from(m.ics).toString("base64"), type: "text/calendar; method=REQUEST; charset=UTF-8", filename: "convite.ics", disposition: "attachment" }];
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`SendGrid ${r.status}: ${await r.text().catch(() => "")}`);
    return;
  }
  if (process.env.RESEND_API_KEY) {
    const body: any = { from, to: [m.para], subject: m.assunto, html, text: m.texto };
    if (m.ics) body.attachments = [{ filename: "convite.ics", content: Buffer.from(m.ics).toString("base64") }];
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text().catch(() => "")}`);
    return;
  }
  throw new Error("Nenhum provedor de e-mail configurado (SENDGRID_API_KEY ou RESEND_API_KEY)");
}
function parseFrom(f: string) { const m = f.match(/^(.*)<(.+)>$/); return m ? { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() } : { email: f.trim() }; }

// Convite de agenda (.ics). Brasil sem horário de verão: America/Sao_Paulo = UTC-3.
const esc = (s: string) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function montarIcs(t: { id: string; nome: string; descricao?: string; data: string; hora?: string | null; duracao?: number | null; url?: string; email: string }) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Conectas//Projetos//PT", "METHOD:REQUEST", "BEGIN:VEVENT",
    `UID:${t.id}@conectas`, `DTSTAMP:${z(new Date())}`, `SEQUENCE:${Math.floor(Date.now() / 1000)}`];
  if (t.hora) {
    const ini = new Date(`${t.data}T${t.hora.slice(0, 5)}:00-03:00`); const fim = new Date(ini.getTime() + (t.duracao || 60) * 60000);
    lines.push(`DTSTART:${z(ini)}`, `DTEND:${z(fim)}`);
  } else {
    const d = new Date(t.data + "T00:00:00Z"), n = new Date(d.getTime() + 864e5);
    lines.push(`DTSTART;VALUE=DATE:${t.data.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${n.toISOString().slice(0, 10).replace(/-/g, "")}`);
  }
  lines.push(`SUMMARY:${esc(t.nome)}`, `DESCRIPTION:${esc((t.descricao || "") + (t.url ? "\n" + t.url : ""))}`,
    `ATTENDEE;CN=${esc(t.email)};RSVP=TRUE:mailto:${t.email}`, `ORGANIZER:mailto:${(process.env.EMAIL_FROM || "").replace(/.*<(.+)>.*/, "$1") || "noreply@conectas.local"}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${esc(t.nome)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
