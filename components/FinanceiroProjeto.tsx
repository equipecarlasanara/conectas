"use client";
import { useCallback, useEffect, useState } from "react";
import Dialog from "@/components/Dialog";
import { supabase } from "@/lib/supabase";
import { brl, dataBR, hoje } from "@/lib/format";

const CATEGORIAS = ["Logística", "Passagem", "Hospedagem", "Transporte", "Alimentação", "Material", "Impressão", "Parceiro", "Design", "Outros"];
const num = (v: any) => (v === "" || v == null ? null : Number(String(v).replace(/\./g, "").replace(",", ".")));
const txt = (v: any) => (v == null ? "" : String(v).replace(".", ","));

// Gestão financeira do projeto: despesas (logística, material, parceiros...) com ou sem valor orçado.
export default function FinanceiroProjeto({ projetoId, pode, perfil }: { projetoId: string; pode: boolean; perfil: any }) {
  const [l, setL] = useState<any[]>([]); const [contratado, setContratado] = useState<number | null>(null); const [reconhecida, setReconhecida] = useState(0); const [saving, setSaving] = useState(0);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS);
  const [dlg, setDlg] = useState<any>(null); const [erro, setErro] = useState(""); const [ok, setOk] = useState("");
  const finVer = perfil.fin !== "nenhum"; const podeEditar = pode || perfil.fin === "editar" || perfil.fin === "validar";
  const carregar = useCallback(async () => {
    setL((await supabase.from("despesas").select("*, quem:perfis(nome)").eq("projeto_id", projetoId).order("data", { ascending: false })).data || []);
    const ops = (await supabase.from("opcoes_sistema").select("nome").eq("grupo", "categoria_despesa").eq("ativo", true).order("ordem")).data || [];
    if (ops.length) setCategorias(ops.map((x: any) => x.nome));
    if (finVer) {
      const f = await supabase.from("projeto_financeiro").select("valor_contratado").eq("projeto_id", projetoId).maybeSingle();
      setContratado(f.data ? Number(f.data.valor_contratado) : null);
      const ev = (await supabase.from("eventos_receita").select("valor,status,origem").eq("projeto_id", projetoId)).data || [];
      setReconhecida(ev.filter((x: any) => x.status === "reconhecida").reduce((s: number, x: any) => s + Number(x.valor), 0));
      setSaving(ev.filter((x: any) => x.origem === "saving" && x.status === "reconhecida").reduce((s: number, x: any) => s + Number(x.valor), 0));
    }
  }, [projetoId, finVer]);
  useEffect(() => { carregar(); }, [carregar]);

  const liq = (x: any) => Number(x.valor_gasto || 0) - Number(x.valor_reembolsado || 0);
  const gasto = l.reduce((s, x) => s + liq(x), 0);
  const orcado = l.filter(x => x.valor_orcado != null).reduce((s, x) => s + Number(x.valor_orcado), 0);
  const savingCalc = l.filter(x => x.valor_orcado != null && x.valor_gasto != null).reduce((s, x) => s + Number(x.valor_orcado) - liq(x), 0);
  const porCat: Record<string, number> = {}; l.forEach(x => porCat[x.categoria] = (porCat[x.categoria] || 0) + liq(x));

  async function remover(id: string) {
    if (!confirm("Remover este lançamento? A remoção fica registrada no histórico.")) return;
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    setErro(error ? "Não foi possível remover. Verifique sua permissão e tente de novo." : ""); carregar();
  }
  async function lancarSaving() {
    const sugestao = Math.max(savingCalc - saving, 0);
    const v = prompt("Valor do saving a lançar como receita contábil (R$):", String(sugestao.toFixed(2)).replace(".", ","));
    if (v == null) return;
    const { error } = await supabase.rpc("lancar_saving", { p_projeto: projetoId, p_valor: num(v), p_descricao: "Saving do projeto (orçado menos gasto)" });
    if (error) { setErro("Não foi possível lançar: " + error.message); setOk(""); } else { setErro(""); setOk("Saving lançado como receita contábil."); }
    carregar();
  }

  return (<>
    <section className="sum">
      <div><b>{brl(orcado)}</b><span>Orçado (linhas com orçamento)</span></div>
      <div><b>{brl(gasto)}</b><span>Gasto líquido (após reembolsos)</span></div>
      <div className={savingCalc < 0 ? "l" : ""}><b>{brl(savingCalc)}</b><span>Saving (orçado menos gasto)</span></div>
      {finVer && <div><b>{contratado == null ? "-" : brl(contratado)}</b><span>Valor contratado</span></div>}
      {finVer && <div><b>{brl(reconhecida)}</b><span>Receita contábil reconhecida</span></div>}
      {finVer && <div className={reconhecida - gasto < 0 ? "l" : ""}><b>{brl(reconhecida - gasto)}</b><span>Resultado parcial (receita menos despesas)</span></div>}
    </section>
    {erro && <p className="erro">{erro}</p>}{ok && <p className="meta">{ok}</p>}
    <section className="bx">
      <div className="rowh"><h2>Despesas do projeto</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {perfil.fin === "validar" && savingCalc - saving > 0 && <button className="btn" onClick={lancarSaving}>Lançar saving como receita contábil</button>}
          {podeEditar && <button className="btn p" onClick={() => setDlg({})}>Lançar despesa</button>}
        </div></div>
      <p className="meta">Lance aqui tudo o que o projeto gasta: logística, material, impressão, parceiros. O orçado é opcional; quando existe, a diferença para o gasto é o saving. {saving > 0 ? `Já lançado como receita: ${brl(saving)}.` : ""}</p>
      {l.length === 0 ? <p className="empty">Nenhuma despesa lançada ainda. Registre as despesas e logísticas do projeto.</p> :
        <div className="tw"><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Fornecedor</th><th>Orçado</th><th>Gasto</th><th>Reembolso</th><th>Lançado por</th><th></th></tr></thead><tbody>
          {l.map(x => <tr key={x.id}><td>{dataBR(x.data)}</td><td>{x.categoria}</td><td>{x.descricao}</td><td>{x.fornecedor || "-"}</td><td>{x.valor_orcado != null ? brl(x.valor_orcado) : "-"}</td><td>{x.valor_gasto != null ? brl(x.valor_gasto) : "-"}</td><td>{Number(x.valor_reembolsado) > 0 ? brl(x.valor_reembolsado) : "-"}</td><td>{x.quem?.nome || "-"}</td>
            <td style={{ whiteSpace: "nowrap" }}>{podeEditar && <><button className="btn sm" onClick={() => setDlg(x)}>Editar</button> <button className="btn sm" onClick={() => remover(x.id)}>Remover</button></>}</td></tr>)}
        </tbody></table></div>}
    </section>
    {Object.keys(porCat).length > 0 && <section className="bx"><h2>Gasto por categoria</h2>
      {Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div className="hb" key={k}><span>{k}</span><span className="t"><i style={{ width: (gasto ? Math.max(v, 0) / gasto * 100 : 0) + "%", background: "var(--s2)" }} /></span><b>{brl(v)}</b></div>)}</section>}
    {dlg && <FormDespesa projetoId={projetoId} d={dlg} categorias={categorias} onClose={() => { setDlg(null); carregar(); }} />}
  </>);
}

