"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";
import Dialog from "@/components/Dialog";
import { PAPEL, FIN, ACESSO, dataBR } from "@/lib/format";

export default function Page() {
  return (
    <Shell>
      <Admin />
    </Shell>
  );
}

const GRUPOS_OPCOES = [
  { id: "macroetapa_padrao", titulo: "Macroetapas padrão", desc: "Etapas padrão do método Conectas criadas nos projetos (ex.: Contextualização, Conteúdo, Conexão, Consolidação, Concretização)." },
  { id: "categoria_despesa", titulo: "Categorias de despesa", desc: "Categorias para lançamento de gastos e orçamento na aba Financeiro de cada projeto." },
  { id: "tipo_projeto", titulo: "Classificação do projeto", desc: "Classificação do projeto (se é Palestra, Projeto, Programa, Workshop, Consultoria)." },
  { id: "tipos_entregavel", titulo: "Entregáveis", desc: "Catálogo de entregáveis da Conectas para classificar entregas e atividades (ex.: Team Building, PDL, Coaching, Assessment, Diagnóstico...)." },
];

function Admin() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState<"usuarios" | "parametros">("usuarios");
  const [u, setU] = useState<any[]>([]);
  const [s, setS] = useState<any[]>([]);
  const [erro, setErro] = useState("");
  const [nu, setNu] = useState({ nome: "", email: "", senha: "", papel: "gestora", fin: "nenhum" });
  const [ok, setOk] = useState("");
  const [perm, setPerm] = useState<any>(null);
  const [sub, setSub] = useState({ ausente: "", substituta: "", ini: "", fim: "" });

  const carregar = async () => {
    setU((await supabase.from("perfis").select("*").order("nome")).data || []);
    setS((await supabase.from("substituicoes").select("*").order("inicio", { ascending: false })).data || []);
  };
  useEffect(() => {
    carregar();
  }, []);

  if (perfil!.papel !== "admin") return <p className="empty">Esta área é restrita exclusivamente à administração.</p>;

  async function upd(id: string, campos: any) {
    const { error } = await supabase.from("perfis").update(campos).eq("id", id);
    setErro(error ? "Não foi possível salvar a última alteração. Verifique sua permissão e tente de novo." : "");
    carregar();
  }

  async function addSub(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("substituicoes")
      .insert({ ausente_id: sub.ausente, substituta_id: sub.substituta, inicio: sub.ini, fim: sub.fim, criado_por: perfil!.id });
    setErro(error ? "Não foi possível registrar a substituição. Confira as datas e as pessoas." : "");
    carregar();
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const cadastrarDireto = async () => {
      const { error } = await supabase.from("perfis").insert({
        nome: nu.nome.trim(),
        email: nu.email.trim().toLowerCase(),
        senha: nu.senha,
        papel: nu.papel,
        fin: nu.fin,
        ativo: true,
        acesso_projetos: "todos",
        ver_geral: true,
        ver_impactometro: true,
        ver_pax_consultor: nu.papel === "admin",
        ver_capacidade: nu.papel === "admin" || nu.papel === "gestora",
        carga_horas_mes: 176,
      });
      if (error) {
        setErro("Não foi possível cadastrar. Tente de novo.");
        return;
      }
      setOk(`Usuário cadastrado. Passe o e-mail e a senha provisória para ${nu.nome}.`);
      setNu({ nome: "", email: "", senha: "", papel: "gestora", fin: "nenhum" });
      carregar();
    };
    if (session?.access_token?.startsWith("local-token-")) {
      await cadastrarDireto();
      return;
    }
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(nu),
      });
      if (r.status === 404 || r.status === 405) {
        await cadastrarDireto();
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.erro || "Não foi possível cadastrar. Tente de novo.");
        return;
      }
      setOk(`Usuário cadastrado. Passe o e-mail e a senha provisória para ${nu.nome}.`);
      setNu({ nome: "", email: "", senha: "", papel: "gestora", fin: "nenhum" });
      carregar();
    } catch {
      await cadastrarDireto();
    }
  }

  const nome = (id: string) => u.find((x) => x.id === id)?.nome || "-";

  return (
    <>
      <header className="cx-head">
        <div>
          <h1>Administração</h1>
          <div className="meta">Gestão exclusiva de acessos, usuários, substituições e listas fixas do sistema Conectas.</div>
        </div>
      </header>

      <div className="tabs">
        <button className={aba === "usuarios" ? "on" : ""} onClick={() => setAba("usuarios")}>
          Usuários, Permissões &amp; Substituições
        </button>
        <button className={aba === "parametros" ? "on" : ""} onClick={() => setAba("parametros")}>
          Listas e Parâmetros do Sistema
        </button>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {ok && <p className="meta">{ok}</p>}

      {aba === "usuarios" && (
        <>
          <section className="bx">
            <h2>Cadastrar usuário</h2>
            <p className="meta">O e-mail cadastrado libera o acesso e também recebe os alertas de tarefas, entregas e agenda.</p>
            <form className="fbar" onSubmit={cadastrar}>
              <label className="f">
                Nome
                <input required value={nu.nome} onChange={(e) => setNu({ ...nu, nome: e.target.value })} />
              </label>
              <label className="f">
                E-mail
                <input type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
              </label>
              <label className="f">
                Senha provisória
                <input required minLength={8} value={nu.senha} onChange={(e) => setNu({ ...nu, senha: e.target.value })} />
              </label>
              <label className="f">
                Papel
                <select value={nu.papel} onChange={(e) => setNu({ ...nu, papel: e.target.value })}>
                  {Object.entries(PAPEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="f">
                Financeiro
                <select value={nu.fin} onChange={(e) => setNu({ ...nu, fin: e.target.value })}>
                  {Object.entries(FIN).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn p">Cadastrar usuário</button>
            </form>
          </section>

          <section className="bx">
            <h2>Usuários e permissões</h2>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Financeiro</th>
                    <th>Ativo</th>
                    <th>Acessos</th>
                  </tr>
                </thead>
                <tbody>
                  {u.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <b>{x.nome}</b>
                      </td>
                      <td>{x.email}</td>
                      <td>
                        <select value={x.papel} disabled={x.id === perfil!.id} onChange={(e) => upd(x.id, { papel: e.target.value })}>
                          {Object.entries(PAPEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={x.fin} onChange={(e) => upd(x.id, { fin: e.target.value })}>
                          {Object.entries(FIN).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={x.ativo}
                          disabled={x.id === perfil!.id}
                          onChange={(e) => upd(x.id, { ativo: e.target.checked })}
                        />
                      </td>
                      <td>
                        <button className="btn sm" onClick={() => setPerm(x)}>
                          Definir acessos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {perm && (
            <Permissoes
              u={perm}
              onClose={() => {
                setPerm(null);
                carregar();
              }}
            />
          )}

          <section className="bx">
            <h2>Substituição temporária</h2>
            <p className="meta">Durante o período, a substituta pode editar os projetos da pessoa ausente.</p>
            <form className="fbar" onSubmit={addSub}>
              <label className="f">
                Ausente
                <select required value={sub.ausente} onChange={(e) => setSub({ ...sub, ausente: e.target.value })}>
                  <option value="">Selecione</option>
                  {u.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="f">
                Substituta
                <select required value={sub.substituta} onChange={(e) => setSub({ ...sub, substituta: e.target.value })}>
                  <option value="">Selecione</option>
                  {u.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="f">
                De
                <input type="date" required value={sub.ini} onChange={(e) => setSub({ ...sub, ini: e.target.value })} />
              </label>
              <label className="f">
                Até
                <input type="date" required value={sub.fim} onChange={(e) => setSub({ ...sub, fim: e.target.value })} />
              </label>
              <button className="btn p">Registrar substituição</button>
            </form>
            {s.length === 0 ? (
              <p className="empty">Nenhuma substituição registrada.</p>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Ausente</th>
                      <th>Substituta</th>
                      <th>Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.map((x) => (
                      <tr key={x.id}>
                        <td>{nome(x.ausente_id)}</td>
                        <td>{nome(x.substituta_id)}</td>
                        <td>
                          {dataBR(x.inicio)} a {dataBR(x.fim)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {aba === "parametros" && <ParametrosSistema />}
    </>
  );
}

function ParametrosSistema() {
  const [grupoAtivo, setGrupoAtivo] = useState("macroetapa_padrao");
  const [itens, setItens] = useState<any[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  const ehTabelaTiposEntregavel = grupoAtivo === "tipos_entregavel";
  const infoGrupo = GRUPOS_OPCOES.find((g) => g.id === grupoAtivo)!;

  async function carregarItens() {
    setErro("");
    if (ehTabelaTiposEntregavel) {
      const { data, error } = await supabase.from("tipos_entregavel").select("*").order("nome");
      if (error) setErro("Não foi possível carregar os tipos de entregável.");
      setItens(data || []);
    } else {
      const { data, error } = await supabase.from("opcoes_sistema").select("*").eq("grupo", grupoAtivo).order("ordem");
      if (error) setErro("Não foi possível carregar as opções do sistema.");
      setItens(data || []);
    }
  }

  useEffect(() => {
    carregarItens();
    setNovoNome("");
    setMsg("");
  }, [grupoAtivo]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMsg("");
    const limpo = novoNome.trim();
    if (!limpo) return;
    if (itens.some((x) => x.nome.toLowerCase() === limpo.toLowerCase())) {
      setErro("Já existe um item com esse nome nesta lista.");
      return;
    }
    const res = ehTabelaTiposEntregavel
      ? await supabase.from("tipos_entregavel").insert({ nome: limpo, ativo: true })
      : await supabase.from("opcoes_sistema").insert({ grupo: grupoAtivo, nome: limpo, ordem: itens.length + 1, ativo: true });

    if (res.error) {
      setErro(res.error.message || "Não foi possível adicionar o item.");
      return;
    }
    setNovoNome("");
    setMsg(`"${limpo}" adicionado com sucesso.`);
    carregarItens();
  }

  async function renomear(item: any, novoTexto: string) {
    const limpo = novoTexto.trim();
    if (!limpo || limpo === item.nome) return;
    setErro("");
    setMsg("");
    const tabela = ehTabelaTiposEntregavel ? "tipos_entregavel" : "opcoes_sistema";
    const { error } = await supabase.from(tabela).update({ nome: limpo }).eq("id", item.id);
    if (error) {
      setErro("Não foi possível renomear o item.");
      return;
    }
    setMsg(`Item atualizado para "${limpo}".`);
    carregarItens();
  }

  async function alternarAtivo(item: any, ativo: boolean) {
    setErro("");
    const tabela = ehTabelaTiposEntregavel ? "tipos_entregavel" : "opcoes_sistema";
    const { error } = await supabase.from(tabela).update({ ativo }).eq("id", item.id);
    if (error) {
      setErro("Não foi possível alterar o status do item.");
      return;
    }
    carregarItens();
  }

  async function remover(item: any) {
    if (!confirm(`Remover "${item.nome}" desta lista?`)) return;
    setErro("");
    setMsg("");
    const tabela = ehTabelaTiposEntregavel ? "tipos_entregavel" : "opcoes_sistema";
    const { error } = await supabase.from(tabela).delete().eq("id", item.id);
    if (error) {
      setErro("Não foi possível remover (pode estar em uso). Você também pode desativá-lo desmarcando a caixa Ativo.");
      return;
    }
    setMsg(`"${item.nome}" removido.`);
    carregarItens();
  }

  return (
    <section className="bx">
      <div className="rowh">
        <div>
          <h2>Listas e Parâmetros Configuráveis (Exclusivo Admin)</h2>
          <p className="meta">
            Edite aqui as opções fixas que aparecem nos seletores do sistema. Qualquer alteração reflete imediatamente nas telas de Projetos, Escopo e Financeiro.
          </p>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 8 }}>
        {GRUPOS_OPCOES.map((g) => (
          <button key={g.id} className={grupoAtivo === g.id ? "on" : ""} onClick={() => setGrupoAtivo(g.id)}>
            {g.titulo}
          </button>
        ))}
      </div>

      <p className="meta" style={{ marginBottom: 12 }}>
        <b>{infoGrupo.titulo}:</b> {infoGrupo.desc}
      </p>

      {erro && <p className="erro">{erro}</p>}
      {msg && (
        <p className="meta" style={{ color: "var(--ink)", fontWeight: 600, marginBottom: 10 }}>
          ✓ {msg}
        </p>
      )}

      <form className="fbar" onSubmit={adicionar} style={{ background: "var(--soft)", boxShadow: "none" }}>
        <label className="f" style={{ flex: 1, minWidth: 240 }}>
          Novo item em {infoGrupo.titulo}
          <input
            required
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder={`Digite o nome para adicionar em ${infoGrupo.titulo.toLowerCase()}...`}
          />
        </label>
        <button className="btn p" type="submit">
          + Adicionar opção
        </button>
      </form>

      <div className="tw">
        {itens.length === 0 ? (
          <p className="empty">Nenhuma opção cadastrada nesta lista.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome da opção (clique para editar)</th>
                <th style={{ width: 110 }}>Ativo nos formulários</th>
                <th style={{ width: 120, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      key={item.id + "-" + item.nome}
                      defaultValue={item.nome}
                      style={{ width: "100%", maxWidth: 460, fontWeight: 500 }}
                      onBlur={(e) => renomear(item, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      aria-label={`Editar ${item.nome}`}
                    />
                  </td>
                  <td>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={item.ativo !== false} onChange={(e) => alternarAtivo(item, e.target.checked)} />
                      <span>{item.ativo !== false ? "Ativo" : "Inativo"}</span>
                    </label>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn sm" onClick={() => remover(item)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// Acessos de uma pessoa: módulos, nível financeiro e quais projetos ela enxerga ou edita.
function Permissoes({ u, onClose }: { u: any; onClose: () => void }) {
  const [f, setF] = useState<any>({
    papel: u.papel,
    fin: u.fin,
    acesso_projetos: u.acesso_projetos || "todos",
    ver_geral: u.ver_geral !== false,
    ver_impactometro: u.ver_impactometro !== false,
    ver_pax_consultor: !!u.ver_pax_consultor,
    ver_capacidade: !!u.ver_capacidade,
    carga_horas_mes: u.carga_horas_mes ?? 176,
  });
  const [projs, setProjs] = useState<any[]>([]);
  const [ac, setAc] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    (async () => {
      setProjs((await supabase.from("projetos").select("id,nome,codigo,clientes(nome)").order("nome")).data || []);
      const a = (await supabase.from("acessos_projeto").select("projeto_id,nivel").eq("usuario_id", u.id)).data || [];
      setAc(Object.fromEntries(a.map((x: any) => [x.projeto_id, x.nivel])));
    })();
  }, [u.id]);
  const liberarTudo = () =>
    setF({ ...f, fin: "validar", acesso_projetos: "todos", ver_geral: true, ver_impactometro: true, ver_pax_consultor: true, ver_capacidade: true });
  async function salvar() {
    const r = await supabase
      .from("perfis")
      .update({ ...f, carga_horas_mes: Number(String(f.carga_horas_mes).replace(",", ".")) || 176 })
      .eq("id", u.id)
      .select("id");
    if (r.error || !r.data?.length) {
      setErro("Não foi possível salvar os acessos.");
      return;
    }
    await supabase.from("acessos_projeto").delete().eq("usuario_id", u.id);
    const linhas = Object.entries(ac)
      .filter(([, n]) => n)
      .map(([projeto_id, nivel]) => ({ usuario_id: u.id, projeto_id, nivel }));
    if (linhas.length) {
      const w = await supabase.from("acessos_projeto").insert(linhas);
      if (w.error) {
        setErro("Não foi possível salvar os projetos.");
        return;
      }
    }
    onClose();
  }
  const Chk = ({ k, t }: { k: string; t: string }) => (
    <label className="f w" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />
      {t}
    </label>
  );
  const vis = projs.filter((p) => !busca || (p.nome + p.codigo + (p.clientes?.nome || "")).toLowerCase().includes(busca.toLowerCase()));
  return (
    <Dialog titulo={`Acessos de ${u.nome}`} onClose={onClose}>
      <button type="button" className="btn" onClick={liberarTudo}>
        Liberar tudo (financeiro completo, todos os projetos e todas as telas)
      </button>
      <div className="fg">
        <label className="f">
          Papel
          <select value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })}>
            {Object.entries(PAPEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Financeiro
          <select value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })}>
            {Object.entries(FIN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Horas por mês (capacidade)
          <input inputMode="decimal" value={f.carga_horas_mes} onChange={(e) => setF({ ...f, carga_horas_mes: e.target.value })} />
        </label>
        <Chk k="ver_geral" t="Pode ver a Visão geral" />
        <Chk k="ver_impactometro" t="Pode ver o Impactômetro" />
        <Chk k="ver_pax_consultor" t="Pode ver o Impactômetro e a avaliação de reação por consultor" />
        <Chk k="ver_capacidade" t="Pode ver as horas e a capacidade dos consultores" />
        <label className="f w">
          Projetos que pode ver
          <select value={f.acesso_projetos} onChange={(e) => setF({ ...f, acesso_projetos: e.target.value })}>
            {Object.entries(ACESSO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {f.acesso_projetos === "selecionados" && (
        <div>
          <label className="f">
            Buscar projeto
            <input value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <div className="tw" style={{ maxHeight: 260, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Acesso</th>
                </tr>
              </thead>
              <tbody>
                {vis.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.nome}
                      <div className="meta">
                        {p.clientes?.nome} · {p.codigo}
                      </div>
                    </td>
                    <td>
                      <select value={ac[p.id] || ""} onChange={(e) => setAc({ ...ac, [p.id]: e.target.value })}>
                        <option value="">Sem acesso</option>
                        <option value="ver">Só ver</option>
                        <option value="editar">Ver e editar</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="meta">
        Projetos em que a pessoa é GP, líder técnico ou responsável por uma atividade aparecem sempre para ela. O Financeiro continua valendo conforme o nível escolhido acima.
      </p>
      {erro && <p className="erro">{erro}</p>}
      <div className="acts">
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn p" onClick={salvar}>
          Salvar acessos
        </button>
      </div>
    </Dialog>
  );
}
