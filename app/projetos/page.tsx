"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import Dialog from "@/components/Dialog";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { PRIORIDADE, SITUACAO, FASE, TIPOS_PROJETO, STATUS, dataBR, atrasado, brl } from "@/lib/format";
import { ehCronograma, lerCronograma } from "@/lib/importar/cronograma";

export default function Page() { return <Shell><Projetos /></Shell>; }

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function Projetos() {
  const { perfil } = useAuth();
  const pode = perfil!.papel === "admin" || perfil!.papel === "gestora" || perfil!.papel === "lider_tecnico";
  const finEd = perfil!.fin === "editar" || perfil!.fin === "validar";
  const [lista, setLista] = useState<any[]>([]); const [clientes, setClientes] = useState<any[]>([]); const [pessoas, setPessoas] = useState<any[]>([]);
  const [tiposProj, setTiposProj] = useState<string[]>(TIPOS_PROJETO);
  const [novo, setNovo] = useState(false); const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState({ cliente: "", resp: "", sit: "", tipo: "", q: "" });
  const vazio = { codigo: "", cliente: "", nome: "", descricao: "", resp: perfil!.id, apoio: "", ini: "", fim: "", tipo: "", modalidade: "projeto", fase: "", prio: "media" };
  const [n, setN] = useState<any>(vazio);
  // importação
  const arqRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false); const [erroLeitura, setErroLeitura] = useState(""); const [abas, setAbas] = useState<any[] | null>(null);
  const [prev, setPrev] = useState<any>(null); const [arv, setArv] = useState<any[]>([]); const [novoCliente, setNovoCliente] = useState("");

  const carregar = async () => {
    const { data } = await supabase.from("projetos").select("*, clientes(nome), resp:perfis!projetos_responsavel_id_fkey(nome), entregaveis(status,escopo_id,data_prevista)").order("criado_em", { ascending: false });
    setLista(data || []);
  };
  useEffect(() => { carregar();
    supabase.from("clientes").select("id,nome").order("nome").then((r: any) => setClientes(r.data || []));
    supabase.from("perfis").select("id,nome,papel").eq("ativo", true).order("nome").then((r: any) => setPessoas(r.data || []));
    supabase.from("opcoes_sistema").select("grupo,nome").eq("ativo", true).order("ordem").then((r: any) => {
      const d = r.data || [];
      const tps = d.filter((x: any) => x.grupo === "tipo_projeto").map((x: any) => x.nome);
      if (tps.length) setTiposProj(tps);
    });
  }, []);

  function abrirNovo() { setN(vazio); setPrev(null); setArv([]); setAbas(null); setErro(""); setErroLeitura(""); setNovoCliente(""); setNovo(true); }

  async function ler(aba?: string) {
    const arq = arqRef.current?.files?.[0]; if (!arq) { setErroLeitura("Escolha um arquivo primeiro."); return; }
    setLendo(true); setErroLeitura(""); setAbas(null); setPrev(null);
    const aplicarPrevia = (j: any) => {
      if (j.escolher_aba) { setAbas(j.escolher_aba); return; }
      setPrev(j);
      setArv(j.macroetapas.map((m: any) => ({ ...m, incluir: true, entregaveis: m.entregaveis.map((e: any) => ({ ...e, incluir: true })) })));
      const achado = clientes.find(c => j.cliente && norm(c.nome) === norm(j.cliente));
      setN((x: any) => ({ ...x, nome: x.nome || j.projeto || (j.cliente ? `${j.cliente}` : ""), descricao: x.descricao || j.descricao || "", cliente: achado ? achado.id : (j.cliente ? "__novo" : x.cliente) }));
      setNovoCliente(achado ? "" : (j.cliente || ""));
    };
    try {
      if (/\.(xlsx|xlsm|xls|csv)$/i.test(arq.name)) {
        const XLSX = await import("xlsx");
        const buf = await arq.arrayBuffer();
        const wb = XLSX.read(buf, { cellDates: true });
        const listaAbas = wb.SheetNames.map(nm => ({ n: nm, rows: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nm], { header: 1, raw: true, defval: null }) }));
        const cron = listaAbas.filter(a => ehCronograma(a.rows));
        if (cron.length > 0) {
          if (cron.length > 1 && !aba) {
            aplicarPrevia({ escolher_aba: cron.map(a => { const r = lerCronograma(a.rows, a.n); return { aba: a.n, cliente: r.cliente, atividades: r.total.atividades }; }) });
            return;
          }
          const alvo = cron.find(a => a.n === aba) || cron[0];
          aplicarPrevia({ ...lerCronograma(alvo.rows, alvo.n), fonte: "cronograma" });
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData(); fd.append("arquivo", arq); if (aba) fd.append("aba", aba);
      const r = await fetch("/api/importar", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: fd });
      const j = await r.json();
      if (!r.ok) { setErroLeitura(j.erro || "Não foi possível ler o arquivo."); return; }
      aplicarPrevia(j);
    } catch { setErroLeitura("Planilhas no formato de cronograma são lidas automaticamente; para arquivos comerciais (PDF/DOCX) preencha manualmente caso a leitura por IA não esteja ativa."); } finally { setLendo(false); }
  }

  const setM = (i: number, c: any) => setArv(a => a.map((m, k) => k === i ? { ...m, ...c } : m));
  const setE = (i: number, j: number, c: any) => setArv(a => a.map((m, k) => k !== i ? m : { ...m, entregaveis: m.entregaveis.map((e: any, l: number) => l === j ? { ...e, ...c } : e) }));
  const casaPessoa = (txt: string | null) => { if (!txt) return null; for (const p of txt.split(/,|\/| e |&/)) { const k = norm(p).split(" ")[0]; if (k.length < 3) continue; const ach = pessoas.filter(x => norm(x.nome).split(" ")[0] === k); if (ach.length === 1) return ach[0].id; } return null; };

  async function criar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setOcupado(true);
    try {
      let clienteId = n.cliente;
      if (clienteId === "__novo") {
        const { data, error } = await supabase.from("clientes").insert({ nome: novoCliente.trim() }).select("id").single();
        if (error || !data) { setErro("Não foi possível criar o cliente. Verifique sua permissão e tente de novo."); return; }
        clienteId = data.id;
      }
      const { data: pid, error } = await supabase.rpc("criar_projeto", { p_codigo: n.codigo || null, p_cliente: clienteId, p_nome: n.nome, p_descricao: n.descricao || null, p_responsavel: n.resp || null, p_apoio: n.apoio || null, p_inicio: n.ini || null, p_fim: n.fim || null });
      if (error || !pid) { setErro(error?.message?.includes("duplicate") ? "Já existe um projeto com esse identificador." : "Não foi possível criar o projeto: " + (error?.message || "")); return; }
      await supabase.from("projetos").update({ tipo_projeto: n.tipo || null, subtipo: null, modalidade: n.modalidade, fase: n.fase || null, prioridade: n.prio }).eq("id", pid);
      if (prev) {
        const dados = { macroetapas: arv.filter(m => m.incluir).map(m => ({ nome: m.nome, entregaveis: m.entregaveis.filter((e: any) => e.incluir).map((e: any) => ({
          nome: e.nome, quantidade: e.quantidade, status: e.status, data_prevista: e.data_prevista, valor: finEd ? e.valor : null, gera_receita: e.gera_receita,
          atividades: e.atividades.map((a: any) => ({ nome: a.nome, status: a.status, data_prevista: a.data_prevista, horas_previstas: a.horas_previstas, local: a.local, participantes: a.participantes,
            responsavel_id: a.status === "concluido" || a.status === "cancelado" ? null : casaPessoa(a.participantes) })) })) })) };
        const { error: e2 } = await supabase.rpc("importar_estrutura", { p_projeto: pid, p_dados: dados });
        if (e2) { setErro("O projeto foi criado, mas a estrutura não pôde ser importada: " + e2.message + " Abra o projeto e tente de novo."); carregar(); return; }
      }
      setNovo(false); carregar();
    } finally { setOcupado(false); }
  }

  const vis = lista.filter(p => (!f.cliente || p.cliente_id === f.cliente) && (!f.resp || p.responsavel_id === f.resp) && (!f.sit || p.situacao === f.sit) && (!f.tipo || p.tipo_projeto === f.tipo) && (!f.q || (p.nome + p.codigo + (p.clientes?.nome || "")).toLowerCase().includes(f.q.toLowerCase())));
  const cont = prev ? { m: arv.filter(m => m.incluir).length, e: arv.filter(m => m.incluir).reduce((s, m) => s + m.entregaveis.filter((e: any) => e.incluir).length, 0), a: arv.filter(m => m.incluir).reduce((s, m) => s + m.entregaveis.filter((e: any) => e.incluir).reduce((t: number, e: any) => t + e.atividades.length, 0), 0) } : null;

  return (<>
    <header className="cx-head"><h1>Projetos</h1>{pode && <button className="btn p" onClick={abrirNovo}>Novo projeto</button>}</header>
    <section className="fbar">
      <label className="f">Buscar<input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Nome, código ou cliente" /></label>
      <label className="f">Cliente<select value={f.cliente} onChange={e => setF({ ...f, cliente: e.target.value })}><option value="">Todos</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label className="f">GP<select value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })}><option value="">Todos</option>{pessoas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label className="f">Classificação do projeto<select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}><option value="">Todas</option>{tiposProj.map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="f">Status<select value={f.sit} onChange={e => setF({ ...f, sit: e.target.value })}><option value="">Todas</option>{Object.entries(SITUACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <button className="btn" onClick={() => setF({ cliente: "", resp: "", sit: "", tipo: "", q: "" })}>Limpar filtros</button>
    </section>
    {vis.length === 0 ? <p className="empty">Nenhum projeto encontrado. {pode ? "Crie o primeiro em Novo projeto." : ""}</p> :
      <div className="grid">{vis.map(p => {
        const es = (p.entregaveis || []).filter((x: any) => x.escopo_id === p.escopo_vigente_id);
        const ok = es.filter((x: any) => x.status === "concluido").length; const at = es.filter((x: any) => atrasado(x.data_prevista, x.status)).length;
        return <Link key={p.id} href={`/projetos/${p.id}`} className="pj">
          <h2>{p.nome}</h2><div className="meta">{p.clientes?.nome} · {p.codigo}</div>
          <div className="prog"><i style={{ width: (es.length ? ok / es.length * 100 : 0) + "%" }} /></div>
          <div className="meta">{ok} de {es.length} entregas concluídas</div>
          <div style={{ marginTop: 8 }}><span className="tag">{SITUACAO[p.situacao]}</span>{p.fase && <span className="tag">{FASE[p.fase]}</span>}{p.tipo_projeto && <span className="tag">{p.tipo_projeto}</span>}{p.modalidade === "full_service" && <span className="tag">Full service</span>}{at > 0 && <span className="tag late">{at} atrasada{at > 1 ? "s" : ""}</span>}</div>
          <div className="meta" style={{ marginTop: 6 }}>GP: {p.resp?.nome || "sem responsável"} · {dataBR(p.inicio_previsto)} a {dataBR(p.fim_previsto)}</div>
        </Link>; })}</div>}

    {novo && <Dialog titulo="Novo projeto" onClose={() => setNovo(false)}>
      <div className="bx" style={{ background: "var(--soft)", boxShadow: "none" }}>
        <h2>Começar por um arquivo</h2>
        <p className="meta">Envie o arquivo recebido do comercial (PDF, DOCX ou XLSX) ou um cronograma em Excel. O sistema monta uma prévia para você conferir antes de criar. Nada é gravado até você clicar em Criar projeto.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input ref={arqRef} type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt" onChange={() => { setAbas(null); setPrev(null); setErroLeitura(""); }} />
          <button type="button" className="btn" disabled={lendo} onClick={() => ler()}>{lendo ? "Lendo..." : "Ler arquivo"}</button>
        </div>
        {erroLeitura && <p className="erro">{erroLeitura}</p>}
        {abas && <div style={{ marginTop: 10 }}><p className="meta">Este arquivo tem mais de um cronograma. Escolha qual criar agora:</p>
          <div className="tw" style={{ maxHeight: 180, overflow: "auto" }}><table><thead><tr><th>Aba</th><th>Cliente</th><th>Atividades</th><th></th></tr></thead><tbody>
            {abas.map(a => <tr key={a.aba}><td>{a.aba}</td><td>{a.cliente || "-"}</td><td>{a.atividades}</td><td><button type="button" className="btn sm" onClick={() => ler(a.aba)}>Usar esta</button></td></tr>)}</tbody></table></div></div>}
      </div>

      <form onSubmit={criar}>
        <div className="fg">
          <label className="f">Código<input value={n.codigo} onChange={e => setN({ ...n, codigo: e.target.value })} placeholder="Gerado automaticamente" /></label>
          <label className="f">Cliente<select required value={n.cliente} onChange={e => setN({ ...n, cliente: e.target.value })}><option value="">Selecione</option>{novoCliente && <option value="__novo">Criar cliente: {novoCliente}</option>}{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label className="f w">Nome do projeto<input required value={n.nome} onChange={e => setN({ ...n, nome: e.target.value })} /></label>
          <label className="f">Classificação do projeto<select value={n.tipo} onChange={e => setN({ ...n, tipo: e.target.value })}><option value="">Não definida</option>{tiposProj.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="f">Modalidade<select value={n.modalidade} onChange={e => setN({ ...n, modalidade: e.target.value })}><option value="projeto">Projeto</option><option value="full_service">Full service</option></select></label>
          <label className="f">Fase<select value={n.fase} onChange={e => setN({ ...n, fase: e.target.value })}><option value="">Não definida</option>{Object.entries(FASE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="f w">Descrição e objetivo<textarea rows={2} value={n.descricao} onChange={e => setN({ ...n, descricao: e.target.value })} /></label>
          <label className="f">GP (gestor do projeto)<select value={n.resp} onChange={e => setN({ ...n, resp: e.target.value })}><option value="">Definir depois</option>{pessoas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label className="f">Líder técnico<select value={n.apoio} onChange={e => setN({ ...n, apoio: e.target.value })}><option value="">Nenhum</option>{pessoas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label className="f">Prioridade<select value={n.prio} onChange={e => setN({ ...n, prio: e.target.value })}>{Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="f">Início previsto<input type="date" value={n.ini} onChange={e => setN({ ...n, ini: e.target.value })} /></label>
          <label className="f">Término previsto<input type="date" value={n.fim} onChange={e => setN({ ...n, fim: e.target.value })} /></label>
        </div>

        {prev && <div className="bx" style={{ boxShadow: "none" }}>
          <h2>Prévia para conferência</h2>
          <p className="meta">{prev.fonte === "ia" ? "Lido por IA a partir do documento." : "Lido do cronograma em Excel."} Incluindo agora: {cont!.m} macroetapas, {cont!.e} entregáveis e {cont!.a} atividades. Desmarque o que não deve entrar e corrija os nomes.</p>
          {(prev.avisos || []).map((a: string, i: number) => <p key={i} className="meta">Atenção: {a}</p>)}
          {prev.lacunas?.length > 0 && <div><b>Informações não encontradas no documento:</b><ul>{prev.lacunas.map((l: string, i: number) => <li key={i} className="meta">{l}</li>)}</ul></div>}
          <div style={{ maxHeight: 340, overflow: "auto" }}>
            {arv.map((m, i) => <div key={i} className="macro" style={{ opacity: m.incluir ? 1 : .5 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={m.incluir} onChange={e => setM(i, { incluir: e.target.checked })} /><input style={{ flex: 1 }} value={m.nome} onChange={e => setM(i, { nome: e.target.value })} aria-label="Nome da macroetapa" /></label>
              {m.entregaveis.map((en: any, j: number) => <div key={j} className="ent" style={{ opacity: en.incluir ? 1 : .5 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><input type="checkbox" checked={en.incluir} onChange={e => setE(i, j, { incluir: e.target.checked })} />
                  <input style={{ flex: 1, minWidth: 180 }} value={en.nome} onChange={e => setE(i, j, { nome: e.target.value })} aria-label="Nome do entregável" />
                  {prev.fonte === "ia" && <><input type="number" min={1} style={{ width: 70 }} value={en.quantidade} onChange={e => setE(i, j, { quantidade: Number(e.target.value) || 1 })} aria-label="Quantidade" />
                    {finEd && <input style={{ width: 110 }} inputMode="decimal" placeholder="Valor (R$)" value={en.valor ?? ""} onChange={e => setE(i, j, { valor: e.target.value === "" ? null : Number(e.target.value.replace(/\./g, "").replace(",", ".")) || 0 })} aria-label="Valor" />}</>}
                </label>
                <div className="meta">{STATUS[en.status]} · prazo {dataBR(en.data_prevista)} · {en.atividades.length} atividade{en.atividades.length === 1 ? "" : "s"}{en.valor != null ? " · " + brl(en.valor) : ""}{en.origem ? " · origem: " + en.origem : ""}</div>
                {en.atividades.length > 0 && <details><summary className="meta">Ver atividades</summary>{en.atividades.map((a: any, k: number) => <div key={k} className="meta" style={{ padding: "2px 0" }}>{a.nome} · {STATUS[a.status]} · {dataBR(a.data_prevista)}{a.participantes ? " · " + a.participantes : ""}{a.local ? " · " + a.local : ""}</div>)}</details>}
              </div>)}
            </div>)}
          </div>
        </div>}

        {erro && <p className="erro">{erro}</p>}
        <div className="acts"><button type="button" className="btn" onClick={() => setNovo(false)}>Cancelar</button><button className="btn p" disabled={ocupado}>{ocupado ? "Criando..." : "Criar projeto"}</button></div>
      </form>
    </Dialog>}
  </>);
}
