import { createClient } from "@supabase/supabase-js";
import { montarFeed, Ev } from "@/lib/ics";

export const dynamic = "force-dynamic";

// Feed privado para assinar no Outlook: GET /api/calendario/<token>.ics
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await ctx.params; const token = bruto.replace(/\.ics$/i, "");
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service || !/^[0-9a-f-]{36}$/i.test(token)) return new Response("Link inválido.", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, { auth: { persistSession: false } });
  const { data: t } = await db.from("calendario_tokens").select("usuario_id,tipo").eq("token", token).maybeSingle();
  if (!t) return new Response("Link inválido ou revogado.", { status: 404 });
  const { data: u } = await db.from("perfis").select("ativo").eq("id", t.usuario_id).maybeSingle();
  if (!u?.ativo) return new Response("Acesso desativado.", { status: 403 });

  const app = process.env.APP_URL || ""; const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const evs: Ev[] = [];
  const { data: ents } = await db.from("entregaveis").select("id,nome,projeto_id,escopo_id,data_prevista,hora_prevista,duracao_min,status,responsavel_id,projetos(nome,escopo_vigente_id,codigo),resp:perfis(nome)")
    .not("data_prevista", "is", null).gte("data_prevista", desde).neq("status", "cancelado");
  for (const e of (ents || []) as any[]) {
    if (e.projetos?.escopo_vigente_id !== e.escopo_id) continue;
    if (t.tipo === "minhas" && (e.responsavel_id !== t.usuario_id || e.status === "concluido")) continue;
    evs.push({ id: "e" + e.id, titulo: `[${e.projetos?.nome}] ${e.nome}`, descricao: `Entrega · Responsável: ${e.resp?.nome || "não definido"}`, data: e.data_prevista, hora: e.hora_prevista, duracao: e.duracao_min, url: app ? `${app}/projetos/${e.projeto_id}` : undefined });
  }
  if (t.tipo === "minhas") {
    const { data: ats } = await db.from("atividades").select("id,nome,projeto_id,data_prevista,hora_prevista,duracao_min,status,projetos(nome)").eq("responsavel_id", t.usuario_id)
      .not("data_prevista", "is", null).gte("data_prevista", desde).not("status", "in", "(concluido,cancelado)");
    for (const a of (ats || []) as any[]) evs.push({ id: "a" + a.id, titulo: `[${a.projetos?.nome}] ${a.nome}`, descricao: "Atividade", data: a.data_prevista, hora: a.hora_prevista, duracao: a.duracao_min, url: app ? `${app}/projetos/${a.projeto_id}` : undefined });
  }
  return new Response(montarFeed(t.tipo === "geral" ? "Conectas - Calendário de entregas" : "Conectas - Minhas tarefas", evs), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