function FormDespesa({ projetoId, d, categorias, onClose }: { projetoId: string; d: any; categorias: string[]; onClose: () => void }) {
  const [s, setS] = useState<any>({ categoria: d.categoria || categorias[0] || "Logística", descricao: d.descricao || "", fornecedor: d.fornecedor || "", data: d.data || hoje(), orcado: txt(d.valor_orcado), gasto: txt(d.valor_gasto), reemb: Number(d.valor_reembolsado) > 0 ? txt(d.valor_reembolsado) : "" });
  const [erro, setErro] = useState("");
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const corpo = { projeto_id: projetoId, categoria: s.categoria.trim(), descricao: s.descricao.trim(), fornecedor: s.fornecedor.trim() || null, data: s.data, valor_orcado: num(s.orcado), valor_gasto: num(s.gasto), valor_reembolsado: num(s.reemb) || 0 };
    const { error } = d.id ? await supabase.from("despesas").update(corpo).eq("id", d.id) : await supabase.from("despesas").insert(corpo);
    if (error) { setErro("Não foi possível salvar. Verifique sua permissão e tente de novo."); return; }
    onClose();
  }
  return <Dialog titulo={d.id ? "Editar despesa" : "Lançar despesa"} onClose={onClose}><form onSubmit={salvar}><div className="fg">
    <label className="f">Categoria<select required value={s.categoria} onChange={e => setS({ ...s, categoria: e.target.value })}>{categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
    <label className="f">Data<input type="date" required value={s.data} onChange={e => setS({ ...s, data: e.target.value })} /></label>
    <label className="f w">Descrição<input required value={s.descricao} onChange={e => setS({ ...s, descricao: e.target.value })} placeholder="Ex.: Passagem aérea SP-Recife" /></label>
    <label className="f w">Fornecedor ou parceiro<input value={s.fornecedor} onChange={e => setS({ ...s, fornecedor: e.target.value })} placeholder="Opcional" /></label>
    <label className="f">Valor orçado (R$)<input inputMode="decimal" value={s.orcado} onChange={e => setS({ ...s, orcado: e.target.value })} placeholder="Opcional" /></label>
    <label className="f">Valor gasto (R$)<input inputMode="decimal" value={s.gasto} onChange={e => setS({ ...s, gasto: e.target.value })} /></label>
    <label className="f">Reembolsado (R$)<input inputMode="decimal" value={s.reemb} onChange={e => setS({ ...s, reemb: e.target.value })} placeholder="Opcional" /></label>
  </div>{erro && <p className="erro">{erro}</p>}<div className="acts"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn p">Salvar</button></div></form></Dialog>;
}
