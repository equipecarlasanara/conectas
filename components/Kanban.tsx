"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { STATUS, STATUS_COR, RESP, dataBR, prazoTag, atrasado, hoje, brl } from "@/lib/format";

// Kanban de atividades: arraste o cartão para outra coluna ou use a lista de status do cartão.
export default function Kanban({ atividades, recarregar, mostrarProjeto, pessoas = [], onEditar, mostrarValor = false }: { atividades: any[]; recarregar: () => void; mostrarProjeto?: boolean; pessoas?: any[]; onEditar?: (a: any) => void; mostrarValor?: boolean }) {
  const [erro, setErro] = useState(""); const [sobre, setSobre] = useState("");
  const colunas = Object.keys(STATUS);
  async function mover(a: any, status: string) {
    if (a.status === status) return;
    const { data, error } = await supabase.from("atividades").update({ status, data_realizada: status === "concluido" ? hoje() : null }).eq("id", a.id).select("id");
    if (error || !data || data.length === 0) setErro("Não foi possível salvar a última alteração. Verifique sua permissão e tente de novo."); else setErro("");
    recarregar();
  }
  async function atribuir(a: any, pid: string) {
    const { data, error } = await supabase.from("atividades").update({ responsavel_id: pid || null }).eq("id", a.id).select("id");
    if (error || !data || data.length === 0) setErro("Não foi possível salvar a última alteração. Verifique sua permissão e tente de novo."); else setErro("");
    recarregar();
  }
  return (<>
    {erro && <p className="erro">{erro}</p>}
    <div className="kan">{colunas.map(s => {
      const itens = atividades.filter(a => a.status === s);
      return <div key={s} className={"col" + (sobre === s ? " over" : "")} style={{ ["--c" as any]: STATUS_COR[s] }}
        onDragOver={e => { e.preventDefault(); setSobre(s); }} onDragLeave={() => setSobre("")}
        onDrop={e => { e.preventDefault(); setSobre(""); const a = atividades.find(x => x.id === e.dataTransfer.getData("text/plain")); if (a) mover(a, s); }}>
        <h2><span><span className="dot" style={{ background: STATUS_COR[s] }} />{STATUS[s]}</span><span className="meta">{itens.length}</span></h2>
        {itens.length === 0 && <p className="meta" style={{ padding: 8 }}>Nenhuma atividade.</p>}
        {itens.map(a => { const t = prazoTag(a.data_prevista, a.status);
          return <div key={a.id} className={"kcard" + (atrasado(a.data_prevista, a.status) ? " late" : "")} draggable onDragStart={e => e.dataTransfer.setData("text/plain", a.id)}>
            <h3>{a.nome}</h3>
            {a.entregaveis?.nome && <div className="meta">Entregável: {a.entregaveis.nome}</div>}
            {mostrarProjeto && a.projetos?.nome && <div className="meta"><Link href={`/projetos/${a.projeto_id}`}>{a.projetos.nome}</Link></div>}
            <div className="meta">{RESP[a.responsabilidade]}{a.resp?.nome ? " · " + a.resp.nome : a.contato?.nome ? " · " + a.contato.nome + " (externo)" : ""} · {dataBR(a.data_prevista)}{a.hora_prevista ? " às " + a.hora_prevista.slice(0, 5) : ""}</div>
            <div style={{ marginTop: 4 }}>{t && <span className={"tag " + t.c}>{t.t}</span>}{a.logistica && <span className="tag">Logística</span>}{a.prioridade === "alta" && <span className="tag alta">Alta</span>}{mostrarValor && a.gera_receita && a.valor != null && <span className="tag">{brl(a.valor)}</span>}</div>
            {a.pendencia && <div className="meta">Pendência: {a.pendencia}</div>}
            <label className="meta" style={{ display: "block", marginTop: 6 }}>Responsável<select aria-label="Responsável" value={a.responsavel_id || ""} onChange={e => atribuir(a, e.target.value)} style={{ padding: "3px 6px", fontSize: 13, width: "100%" }}><option value="">Definir</option>{pessoas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
            {onEditar && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => onEditar(a)}>Editar atividade</button>}
            <select aria-label="Mover para" value={a.status} onChange={e => mover(a, e.target.value)} style={{ marginTop: 6, padding: "3px 6px", fontSize: 13, width: "100%" }}>{colunas.map(k => <option key={k} value={k}>{STATUS[k]}</option>)}</select>
          </div>; })}
      </div>; })}</div>
  </>);
}
