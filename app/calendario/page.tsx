"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { STATUS, dataBR } from "@/lib/format";

export default function Page() { return <Shell><Calendario /></Shell>; }

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const CORES = ["#5E6FB4", "#FF007F", "#9C829C", "#FF5900", "#868880", "#3A0539", "#C4E800", "#8DA8FC"];
const pad = (n: number) => String(n).padStart(2, "0");

function Calendario() {
  const { perfil } = useAuth();
  const hoje = new Date(); const [ano, setAno] = useState(hoje.getFullYear()); const [mes, setMes] = useState(hoje.getMonth());
  const [ents, setEnts] = useState<any[]>([]); const [ats, setAts] = useState<any[]>([]); const [pessoas, setPessoas] = useState<any[]>([]); const [projs, setProjs] = useState<any[]>([]);
  const [f, setF] = useState({ resp: "", proj: "", ver: "entregas" }); const [dia, setDia] = useState<string>(`${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`);
  useEffect(() => { (async () => {
    setEnts((await supabase.from("entregaveis").select("id,nome,projeto_id,escopo_id,data_prevista,hora_prevista,status,responsavel_id").not("data_prevista", "is", null)).data || []);
    setAts((await supabase.from("atividades").select("id,nome,projeto_id,data_prevista,hora_prevista,status,responsavel_id").not("data_prevista", "is", null)).data || []);
    setPessoas((await supabase.from("perfis").select("id,nome").eq("ativo", true).order("nome")).data || []);
    setProjs((await supabase.from("projetos").select("id,nome,escopo_vigente_id").order("nome")).data || []);
  })(); }, []);
  const proj = (id: string) => projs.find(p => p.id === id);
  const cor = (rid: string | null) => { const i = pessoas.findIndex(p => p.id === rid); return i < 0 ? "var(--s0)" : CORES[i % CORES.length]; };
  const itens = useMemo(() => {
    const lista: any[] = [];
    if (f.ver !== "atividades") ents.filter(e => proj(e.projeto_id)?.escopo_vigente_id === e.escopo_id).forEach(e => lista.push({ ...e, tipo: "Entrega" }));
    if (f.ver !== "entregas") ats.forEach(a => lista.push({ ...a, tipo: "Atividade" }));
    return lista.filter(x => (!f.resp || x.responsavel_id === f.resp) && (!f.proj || x.projeto_id === f.proj) && x.status !== "cancelado");
  }, [ents, ats, projs, f]);
  const porDia = useMemo(() => { const m: Record<string, any[]> = {}; itens.forEach(x => (m[x.data_prevista] = m[x.data_prevista] || []).push(x)); Object.values(m).forEach(a => a.sort((p, q) => (p.hora_prevista || "").localeCompare(q.hora_prevista || ""))); return m; }, [itens]);

  const primeiro = new Date(ano, mes, 1).getDay(); const total = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]; while (celulas.length % 7) celulas.push(null);
  const iso = (d: number) => `${ano}-${pad(mes + 1)}-${pad(d)}`;
  const mover = (n: number) => { const d = new Date(ano, mes + n, 1); setAno(d.getFullYear()); setMes(d.getMonth()); };
  const doDia = porDia[dia] || [];

  return (<>
    <header className="cx-head"><h1>Calendário de entregas</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className="btn" onClick={() => mover(-1)} aria-label="Mês anterior">←</button><b style={{ minWidth: 140, textAlign: "center" }}>{MESES[mes]} de {ano}</b><button className="btn" onClick={() => mover(1)} aria-label="Próximo mês">→</button></div></header>
    <section className="fbar">
      <label className="f">Consultor ou responsável<select value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })}><option value="">Todos</option>{pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">Projeto<select value={f.proj} onChange={e => setF({ ...f, proj: e.target.value })}><option value="">Todos</option>{projs.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">Mostrar<select value={f.ver} onChange={e => setF({ ...f, ver: e.target.value })}><option value="entregas">Entregas</option><option value="atividades">Atividades</option><option value="ambos">Entregas e atividades</option></select></label>
      <button className="btn" onClick={() => setF({ resp: "", proj: "", ver: "entregas" })}>Limpar filtros</button>
    </section>
    <div className="leg" style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 13, marginBottom: 10 }}>{pessoas.map(p => <span key={p.id}><span className="dot" style={{ background: cor(p.id) }} />{p.nome}</span>)}</div>
    <div className="cal">
      {DIAS.map(d => <div key={d} className="cal-h">{d}</div>)}
      {celulas.map((d, i) => d === null ? <div key={i} className="cal-c vazio" /> :
        <button key={i} className={"cal-c" + (iso(d) === dia ? " sel" : "")} onClick={() => setDia(iso(d))}>
          <span className="cal-n">{d}</span>
          {(porDia[iso(d)] || []).slice(0, 3).map(x => <span key={x.id} className="cal-i" style={{ borderLeftColor: cor(x.responsavel_id) }}>{x.hora_prevista ? x.hora_prevista.slice(0, 5) + " " : ""}{x.nome}</span>)}
          {(porDia[iso(d)] || []).length > 3 && <span className="meta">+{(porDia[iso(d)] || []).length - 3} mais</span>}
        </button>)}
    </div>
    <section className="bx" style={{ marginTop: 14 }}><h2>{dataBR(dia)}</h2>
      {doDia.length === 0 ? <p className="empty">Nada marcado para este dia.</p> : doDia.map(x => <div key={x.id} className="ent" style={{ ["--c" as any]: cor(x.responsavel_id) }}>
        <h3>{x.hora_prevista ? x.hora_prevista.slice(0, 5) + " · " : ""}{x.nome}</h3>
        <div className="meta">{x.tipo} · <Link href={`/projetos/${x.projeto_id}`}>{proj(x.projeto_id)?.nome}</Link> · {pessoas.find(p => p.id === x.responsavel_id)?.nome || "sem responsável"} · {STATUS[x.status]}</div></div>)}</section>
    <Assinar perfil={perfil} />
  </>);
}

