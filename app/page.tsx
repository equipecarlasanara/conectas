"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { SITUACAO, brk, dias, atrasado, mesBR, dataBR, STATUS } from "@/lib/format";

export default function Home() { return <Shell><Visao /></Shell>; }

function Visao() {
  const { perfil } = useAuth();
  const [d, setD] = useState<any>(null); const [erro, setErro] = useState("");
  const bloq = perfil!.papel !== "admin" && perfil!.ver_geral === false;
  useEffect(() => { if (bloq) return; (async () => {
    const [p, e, a, ev] = await Promise.all([
      supabase.from("projetos").select("id,nome,situacao,tipo_projeto,escopo_vigente_id,responsavel_id,apoio_id,clientes(nome),perfis!projetos_responsavel_id_fkey(nome),lt:perfis!projetos_apoio_id_fkey(nome)"),
      supabase.from("entregaveis").select("id,projeto_id,escopo_id,nome,data_prevista,status,gera_receita,alocacoes_valor(valor)"),
      supabase.from("atividades").select("id,projeto_id,nome,data_prevista,status,responsavel_id"),
      supabase.from("eventos_receita").select("id,valor,status,competencia"),
    ]);
    if (p.error || e.error || a.error) { setErro("Não foi possível carregar os dados. Verifique sua permissão e tente de novo."); return; }
    setD({ p: p.data || [], e: e.data || [], a: a.data || [], ev: ev.data || [] });
  })(); }, []);
  if (bloq) return <p className="empty">Você não tem acesso à Visão geral. Use a aba Projetos ou Minhas atividades.</p>;
  if (erro) return <p className="erro">{erro}</p>;
  if (!d) return <p className="empty">Carregando...</p>;

  const vigentes = new Map(d.p.map((x: any) => [x.id, x.escopo_vigente_id]));
  const ents = d.e.filter((x: any) => vigentes.get(x.projeto_id) === x.escopo_id);
  const ativos = d.p.filter((x: any) => !["concluido", "cancelado"].includes(x.situacao));
  const porSit: Record<string, number> = {}; d.p.forEach((x: any) => porSit[x.situacao] = (porSit[x.situacao] || 0) + 1);
  const abertas = ents.filter((x: any) => x.status !== "concluido" && x.status !== "cancelado");
  const prox = (n: number) => abertas.filter((x: any) => x.data_prevista && dias(x.data_prevista)! >= 0 && dias(x.data_prevista)! <= n).length;
  const entAtr = abertas.filter((x: any) => atrasado(x.data_prevista, x.status));
  const ativAtr = d.a.filter((x: any) => atrasado(x.data_prevista, x.status));
  const porResp: Record<string, number> = {}; ativos.forEach((x: any) => { const n = x.perfis?.nome || "Sem GP"; porResp[n] = (porResp[n] || 0) + 1; });
  const maxR = Math.max(1, ...Object.values(porResp));
  const porTipo: Record<string, number> = {}; d.p.forEach((x: any) => { const k = x.tipo_projeto || "Sem tipo"; porTipo[k] = (porTipo[k] || 0) + 1; });
  const porCons: Record<string, any> = {}; d.p.forEach((x: any) => { const k = x.perfis?.nome || "Sem GP"; const o = porCons[k] = porCons[k] || { t: 0, and: 0, fin: 0 }; o.t++; if (x.situacao === "concluido" || x.situacao === "pausado" || x.situacao === "cancelado") o.fin++; else o.and++; });
  const porLT: Record<string, any> = {}; d.p.filter((x: any) => x.apoio_id).forEach((x: any) => { const k = x.lt?.nome || "-"; const o = porLT[k] = porLT[k] || { t: 0, and: 0, fin: 0 }; o.t++; if (["concluido", "pausado", "cancelado"].includes(x.situacao)) o.fin++; else o.and++; });
  const finOk = perfil!.fin !== "nenhum";
  const prevMes: Record<string, number> = {}; ents.forEach((x: any) => { const v = x.alocacoes_valor?.valor ?? x.alocacoes_valor?.[0]?.valor; if (x.gera_receita && x.data_prevista && v) { const k = x.data_prevista.slice(0, 7); prevMes[k] = (prevMes[k] || 0) + Number(v); } });
  const recMes: Record<string, number> = {}; d.ev.filter((x: any) => x.status === "reconhecida").forEach((x: any) => { const k = (x.competencia || "").slice(0, 7); if (k) recMes[k] = (recMes[k] || 0) + Number(x.valor); });
  const pend = d.ev.filter((x: any) => x.status === "pendente").reduce((s: number, x: any) => s + Number(x.valor), 0);
  const meses = Array.from(new Set([...Object.keys(prevMes), ...Object.keys(recMes)])).sort();
  const maxM = Math.max(1, ...meses.map(m => Math.max(prevMes[m] || 0, recMes[m] || 0)));

  return (<>
    <header className="cx-head"><h1>Visão geral</h1><Link href="/projetos" className="btn p">Ver projetos</Link></header>
    <section className="sum">
      <div><b>{ativos.length}</b><span>Projetos ativos</span></div>
      <div><b>{prox(7)}</b><span>Entregas em 7 dias</span></div>
      <div><b>{prox(15)}</b><span>Entregas em 15 dias</span></div>
      <div><b>{prox(30)}</b><span>Entregas em 30 dias</span></div>
      <div className="l"><b>{entAtr.length}</b><span>Entregas atrasadas</span></div>
      <div className="l"><b>{ativAtr.length}</b><span>Atividades atrasadas</span></div>
      {finOk && <div><b>{brk(pend)}</b><span>Receita a validar</span></div>}
    </section>
    <div className="ch">
      <section className="bx"><h2>Projetos por status</h2>
        {d.p.length === 0 ? <p className="empty">Nenhum projeto ainda. Crie o primeiro em Projetos.</p> :
          Object.entries(porSit).map(([k, v]) => <div className="hb" key={k}><span>{SITUACAO[k]}</span><span className="t"><i style={{ width: (v as number) / d.p.length * 100 + "%", background: "var(--s1)" }} /></span><b>{v as number}</b></div>)}
      </section>
      <section className="bx"><h2>Projetos por tipo</h2>{d.p.length === 0 ? <p className="empty">Sem projetos.</p> : Object.entries(porTipo).map(([k, v]) => <div className="hb" key={k}><span>{k}</span><span className="t"><i style={{ width: (v as number) / d.p.length * 100 + "%", background: "var(--s2)" }} /></span><b>{v as number}</b></div>)}</section>
      <section className="bx"><h2>Projetos por GP</h2>{Object.keys(porCons).length === 0 ? <p className="empty">Sem projetos.</p> : <div className="tw"><table><thead><tr><th>GP</th><th>Total</th><th>Em andamento</th><th>Finalizado ou pausado</th></tr></thead><tbody>{Object.entries(porCons).map(([k, v]: any) => <tr key={k}><td>{k}</td><td>{v.t}</td><td>{v.and}</td><td>{v.fin}</td></tr>)}</tbody></table></div>}</section>
      <section className="bx"><h2>Projetos por líder técnico</h2>{Object.keys(porLT).length === 0 ? <p className="empty">Nenhum projeto com líder técnico definido.</p> : <div className="tw"><table><thead><tr><th>Líder técnico</th><th>Total</th><th>Em andamento</th><th>Finalizado ou pausado</th></tr></thead><tbody>{Object.entries(porLT).map(([k, v]: any) => <tr key={k}><td>{k}</td><td>{v.t}</td><td>{v.and}</td><td>{v.fin}</td></tr>)}</tbody></table></div>}</section>
      <section className="bx"><h2>Projetos ativos por GP</h2>
        {ativos.length === 0 ? <p className="empty">Sem projetos ativos.</p> :
          Object.entries(porResp).map(([k, v]) => <div className="hb" key={k}><span>{k}</span><span className="t"><i style={{ width: (v as number) / maxR * 100 + "%", background: "var(--brand)" }} /></span><b>{v as number}</b></div>)}
      </section>
      {finOk && <section className="bx"><h2>Receita por mês</h2>
        {meses.length === 0 ? <p className="empty">Nenhum valor lançado. Vincule valores aos entregáveis dos projetos.</p> :
          meses.map(m => <div key={m}><div className="hb"><span>{mesBR(m)} previsto</span><span className="t"><i style={{ width: (prevMes[m] || 0) / maxM * 100 + "%", background: "var(--s1)" }} /></span><b>{brk(prevMes[m] || 0)}</b></div>
            <div className="hb"><span>{mesBR(m)} reconhecido</span><span className="t"><i style={{ width: (recMes[m] || 0) / maxM * 100 + "%", background: "var(--s3)" }} /></span><b>{brk(recMes[m] || 0)}</b></div></div>)}
      </section>}
      <section className="bx"><h2>Entregas atrasadas</h2>
        {entAtr.length === 0 ? <p className="empty">Nenhuma entrega atrasada.</p> :
          <div className="tw"><table><thead><tr><th>Entrega</th><th>Prazo</th><th>Status</th></tr></thead><tbody>
            {entAtr.map((x: any) => <tr key={x.id}><td><Link href={`/projetos/${x.projeto_id}`}>{x.nome}</Link></td><td>{dataBR(x.data_prevista)}</td><td>{STATUS[x.status]}</td></tr>)}
          </tbody></table></div>}
      </section>
    </div>
  </>);
}
