"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { STATUS, dataBR, prazoTag, hoje } from "@/lib/format";

export default function Page() { return <Shell><Minhas /></Shell>; }
function Minhas() {
  const { perfil } = useAuth();
  const [l, setL] = useState<any[]>([]);
  const [ent, setEnt] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    const { data } = await supabase.from("atividades").select("*, projetos(nome), entregaveis(nome,tipo_id,tipos_entregavel(nome))").eq("responsavel_id", perfil!.id).order("data_prevista");
    setL(data || []);
    setEnt((await supabase.from("entregaveis").select("id,nome,tipo_id,status,data_prevista,projeto_id,projetos(nome),tipos_entregavel(nome)").eq("responsavel_id", perfil!.id).order("data_prevista")).data || []);
    setTipos((await supabase.from("tipos_entregavel").select("id,nome").eq("ativo", true).order("nome")).data || []);
  };
  useEffect(() => { carregar(); }, []);

  async function mudar(a: any, status: string) {
    const { error } = await supabase.from("atividades").update({ status, data_realizada: status === "concluido" ? hoje() : null }).eq("id", a.id);
    setErro(error ? "Não foi possível salvar a última alteração. Verifique sua permissão e tente de novo." : ""); carregar();
  }
  async function mudarTipoEnt(eid: string, tid: string) {
    await supabase.from("entregaveis").update({ tipo_id: tid || null }).eq("id", eid);
    carregar();
  }
  async function mudarTipoAtiv(a: any, tid: string) {
    await supabase.from("atividades").update({ tipo_id: tid || null }).eq("id", a.id);
    if (a.entregavel_id) await supabase.from("entregaveis").update({ tipo_id: tid || null }).eq("id", a.entregavel_id);
    carregar();
  }

  const vis = l.filter(a => mostrar || (a.status !== "concluido" && a.status !== "cancelado"));
  return (<>
    <header className="cx-head"><h1>Minhas atividades</h1><label className="meta"><input type="checkbox" checked={mostrar} onChange={e => setMostrar(e.target.checked)} /> Mostrar concluídas</label></header>
    {erro && <p className="erro">{erro}</p>}
    <section className="bx"><h2>Minhas entregas</h2><div className="tw">{ent.filter(e => mostrar || (e.status !== "concluido" && e.status !== "cancelado")).length === 0 ? <p className="empty">Nenhuma entrega sob sua responsabilidade.</p> :
      <table><thead><tr><th>Entrega</th><th>Entregável (Classificação)</th><th>Projeto</th><th>Prazo</th><th>Status</th></tr></thead><tbody>
        {ent.filter(e => mostrar || (e.status !== "concluido" && e.status !== "cancelado")).map(e => { const t = prazoTag(e.data_prevista, e.status); return <tr key={e.id}>
          <td><b>{e.nome}</b></td>
          <td><select value={e.tipo_id || ""} onChange={ev => mudarTipoEnt(e.id, ev.target.value)}><option value="">Classificar entregável...</option>{tipos.map(tp => <option key={tp.id} value={tp.id}>{tp.nome}</option>)}</select></td>
          <td><Link href={`/projetos/${e.projeto_id}`}>{e.projetos?.nome}</Link></td>
          <td>{dataBR(e.data_prevista)} {t && <span className={"tag " + t.c}>{t.t}</span>}</td>
          <td>{STATUS[e.status]}</td></tr>; })}
      </tbody></table>}</div></section>
    <section className="bx"><h2>Minhas atividades</h2><div className="tw">{vis.length === 0 ? <p className="empty">Nenhuma atividade atribuída a você. Quando alguém atribuir, ela aparece aqui.</p> :
      <table><thead><tr><th>Atividade</th><th>Entregável (Classificação)</th><th>Projeto</th><th>Prazo</th><th>Status</th></tr></thead><tbody>
        {vis.map(a => { const t = prazoTag(a.data_prevista, a.status); const tid = a.tipo_id || a.entregaveis?.tipo_id || ""; return <tr key={a.id}>
          <td><b>{a.nome}</b><div className="meta">{a.entregaveis?.nome}</div></td>
          <td><select value={tid} onChange={ev => mudarTipoAtiv(a, ev.target.value)}><option value="">Classificar entregável...</option>{tipos.map(tp => <option key={tp.id} value={tp.id}>{tp.nome}</option>)}</select></td>
          <td><Link href={`/projetos/${a.projeto_id}`}>{a.projetos?.nome}</Link></td>
          <td>{dataBR(a.data_prevista)} {t && <span className={"tag " + t.c}>{t.t}</span>}</td>
          <td><select value={a.status} onChange={e => mudar(a, e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td></tr>; })}
      </tbody></table>}</div></section>
  </>);
}
