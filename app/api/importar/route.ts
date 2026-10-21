import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { ehCronograma, lerCronograma } from "@/lib/importar/cronograma";
import { extrairComIA } from "@/lib/importar/ia";

export const maxDuration = 120;

// Lê o arquivo enviado pelo comercial/equipe e devolve uma PRÉVIA estruturada. Nada é gravado aqui.
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ erro: "Sessão inválida. Entre novamente." }, { status: 401 });
  const quem = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await quem.auth.getUser(token);
  if (!u?.user) return NextResponse.json({ erro: "Sessão inválida. Entre novamente." }, { status: 401 });
  const { data: me } = await quem.from("perfis").select("papel,ativo").eq("id", u.user.id).maybeSingle();
  if (!me || !me.ativo || !["admin", "gestora"].includes(me.papel)) return NextResponse.json({ erro: "Sem permissão para importar projetos." }, { status: 403 });

  const form = await req.formData(); const f = form.get("arquivo") as File | null; const aba = String(form.get("aba") || "");
  if (!f) return NextResponse.json({ erro: "Envie um arquivo." }, { status: 400 });
  if (f.size > 25 * 1024 * 1024) return NextResponse.json({ erro: "O arquivo passa de 25 MB." }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer()); const nome = f.name.toLowerCase();

  try {
    if (/\.(xlsx|xlsm|xls|csv)$/.test(nome)) {
      const wb = XLSX.read(buf, { cellDates: true });
      const abas = wb.SheetNames.map(n => ({ n, rows: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }) }));
      const cron = abas.filter(a => ehCronograma(a.rows));
      if (cron.length > 0) {
        if (cron.length > 1 && !aba) return NextResponse.json({ escolher_aba: cron.map(a => { const r = lerCronograma(a.rows, a.n); return { aba: a.n, cliente: r.cliente, atividades: r.total.atividades }; }) });
        const alvo = cron.find(a => a.n === aba) || cron[0];
        const r = lerCronograma(alvo.rows, alvo.n);
        return NextResponse.json({ ...r, fonte: "cronograma" });
      }
      const texto = abas.map(a => `### Aba: ${a.n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[a.n])).join("\n\n");
      return NextResponse.json(await extrairComIA({ texto }));
    }
    if (nome.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return NextResponse.json(await extrairComIA({ texto: value }));
    }
    if (nome.endsWith(".pdf")) return NextResponse.json(await extrairComIA({ pdfBase64: buf.toString("base64") }));
    if (nome.endsWith(".txt")) return NextResponse.json(await extrairComIA({ texto: buf.toString("utf8") }));
    return NextResponse.json({ erro: "Formato não suportado. Envie PDF, DOCX ou XLSX." }, { status: 400 });
  } catch (e: any) {
    if (e?.message === "SEM_CHAVE") return NextResponse.json({ erro: "A leitura por IA ainda não está ativada neste sistema (falta a chave ANTHROPIC_API_KEY). Planilhas no formato de cronograma funcionam sem IA; os demais arquivos você pode preencher manualmente." }, { status: 501 });
    return NextResponse.json({ erro: "Não foi possível ler o arquivo: " + String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
