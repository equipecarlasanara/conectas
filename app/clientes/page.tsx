"use client";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import Dialog from "@/components/Dialog";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";

export default function Page() { return <Shell><Clientes /></Shell>; }

function norm(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function Clientes() {
  const { perfil } = useAuth();
  const pode = perfil!.papel === "admin" || perfil!.papel === "gestora" || perfil!.papel === "lider_tecnico";
  const [lista, setLista] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [importar, setImportar] = useState(false);
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [msgSucesso, setMsgSucesso] = useState("");

  // Importação em lote
  const arqRef = useRef<HTMLInputElement>(null);
  const [textoColado, setTextoColado] = useState("");
  const [previa, setPrevia] = useState<{ nome: string; documento: string | null; observacoes: string | null; duplicado: boolean }[]>([]);
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erroImport, setErroImport] = useState("");

  const carregar = async () => {
    const { data } = await supabase.from("clientes").select("*, projetos(id)").order("nome");
    setLista(data || []);
  };

  useEffect(() => { carregar(); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const { error } = await supabase.from("clientes").insert({ nome: nome.trim(), documento: doc.trim() || null, observacoes: obs.trim() || null });
    if (error) { setErro("Não foi possível salvar. Verifique sua permissão e tente de novo."); return; }
    setNovo(false); setNome(""); setDoc(""); setObs("");
    setMsgSucesso(`Cliente "${nome.trim()}" cadastrado com sucesso.`);
    carregar();
  }

  async function excluir(c: any) {
    if (!confirm(`Remover o cliente "${c.nome}"?`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (error) { alert("Não foi possível excluir o cliente: " + error.message); return; }
    carregar();
  }

  function processarLinhas(linhas: { nome: string; documento?: string | null; observacoes?: string | null }[]) {
    const existentes = new Set(lista.map(c => norm(c.nome)));
    const mapaUnicos = new Map<string, { nome: string; documento: string | null; observacoes: string | null; duplicado: boolean }>();

    for (const item of linhas) {
      const n = (item.nome || "").trim();
      if (!n || n.length < 2) continue;
      const chave = norm(n);
      if (!mapaUnicos.has(chave)) {
        mapaUnicos.set(chave, {
          nome: n,
          documento: item.documento ? String(item.documento).trim() : null,
          observacoes: item.observacoes ? String(item.observacoes).trim() : null,
          duplicado: existentes.has(chave),
        });
      }
    }
    setPrevia(Array.from(mapaUnicos.values()));
  }

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    setLendo(true); setErroImport("");
    try {
      const XLSX = await import("xlsx");
      const buf = await arq.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: false });
      const primeiraAba = wb.SheetNames[0];
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[primeiraAba], { header: 1, raw: false, defval: "" });
      if (!rows.length) { setErroImport("A planilha está vazia."); return; }

      let colNome = 0, colDoc = -1, colObs = -1, startRow = 0;
      const h0 = rows[0].map((x: any) => norm(String(x)));
      const idxN = h0.findIndex((h: string) => h.includes("cliente") || h.includes("empresa") || h.includes("nome") || h.includes("razao"));
      const idxD = h0.findIndex((h: string) => h.includes("cnpj") || h.includes("cpf") || h.includes("doc"));
      const idxO = h0.findIndex((h: string) => h.includes("obs") || h.includes("observacao") || h.includes("contato") || h.includes("segmento"));

      if (idxN >= 0) {
        colNome = idxN;
        colDoc = idxD;
        colObs = idxO;
        startRow = 1;
      } else {
        startRow = 0;
      }

      const itens: { nome: string; documento?: string | null; observacoes?: string | null }[] = [];
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[colNome]) continue;
        itens.push({
          nome: String(row[colNome]),
          documento: colDoc >= 0 ? String(row[colDoc] || "") : null,
          observacoes: colObs >= 0 ? String(row[colObs] || "") : null,
        });
      }
      processarLinhas(itens);
    } catch (err: any) {
      setErroImport("Não foi possível ler o arquivo: " + (err?.message || err));
    } finally {
      setLendo(false);
    }
  }

  function lerTextoColado(txt: string) {
    setTextoColado(txt);
    if (!txt.trim()) { setPrevia([]); return; }
    const linhas = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const itens = linhas.map(l => {
      const partes = l.includes("\t") ? l.split("\t") : l.includes(";") ? l.split(";") : [l];
      return {
        nome: partes[0]?.trim() || "",
        documento: partes[1]?.trim() || null,
        observacoes: partes[2]?.trim() || null,
      };
    });
    processarLinhas(itens);
  }

  async function confirmarImportacao() {
    const novos = previa.filter(p => !p.duplicado);
    if (!novos.length) { setErroImport("Não há novas empresas para importar (todas já existem no sistema)."); return; }
    setImportando(true); setErroImport("");
    try {
      const payload = novos.map(x => ({
        nome: x.nome,
        documento: x.documento || null,
        observacoes: x.observacoes || null,
      }));
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) { setErroImport("Erro ao salvar clientes: " + error.message); return; }
      setImportar(false);
      setPrevia([]);
      setTextoColado("");
      setMsgSucesso(`${novos.length} cliente(s) importado(s) com sucesso!`);
      carregar();
    } finally {
      setImportando(false);
    }
  }

  const filtrados = lista.filter(c => {
    if (!busca) return true;
    const b = norm(busca);
    return norm(c.nome).includes(b) || norm(c.documento || "").includes(b) || norm(c.observacoes || "").includes(b);
  });

  const novosQtd = previa.filter(p => !p.duplicado).length;

  return (<>
    <header className="cx-head">
      <div>
        <h1>Clientes</h1>
        <div className="meta">Catálogo de empresas e clientes atendidos pela Conectas.</div>
      </div>
      {pode && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => { setImportar(true); setPrevia([]); setErroImport(""); setTextoColado(""); }}>
            Importar lista de empresas
          </button>
          <button className="btn p" onClick={() => { setNome(""); setDoc(""); setObs(""); setErro(""); setNovo(true); }}>
            + Novo cliente
          </button>
        </div>
      )}
    </header>

    {msgSucesso && (
      <p className="meta" style={{ color: "var(--ink)", fontWeight: 600, marginBottom: 12 }}>
        ✓ {msgSucesso}
      </p>
    )}

    <section className="fbar">
      <label className="f" style={{ flex: 1, minWidth: 260 }}>
        Buscar cliente
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar por nome, CNPJ ou observação..." />
      </label>
      {busca && <button className="btn" onClick={() => setBusca("")}>Limpar busca</button>}
      <span className="meta" style={{ alignSelf: "center", marginLeft: "auto" }}>
        Total: <b>{filtrados.length}</b> {filtrados.length === 1 ? "empresa" : "empresas"}
      </span>
    </section>

    <section className="bx">
      <div className="tw">
        {filtrados.length === 0 ? (
          <p className="empty">
            {busca ? "Nenhum cliente corresponde ao filtro." : "Nenhum cliente cadastrado ainda. Use \"Novo cliente\" ou \"Importar lista de empresas\" para começar."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente / Empresa</th>
                <th>CNPJ ou Documento</th>
                <th>Projetos vinculados</th>
                {pode && <th style={{ width: 80, textAlign: "right" }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id}>
                  <td>
                    <b>{c.nome}</b>
                    {c.observacoes && <div className="meta">{c.observacoes}</div>}
                  </td>
                  <td>{c.documento || "-"}</td>
                  <td>
                    <span className="tag">
                      {c.projetos?.length || 0} {c.projetos?.length === 1 ? "projeto" : "projetos"}
                    </span>
                  </td>
                  {pode && (
                    <td style={{ textAlign: "right" }}>
                      {(c.projetos?.length || 0) === 0 && (
                        <button type="button" className="btn sm" onClick={() => excluir(c)} title="Excluir este cliente">
                          Excluir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>

    {novo && (
      <Dialog titulo="Novo cliente" onClose={() => setNovo(false)}>
        <form onSubmit={salvar}>
          <div className="fg">
            <label className="f w">Nome da empresa / cliente<input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Banco do Brasil, Vale, Natura..." /></label>
            <label className="f w">CNPJ ou documento<input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Opcional" /></label>
            <label className="f w">Observações<textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Segmento, contato principal ou observações..." /></label>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <div className="acts">
            <button type="button" className="btn" onClick={() => setNovo(false)}>Cancelar</button>
            <button className="btn p">Salvar cliente</button>
          </div>
        </form>
      </Dialog>
    )}

    {importar && (
      <Dialog titulo="Importar lista de empresas" onClose={() => setImportar(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="meta">
            Envie uma planilha em <b>Excel (.xlsx, .xls, .csv)</b> com as colunas da sua lista ou <b>cole os nomes das empresas</b> no campo abaixo (um nome por linha).
          </p>

          <div className="bx" style={{ background: "var(--soft)", boxShadow: "none" }}>
            <b>Opção 1: Subir arquivo de planilha</b>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input ref={arqRef} type="file" accept=".xlsx,.xls,.csv,.txt" onChange={lerArquivo} />
              {lendo && <span className="meta">Lendo planilha...</span>}
            </div>
          </div>

          <div>
            <b>Opção 2: Ou colar lista de nomes de empresas</b>
            <p className="meta">Cole aqui os nomes das empresas (uma por linha):</p>
            <textarea
              rows={5}
              style={{ width: "100%", fontFamily: "inherit" }}
              placeholder={"Petrobras\nAmbev\nItaú Unibanco\nMagazine Luiza"}
              value={textoColado}
              onChange={e => lerTextoColado(e.target.value)}
            />
          </div>

          {erroImport && <p className="erro">{erroImport}</p>}

          {previa.length > 0 && (
            <div className="bx" style={{ boxShadow: "none" }}>
              <div className="rowh">
                <b>Prévia da importação: {novosQtd} nova(s) empresa(s) para cadastrar</b>
                {previa.length - novosQtd > 0 && (
                  <span className="meta">({previa.length - novosQtd} já existente(s) serão ignoradas)</span>
                )}
              </div>
              <div className="tw" style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>CNPJ / Doc</th>
                      <th>Observações</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.slice(0, 100).map((p, idx) => (
                      <tr key={idx} style={{ opacity: p.duplicado ? 0.5 : 1 }}>
                        <td><b>{p.nome}</b></td>
                        <td>{p.documento || "-"}</td>
                        <td>{p.observacoes || "-"}</td>
                        <td>
                          {p.duplicado ? (
                            <span className="meta">Já cadastrada</span>
                          ) : (
                            <span className="tag" style={{ background: "var(--s3)", color: "#fff" }}>Novo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previa.length > 100 && (
                <p className="meta" style={{ marginTop: 6 }}>
                  Mostrando primeiras 100 de {previa.length} empresas encontradas.
                </p>
              )}
            </div>
          )}

          <div className="acts">
            <button type="button" className="btn" onClick={() => setImportar(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn p"
              disabled={novosQtd === 0 || importando}
              onClick={confirmarImportacao}
            >
              {importando ? "Importando..." : `Confirmar importação de ${novosQtd} empresa(s)`}
            </button>
          </div>
        </div>
      </Dialog>
    )}
  </>);
}
