"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { UFS, ehCapital, brk, dataBR, mesBR, nps, zonaNps, pct, catNps } from "@/lib/format";

export default function Page() { return <Shell><Impactometro /></Shell>; }

function Impactometro() {
  const { perfil } = useAuth(); const verCons = perfil!.papel === "admin" || !!perfil!.ver_pax_consultor;
  const [ents, setEnts] = useState<any[]>([]); const [ns, setNs] = useState<any[]>([]); const [ps, setPs] = useState<any[]>([]);
  const [pessoas, setPessoas] = useState<any[]>([]); const [erro, setErro] = useState(""); const [reac, setReac] = useState<any[]>([]);
  const [f, setF] = useState({ de: "", ate: "", cli: "", resp: "" });
  const [aba, setAba] = useState("imp");
  useEffect(() => { (async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from("entregaveis").select("id,projeto_id,escopo_id,nome,status,data_prevista,data_realizada,pax,pax_previsto,uf,cidade,responsavel_id"),
      supabase.from("nps_respostas").select("*"),
      supabase.from("projetos").select("id,nome,escopo_vigente_id,cliente_id,responsavel_id,clientes(nome)"),
      supabase.from("perfis").select("id,nome").order("nome"),
    ]);
    if (a.error || b.error || c.error) { setErro("Não foi possível carregar os dados. Verifique sua permissão e tente de novo."); return; }
    setReac((await supabase.from("avaliacoes_reacao").select("*, consultor:perfis(nome)")).data || []);
    setEnts(a.data || []); setNs(b.data || []); setPs(c.data || []); setPessoas(d.data || []);
  })(); }, []);
  if (erro) return <p className="erro">{erro}</p>;

  const proj = (id: string) => ps.find(p => p.id === id);
  const clientes = Array.from(new Map(ps.map(p => [p.cliente_id, p.clientes?.nome])).entries());
  const okProj = (id: string) => { const p = proj(id); return !!p && (!f.cli || p.cliente_id === f.cli) && (!f.resp || p.responsavel_id === f.resp); };
  const noPeriodo = (d?: string | null) => (!f.de || (!!d && d >= f.de)) && (!f.ate || (!!d && d <= f.ate));

  // Só entregáveis do escopo vigente: o PAX é informado uma vez, na entrega.
  const vig = ents.filter(e => proj(e.projeto_id)?.escopo_vigente_id === e.escopo_id && okProj(e.projeto_id));
  const feitas = vig.filter(e => e.status === "concluido" && e.pax != null && noPeriodo(e.data_realizada));
  const abertas = vig.filter(e => e.status !== "concluido" && e.status !== "cancelado");
  const previstas = abertas.reduce((s, e) => s + (e.pax_previsto || 0), 0);
  const total = feitas.reduce((s, e) => s + e.pax, 0);
  const projetosComImpacto = new Set(feitas.map(e => e.projeto_id)).size;
  const maior = feitas.reduce((m: any, e) => (!m || e.pax > m.pax ? e : m), null);

  const porProj: Record<string, number> = {}; feitas.forEach(e => porProj[e.projeto_id] = (porProj[e.projeto_id] || 0) + e.pax);
  const porMes: Record<string, number> = {}; feitas.forEach(e => { const k = (e.data_realizada || "").slice(0, 7); if (k) porMes[k] = (porMes[k] || 0) + e.pax; });
  const meses = Object.keys(porMes).sort(); const maxMes = Math.max(1, ...Object.values(porMes));
  const maxProj = Math.max(1, ...Object.values(porProj));

  const nv = ns.filter(n => okProj(n.projeto_id) && noPeriodo(n.data));
  const geral = nps(nv.map(n => n.nota)); const z = zonaNps(geral);
  const prom = nv.filter(n => n.nota >= 9).length, det = nv.filter(n => n.nota <= 6).length;
  const npsProj: Record<string, number[]> = {}; nv.forEach(n => (npsProj[n.projeto_id] = npsProj[n.projeto_id] || []).push(n.nota));
  const rv = reac.filter(x => okProj(x.projeto_id) && noPeriodo(x.data));
  const mediaReac = rv.length ? rv.reduce((t, x) => t + Number(x.nota) / Number(x.escala_max) * 100, 0) / rv.length : null;
  const porUF: Record<string, { cap: number; int: number }> = {}; let semUF = 0;
  feitas.forEach(e => { if (!e.uf) { semUF++; return; } const o = porUF[e.uf] = porUF[e.uf] || { cap: 0, int: 0 }; if (ehCapital(e.uf, e.cidade)) o.cap += e.pax; else o.int += e.pax; });
  const nomeP = (id: string) => pessoas.find(p => p.id === id)?.nome || "Sem consultor";
  const consMap: Record<string, any> = {}; const cm = (k: string, nome: string) => consMap[k] = consMap[k] || { k, nome, ent: 0, pax: 0, notas: [] as number[], re: [] as number[] };
  feitas.forEach(e => { const o = cm(e.responsavel_id || "-", nomeP(e.responsavel_id)); o.ent++; o.pax += e.pax; });
  nv.forEach(n => { if (n.consultor_id) cm(n.consultor_id, nomeP(n.consultor_id)).notas.push(n.nota); });
  rv.forEach(x => { const k = x.consultor_id || ("n:" + (x.consultor_nome || "")); if (x.consultor_id || x.consultor_nome) cm(k, x.consultor?.nome || x.consultor_nome).re.push(Number(x.nota) / Number(x.escala_max) * 100); });
  const linhasCons = Object.values(consMap).map((o: any) => ({ ...o, nps: nps(o.notas), nn: o.notas.length, re: o.re.length ? o.re.reduce((a: number, b: number) => a + b, 0) / o.re.length : null })).sort((a: any, b: any) => b.pax - a.pax);
  const semNps = ps.filter(p => okProj(p.id) && !npsProj[p.id]).length;

  return (<>
    <header className="cx-head"><h1>Impactômetro</h1></header>
    <section className="fbar">
      <label className="f">De<input type="date" value={f.de} onChange={e => setF({ ...f, de: e.target.value })} /></label>
      <label className="f">Até<input type="date" value={f.ate} onChange={e => setF({ ...f, ate: e.target.value })} /></label>
      <label className="f">Cliente<select value={f.cli} onChange={e => setF({ ...f, cli: e.target.value })}><option value="">Todos</option>{clientes.map(([id, n]) => <option key={id as string} value={id as string}>{n as string}</option>)}</select></label>
      <label className="f">GP<select value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })}><option value="">Todos</option>{pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <button className="btn" onClick={() => setF({ de: "", ate: "", cli: "", resp: "" })}>Limpar filtros</button>
    </section>

    <section className="hero">
      <div className="main"><span>Pessoas impactadas</span><span className="big">{total.toLocaleString("pt-BR")}</span><span>em entregas concluídas</span></div>
      <div className="main"><span>NPS geral</span><span className="big">{geral ?? "-"}</span><span><span className="dot" style={{ background: z[1] }} />{z[0]}</span></div>
    </section>
    <section className="sum">
      <div><b>{previstas.toLocaleString("pt-BR")}</b><span>Previstas (entregas em aberto)</span></div>
      <div><b>{feitas.length}</b><span>Entregas concluídas com PAX</span></div>
      <div><b>{feitas.length ? Math.round(total / feitas.length) : 0}</b><span>Média de PAX por entrega</span></div>
      <div><b>{projetosComImpacto}</b><span>Projetos com impacto</span></div>
      <div><b>{nv.length}</b><span>Respostas de NPS</span></div>
      <div><b>{nv.length ? pct(prom / nv.length * 100) : "-"}</b><span>Promotores</span></div>
      <div><b>{nv.length ? pct(det / nv.length * 100) : "-"}</b><span>Detratores</span></div>
      <div className={semNps ? "l" : ""}><b>{semNps}</b><span>Projetos sem NPS ainda</span></div>
    </section>
    <p className="meta">Os dados vêm das entregas (campo PAX) e das respostas de NPS lançadas nos projetos. Nada é preenchido duas vezes.{maior ? ` Maior entrega: ${maior.nome} (${maior.pax} pessoas).` : ""}</p>

    <div className="tabs" style={{ marginTop: 12 }}>
      <button className={aba === "imp" ? "on" : ""} onClick={() => setAba("imp")}>Pessoas impactadas</button>
      <button className={aba === "uf" ? "on" : ""} onClick={() => setAba("uf")}>Estados e capitais</button>
      {verCons && <button className={aba === "cons" ? "on" : ""} onClick={() => setAba("cons")}>Por consultor</button>}
      <button className={aba === "nps" ? "on" : ""} onClick={() => setAba("nps")}>NPS por projeto</button>
    </div>

    {aba === "imp" && <div className="ch">
      <section className="bx"><h2>Por projeto</h2>{Object.keys(porProj).length === 0 ? <p className="empty">Nenhuma entrega concluída com PAX no período. Informe o PAX nas entregas dos projetos.</p> :
        Object.entries(porProj).sort((a, b) => b[1] - a[1]).map(([id, v]) => <div className="hb" key={id}><span>{proj(id)?.nome}</span><span className="t"><i style={{ width: v / maxProj * 100 + "%", background: "var(--brand)" }} /></span><b>{v}</b></div>)}</section>
      <section className="bx"><h2>Por mês</h2>{meses.length === 0 ? <p className="empty">Sem dados no período.</p> :
        meses.map(m => <div className="hb" key={m}><span>{mesBR(m)}</span><span className="t"><i style={{ width: porMes[m] / maxMes * 100 + "%", background: "var(--s1)" }} /></span><b>{porMes[m]}</b></div>)}</section>
      <section className="bx" style={{ gridColumn: "1/-1" }}><h2>Entregas por projeto e data</h2><div className="tw">{feitas.length === 0 ? <p className="empty">Sem entregas no período.</p> :
        <table><thead><tr><th>Data</th><th>Projeto</th><th>Cliente</th><th>Entrega</th><th>PAX</th></tr></thead><tbody>
          {[...feitas].sort((a, b) => (b.data_realizada || "").localeCompare(a.data_realizada || "")).map(e => <tr key={e.id}><td>{dataBR(e.data_realizada)}</td><td><Link href={`/projetos/${e.projeto_id}`}>{proj(e.projeto_id)?.nome}</Link></td><td>{proj(e.projeto_id)?.clientes?.nome}</td><td>{e.nome}</td><td>{e.pax}</td></tr>)}
        </tbody></table>}</div></section>
    </div>}

    {aba === "uf" && <section className="bx"><h2>Pessoas impactadas por estado</h2>
      <p className="meta">Vem do estado e da cidade informados em cada entregável. Capital = cidade que é a capital do estado.</p>
      <div className="tw">{Object.keys(porUF).length === 0 ? <p className="empty">Nenhuma entrega concluída com PAX e estado informado no período.</p> :
        <table><thead><tr><th>Estado</th><th>Capital</th><th>Interior</th><th>Total</th></tr></thead><tbody>
          {Object.entries(porUF).sort((a, b) => (b[1].cap + b[1].int) - (a[1].cap + a[1].int)).map(([u, o]) => <tr key={u}><td>{u} <span className="meta">{UFS[u] || ""}</span></td><td>{o.cap}</td><td>{o.int}</td><td><b>{o.cap + o.int}</b></td></tr>)}
        </tbody></table>}</div>{semUF > 0 && <p className="meta">{semUF} entrega{semUF === 1 ? "" : "s"} concluída{semUF === 1 ? "" : "s"} com PAX ainda sem estado informado.</p>}</section>}

    {aba === "cons" && verCons && <section className="bx"><h2>Por consultor</h2>
      <p className="meta">Pessoas impactadas nas entregas de cada consultor, junto com o NPS e a avaliação de reação em que ele foi informado. Área restrita.</p>
      <div className="tw">{linhasCons.length === 0 ? <p className="empty">Sem dados no período.</p> :
        <table><thead><tr><th>Consultor</th><th>Entregas</th><th>Pessoas impactadas</th><th>NPS</th><th>Respostas de NPS</th><th>Reação (% da escala)</th></tr></thead><tbody>
          {linhasCons.map(l => <tr key={l.k}><td>{l.nome}</td><td>{l.ent}</td><td><b>{l.pax}</b></td><td>{l.nps ?? "-"}</td><td>{l.nn}</td><td>{l.re === null ? "-" : pct(l.re)}</td></tr>)}</tbody></table>}</div></section>}

    {aba === "nps" && <>
    <section className="bx"><h2>NPS por projeto</h2><div className="tw">{nv.length === 0 ? <p className="empty">Nenhuma resposta no período. Registre respostas na aba NPS de cada projeto.</p> :
      <table><thead><tr><th>Projeto</th><th>Cliente</th><th>Respostas</th><th>NPS</th><th>Classificação</th></tr></thead><tbody>
        {Object.entries(npsProj).map(([id, notas]) => { const v = nps(notas), zz = zonaNps(v); return <tr key={id}><td><Link href={`/projetos/${id}`}>{proj(id)?.nome}</Link></td><td>{proj(id)?.clientes?.nome}</td><td>{notas.length}</td><td><b>{v}</b></td><td><span className="dot" style={{ background: zz[1] }} />{zz[0]}</td></tr>; })}
      </tbody></table>}</div></section>
    <section className="bx"><h2>Avaliação de reação</h2>
      <p className="meta">Avaliações de reação lançadas nos projetos, inclusive as recebidas em arquivo do cliente. A nota é comparada pela porcentagem da escala de cada avaliação.</p>
      <section className="sum"><div><b>{rv.length}</b><span>Avaliações no período</span></div><div><b>{mediaReac === null ? "-" : pct(mediaReac)}</b><span>Média (% da escala)</span></div><div><b>{rv.filter(x => x.origem === "cliente").length}</b><span>Enviadas pelo cliente</span></div></section>
      <div className="tw">{rv.length === 0 ? <p className="empty">Nenhuma avaliação de reação no período. Registre na aba NPS e avaliação de reação de cada projeto.</p> :
        <table><thead><tr><th>Data</th><th>Projeto</th>{verCons && <th>Consultor</th>}<th>Origem</th><th>Nota</th><th>Respostas</th><th>Arquivo</th></tr></thead><tbody>
          {[...rv].sort((a, b) => b.data.localeCompare(a.data)).map(x => <tr key={x.id}><td>{dataBR(x.data)}</td><td><Link href={`/projetos/${x.projeto_id}`}>{proj(x.projeto_id)?.nome}</Link></td>{verCons && <td>{x.consultor?.nome || x.consultor_nome || "-"}</td>}<td>{x.origem === "cliente" ? "Cliente" : "Conectas"}</td><td>{Number(x.nota).toLocaleString("pt-BR")} de {Number(x.escala_max).toLocaleString("pt-BR")}</td><td>{x.respostas ?? "-"}</td>
            <td>{x.arquivo_path ? <button className="btn sm" onClick={async () => { const { data } = await supabase.storage.from("avaliacoes").createSignedUrl(x.arquivo_path, 120); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); }}>Abrir</button> : "-"}</td></tr>)}
        </tbody></table>}</div></section>
    </>}
  </>);
}
