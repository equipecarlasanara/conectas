"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { brl, brk, dataBR, mesBR } from "@/lib/format";

export default function Page() { return <Shell><Financeiro /></Shell>; }
function Financeiro() {
  const { perfil } = useAuth(); const valida = perfil!.fin === "validar";
  const temFin = perfil!.fin !== "nenhum"; const [aba, setAba] = useState(temFin ? "receita" : "desp");
  const [ev, setEv] = useState<any[]>([]); const [proj, setProj] = useState<any[]>([]); const [desp, setDesp] = useState<any[]>([]); const [erro, setErro] = useState("");
  const [f, setF] = useState({ proj: "", cat: "", de: "", ate: "", gp: "" });
  const carregar = async () => {
    const a = await supabase.from("eventos_receita").select("*, projetos(nome,clientes(nome)), entregaveis(nome)").order("criado_em", { ascending: false });
    const b = await supabase.from("projetos").select("id,nome,codigo,responsavel_id,clientes(nome),resp:perfis!projetos_responsavel_id_fkey(nome),projeto_financeiro(valor_contratado)").order("nome");
    const c = await supabase.from("despesas").select("*, projetos(nome)").order("data", { ascending: false });
    setEv(a.data || []); setProj(b.data || []); setDesp(c.data || []);
  };
  useEffect(() => { carregar(); }, []);
  async function validar(id: string) {
    const { error } = await supabase.rpc("validar_receita", { p_evento: id });
    setErro(error ? "Não foi possível validar: " + error.message : ""); carregar();
  }
  const soma = (s: string) => ev.filter(x => x.status === s).reduce((t, x) => t + Number(x.valor), 0);
  const contrat = (p: any) => { const a = p.projeto_financeiro; const v = Array.isArray(a) ? a[0]?.valor_contratado : a?.valor_contratado; return Number(v || 0); };
  const contratado = proj.reduce((t, x) => t + contrat(x), 0);
  const liq = (d: any) => Number(d.valor_gasto || 0) - Number(d.valor_reembolsado || 0);
  const sv = (d: any) => d.valor_orcado != null && d.valor_gasto != null ? Number(d.valor_orcado) - liq(d) : 0;
  const cats = Array.from(new Set(desp.map(d => d.categoria))).sort();
  const dv = desp.filter(d => (!f.proj || d.projeto_id === f.proj) && (!f.cat || d.categoria === f.cat) && (!f.de || d.data >= f.de) && (!f.ate || d.data <= f.ate) && (!f.gp || proj.find(p => p.id === d.projeto_id)?.responsavel_id === f.gp));
  const gastoT = dv.reduce((s, d) => s + liq(d), 0), orcT = dv.filter(d => d.valor_orcado != null).reduce((s, d) => s + Number(d.valor_orcado), 0), reembT = dv.reduce((s, d) => s + Number(d.valor_reembolsado || 0), 0), savT = dv.reduce((s, d) => s + sv(d), 0);
  const porCat: Record<string, number> = {}; dv.forEach(d => porCat[d.categoria] = (porCat[d.categoria] || 0) + liq(d)); const maxC = Math.max(1, ...Object.values(porCat));
  const gps = Array.from(new Map(proj.filter(p => p.responsavel_id).map(p => [p.responsavel_id, p.resp?.nome])).entries());
  return (<>
    <header className="cx-head"><h1>Financeiro</h1></header>
    <div className="tabs">{temFin && <button className={aba === "receita" ? "on" : ""} onClick={() => setAba("receita")}>Receita contábil</button>}<button className={aba === "desp" ? "on" : ""} onClick={() => setAba("desp")}>Despesas</button></div>
    {erro && <p className="erro">{erro}</p>}
    {aba === "receita" && <>
      <section className="sum"><div><b>{brk(contratado)}</b><span>Valor contratado</span></div><div><b>{brk(soma("pendente"))}</b><span>Concluído, a validar</span></div><div><b>{brk(soma("reconhecida"))}</b><span>Reconhecida</span></div></section>
      <p className="meta">A receita nasce no Cronograma: ao concluir uma atividade com valor, ela aparece aqui para validação. Valor vendido, previsto, reconhecido, faturado e recebido são conceitos separados.</p>
      <section className="bx"><h2>Eventos de receita</h2><div className="tw">{ev.length === 0 ? <p className="empty">Nenhum evento ainda. Ao concluir no Cronograma uma atividade com valor, ela aparece aqui para validação.</p> :
        <table><thead><tr><th>Origem</th><th>Projeto</th><th>Valor</th><th>Competência</th><th>Status</th><th></th></tr></thead><tbody>
          {ev.map(x => <tr key={x.id}><td>{x.entregaveis?.nome || x.descricao || "Saving"}{x.origem === "saving" && <span className="tag" style={{ marginLeft: 6 }}>Saving</span>}</td><td><Link href={`/projetos/${x.projeto_id}`}>{x.projetos?.nome}</Link><div className="meta">{x.projetos?.clientes?.nome}</div></td>
            <td>{brl(x.valor)}</td><td>{x.competencia ? mesBR(x.competencia) : "-"}</td>
            <td><span className="tag">{x.status === "pendente" ? "A validar" : x.status === "reconhecida" ? "Reconhecida" : x.status === "estornada" ? "Estornada" : x.status}</span>{x.validado_em && <div className="meta">{dataBR(x.validado_em)}</div>}</td>
            <td>{valida && x.status === "pendente" && <button className="btn sm p" onClick={() => validar(x.id)}>Validar reconhecimento</button>}</td></tr>)}
        </tbody></table>}</div></section></>}

    {aba === "desp" && <>
      <p className="meta">As despesas são lançadas pelo GP na aba Financeiro de cada projeto (logística, material, parceiros...). Aqui aparece o consolidado{perfil!.papel === "admin" ? " de todos os projetos" : " dos projetos que você acompanha"}.</p>
      <section className="fbar">
        <label className="f">Projeto<select value={f.proj} onChange={e => setF({ ...f, proj: e.target.value })}><option value="">Todos</option>{proj.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label className="f">GP<select value={f.gp} onChange={e => setF({ ...f, gp: e.target.value })}><option value="">Todos</option>{gps.map(([id, n]) => <option key={id as string} value={id as string}>{n as string}</option>)}</select></label>
        <label className="f">Categoria<select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}><option value="">Todas</option>{cats.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="f">De<input type="date" value={f.de} onChange={e => setF({ ...f, de: e.target.value })} /></label>
        <label className="f">Até<input type="date" value={f.ate} onChange={e => setF({ ...f, ate: e.target.value })} /></label>
        <button className="btn" onClick={() => setF({ proj: "", cat: "", de: "", ate: "", gp: "" })}>Limpar filtros</button>
      </section>
      <section className="sum"><div><b>{brk(orcT)}</b><span>Orçado</span></div><div><b>{brk(gastoT)}</b><span>Gasto líquido</span></div><div><b>{brk(reembT)}</b><span>Reembolsado</span></div><div><b>{brk(savT)}</b><span>Saving</span></div></section>
      <div className="ch">
        <section className="bx"><h2>Gasto por categoria</h2>{Object.keys(porCat).length === 0 ? <p className="empty">Nenhuma despesa no filtro.</p> : Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div className="hb" key={k}><span>{k}</span><span className="t"><i style={{ width: v / maxC * 100 + "%", background: "var(--s2)" }} /></span><b>{brk(v)}</b></div>)}</section>
        <section className="bx"><h2>Resultado por projeto</h2><p className="meta">Resultado parcial = receita reconhecida menos gasto líquido (após reembolsos).</p>
          <div className="tw">{proj.length === 0 ? <p className="empty">Nenhum projeto.</p> :
            <table><thead><tr><th>Projeto</th><th>GP</th><th>Contratado</th><th>Receita reconhecida</th><th>Gasto líquido</th><th>Saving</th><th>Resultado parcial</th></tr></thead><tbody>
              {proj.filter(p => (!f.proj || p.id === f.proj) && (!f.gp || p.responsavel_id === f.gp)).map((p: any) => { const ds = desp.filter(d => d.projeto_id === p.id); const gasto = ds.reduce((s, d) => s + liq(d), 0); const sav = ds.reduce((s, d) => s + sv(d), 0);
                const rec = ev.filter(e => e.projeto_id === p.id && e.status === "reconhecida").reduce((s, e) => s + Number(e.valor), 0);
                return <tr key={p.id}><td><Link href={`/projetos/${p.id}`}>{p.nome}</Link></td><td>{p.resp?.nome || "-"}</td><td>{brl(contrat(p))}</td><td>{brl(rec)}</td><td>{brl(gasto)}</td><td>{brl(sav)}</td><td><b>{brl(rec - gasto)}</b></td></tr>; })}
            </tbody></table>}</div></section>
      </div>
      <section className="bx"><h2>Lançamentos</h2><div className="tw">{dv.length === 0 ? <p className="empty">Nenhum lançamento.</p> :
        <table><thead><tr><th>Data</th><th>Projeto</th><th>Categoria</th><th>Descrição</th><th>Fornecedor</th><th>Orçado</th><th>Gasto líquido</th></tr></thead><tbody>
          {dv.map(d => <tr key={d.id}><td>{dataBR(d.data)}</td><td><Link href={`/projetos/${d.projeto_id}`}>{d.projetos?.nome}</Link></td><td>{d.categoria}</td><td>{d.descricao}</td><td>{d.fornecedor || "-"}</td><td>{d.valor_orcado != null ? brl(d.valor_orcado) : "-"}</td><td>{brl(liq(d))}</td></tr>)}</tbody></table>}</div></section>
    </>}
  </>);
}