function Assinar({ perfil }: { perfil: any }) {
  const [links, setLinks] = useState<Record<string, string>>({}); const [erro, setErro] = useState("");
  const carregar = async () => { const { data } = await supabase.from("calendario_tokens").select("tipo,token"); const m: Record<string, string> = {}; (data || []).forEach((x: any) => m[x.tipo] = `${window.location.origin}/api/calendario/${x.token}.ics`); setLinks(m); };
  useEffect(() => { carregar(); }, []);
  async function gerar(tipo: string, novo: boolean) {
    setErro("");
    if (novo) await supabase.from("calendario_tokens").delete().eq("tipo", tipo).eq("usuario_id", perfil.id);
    const { error } = await supabase.from("calendario_tokens").insert({ tipo, usuario_id: perfil.id });
    if (error && !novo) { /* já existe */ } else if (error) setErro("Não foi possível gerar o link. Tente de novo.");
    carregar();
  }
  const Linha = ({ tipo, titulo, desc }: any) => <div style={{ marginBottom: 12 }}><b>{titulo}</b><div className="meta">{desc}</div>
    {links[tipo] ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}><input readOnly value={links[tipo]} style={{ flex: 1, minWidth: 240 }} onFocus={e => e.target.select()} /><button className="btn sm" onClick={() => navigator.clipboard?.writeText(links[tipo])}>Copiar link</button><button className="btn sm" onClick={() => { if (confirm("O link atual deixará de funcionar. Gerar um novo?")) gerar(tipo, true); }}>Gerar novo link</button></div>
      : <button className="btn sm" style={{ marginTop: 6 }} onClick={() => gerar(tipo, false)}>Gerar link</button>}</div>;
  return <section className="bx"><h2>Ver no Outlook</h2>
    <p className="meta">Assine um destes links no Outlook e o calendário aparece lá, junto com a sua agenda, e se atualiza sozinho (pode levar algumas horas para refletir mudanças). É uma via de mão única: o sistema alimenta o Outlook. O link é pessoal; quem o tiver vê as entregas, então não o compartilhe.</p>
    {erro && <p className="erro">{erro}</p>}
    <Linha tipo="geral" titulo="Calendário geral de entregas" desc="Todas as entregas de todos os projetos." />
    <Linha tipo="minhas" titulo="Minhas tarefas" desc="Suas entregas e atividades em aberto." />
    <p className="meta"><b>Outlook na web:</b> Calendário, Adicionar calendário, Assinar da Web, cole o link. <b>Outlook no computador:</b> Arquivo, Configurações da Conta, Calendários da Internet, Novo, cole o link.</p></section>;
}
