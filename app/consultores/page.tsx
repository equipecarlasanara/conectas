"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { hoje, mesBR } from "@/lib/format";

export default function Page() { return <Shell><Consultores /></Shell>; }

// Horas previstas por pessoa no mês contra a capacidade (padrão 22 dias x 8 h = 176 h).
function Consultores() {
  const { perfil } = useAuth();
  const [mes, setMes] = useState(hoje().slice(0, 7)); const [pe, setPe] = useState<any[]>([]); const [at, setAt] = useState<any[]>([]); const [ps, setPs] = useState<any[]>([]);
  const [aberto, setAberto] = useState(""); const [erro, setErro] = useState("");
  const liberado = perfil!.papel === "admin" || !!perfil!.ver_capacidade;
  useEffect(() => { if (!liberado) return; (async () => {
    const ini = mes + "-01"; const [a, m] = mes.split("-").map(Number); const fim = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
    const [p, x, j] = await Promise.all([
      supabase.from("perfis").select("id,nome,papel,carga_horas_mes").eq("ativo", true).order("nome"),
      supabase.from("atividades").select("id,projeto_id,responsavel_id,data_prevista,horas_previstas,status,nome,projetos(nome)").gte("data_prevista", ini).lt("data_prevista", fim).not("responsavel_id", "is", null),
      supabase.from("projetos").select("id,nome,situacao,responsavel_id,apoio_id"),
    ]);
    if (p.error || x.error) { setErro("Não foi possível carregar os dados. Verifique sua permissão e tente de novo."); return; }
    setPe(p.data || []); setAt(x.data || []); setPs(j.data || []);
  })(); }, [mes, liberado]);
  if (!liberado) return <p className="empty">Esta área é restrita. Peça acesso à administração.</p>;
  if (erro) return <p className="erro">{erro}</p>;
  const linhas = pe.map(p => {
    const mine = at.filter(a => a.responsavel_id === p.id && a.status !== "cancelado");
    const prev = mine.reduce((s, a) => s + Number(a.horas_previstas || 0), 0);
    const feito = mine.filter(a => a.status === "concluido").reduce((s, a) => s + Number(a.horas_previstas || 0), 0);
    const cap = Number(p.carga_horas_mes || 176); const uso = cap ? prev / cap * 100 : 0;
    const sem = mine.filter(a => a.horas_previstas == null).length;
    const porProj: Record<string, { n: string; h: number }> = {}; mine.forEach(a => { const o = porProj[a.projeto_id] = porProj[a.projeto_id] || { n: a.projetos?.nome || "", h: 0 }; o.h += Number(a.horas_previstas || 0); });
    const ativos = ps.filter(j => !["concluido", "cancelado"].includes(j.situacao));
    return { p, prev, feito, cap, uso, sem, livre: cap - prev, porProj, gp: ativos.filter(j => j.responsavel_id === p.id).length, lt: ativos.filter(j => j.apoio_id === p.id).length, n: mine.length };
  }).filter(l => l.n > 0 || l.gp > 0 || l.lt > 0 || l.p.papel === "consultor" || l.p.papel === "lider_tecnico");
  const farol = (u: number): [string, string] => u > 100 ? ["Acima da capacidade", "var(--late)"] : u >= 80 ? ["Atenção", "var(--s2)"] : ["Com folga", "var(--s3)"];
  return (<>
    <header className="cx-head"><h1>Consultores: horas e capacidade</h1><label className="f">Mês<input type="month" value={mes} onChange={e => setMes(e.target.value)} /></label></header>
    <p className="meta">Horas previstas das atividades com prazo em {mesBR(mes)} contra a capacidade mensal da pessoa (padrão 176 h = 22 dias x 8 h; ajuste na Administração). Verde até 80%, amarelo de 80% a 100%, vermelho acima de 100%. Atividades sem horas previstas não entram na conta.</p>
    <section className="bx"><div className="tw">{linhas.length === 0 ? <p className="empty">Nenhuma atividade com responsável neste mês.</p> :
      <table><thead><tr><th>Pessoa</th><th>Projetos (GP / líder técnico)</th><th>Horas previstas</th><th>Capacidade</th><th>Estoque livre</th><th>Uso</th><th>Farol</th></tr></thead><tbody>
        {linhas.map(l => { const [t, c] = farol(l.uso); return <Fragment key={l.p.id}><tr style={{ cursor: "pointer" }} onClick={() => setAberto(aberto === l.p.id ? "" : l.p.id)}>
          <td><b>{l.p.nome}</b><div className="meta">{l.n} atividade{l.n === 1 ? "" : "s"}{l.sem ? ` · ${l.sem} sem horas` : ""}</div></td><td>{l.gp} / {l.lt}</td>
          <td>{l.prev.toLocaleString("pt-BR")} h<div className="meta">{l.feito.toLocaleString("pt-BR")} h concluídas</div></td><td>{l.cap.toLocaleString("pt-BR")} h</td><td>{l.livre.toLocaleString("pt-BR")} h</td>
          <td>{Math.round(l.uso)}%</td><td><span className="dot" style={{ background: c }} />{t}</td></tr>
          {aberto === l.p.id && <tr><td colSpan={7}>{Object.entries(l.porProj).sort((a, b) => b[1].h - a[1].h).map(([id, o]) => <div key={id} className="meta"><Link href={`/projetos/${id}`}>{o.n}</Link>: {o.h.toLocaleString("pt-BR")} h</div>)}</td></tr>}</Fragment>; })}
      </tbody></table>}</div></section>
  </>);
}
