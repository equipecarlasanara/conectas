import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enviarEmail, montarIcs } from "@/lib/mail";
import { graphConfigurado, graphUpsertEvento } from "@/lib/graph";

// Chamado a cada 15 minutos por um agendador (Railway Cron ou similar) com: Authorization: Bearer <CRON_SECRET>
// 1) cria os lembretes: 15 dias, 7 dias, 2 dias antes e atrasada (repete a cada 7 dias; o GP também é avisado do atraso)
// 2) envia a fila (aviso na criação + lembretes) e, com o Outlook configurado, cria o compromisso na agenda de quem recebeu a tarefa.
export const dynamic = "force-dynamic";

const hojeSP = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const br = (d: string) => d.split("-").reverse().join("/");
const difDias = (d: string, hoje: string) => Math.round((new Date(d + "T00:00:00Z").getTime() - new Date(hoje + "T00:00:00Z").getTime()) / 864e5);

function tipoLembrete(d: number): string | null {
  if (d <= -1) { const sem = Math.floor((-d - 1) / 7); return sem === 0 ? "atraso" : `atraso_s${sem}`; }
  if (d <= 2) return "lembrete_2d";
  if (d <= 7) return "lembrete_7d";
  if (d <= 15) return "lembrete_15d";
  return null;
}

