"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Kanban from "@/components/Kanban";
import Dialog from "@/components/Dialog";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import { PRIORIDADE, RESP } from "@/lib/format";

export default function Page() { return <Shell><Quadro /></Shell>; }

function Quadro() {
  const { perfil } = useAuth();
  const podeCriar = perfil!.papel === "admin" || perfil!.papel === "gestora";
  const [l, setL] = useState<any[]>([]);
  const [ps, setPs] = useState<any[]>([]);
  const [pe, setPe] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [tiposProj, setTiposProj] = useState<string[]>([]);
  const [macros, setMacros] = useState<any[]>([]);
  const [ents, setEnts] = useState<any[]>([]);
  const [f, setF] = useState({ proj: "", resp: "", tipo: "", q: "" });
  const [dlg, setDlg] = useState<any>(null);

  const carregar = async () => {
    setL((await supabase.from("atividades").select("*, projetos(nome,tipo_projeto), resp:perfis(nome), contato:contatos(nome), entregaveis(nome,tipo_id,macroetapa_id,tipos_entregavel(nome))").order("data_prevista")).data || []);
    setPs((await supabase.from("projetos").select("id,nome,tipo_projeto,escopo_vigente_id").order("nome")).data || []);
    setPe((await supabase.from("perfis").select("id,nome").eq("ativo", true).order("nome")).data || []);
    setTipos((await supabase.from("tipos_entregavel").select("id,nome").eq("ativo", true).order("nome")).data || []);
    setMacros((await supabase.from("macroetapas").select("*").order("ordem")).data || []);
    setEnts((await supabase.from("entregaveis").select("id,nome,projeto_id,macroetapa_id,tipo_id,tipos_entregavel(nome)").order("nome")).data || []);
    const ops = (await supabase.from("opcoes_sistema").select("grupo,nome").eq("ativo", true).order("ordem")).data || [];
    setTiposProj(ops.filter((x: any) => x.grupo === "tipo_projeto").map((x: any) => x.nome));
  };
  useEffect(() => { carregar(); }, []);

  const vis = l.filter(a => {
    const tid = a.tipo_id || a.entregaveis?.tipo_id || "";
    return (!f.proj || a.projeto_id === f.proj) &&
      (!f.resp || a.responsavel_id === f.resp) &&
      (!f.tipo || tid === f.tipo) &&
      (!f.q || a.nome.toLowerCase().includes(f.q.toLowerCase()));
  });

  return (<>
    <header className="cx-head">
      <div>
        <h1>Cronograma (Kanban)</h1>
        <div className="meta">Arraste um cartão para mudar o status, classifique o entregável ou inicie uma nova atividade.</div>
      </div>
      {podeCriar && <button className="btn p" onClick={() => setDlg({ a: null })}>Nova atividade</button>}
    </header>
    <section className="fbar">
      <label className="f">Buscar<input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Nome da atividade" /></label>
      <label className="f">Projeto<select value={f.proj} onChange={e => setF({ ...f, proj: e.target.value })}><option value="">Todos</option>{ps.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className="f">Entregável<select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}><option value="">Todos</option>{tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
      <label className="f">Responsável<select value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })}><option value="">Todos</option>{pe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <button className="btn" onClick={() => setF({ proj: "", resp: "", tipo: "", q: "" })}>Limpar filtros</button>
    </section>
    <Kanban atividades={vis} recarregar={carregar} mostrarProjeto pessoas={pe} tipos={tipos} onEditar={podeCriar ? (a: any) => setDlg({ a }) : undefined} />
    {dlg && (
      <ModalAtividadeKanban
        a={dlg.a}
        projetos={ps}
        macros={macros}
        ents={ents}
        tipos={tipos}
        tiposProj={tiposProj}
        pessoas={pe}
        projInicial={f.proj}
        onClose={() => { setDlg(null); carregar(); }}
      />
    )}
  </>);
}

