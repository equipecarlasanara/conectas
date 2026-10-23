// Cloudflare Pages Function: /api/outlook/send
// Envia e-mails de alerta e cria eventos na agenda do Outlook (Microsoft 365) via Microsoft Graph API.

async function obterTokenGraph(cfg) {
  const tenantId = cfg.tenantId || cfg.GRAPH_TENANT_ID;
  const clientId = cfg.clientId || cfg.GRAPH_CLIENT_ID;
  const clientSecret = cfg.clientSecret || cfg.GRAPH_CLIENT_SECRET;

  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    throw new Error(`Falha ao autenticar no Microsoft 365 (${r.status}): ${j.error_description || j.error || "verifique Tenant ID, Client ID e Client Secret"}`);
  }
  return j.access_token;
}

function montarIcsBase64(t) {
  const esc = (s) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Conectas//Projetos//PT",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${t.id || Date.now()}@conectas.com.br`,
    `DTSTAMP:${z(new Date())}`,
    `SEQUENCE:${Math.floor(Date.now() / 1000)}`,
  ];
  if (t.hora) {
    const ini = new Date(`${t.data}T${t.hora.slice(0, 5)}:00-03:00`);
    const fim = new Date(ini.getTime() + (Number(t.duracao) || 60) * 60000);
    lines.push(`DTSTART:${z(ini)}`, `DTEND:${z(fim)}`);
  } else {
    const d = new Date(t.data + "T00:00:00Z");
    const n = new Date(d.getTime() + 864e5);
    lines.push(`DTSTART;VALUE=DATE:${t.data.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${n.toISOString().slice(0, 10).replace(/-/g, "")}`);
  }
  lines.push(
    `SUMMARY:${esc(t.nome)}`,
    `DESCRIPTION:${esc((t.descricao || "") + (t.url ? "\n" + t.url : ""))}`,
    `ATTENDEE;CN=${esc(t.para)};RSVP=TRUE:mailto:${t.para}`,
    `ORGANIZER:mailto:${t.sender}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(t.nome)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );
  const icsStr = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(icsStr)));
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const env = context.env || {};

    const cfg = {
      tenantId: body.config?.tenantId || env.GRAPH_TENANT_ID || "",
      clientId: body.config?.clientId || env.GRAPH_CLIENT_ID || "",
      clientSecret: body.config?.clientSecret || env.GRAPH_CLIENT_SECRET || "",
      sender: body.config?.sender || env.GRAPH_SENDER || "",
    };

    if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret || !cfg.sender) {
      return new Response(
        JSON.stringify({
          ok: false,
          erro: "Credenciais do Microsoft 365 / Outlook incompletas (Tenant ID, Client ID, Client Secret e E-mail remetente são obrigatórios).",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = await obterTokenGraph(cfg);
    const { para, cc, assunto, texto, html, evento } = body;

    const message = {
      subject: assunto || "Alerta Conectas",
      body: {
        contentType: "HTML",
        content: html || `<div style="font-family:sans-serif;font-size:14px;color:#222"><p>${String(texto || "").replace(/\n/g, "<br>")}</p></div>`,
      },
      toRecipients: [{ emailAddress: { address: para } }],
    };

    if (cc) {
      message.ccRecipients = [{ emailAddress: { address: cc } }];
    }

    if (evento?.data) {
      const contentBytes = montarIcsBase64({
        id: evento.id,
        nome: evento.titulo || assunto,
        descricao: texto,
        data: evento.data,
        hora: evento.hora,
        duracao: evento.duracaoMin,
        url: evento.url,
        para,
        sender: cfg.sender,
      });
      message.attachments = [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: "convite-conectas.ics",
          contentType: "text/calendar; method=REQUEST",
          contentBytes,
        },
      ];
    }

    const rMail = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.sender)}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (!rMail.ok) {
      const errTxt = await rMail.text().catch(() => "");
      throw new Error(`Erro ao enviar e-mail (${rMail.status}): ${errTxt.slice(0, 300)}`);
    }

    let graphEventId = null;
    let agendaAviso = null;
    if (evento?.data && evento?.criarNaAgenda !== false) {
      try {
        const tz = "E. South America Standard Time";
        const diaSeguinte = (d) => new Date(new Date(d + "T00:00:00Z").getTime() + 864e5).toISOString().slice(0, 10);
        let start, end, isAllDay = false;
        if (evento.hora) {
          const ini = new Date(`${evento.data}T${evento.hora.slice(0, 5)}:00Z`);
          const fim = new Date(ini.getTime() + (Number(evento.duracaoMin) || 60) * 60000);
          start = { dateTime: ini.toISOString().slice(0, 19), timeZone: tz };
          end = { dateTime: fim.toISOString().slice(0, 19), timeZone: tz };
        } else {
          isAllDay = true;
          start = { dateTime: evento.data + "T00:00:00", timeZone: tz };
          end = { dateTime: diaSeguinte(evento.data) + "T00:00:00", timeZone: tz };
        }
        const evBody = {
          subject: evento.titulo || assunto,
          body: {
            contentType: "HTML",
            content: `${String(texto || "").replace(/\n/g, "<br>")}${evento.url ? `<p><a href="${evento.url}">Abrir no sistema Conectas</a></p>` : ""}`,
          },
          start,
          end,
          isAllDay,
          isReminderOn: true,
          reminderMinutesBeforeStart: 30,
          categories: ["Conectas"],
        };
        const rEv = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(para)}/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(evBody),
        });
        if (rEv.ok) {
          const evJson = await rEv.json().catch(() => ({}));
          graphEventId = evJson?.id || null;
        }
      } catch (e) {
        agendaAviso = String(e?.message || e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, graphEventId, agendaAviso }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, erro: String(err?.message || err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
