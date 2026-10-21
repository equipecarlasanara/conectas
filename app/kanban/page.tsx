"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Kanban from "@/components/Kanban";
import { supabase } from "@/lib/supabase";

export default function Page() { return <Shell><Quadro /></Shell>; }
function Quadro() {
  const [l, setL] = useState<any[]>([]); const [ps, setPs] = useState<any[]>([]); const [pe, setPe] = useState<any[]>([]);
  const [f, setF] = useState({ proj: "", resp: "", q: "" });
  const carregar = async () => {
    setL((await supabase.from("atividades").select("*, projetos(nome), resp:perfis(nome), contato:contatos(nome), entregaveis(nome)").order("data_prevista")).data || []);
    setPs((await supabase.from("projetos").select("id,nome").order("nome")).data || []);
    setPe((await supabase.from("perfis").select("id,nome").eq("ativo", true).order("nome")).data || []);
  };
  useEffect(() => { carregar(); }, []);
  const vis = l.filter(a => (!f.proj || a.projeto_id === f.proj) && (!f.resp || a.responsavel_id === f.resp) && (!f.q || a.nome.toLowerCase().includes(f.q.toLowerCase())));
  return (<>
    <header className="cx-head"><h1>Cronograma</h1></header>
    <section className="fbar">
      <label className="f">Buscar<input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Nome da atividade" /></label>
      <label className="f">Projeto<select value={f.proj} onChange={e => setF({ ...f, proj: e.target.value })}><option value="">Todos</option>{ps.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">Responsável<select value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })}><option value="">Todos</option>{pe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <button className="btn" onClick={() => setF({ proj: "", resp: "", q: "" })}>Limpar filtros</button>
    </section>
    <p className="meta">Arraste um cartão para mudar o status, ou use a lista dentro do cartão. Só quem pode editar o projeto consegue alterar.</p>
    <Kanban atividades={vis} recarregar={carregar} mostrarProjeto pessoas={pe} />
  </>);
}