function ModalAtividadeKanban({ a, projetos, macros, ents, tipos, tiposProj, pessoas, projInicial, onClose }: any) {
  const edit = !!a;
  const pidInicial = a?.projeto_id || projInicial || projetos[0]?.id || "";
  const pInicial = projetos.find((x: any) => x.id === pidInicial);
  const entInicial = ents.find((x: any) => x.id === a?.entregavel_id) || null;
  const macrosProjInicial = macros.filter((m: any) => m.projeto_id === pidInicial);

  const [s, setS] = useState<any>({
    proj: pidInicial,
    classifProj: pInicial?.tipo_projeto || "",
    macro: entInicial?.macroetapa_id || macrosProjInicial[0]?.id || "",
    tipoEnt: a?.tipo_id || entInicial?.tipo_id || "",
    ent: a?.entregavel_id || "__auto",
    nome: a?.nome || "",
    resp: a?.responsavel_id || "",
    tipo: a?.responsabilidade || "conectas",
    data: a?.data_prevista || "",
    hora: a?.hora_prevista?.slice(0, 5) || "",
    prio: a?.prioridade || "media",
    local: a?.local || "",
    part: a?.participantes || "",
    pend: a?.pendencia || "",
    log: !!a?.logistica,
  });
  const [erro, setErro] = useState("");

  const macrosProj = macros.filter((m: any) => m.projeto_id === s.proj);
  const entsProj = ents.filter((e: any) => e.projeto_id === s.proj && (!s.macro || e.macroetapa_id === s.macro));

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro("");
    const projObj = projetos.find((x: any) => x.id === s.proj);
    if (!projObj) { setErro("Selecione um projeto."); return; }

    if (s.classifProj !== (projObj.tipo_projeto || "")) {
      await supabase.from("projetos").update({ tipo_projeto: s.classifProj || null }).eq("id", projObj.id);
    }

    let entregavelId = s.ent;
    if (!entregavelId || entregavelId === "__auto") {
      const macroId = s.macro || macrosProj[0]?.id;
      if (!macroId) { setErro("Este projeto ainda não possui macroetapa."); return; }
      const tObj = tipos.find((t: any) => t.id === s.tipoEnt);
      const nomeEnt = tObj?.nome || s.nome;
      const rEnt = await supabase.from("entregaveis").insert({
        macroetapa_id: macroId,
        projeto_id: projObj.id,
        escopo_id: projObj.escopo_vigente_id,
        tipo_id: s.tipoEnt || null,
        nome: nomeEnt,
        quantidade: 1,
        data_prevista: s.data || null,
        hora_prevista: s.hora || null,
        responsavel_id: s.resp || null,
        gera_receita: true,
      }).select("id").single();
      if (rEnt.error || !rEnt.data) { setErro("Não foi possível criar o entregável no escopo."); return; }
      entregavelId = rEnt.data.id;
    } else if (s.tipoEnt) {
      await supabase.from("entregaveis").update({ tipo_id: s.tipoEnt }).eq("id", entregavelId);
    }

    const body: any = {
      projeto_id: projObj.id,
      entregavel_id: entregavelId,
      tipo_id: s.tipoEnt || null,
      nome: s.nome,
      responsavel_id: s.resp || null,
      responsabilidade: s.tipo,
      data_prevista: s.data || null,
      hora_prevista: s.hora || null,
      prioridade: s.prio,
      local: s.local || null,
      participantes: s.part || null,
      pendencia: s.pend || null,
      logistica: s.log,
    };

    const res = edit
      ? await supabase.from("atividades").update(body).eq("id", a.id)
      : await supabase.from("atividades").insert(body);

    if (res.error) {
      setErro("Não foi possível salvar a atividade. Verifique sua permissão.");
      return;
    }
    onClose();
  }

  return (
    <Dialog titulo={edit ? "Editar atividade" : "Nova atividade no Cronograma"} onClose={onClose}>
      <form onSubmit={salvar}>
        <div className="fg">
          <label className="f">
            Projeto
            <select required disabled={edit} value={s.proj} onChange={e => {
              const np = e.target.value;
              const pObj = projetos.find((x: any) => x.id === np);
              const mList = macros.filter((m: any) => m.projeto_id === np);
              setS({ ...s, proj: np, classifProj: pObj?.tipo_projeto || "", macro: mList[0]?.id || "", ent: "__auto" });
            }}>
              <option value="">Selecione</option>
              {projetos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="f">
            Classificação do projeto
            <select value={s.classifProj} onChange={e => setS({ ...s, classifProj: e.target.value })}>
              <option value="">Não definida</option>
              {tiposProj.map((t: string) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="f">
            Macroetapa
            <select required value={s.macro} onChange={e => setS({ ...s, macro: e.target.value, ent: "__auto" })}>
              {macrosProj.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
          <label className="f">
            Entregável (Classificação)
            <select required value={s.tipoEnt} onChange={e => {
              const tid = e.target.value;
              const tObj = tipos.find((t: any) => t.id === tid);
              setS({ ...s, tipoEnt: tid, nome: s.nome || (tObj ? tObj.nome : "") });
            }}>
              <option value="">Selecione o entregável (Team Building, PDL...)</option>
              {tipos.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
          <label className="f w">
            Entrega vinculada no escopo
            <select value={s.ent} onChange={e => {
              const eid = e.target.value;
              const eObj = ents.find((x: any) => x.id === eid);
              setS({ ...s, ent: eid, tipoEnt: eObj?.tipo_id || s.tipoEnt });
            }}>
              <option value="__auto">+ Criar entrega automaticamente nesta macroetapa</option>
              {entsProj.map((x: any) => <option key={x.id} value={x.id}>{x.nome}{x.tipos_entregavel?.nome ? ` (${x.tipos_entregavel.nome})` : ""}</option>)}
            </select>
          </label>
          <label className="f w">
            Nome da atividade
            <input required value={s.nome} onChange={e => setS({ ...s, nome: e.target.value })} placeholder="Ex.: Condução de Team Building / Agendar entrevistas" />
          </label>
          <label className="f">
            Responsável (equipe)
            <select value={s.resp} onChange={e => setS({ ...s, resp: e.target.value })}>
              <option value="">Definir depois</option>
              {pessoas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="f">
            Responsabilidade
            <select value={s.tipo} onChange={e => setS({ ...s, tipo: e.target.value })}>
              {Object.entries(RESP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="f">
            Data prevista
            <input type="date" value={s.data} onChange={e => setS({ ...s, data: e.target.value })} />
          </label>
          <label className="f">
            Horário
            <input type="time" value={s.hora} onChange={e => setS({ ...s, hora: e.target.value })} />
          </label>
          <label className="f">
            Prioridade
            <select value={s.prio} onChange={e => setS({ ...s, prio: e.target.value })}>
              {Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="f">
            Local
            <input value={s.local} onChange={e => setS({ ...s, local: e.target.value })} placeholder="Cliente, online..." />
          </label>
          <label className="f w">
            Participantes
            <input value={s.part} onChange={e => setS({ ...s, part: e.target.value })} placeholder="Ex.: Angélica, Marcelle" />
          </label>
          <label className="f w" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={s.log} onChange={e => setS({ ...s, log: e.target.checked })} />
            Atividade de logística
          </label>
        </div>
        {erro && <p className="erro">{erro}</p>}
        <div className="acts">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn p">Salvar</button>
        </div>
      </form>
    </Dialog>
  );
}
