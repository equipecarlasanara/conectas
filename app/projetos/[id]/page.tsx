"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import Dialog from "@/components/Dialog";
import Kanban from "@/components/Kanban";
import FinanceiroProjeto from "@/components/FinanceiroProjeto";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { STATUS, STATUS_COR, SITUACAO, FASE, RESP, PRIORIDADE, LOGISTICA, UFS, brl, dataBR, prazoTag, atrasado, hoje, nps, zonaNps, catNps, statusAuto, numBR, txtBR } from "@/lib/format";

export default function Page() { return <Shell><Detalhe /></Shell>; }

function Detalhe() {
  const { id } = useParams<{ id: string }>();
  const { perfil } = useAuth();
  const [p, setP] = useState<any>(null); const [macros, setMacros] = useState<any[]>([]); const [ents, setEnts] = useState<any[]>([]);
  const [ativs, setAtivs] = useState<any[]>([]); const [valor, setValor] = useState<number | null>(null);
  const [pessoas, setPessoas] = useState<any[]>([]); const [tipos, setTipos] = useState<any[]>([]); const [contatos, setContatos] = useState<any[]>([]);
  const [pode, setPode] = useState(false); const [erro, setErro] = useState(""); const [dlg, setDlg] = useState<any>(null);
  const [histA, setHistA] = useState<any[]>([]); const [histE, setHistE] = useState<any[]>([]);
  const [aba, setAba] = useState("escopo"); const [npsL, setNpsL] = useState<any[]>([]); const [reacao, setReacao] = useState<any[]>([]); const [liquido, setLiquido] = useState<number | null>(null);
  const [fe, setFe] = useState(""); const [fr, setFr] = useState(""); const [novoGP, setNovoGP] = useState("");
  const finVer = perfil!.fin !== "nenhum"; const finEd = perfil!.fin === "editar" || perfil!.fin === "validar";

  const carregar = useCallback(async () => {
    const { data: pr } = await supabase.from("projetos").select("*, clientes(nome)").eq("id", id).maybeSingle();
    if (!pr) { setErro("Projeto não encontrado ou sem acesso."); return; }
    setP(pr);
    const [m, e, a, f, pe, ti, pd, ct] = await Promise.all([
      supabase.from("macroetapas").select("*").eq("escopo_id", pr.escopo_vigente_id).order("ordem"),
      supabase.from("entregaveis").select("*, alocacoes_valor(valor), tipos_entregavel(nome), resp:perfis(nome)").eq("escopo_id", pr.escopo_vigente_id).order("data_prevista"),
      supabase.from("atividades").select("*, resp:perfis(nome), contato:contatos(nome,email), entregaveis(nome)").eq("projeto_id", id).order("data_prevista"),
      supabase.from("projeto_financeiro").select("valor_contratado,valor_liquido").eq("projeto_id", id).maybeSingle(),
      supabase.from("perfis").select("id,nome").eq("ativo", true).order("nome"),
      supabase.from("tipos_entregavel").select("id,nome").eq("ativo", true).order("nome"),
      supabase.rpc("pode_editar_projeto", { p: id }),
      supabase.from("contatos").select("*").eq("ativo", true).order("nome"),
    ]);
    setMacros(m.data || []); setEnts(e.data || []); setAtivs(a.data || []); setValor(f.data ? Number(f.data.valor_contratado) : null); setLiquido(f.data && f.data.valor_liquido != null ? Number(f.data.valor_liquido) : null);
    setPessoas(pe.data || []); setTipos(ti.data || []); setPode(pd.data === true); setContatos(ct.data || []);
    setReacao((await supabase.from("avaliacoes_reacao").select("*, consultor:perfis(nome)").eq("projeto_id", id).order("data", { ascending: false })).data || []);
    setNpsL((await supabase.from("nps_respostas").select("*").eq("projeto_id", id).order("data", { ascending: false })).data || []);
    if (pd.data === true) {
      setHistA((await supabase.rpc("historico_alertas", { p_projeto: id })).data || []);
      setHistE((await supabase.rpc("historico_projeto", { p_projeto: id })).data || []);
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const falha = (e: any) => setErro(e ? "Não foi possível salvar. Verifique sua permissão e tente de novo." : "");
  async function upd(tab: string, rid: string, campos: any) { const { data, error } = await supabase.from(tab).update(campos).eq("id", rid).select("id"); falha(error || (!data || data.length === 0 ? true : null)); carregar(); }
  async function confirmar(eid: string) {
    if (!confirm("Confirmar a entrega? Isso cria um evento de receita pendente de validação.")) return;
    const { error } = await supabase.rpc("confirmar_entrega", { p_entregavel: eid });
    if (error) setErro("Não foi possível confirmar: " + error.message); else setErro(""); carregar();
  }
  async function salvarValorProj(v: string) {
    const { error } = await supabase.from("projeto_financeiro").upsert({ projeto_id: id, valor_contratado: numBR(v) || 0 }); falha(error); carregar();
  }
  async function salvarLiquido(v: string) {
    const { error } = await supabase.from("projeto_financeiro").upsert({ projeto_id: id, valor_contratado: valor ?? 0, valor_liquido: v === "" ? null : numBR(v) || 0 }); falha(error); carregar();
  }
  // O valor do entregável é dividido entre as linhas do cronograma que ainda não foram concluídas.
  async function salvarValorEnt(e: any, v: string) {
    const n = numBR(v) || 0;
    const r = await supabase.from("alocacoes_valor").upsert({ entregavel_id: e.id, valor: n }, { onConflict: "entregavel_id" });
    const ls = ativs.filter(a => a.entregavel_id === e.id && a.status !== "concluido" && a.status !== "cancelado");
    if (!r.error && ls.length) {
      const feito = ativs.filter(a => a.entregavel_id === e.id && a.status === "concluido").reduce((s, a) => s + Number(a.valor || 0), 0);
      const resto = Math.max(0, n - feito); const base = Math.floor(resto / ls.length * 100) / 100;
      for (let i = 0; i < ls.length; i++) await supabase.from("atividades").update({ valor: i === ls.length - 1 ? Math.round((resto - base * (ls.length - 1)) * 100) / 100 : base, gera_receita: e.gera_receita && n > 0 }).eq("id", ls[i].id);
    }
    falha(r.error); carregar();
  }
  async function mudarPaga(e: any, paga: boolean) {
    await supabase.from("atividades").update({ gera_receita: paga && Number(val(e) || 0) > 0 }).eq("entregavel_id", e.id).neq("status", "concluido");
    await upd("entregaveis", e.id, { gera_receita: paga });
  }
  async function transferir() {
    if (!novoGP) return;
    if (!confirm("Transferir este projeto para o novo GP? O novo GP passa a poder editá-lo.")) return;
    const { error } = await supabase.rpc("transferir_projetos", { p_de: p.responsavel_id, p_para: novoGP, p_projeto: id });
    setErro(error ? "Não foi possível transferir: " + error.message : ""); setNovoGP(""); carregar();
  }

  if (!p) return <p className={erro ? "erro" : "empty"}>{erro || "Carregando..."}</p>;
  const val = (e: any) => { const a = e.alocacoes_valor; const v = Array.isArray(a) ? a[0]?.valor : a?.valor; return v == null ? null : Number(v); };
  const alocado = ents.filter(e => e.gera_receita).reduce((s, e) => s + (val(e) || 0), 0);
  const feitas = ents.filter(e => e.status === "concluido").length;
  const atr = ents.filter(e => atrasado(e.data_prevista, e.status)).length + ativs.filter(a => atrasado(a.data_prevista, a.status)).length;
  const pessoa = (pid: string) => pessoas.find(x => x.id === pid)?.nome || "Sem responsável";
  const podeTransferir = perfil!.papel === "admin" || p.responsavel_id === perfil!.id;
  const vis = ativs.filter(a => (!fe || a.entregavel_id === fe) && (!fr || a.responsavel_id === fr));
  const tag = (s: string) => <><span className="dot" style={{ background: STATUS_COR[s] }} />{STATUS[s]}</>;

  return (<>
    <Link href="/projetos" className="backbar"><span className="arr">←</span><span>Todos os projetos</span></Link>
    <header className="cx-head"><div><h1>{p.nome}</h1><div className="meta">{p.clientes?.nome} · {p.codigo} · GP: {pessoa(p.responsavel_id)}{p.apoio_id ? ` · Líder técnico: ${pessoa(p.apoio_id)}` : ""}{p.tipo_projeto ? ` · ${p.tipo_projeto}${p.subtipo ? " · " + p.subtipo : ""}` : ""}{p.modalidade === "full_service" ? " · Full service" : ""}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select disabled={!pode} value={p.fase || ""} onChange={e => upd("projetos", id, { fase: e.target.value || null })} aria-label="Fase"><option value="">Sem fase</option>{Object.entries(FASE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select disabled={!pode} value={p.situacao} onChange={e => upd("projetos", id, { situacao: e.target.value })} aria-label="Status do projeto">{Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>Status: {v}</option>)}</select>
        <select disabled={!pode} value={p.prioridade || "media"} onChange={e => upd("projetos", id, { prioridade: e.target.value })} aria-label="Prioridade">{Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>Prioridade: {v}</option>)}</select>
        {pode && <button className="btn p" onClick={() => setDlg({ t: "macro" })}>Nova macroetapa</button>}
      </div></header>
    {!pode && <p className="meta">Você pode consultar este projeto, mas não editá-lo.</p>}
    {erro && <p className="erro">{erro}</p>}
    <section className="sum">
      <div><b>{ents.length}</b><span>Entregáveis</span></div><div><b>{feitas}</b><span>Concluídos</span></div>
      <div className="l"><b>{atr}</b><span>Atrasados</span></div>
      {finVer && <div><b>{valor == null ? "-" : brl(valor)}</b><span>Valor contratado</span></div>}
      {finVer && <div><b>{brl(alocado)}</b><span>Valor alocado</span></div>}
      {finVer && valor != null && <div className={Math.abs(valor - alocado) > 0.005 ? "l" : ""}><b>{brl(valor - alocado)}</b><span>A alocar</span></div>}
    </section>
    {finEd && <section className="bx"><div className="rowh"><h2>Valor contratado</h2>
      <form onSubmit={e => { e.preventDefault(); salvarValorProj((e.currentTarget.elements.namedItem("v") as HTMLInputElement).value); }} style={{ display: "flex", gap: 8 }}>
        <input name="v" key={valor ?? "x"} defaultValue={valor != null ? txtBR(valor) : ""} placeholder="Ex.: 44000,00" inputMode="decimal" /><button className="btn">Salvar valor</button></form></div>
      <form onSubmit={e => { e.preventDefault(); salvarLiquido((e.currentTarget.elements.namedItem("l") as HTMLInputElement).value); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <label className="meta">Valor líquido (após impostos)</label><input name="l" key={"l" + (liquido ?? "x")} defaultValue={liquido != null ? txtBR(liquido) : ""} placeholder="Opcional" inputMode="decimal" /><button className="btn">Salvar líquido</button></form>
      <p className="meta">O valor contratado é mantido separado da receita prevista, reconhecida, faturada e recebida.</p></section>}

    <div className="tabs"><button className={aba === "escopo" ? "on" : ""} onClick={() => setAba("escopo")}>Escopo contratado</button>
      <button className={aba === "cronograma" ? "on" : ""} onClick={() => setAba("cronograma")}>Cronograma</button>
      {(perfil!.papel === "admin" || perfil!.papel === "gestora" || perfil!.papel === "financeiro" || perfil!.fin !== "nenhum") && <button className={aba === "fin" ? "on" : ""} onClick={() => setAba("fin")}>Financeiro</button>}
      <button className={aba === "sobre" ? "on" : ""} onClick={() => setAba("sobre")}>Sobre o projeto</button>
      <button className={aba === "nps" ? "on" : ""} onClick={() => setAba("nps")}>NPS e avaliação de reação</button>
      {pode && <button className={aba === "hist" ? "on" : ""} onClick={() => setAba("hist")}>Histórico</button>}</div>

    {aba === "escopo" && (<>
      <p className="meta">Visão macro do que foi vendido. O status das macroetapas e dos entregáveis é calculado pelas atividades do Cronograma; ao informar a quantidade, o sistema cria uma linha de cronograma para cada unidade.</p>
      {macros.length === 0 ? <p className="empty">Nenhuma macroetapa ainda. {pode ? "Crie a primeira em Nova macroetapa." : ""}</p> :
      macros.map(m => { const es = ents.filter(e => e.macroetapa_id === m.id); const sm = statusAuto(es);
        return <section className="macro" key={m.id}>
        <div className="rowh"><h2>{m.nome} <span className="meta" style={{ fontWeight: 400 }}>{tag(sm)} · {es.filter(x => x.status === "concluido").length} de {es.length} concluídos</span></h2>{pode && <button className="btn sm" onClick={() => setDlg({ t: "ent", m })}>Novo entregável</button>}</div>
        {es.length === 0 && <p className="meta">Nenhum entregável nesta macroetapa.</p>}
        {es.map(e => { const t = prazoTag(e.data_prevista, e.status); const v = val(e); const ls = ativs.filter(a => a.entregavel_id === e.id); const lc = ls.filter(a => a.status === "concluido").length;
          return <div key={e.id} className={"ent" + (atrasado(e.data_prevista, e.status) ? " late" : "")} style={{ ["--c" as any]: STATUS_COR[e.status] }}>
            <div className="rowh" style={{ marginBottom: 4 }}><div><h3>{e.quantidade > 1 ? `${e.quantidade}x ` : ""}{e.nome}</h3>
              <div className="meta">{tag(e.status)} · prazo {dataBR(e.data_prevista)}{e.hora_prevista ? " às " + e.hora_prevista.slice(0, 5) : ""} {e.tipos_entregavel?.nome ? "· " + e.tipos_entregavel.nome : ""}{e.uf ? ` · ${e.cidade ? e.cidade + "/" : ""}${e.uf}` : ""} · Responsável: {pode ? <select aria-label="Responsável pela entrega" style={{ padding: "2px 4px", fontSize: 13 }} value={e.responsavel_id || ""} onChange={ev => upd("entregaveis", e.id, { responsavel_id: ev.target.value || null })}><option value="">Definir</option>{pessoas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select> : (e.resp?.nome || "não definido")} {t && <span className={"tag " + t.c}>{t.t}</span>} {!e.gera_receita && <span className="tag">Não paga</span>}{e.pax != null && <span className="tag">{e.pax} pessoas</span>} <span className="tag">{lc} de {ls.length} linhas no cronograma</span></div></div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {pode && <label className="meta" title="Entrega paga gera receita. Desmarque para entregas sem cobrança."><input type="checkbox" checked={e.gera_receita} disabled={e.status === "concluido"} onChange={ev => mudarPaga(e, ev.target.checked)} /> Paga</label>}
                {pode && <input aria-label="Pessoas impactadas (PAX)" type="number" min={0} style={{ width: 90 }} key={"pax" + String(e.pax)} defaultValue={e.pax ?? ""} placeholder="PAX" onBlur={ev => { const n = ev.target.value === "" ? null : Number(ev.target.value); if (n !== (e.pax ?? null)) upd("entregaveis", e.id, { pax: n }); }} />}
                {finVer && e.gera_receita && (finEd ? <input aria-label="Valor do entregável" style={{ width: 120 }} key={String(v)} defaultValue={v != null ? txtBR(v) : ""} placeholder="Valor (R$)" inputMode="decimal" onBlur={ev => { if (ev.target.value !== (v != null ? txtBR(v) : "")) salvarValorEnt(e, ev.target.value); }} /> : <b>{v != null ? brl(v) : "-"}</b>)}
                <button className="btn sm" onClick={() => { setFe(e.id); setAba("cronograma"); }}>Ver no cronograma</button>
                {pode && ls.length === 0 && e.status !== "concluido" && <button className="btn sm p" onClick={() => confirmar(e.id)}>Confirmar entrega</button>}
              </div></div>
          </div>; })}
      </section>; })}</>)}

    {aba === "cronograma" && (<>
      <div className="fbar">
        <label className="f">Entregável<select value={fe} onChange={e => setFe(e.target.value)}><option value="">Todos</option>{ents.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <label className="f">Responsável<select value={fr} onChange={e => setFr(e.target.value)}><option value="">Todos</option>{pessoas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <button className="btn" onClick={() => { setFe(""); setFr(""); }}>Limpar filtros</button>
        {pode && <button className="btn p" onClick={() => setDlg({ t: "ativ", e: fe ? ents.find(x => x.id === fe) : null })}>Nova atividade</button>}
      </div>
      <p className="meta">Aqui estão todos os detalhes do projeto. Crie as atividades, defina quem faz, quando e o valor de cada linha. Ao concluir uma linha com valor, ela gera receita contábil para validação.</p>
      <Kanban atividades={vis} recarregar={carregar} pessoas={pessoas} mostrarValor={finVer} onEditar={pode ? (a: any) => setDlg({ t: "ativ", a, e: ents.find(x => x.id === a.entregavel_id) }) : undefined} />
    </>)}

    {aba === "fin" && <FinanceiroProjeto projetoId={id} pode={pode} perfil={perfil} />}

    {aba === "sobre" && <section className="bx"><h2>Sobre o projeto</h2>
      <p><b>Descrição:</b> {p.descricao || "-"}</p><p><b>Objetivo:</b> {p.objetivo || "-"}</p>
      <p><b>Período:</b> {dataBR(p.inicio_previsto)} a {dataBR(p.fim_previsto)}</p>
      <p><b>Responsabilidades da Conectas:</b> {p.resp_conectas || "-"}</p><p><b>Responsabilidades do cliente:</b> {p.resp_cliente || "-"}</p>
      <div className="fbar">
        <label className="f">Líder técnico<select disabled={!pode} value={p.apoio_id || ""} onChange={e => upd("projetos", id, { apoio_id: e.target.value || null })}><option value="">Sem líder técnico</option>{pessoas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label className="f">Logística<select disabled={!pode} value={p.logistica_por || ""} onChange={e => upd("projetos", id, { logistica_por: e.target.value || null })}><option value="">Não definida</option>{Object.entries(LOGISTICA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="f w">Observações de logística<input disabled={!pode} key={"lo" + (p.logistica_obs || "")} defaultValue={p.logistica_obs || ""} placeholder="Quem compra passagem, hospedagem, material..." onBlur={e => { if (e.target.value !== (p.logistica_obs || "")) upd("projetos", id, { logistica_obs: e.target.value || null }); }} /></label>
      </div>
      {podeTransferir && <div className="fbar"><label className="f">Transferir projeto para outro GP<select value={novoGP} onChange={e => setNovoGP(e.target.value)}><option value="">Selecione</option>{pessoas.filter(x => x.id !== p.responsavel_id).map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label><button className="btn" disabled={!novoGP} onClick={transferir}>Transferir</button></div>}
    </section>}

    {aba === "nps" && <NpsTab id={id} l={npsL} reacao={reacao} pode={pode} pessoas={pessoas} ents={ents} recarregar={carregar} />}

    {aba === "hist" && <>
      <section className="bx"><h2>Alertas enviados</h2><p className="meta">Quem foi avisado, quando e se o e-mail chegou a ser enviado.</p>{histA.length === 0 ? <p className="empty">Nenhum alerta ainda.</p> :
        <div className="tw"><table><thead><tr><th>Quando</th><th>Para</th><th>Alerta</th><th>Situação</th></tr></thead><tbody>
          {histA.map((h, i) => <tr key={i}><td>{new Date(h.criado_em).toLocaleString("pt-BR")}</td><td>{h.para}</td><td>{h.assunto}</td><td>{h.enviado_em ? "Enviado em " + new Date(h.enviado_em).toLocaleString("pt-BR") + (h.erro ? " (" + h.erro.slice(0, 80) + ")" : "") : h.erro ? "Falhou: " + h.erro.slice(0, 80) : "Na fila"}</td></tr>)}</tbody></table></div>}</section>
      <section className="bx"><h2>Histórico de alterações</h2>{histE.length === 0 ? <p className="empty">Nenhum registro.</p> :
        <div className="tw"><table><thead><tr><th>Quando</th><th>O quê</th><th>Ação</th><th>Por</th></tr></thead><tbody>
          {histE.map((h, i) => <tr key={i}><td>{new Date(h.em).toLocaleString("pt-BR")}</td><td>{h.tabela}{h.resumo ? " · " + h.resumo : ""}</td><td>{h.acao === "INSERT" ? "Criado" : h.acao === "UPDATE" ? "Alterado" : "Removido"}</td><td>{pessoa(h.usuario_id)}</td></tr>)}</tbody></table></div>}</section></>}

    {dlg?.t === "macro" && <FormMacro p={p} n={macros.length} onClose={() => { setDlg(null); carregar(); }} />}
    {dlg?.t === "ent" && <FormEnt p={p} m={dlg.m} tipos={tipos} pessoas={pessoas} finEd={finEd} onClose={() => { setDlg(null); carregar(); }} />}
    {dlg?.t === "ativ" && <FormAtiv p={p} ents={ents} e={dlg.e} a={dlg.a} pessoas={pessoas} contatos={contatos} finEd={finEd} onClose={() => { setDlg(null); carregar(); }} />}
  </>);
}

function Form({ titulo, onClose, onSave, children }: any) {
  const [erro, setErro] = useState("");
  return <Dialog titulo={titulo} onClose={onClose}><form onSubmit={async (e) => { e.preventDefault(); const r = await onSave(); if (r) setErro("Não foi possível salvar. Verifique sua permissão e tente de novo."); else onClose(); }}>
    <div className="fg">{children}</div>{erro && <p className="erro">{erro}</p>}
    <div className="acts"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn p">Salvar</button></div></form></Dialog>;
}
function FormMacro({ p, n, onClose }: any) {
  const [nome, setNome] = useState("");
  return <Form titulo="Nova macroetapa" onClose={onClose} onSave={async () => (await supabase.from("macroetapas").insert({ escopo_id: p.escopo_vigente_id, projeto_id: p.id, nome, ordem: n + 1 })).error}>
    <label className="f w">Nome da macroetapa<input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Contextualização" /></label></Form>;
}
function FormEnt({ p, m, tipos, pessoas, finEd, onClose }: any) {
  const [s, setS] = useState<any>({ nome: "", tipo: "", qtd: 1, data: "", receita: true, valor: "", pax: "", resp: "", hora: "", uf: "", cidade: "" });
  return <Form titulo={`Novo entregável em ${m.nome}`} onClose={onClose} onSave={async () => {
    const N = Math.max(1, Number(s.qtd) || 1); const total = finEd && s.receita && s.valor ? numBR(s.valor) || 0 : 0;
    const { data, error } = await supabase.from("entregaveis").insert({ macroetapa_id: m.id, projeto_id: p.id, escopo_id: p.escopo_vigente_id, tipo_id: s.tipo || null, nome: s.nome, quantidade: N, data_prevista: s.data || null, hora_prevista: s.hora || null, responsavel_id: s.resp || null, gera_receita: s.receita, pax_previsto: s.pax === "" ? null : Number(s.pax), uf: s.uf || null, cidade: s.cidade || null }).select("id").single();
    if (error) return error;
    if (total > 0) { const r = await supabase.from("alocacoes_valor").insert({ entregavel_id: data.id, valor: total }); if (r.error) return r.error; }
    // quantidade N = N linhas no cronograma, cada uma com a sua parte do valor
    const base = Math.floor(total / N * 100) / 100;
    const linhas = Array.from({ length: N }, (_, i) => ({ entregavel_id: data.id, projeto_id: p.id, nome: N > 1 ? `${s.nome} (${i + 1}/${N})` : s.nome, responsavel_id: s.resp || null, data_prevista: s.data || null, hora_prevista: s.hora || null,
      gera_receita: s.receita && total > 0, valor: total > 0 ? (i === N - 1 ? Math.round((total - base * (N - 1)) * 100) / 100 : base) : null }));
    return (await supabase.from("atividades").insert(linhas)).error; }}>
    <label className="f w">Nome do entregável<input required value={s.nome} onChange={e => setS({ ...s, nome: e.target.value })} placeholder="Ex.: Entrevistas com lideranças" /></label>
    <label className="f">Tipo<select value={s.tipo} onChange={e => setS({ ...s, tipo: e.target.value })}><option value="">Sem tipo</option>{tipos.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f">Consultor responsável<select value={s.resp} onChange={e => setS({ ...s, resp: e.target.value })}><option value="">Definir depois</option>{pessoas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f">Quantidade (cria uma linha no cronograma por unidade)<input type="number" min={1} max={200} value={s.qtd} onChange={e => setS({ ...s, qtd: e.target.value })} /></label>
    <label className="f">Data prevista<input type="date" value={s.data} onChange={e => setS({ ...s, data: e.target.value })} /></label>
    <label className="f">Horário<input type="time" value={s.hora} onChange={e => setS({ ...s, hora: e.target.value })} /></label>
    <label className="f">Pessoas previstas (PAX)<input type="number" min={0} value={s.pax} onChange={e => setS({ ...s, pax: e.target.value })} placeholder="Opcional" /></label>
    <label className="f">Estado<select value={s.uf} onChange={e => setS({ ...s, uf: e.target.value })}><option value="">Não informado</option>{Object.keys(UFS).map(u => <option key={u} value={u}>{u}</option>)}</select></label>
    <label className="f">Cidade<input value={s.cidade} onChange={e => setS({ ...s, cidade: e.target.value })} placeholder="Opcional" /></label>
    {finEd && s.receita && <label className="f">Valor total (R$), dividido entre as linhas<input inputMode="decimal" value={s.valor} onChange={e => setS({ ...s, valor: e.target.value })} placeholder="Opcional" /></label>}
    <label className="f w" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={s.receita} onChange={e => setS({ ...s, receita: e.target.checked })} />Entrega paga (gera receita). Desmarque se não for cobrada</label>
  </Form>;
}

// Criar ou editar uma atividade do cronograma (linha do Kanban)
function FormAtiv({ p, ents, e, a, pessoas, contatos, finEd, onClose }: any) {
  const edit = !!a;
  const [s, setS] = useState<any>({ ent: a?.entregavel_id || e?.id || "", nome: a?.nome || "", resp: a?.responsavel_id || "", contato: a?.contato_id || "", cn: "", ce: "", tipo: a?.responsabilidade || "conectas", data: a?.data_prevista || "", hora: a?.hora_prevista?.slice(0, 5) || "",
    prio: a?.prioridade || "media", log: !!a?.logistica, pend: a?.pendencia || "", local: a?.local || "", horas: a?.horas_previstas != null ? txtBR(a.horas_previstas) : "", part: a?.participantes || "", valor: a?.valor != null ? txtBR(a.valor) : "", paga: a ? !!a.gera_receita : !!e?.gera_receita });
  return <Form titulo={edit ? `Editar atividade` : "Nova atividade"} onClose={onClose} onSave={async () => {
    let contato = s.contato;
    if (contato === "__novo") {
      if (!s.cn) return true;
      const r = await supabase.from("contatos").insert({ nome: s.cn, email: s.ce || null, tipo: s.tipo === "cliente" ? "cliente" : "terceiro" }).select("id").single();
      if (r.error) return r.error; contato = r.data.id;
    }
    const body: any = { nome: s.nome, responsavel_id: s.resp || null, contato_id: contato || null, responsabilidade: s.tipo, data_prevista: s.data || null, hora_prevista: s.hora || null, local: s.local || null,
      horas_previstas: s.horas === "" ? null : numBR(s.horas), participantes: s.part || null, prioridade: s.prio, logistica: s.log, pendencia: s.pend || null };
    if (finEd) { body.valor = s.valor === "" ? null : numBR(s.valor); body.gera_receita = s.paga && (body.valor || 0) > 0; }
    if (edit) return (await supabase.from("atividades").update(body).eq("id", a.id)).error;
    return (await supabase.from("atividades").insert({ ...body, entregavel_id: s.ent, projeto_id: p.id })).error; }}>
    <label className="f w">Entregável<select required disabled={edit} value={s.ent} onChange={x => setS({ ...s, ent: x.target.value })}><option value="">Selecione</option>{ents.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f w">Nome da atividade<input required value={s.nome} onChange={x => setS({ ...s, nome: x.target.value })} placeholder="Ex.: Agendar entrevistas" /></label>
    <label className="f">Responsável (equipe)<select value={s.resp} onChange={x => setS({ ...s, resp: x.target.value })}><option value="">Definir depois</option>{pessoas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f">Ou contato externo (cliente, parceiro)<select value={s.contato} onChange={x => setS({ ...s, contato: x.target.value })}><option value="">Nenhum</option>{contatos.map((t: any) => <option key={t.id} value={t.id}>{t.nome}{t.email ? " · " + t.email : ""}</option>)}<option value="__novo">Cadastrar novo contato</option></select></label>
    {s.contato === "__novo" && <><label className="f">Nome do contato<input required value={s.cn} onChange={x => setS({ ...s, cn: x.target.value })} /></label><label className="f">E-mail do contato (recebe os alertas)<input type="email" value={s.ce} onChange={x => setS({ ...s, ce: x.target.value })} /></label></>}
    <label className="f">De quem é a responsabilidade<select value={s.tipo} onChange={x => setS({ ...s, tipo: x.target.value })}>{Object.entries(RESP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label className="f">Data prevista<input type="date" value={s.data} onChange={x => setS({ ...s, data: x.target.value })} /></label>
    <label className="f">Horário<input type="time" value={s.hora} onChange={x => setS({ ...s, hora: x.target.value })} /></label>
    <label className="f">Prioridade<select value={s.prio} onChange={x => setS({ ...s, prio: x.target.value })}>{Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label className="f">Local<input value={s.local} onChange={x => setS({ ...s, local: x.target.value })} placeholder="Cliente, online, V12..." /></label>
    <label className="f">Horas previstas (HP)<input inputMode="decimal" value={s.horas} onChange={x => setS({ ...s, horas: x.target.value })} /></label>
    {finEd && <label className="f">Valor desta linha (R$)<input inputMode="decimal" value={s.valor} onChange={x => setS({ ...s, valor: x.target.value })} placeholder="Opcional" /></label>}
    <label className="f w">Participantes<input value={s.part} onChange={x => setS({ ...s, part: x.target.value })} placeholder="Ex.: Patricia, Sabrina" /></label>
    <label className="f w">Pendência<input value={s.pend} onChange={x => setS({ ...s, pend: x.target.value })} /></label>
    {finEd && <label className="f w" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={s.paga} onChange={x => setS({ ...s, paga: x.target.checked })} />Gera receita contábil ao concluir (precisa de valor)</label>}
    <label className="f w" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={s.log} onChange={x => setS({ ...s, log: x.target.checked })} />Atividade de logística</label>
  </Form>;
}

function NpsTab({ id, l, reacao, pode, pessoas, ents, recarregar }: any) {
  const [abrir, setAbrir] = useState(false); const [abrirR, setAbrirR] = useState(false);
  const v = nps(l.map((x: any) => x.nota)); const z = zonaNps(v);
  return <section className="bx"><div className="rowh"><h2>NPS do projeto</h2>{pode && <button className="btn" onClick={() => setAbrir(true)}>Registrar resposta</button>}</div>
    <p><b style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>{v ?? "-"}</b> <span className="meta"><span className="dot" style={{ background: z[1] }} />{z[0]} · {l.length} resposta{l.length === 1 ? "" : "s"}</span></p>
    {l.length === 0 ? <p className="empty">Nenhuma resposta ainda. Registre a nota dada pelo cliente.</p> :
      <div className="tw"><table><thead><tr><th>Data</th><th>Nota</th><th>Respondente</th><th>Consultor</th><th>Observação</th></tr></thead><tbody>
        {l.map((x: any) => <tr key={x.id}><td>{dataBR(x.data)}</td><td>{x.nota} · {catNps(x.nota)}</td><td>{x.respondente || "-"}</td><td>{pessoas.find((p: any) => p.id === x.consultor_id)?.nome || "-"}</td><td>{x.observacao || ""}</td></tr>)}</tbody></table></div>}
    {abrir && <FormNps id={id} pessoas={pessoas} ents={ents} onClose={() => { setAbrir(false); recarregar(); }} />}
    <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />
    <div className="rowh"><h2>Avaliação de reação</h2>{pode && <button className="btn" onClick={() => setAbrirR(true)}>Registrar avaliação de reação</button>}</div>
    <p className="meta">Pode ser da Conectas ou enviada pelo cliente. Anexe o arquivo original para ficar guardado no projeto.</p>
    {reacao.length === 0 ? <p className="empty">Nenhuma avaliação de reação ainda.</p> :
      <div className="tw"><table><thead><tr><th>Data</th><th>Origem</th><th>Consultor</th><th>Nota</th><th>Respostas</th><th>Arquivo</th></tr></thead><tbody>
        {reacao.map((x: any) => <tr key={x.id}><td>{dataBR(x.data)}</td><td>{x.origem === "cliente" ? "Cliente" : "Conectas"}</td><td>{x.consultor?.nome || x.consultor_nome || "-"}</td><td>{Number(x.nota).toLocaleString("pt-BR")} de {Number(x.escala_max).toLocaleString("pt-BR")}</td><td>{x.respostas ?? "-"}</td>
          <td>{x.arquivo_path ? <button className="btn sm" onClick={async () => { const { data } = await supabase.storage.from("avaliacoes").createSignedUrl(x.arquivo_path, 120); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); }}>Abrir</button> : "-"}</td></tr>)}</tbody></table></div>}
    {abrirR && <FormReacao id={id} pessoas={pessoas} ents={ents} onClose={() => { setAbrirR(false); recarregar(); }} />}</section>;
}
function FormNps({ id, pessoas, ents, onClose }: any) {
  const [s, setS] = useState<any>({ nota: "", data: hoje(), consultor: "", resp: "", ent: "", obs: "" });
  return <Form titulo="Registrar resposta de NPS" onClose={onClose} onSave={async () => (await supabase.from("nps_respostas").insert({ projeto_id: id, nota: Number(s.nota), data: s.data, consultor_id: s.consultor || null, respondente: s.resp || null, entregavel_id: s.ent || null, observacao: s.obs || null })).error}>
    <label className="f">Nota (0 a 10)<input required type="number" min={0} max={10} value={s.nota} onChange={e => setS({ ...s, nota: e.target.value })} /></label>
    <label className="f">Data<input type="date" required value={s.data} onChange={e => setS({ ...s, data: e.target.value })} /></label>
    <label className="f">Consultor<select value={s.consultor} onChange={e => setS({ ...s, consultor: e.target.value })}><option value="">Não informado</option>{pessoas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f">Entrega avaliada<select value={s.ent} onChange={e => setS({ ...s, ent: e.target.value })}><option value="">Projeto como um todo</option>{ents.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f w">Respondente<input value={s.resp} onChange={e => setS({ ...s, resp: e.target.value })} /></label>
    <label className="f w">Observação<textarea rows={2} value={s.obs} onChange={e => setS({ ...s, obs: e.target.value })} /></label>
  </Form>;
}

function FormReacao({ id, pessoas, ents, onClose }: any) {
  const [s, setS] = useState<any>({ nota: "", escala: "10", resp: "", data: hoje(), consultor: "", outro: "", ent: "", origem: "conectas", obs: "" });
  const [arq, setArq] = useState<File | null>(null);
  return <Form titulo="Registrar avaliação de reação" onClose={onClose} onSave={async () => {
    let path: string | null = null;
    if (arq) {
      const seguro = arq.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      path = `${id}/${Date.now()}-${seguro}`;
      const up = await supabase.storage.from("avaliacoes").upload(path, arq, { upsert: false });
      if (up.error) return up.error;
    }
    return (await supabase.from("avaliacoes_reacao").insert({ projeto_id: id, nota: Number(String(s.nota).replace(",", ".")), escala_max: Number(String(s.escala).replace(",", ".")), respostas: s.resp === "" ? null : Number(s.resp), data: s.data,
      consultor_id: s.consultor && s.consultor !== "__outro" ? s.consultor : null, consultor_nome: s.consultor === "__outro" ? s.outro || null : null, entregavel_id: s.ent || null, origem: s.origem, arquivo_path: path, observacao: s.obs || null })).error; }}>
    <label className="f">Origem<select value={s.origem} onChange={e => setS({ ...s, origem: e.target.value })}><option value="conectas">Conectas</option><option value="cliente">Enviada pelo cliente</option></select></label>
    <label className="f">Data<input type="date" required value={s.data} onChange={e => setS({ ...s, data: e.target.value })} /></label>
    <label className="f">Nota média<input required inputMode="decimal" value={s.nota} onChange={e => setS({ ...s, nota: e.target.value })} /></label>
    <label className="f">Escala máxima<input required inputMode="decimal" value={s.escala} onChange={e => setS({ ...s, escala: e.target.value })} placeholder="Ex.: 5 ou 10" /></label>
    <label className="f">Número de respostas<input type="number" min={0} value={s.resp} onChange={e => setS({ ...s, resp: e.target.value })} /></label>
    <label className="f">Entrega avaliada<select value={s.ent} onChange={e => setS({ ...s, ent: e.target.value })}><option value="">Projeto como um todo</option>{ents.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label className="f">Consultor<select value={s.consultor} onChange={e => setS({ ...s, consultor: e.target.value })}><option value="">Não informado</option>{pessoas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}<option value="__outro">Outro (informar nome)</option></select></label>
    {s.consultor === "__outro" && <label className="f">Nome do consultor<input value={s.outro} onChange={e => setS({ ...s, outro: e.target.value })} /></label>}
    <label className="f w">Arquivo original (opcional)<input type="file" accept=".pdf,.xlsx,.xls,.csv,.docx,.png,.jpg,.jpeg" onChange={e => setArq(e.target.files?.[0] || null)} /></label>
    <label className="f w">Observação<textarea rows={2} value={s.obs} onChange={e => setS({ ...s, obs: e.target.value })} /></label>
  </Form>;
}
