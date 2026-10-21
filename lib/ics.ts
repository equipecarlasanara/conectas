// Feed de calendário (.ics) para assinar no Outlook, Google Agenda ou Apple Calendar. Brasil sem horário de verão: UTC-3.
const esc = (s: string) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export type Ev = { id: string; titulo: string; descricao?: string; data: string; hora?: string | null; duracao?: number | null; url?: string };

export function montarFeed(nome: string, evs: Ev[]) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Conectas//Calendario//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(nome)}`, "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  const agora = z(new Date());
  for (const e of evs) {
    L.push("BEGIN:VEVENT", `UID:${e.id}@conectas`, `DTSTAMP:${agora}`);
    if (e.hora) {
      const ini = new Date(`${e.data}T${e.hora.slice(0, 5)}:00-03:00`); const fim = new Date(ini.getTime() + (e.duracao || 60) * 60000);
      L.push(`DTSTART:${z(ini)}`, `DTEND:${z(fim)}`);
    } else {
      const d = new Date(e.data + "T00:00:00Z"); const n = new Date(d.getTime() + 864e5);
      L.push(`DTSTART;VALUE=DATE:${e.data.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${n.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    L.push(`SUMMARY:${esc(e.titulo)}`, `DESCRIPTION:${esc((e.descricao || "") + (e.url ? "\n" + e.url : ""))}`);
    if (e.url) L.push(`URL:${e.url}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
