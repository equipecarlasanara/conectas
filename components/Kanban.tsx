"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { STATUS, STATUS_COR, RESP, dataBR, prazoTag, atrasado, hoje, brl } from "@/lib/format";

// Kanban de atividades: arraste o cartão para outra coluna ou use a lista de status do cartão.
export default function Kanban({ atividades, recarregar, mostrarProjeto, pessoas = [], onEditar, mostrarValor = false, tipos = [] }: { atividades: any[]; recarregar: () => void; mostrarProjeto?: boolean; pessoas?: any[]; onEditar?: (a: any) => void; mostrarValor?: boolean; tipos?: any[] }) {
  const [erro, setErro] = useState(""); const [sobre, setSobre] = useState("");
  const [listaTipos, setListaTipos] = useState<any[]>(tipos);
  const colunas = Object.keys(STATUS);

  useEffect(() => {
    if (tipos.length > 0) {
      setListaTipos(tipos);
    } else {
      supabase.from("tipos_entregavel").select("id,nome").eq("ativo", true).order("nome").then((r: any) => setListaTipos(r.data || []));
    }
  }, [tipos]);

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
  async function classificarEntregavel(a: any, tid: string) {
    await supabase.from("atividades").update({ tipo_id: tid || null }).eq("id", a.id);
    if (a.entregavel_id) {
      await supabase.from("entregaveis").update({ tipo_id: tid || null }).eq("id", a.entregavel_id);
    }
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
          const tipoAtualId = a.tipo_id || a.entregaveis?.tipo_id || "";
          const nomeTipo = a.tipos_entregavel?.nome || a.entregaveis?.tipos_entregavel?.nome || listaTipos.find((x: any) => x.id === tipoAtualId)?.nome || "";
          return <div key={a.id} className={"kcard" + (atrasado(a.data_prevista, a.status) ? " late" : "")} draggable onDragStart={e => e.dataTransfer.setData("text/plain", a.id)}>
            <h3>{a.nome}</h3>
            {a.entregaveis?.nome && <div className="meta">Entrega: {a.entregaveis.nome}{a.entregaveis?.macroetapas?.nome ? ` · ${a.entregaveis.macroetapas.nome}` : ""}</div>}
            {mostrarProjeto && a.projetos?.nome && <div className="meta"><Link href={`/projetos/${a.projeto_id}`}>{a.projetos.nome}</Link>{a.projetos?.tipo_projeto ? ` · ${a.projetos.tipo_projeto}` : ""}</div>}
            <div className="meta">{RESP[a.responsabilidade]}{a.resp?.nome ? " · " + a.resp.nome : a.contato?.nome ? " · " + a.contato.nome + " (externo)" : ""} · {dataBR(a.data_prevista)}{a.hora_prevista ? " às " + a.hora_prevista.slice(0, 5) : ""}</div>
            <div style={{ marginTop: 4 }}>{nomeTipo && <span className="tag">{nomeTipo}</span>}{t && <span className={"tag " + t.c}>{t.t}</span>}{a.logistica && <span className="tag">Logística</span>}{a.prioridade === "alta" && <span className="tag alta">Alta</span>}{mostrarValor && a.gera_receita && a.valor != null && <span className="tag">{brl(a.valor)}</span>}</div>
            {a.pendencia && <div className="meta">Pendência: {a.pendencia}</div>}
            <label className="meta" style={{ display: "block", marginTop: 6 }}>Entregável<select aria-label="Classificação do entregável" value={tipoAtualId} onChange={e => classificarEntregavel(a, e.target.value)} style={{ padding: "3px 6px", fontSize: 13, width: "100%" }}><option value="">Classificar entregável...</option>{listaTipos.map((tp: any) => <option key={tp.id} value={tp.id}>{tp.nome}</option>)}</select></label>
            <label className="meta" style={{ display: "block", marginTop: 6 }}>Responsável<select aria-label="Responsável" value={a.responsavel_id || ""} onChange={e => atribuir(a, e.target.value)} style={{ padding: "3px 6px", fontSize: 13, width: "100%" }}><option value="">Definir</option>{pessoas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
            {onEditar && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => onEditar(a)}>Editar atividade</button>}
            <select aria-label="Mover para" value={a.status} onChange={e => mover(a, e.target.value)} style={{ marginTop: 6, padding: "3px 6px", fontSize: 13, width: "100%" }}>{colunas.map(k => <option key={k} value={k}>{STATUS[k]}</option>)}</select>
          </div>; })}
      </div>; })}</div>
  </>);
}
