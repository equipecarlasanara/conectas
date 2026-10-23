"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Dialog from "@/components/Dialog";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";

export default function Page() { return <Shell><Clientes /></Shell>; }
function Clientes() {
  const { perfil } = useAuth();
  const pode = perfil!.papel === "admin" || perfil!.papel === "gestora" || perfil!.papel === "lider_tecnico";
  const [lista, setLista] = useState<any[]>([]); const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState(""); const [doc, setDoc] = useState(""); const [obs, setObs] = useState(""); const [erro, setErro] = useState("");
  const carregar = async () => { const { data } = await supabase.from("clientes").select("*, projetos(id)").order("nome"); setLista(data || []); };
  useEffect(() => { carregar(); }, []);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const { error } = await supabase.from("clientes").insert({ nome, documento: doc || null, observacoes: obs || null });
    if (error) { setErro("Não foi possível salvar. Verifique sua permissão e tente de novo."); return; }
    setNovo(false); setNome(""); setDoc(""); setObs(""); carregar();
  }
  return (<>
    <header className="cx-head"><h1>Clientes</h1>{pode && <button className="btn p" onClick={() => setNovo(true)}>Novo cliente</button>}</header>
    <section className="bx"><div className="tw">{lista.length === 0 ? <p className="empty">Nenhum cliente ainda. Cadastre o primeiro para criar projetos.</p> :
      <table><thead><tr><th>Cliente</th><th>CNPJ / documento</th><th>Projetos</th></tr></thead><tbody>
        {lista.map(c => <tr key={c.id}><td><b>{c.nome}</b><div className="meta">{c.observacoes}</div></td><td>{c.documento || "-"}</td><td>{c.projetos?.length || 0}</td></tr>)}
      </tbody></table>}</div></section>
    {novo && <Dialog titulo="Novo cliente" onClose={() => setNovo(false)}>
      <form onSubmit={salvar}><div className="fg">
        <label className="f w">Nome do cliente<input required value={nome} onChange={e => setNome(e.target.value)} /></label>
        <label className="f w">CNPJ ou documento<input value={doc} onChange={e => setDoc(e.target.value)} /></label>
        <label className="f w">Observações<textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} /></label>
      </div>{erro && <p className="erro">{erro}</p>}
      <div className="acts"><button type="button" className="btn" onClick={() => setNovo(false)}>Cancelar</button><button className="btn p">Salvar</button></div></form>
    </Dialog>}
  </>);
}
