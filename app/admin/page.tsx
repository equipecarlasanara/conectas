"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import Dialog from "@/components/Dialog";
import { PAPEL, FIN, ACESSO, dataBR } from "@/lib/format";

export default function Page() { return <Shell><Admin /></Shell>; }
function Admin() {
  const { perfil } = useAuth();
  const [u, setU] = useState<any[]>([]); const [s, setS] = useState<any[]>([]); const [erro, setErro] = useState("");
  const [nu, setNu] = useState({ nome: "", email: "", senha: "", papel: "gestora", fin: "nenhum" }); const [ok, setOk] = useState("");
  const [perm, setPerm] = useState<any>(null);
  const [sub, setSub] = useState({ ausente: "", substituta: "", ini: "", fim: "" });
  const carregar = async () => {
    setU((await supabase.from("perfis").select("*").order("nome")).data || []);
    setS((await supabase.from("substituicoes").select("*").order("inicio", { ascending: false })).data || []);
  };
  useEffect(() => { carregar(); }, []);
  if (perfil!.papel !== "admin") return <p className="empty">Esta área é restrita à administração.</p>;
  async function upd(id: string, campos: any) {
    const { error } = await supabase.from("perfis").update(campos).eq("id", id);
    setErro(error ? "Não foi possível salvar a última alteração. Verifique sua permissão e tente de novo." : ""); carregar();
  }
  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("substituicoes").insert({ ausente_id: sub.ausente, substituta_id: sub.substituta, inicio: sub.ini, fim: sub.fim, criado_por: perfil!.id });
    setErro(error ? "Não foi possível registrar a substituição. Confira as datas e as pessoas." : ""); carregar();
  }
  async function cadastrar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setOk("");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/usuarios", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(nu) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.erro || "Não foi possível cadastrar. Tente de novo."); return; }
    setOk(`Usuário cadastrado. Passe o e-mail e a senha provisória para ${nu.nome}.`); setNu({ nome: "", email: "", senha: "", papel: "gestora", fin: "nenhum" }); carregar();
  }
  const nome = (id: string) => u.find(x => x.id === id)?.nome || "-";
  return (<>
    <header className="cx-head"><h1>Administração</h1></header>
    {erro && <p className="erro">{erro}</p>}{ok && <p className="meta">{ok}</p>}
    <section className="bx"><h2>Cadastrar usuário</h2>
      <p className="meta">O e-mail cadastrado libera o acesso e também recebe os alertas de tarefas, entregas e agenda.</p>
      <form className="fbar" onSubmit={cadastrar}>
        <label className="f">Nome<input required value={nu.nome} onChange={e => setNu({ ...nu, nome: e.target.value })} /></label>
        <label className="f">E-mail<input type="email" required value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} /></label>
        <label className="f">Senha provisória<input required minLength={8} value={nu.senha} onChange={e => setNu({ ...nu, senha: e.target.value })} /></label>
        <label className="f">Papel<select value={nu.papel} onChange={e => setNu({ ...nu, papel: e.target.value })}>{Object.entries(PAPEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="f">Financeiro<select value={nu.fin} onChange={e => setNu({ ...nu, fin: e.target.value })}>{Object.entries(FIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="btn p">Cadastrar usuário</button></form></section>
    <section className="bx"><h2>Usuários e permissões</h2>
      <div className="tw"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Financeiro</th><th>Ativo</th><th>Acessos</th></tr></thead><tbody>
        {u.map(x => <tr key={x.id}><td>{x.nome}</td><td>{x.email}</td>
          <td><select value={x.papel} disabled={x.id === perfil!.id} onChange={e => upd(x.id, { papel: e.target.value })}>{Object.entries(PAPEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td><select value={x.fin} onChange={e => upd(x.id, { fin: e.target.value })}>{Object.entries(FIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td><input type="checkbox" checked={x.ativo} disabled={x.id === perfil!.id} onChange={e => upd(x.id, { ativo: e.target.checked })} /></td>
          <td><button className="btn sm" onClick={() => setPerm(x)}>Definir acessos</button></td></tr>)}
      </tbody></table></div></section>
    {perm && <Permissoes u={perm} onClose={() => { setPerm(null); carregar(); }} />}
    <section className="bx"><h2>Substituição temporária</h2>
      <p className="meta">Durante o período, a substituta pode editar os projetos da pessoa ausente.</p>
      <form className="fbar" onSubmit={addSub}>
        <label className="f">Ausente<select required value={sub.ausente} onChange={e => setSub({ ...sub, ausente: e.target.value })}><option value="">Selecione</option>{u.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="f">Substituta<select required value={sub.substituta} onChange={e => setSub({ ...sub, substituta: e.target.value })}><option value="">Selecione</option>{u.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="f">De<input type="date" required value={sub.ini} onChange={e => setSub({ ...sub, ini: e.target.value })} /></label>
        <label className="f">Até<input type="date" required value={sub.fim} onChange={e => setSub({ ...sub, fim: e.target.value })} /></label>
        <button className="btn p">Registrar substituição</button></form>
      {s.length === 0 ? <p className="empty">Nenhuma substituição registrada.</p> :
        <div className="tw"><table><thead><tr><th>Ausente</th><th>Substituta</th><th>Período</th></tr></thead><tbody>{s.map(x => <tr key={x.id}><td>{nome(x.ausente_id)}</td><td>{nome(x.substituta_id)}</td><td>{dataBR(x.inicio)} a {dataBR(x.fim)}</td></tr>)}</tbody></table></div>}
    </section></>);
}

// Acessos de uma pessoa: módulos, nível financeiro e quais projetos ela enxerga ou edita.
function Permissoes({ u, onClose }: { u: any; onClose: () => void }) {
  const [f, setF] = useState<any>({ papel: u.papel, fin: u.fin, acesso_projetos: u.acesso_projetos || "todos", ver_geral: u.ver_geral !== false, ver_impactometro: u.ver_impactometro !== false, ver_pax_consultor: !!u.ver_pax_consultor, ver_capacidade: !!u.ver_capacidade, carga_horas_mes: u.carga_horas_mes ?? 176 });
  const [projs, setProjs] = useState<any[]>([]); const [ac, setAc] = useState<Record<string, string>>({}); const [erro, setErro] = useState(""); const [busca, setBusca] = useState("");
  useEffect(() => { (async () => {
    setProjs((await supabase.from("projetos").select("id,nome,codigo,clientes(nome)").order("nome")).data || []);
    const a = (await supabase.from("acessos_projeto").select("projeto_id,nivel").eq("usuario_id", u.id)).data || [];
    setAc(Object.fromEntries(a.map((x: any) => [x.projeto_id, x.nivel])));
  })(); }, [u.id]);
  const liberarTudo = () => setF({ ...f, fin: "validar", acesso_projetos: "todos", ver_geral: true, ver_impactometro: true, ver_pax_consultor: true, ver_capacidade: true });
  async function salvar() {
    const r = await supabase.from("perfis").update({ ...f, carga_horas_mes: Number(String(f.carga_horas_mes).replace(",", ".")) || 176 }).eq("id", u.id).select("id");
    if (r.error || !r.data?.length) { setErro("Não foi possível salvar os acessos."); return; }
    await supabase.from("acessos_projeto").delete().eq("usuario_id", u.id);
    const linhas = Object.entries(ac).filter(([, n]) => n).map(([projeto_id, nivel]) => ({ usuario_id: u.id, projeto_id, nivel }));
    if (linhas.length) { const w = await supabase.from("acessos_projeto").insert(linhas); if (w.error) { setErro("Não foi possível salvar os projetos."); return; } }
    onClose();
  }
  const Chk = ({ k, t }: { k: string; t: string }) => <label className="f w" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={!!f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} />{t}</label>;
  const vis = projs.filter(p => !busca || (p.nome + p.codigo + (p.clientes?.nome || "")).toLowerCase().includes(busca.toLowerCase()));
  return <Dialog titulo={`Acessos de ${u.nome}`} onClose={onClose}>
    <button type="button" className="btn" onClick={liberarTudo}>Liberar tudo (financeiro completo, todos os projetos e todas as telas)</button>
    <div className="fg">
      <label className="f">Papel<select value={f.papel} onChange={e => setF({ ...f, papel: e.target.value })}>{Object.entries(PAPEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="f">Financeiro<select value={f.fin} onChange={e => setF({ ...f, fin: e.target.value })}>{Object.entries(FIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="f">Horas por mês (capacidade)<input inputMode="decimal" value={f.carga_horas_mes} onChange={e => setF({ ...f, carga_horas_mes: e.target.value })} /></label>
      <Chk k="ver_geral" t="Pode ver a Visão geral" />
      <Chk k="ver_impactometro" t="Pode ver o Impactômetro" />
      <Chk k="ver_pax_consultor" t="Pode ver o Impactômetro e a avaliação de reação por consultor" />
      <Chk k="ver_capacidade" t="Pode ver as horas e a capacidade dos consultores" />
      <label className="f w">Projetos que pode ver<select value={f.acesso_projetos} onChange={e => setF({ ...f, acesso_projetos: e.target.value })}>{Object.entries(ACESSO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    </div>
    {f.acesso_projetos === "selecionados" && <div>
      <label className="f">Buscar projeto<input value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <div className="tw" style={{ maxHeight: 260, overflow: "auto" }}><table><thead><tr><th>Projeto</th><th>Acesso</th></tr></thead><tbody>
        {vis.map(p => <tr key={p.id}><td>{p.nome}<div className="meta">{p.clientes?.nome} · {p.codigo}</div></td>
          <td><select value={ac[p.id] || ""} onChange={e => setAc({ ...ac, [p.id]: e.target.value })}><option value="">Sem acesso</option><option value="ver">Só ver</option><option value="editar">Ver e editar</option></select></td></tr>)}</tbody></table></div></div>}
    <p className="meta">Projetos em que a pessoa é GP, líder técnico ou responsável por uma atividade aparecem sempre para ela. O Financeiro continua valendo conforme o nível escolhido acima.</p>
    {erro && <p className="erro">{erro}</p>}
    <div className="acts"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn p" onClick={salvar}>Salvar acessos</button></div>
  </Dialog>;
}