async function rodar(req: Request) {
  const secret = process.env.CRON_SECRET, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !service) return NextResponse.json({ erro: "CRON_SECRET ou SUPABASE_SERVICE_ROLE_KEY não configurados." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, { auth: { persistSession: false } });
  const app = process.env.APP_URL || "";
  const hoje = hojeSP();
  let lembretes = 0, enviados = 0, falhas = 0, agenda = 0;

  const novo = async (tab: string, id: string, tipo: string, data: string) => {
    const { data: n } = await db.from("lembretes_enviados").upsert({ ref_tabela: tab, ref_id: id, tipo, data_prevista: data }, { onConflict: "ref_tabela,ref_id,tipo,data_prevista", ignoreDuplicates: true }).select("id");
    return !!n && n.length > 0;
  };
  const perfilDe = async (id: string | null) => id ? (await db.from("perfis").select("id,nome,email").eq("id", id).eq("ativo", true).maybeSingle()).data : null;

  // 1) Lembretes por prazo (atividades; entregáveis só quando ainda não têm linhas no cronograma)
  const { data: ats } = await db.from("atividades").select("id,nome,projeto_id,responsavel_id,contato_id,data_prevista,hora_prevista,status,criado_em,projetos(nome,responsavel_id),contato:contatos(nome,email)")
    .not("data_prevista", "is", null).not("status", "in", "(concluido,cancelado)");
  const { data: ents } = await db.from("entregaveis").select("id,nome,projeto_id,responsavel_id,data_prevista,hora_prevista,status,projetos(nome,responsavel_id),atividades(id)")
    .not("responsavel_id", "is", null).not("data_prevista", "is", null).not("status", "in", "(concluido,cancelado)");
  const itens: any[] = [...(ats || []).map((t: any) => ({ tab: "atividades", t })), ...(ents || []).filter((t: any) => !t.atividades?.length).map((t: any) => ({ tab: "entregaveis", t }))];

  for (const { tab, t } of itens) {
    const proj = (t as any).projetos; const pn = proj?.nome || "";
    const quando = `${br(t.data_prevista)}${t.hora_prevista ? " às " + t.hora_prevista.slice(0, 5) : ""}`;
    const rot = tab === "entregaveis" ? "entrega" : "atividade";

    // aviso inicial para contato externo (cliente/parceiro), nos primeiros dias após a criação
    if (tab === "atividades" && t.contato?.email && Date.now() - new Date(t.criado_em).getTime() < 3 * 864e5) {
      if (await novo(tab, t.id, "criacao_contato", t.data_prevista)) {
        await db.from("email_fila").insert({ para: t.contato.email, assunto: `Conectas: ${t.nome}`, corpo: `Olá, ${t.contato.nome}. Há uma ${rot} sob sua responsabilidade no projeto "${pn}": "${t.nome}", prazo ${quando}.`, tipo: "criacao", ref_tabela: tab, ref_id: t.id });
        lembretes++;
      }
    }

    const tipo = tipoLembrete(difDias(t.data_prevista, hoje));
    if (!tipo) continue;
    if (!(await novo(tab, t.id, tipo, t.data_prevista))) continue;
    const d = difDias(t.data_prevista, hoje);
    const txt = d < 0 ? `A ${rot} "${t.nome}" (${pn}) está atrasada: o prazo era ${quando}.` : d === 0 ? `A ${rot} "${t.nome}" (${pn}) vence hoje (${quando}).` : `A ${rot} "${t.nome}" (${pn}) vence em ${d} dia${d === 1 ? "" : "s"} (${quando}).`;
    const assunto = `Conectas: ${d < 0 ? "atrasada" : "prazo em " + (d === 0 ? "hoje" : d + (d === 1 ? " dia" : " dias"))} - ${t.nome}`;
    const dest: { id?: string; nome: string; email: string; resp: boolean }[] = [];
    const r = await perfilDe(t.responsavel_id); if (r) dest.push({ id: r.id, nome: r.nome, email: r.email, resp: true });
    if (t.contato?.email) dest.push({ nome: t.contato.nome, email: t.contato.email, resp: true });
    if (d < 0) { const gp = await perfilDe(proj?.responsavel_id); if (gp && !dest.some(x => x.id === gp.id)) dest.push({ id: gp.id, nome: gp.nome, email: gp.email, resp: false }); }
    for (const x of dest) {
      const corpo = `Olá, ${x.nome}. ${txt}${!x.resp ? " Você está recebendo este aviso por ser o GP do projeto." : ""}`;
      if (x.id) await db.from("notificacoes").insert({ usuario_id: x.id, texto: txt, link: "/projetos/" + t.projeto_id });
      await db.from("email_fila").insert({ usuario_id: x.id || null, para: x.email, assunto, corpo, tipo, ref_tabela: tab, ref_id: t.id });
      lembretes++;
    }
  }

  // 2) Envio da fila
  const { data: fila } = await db.from("email_fila").select("*").is("enviado_em", null).is("erro", null).order("criado_em").limit(50);
  for (const m of fila || []) {
    try {
      let t: any = null;
      if (m.ref_tabela && m.ref_id) t = (await db.from(m.ref_tabela).select("id,nome,descricao,projeto_id,data_prevista,hora_prevista,duracao_min").eq("id", m.ref_id).maybeSingle()).data;
      const url = t && app ? `${app}/projetos/${t.projeto_id}` : undefined;
      const interno = !!m.usuario_id && graphConfigurado();
      // Com o Outlook, quem é da equipe recebe o compromisso direto na agenda; os demais recebem o convite .ics anexado.
      const ics = t?.data_prevista && !interno ? montarIcs({ id: t.id, nome: t.nome, descricao: t.descricao, data: t.data_prevista, hora: t.hora_prevista, duracao: t.duracao_min, url, email: m.para }) : undefined;
      await enviarEmail({ para: m.para, cc: m.cc || undefined, assunto: m.assunto, texto: m.corpo + (url ? `\n\nAbrir no sistema: ${url}` : ""), ics });
      let aviso: string | null = null;
      if (interno && m.tipo === "criacao" && t?.data_prevista) {
        try {
          const { data: g } = await db.from("agenda_graph").select("graph_id").eq("ref_tabela", m.ref_tabela).eq("ref_id", m.ref_id).eq("email", m.para).maybeSingle();
          const gid = await graphUpsertEvento({ email: m.para, graphId: g?.graph_id, titulo: t.nome, descricao: t.descricao || m.corpo, data: t.data_prevista, hora: t.hora_prevista, duracaoMin: t.duracao_min, url });
          await db.from("agenda_graph").upsert({ ref_tabela: m.ref_tabela, ref_id: m.ref_id, email: m.para, graph_id: gid, atualizado_em: new Date().toISOString() }); agenda++;
        } catch (x: any) { aviso = ("Agenda: " + (x.message || x)).slice(0, 400); }
      }
      await db.from("email_fila").update({ enviado_em: new Date().toISOString(), erro: aviso }).eq("id", m.id); enviados++;
    } catch (e: any) { await db.from("email_fila").update({ erro: String(e.message || e).slice(0, 500) }).eq("id", m.id); falhas++; }
  }
  return NextResponse.json({ ok: true, lembretes, enviados, agenda, falhas, outlook: graphConfigurado() });
}
export const GET = rodar; export const POST = rodar;
