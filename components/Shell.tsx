"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./Auth";
import { PAPEL, FIN } from "@/lib/format";
import { processarAlertasOutlook } from "@/lib/supabase";

const ICONS: Record<string, React.ReactNode> = {
  "/": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  "/projetos": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  "/kanban": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="4" height="15" rx="1" />
    </svg>
  ),
  "/calendario": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  "/atividades": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  "/clientes": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
    </svg>
  ),
  "/consultores": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "/impactometro": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  "/receita": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  "/admin": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export default function Shell({ children }: { children: React.ReactNode }) {
  const { carregando, perfil, sair } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [tema, setTema] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!carregando && !perfil) router.replace("/login");
  }, [carregando, perfil, router]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("conectas_theme") as "light" | "dark" | null) : null;
    const t = saved || "light";
    setTema(t);
    document.documentElement.setAttribute("data-theme", t);
    setTimeout(() => { processarAlertasOutlook(true).catch(() => {}); }, 1500);
  }, []);

  function alternarTema() {
    const prox = tema === "light" ? "dark" : "light";
    setTema(prox);
    document.documentElement.setAttribute("data-theme", prox);
    try {
      localStorage.setItem("conectas_theme", prox);
    } catch {}
  }

  if (carregando) {
    return (
      <div className="cx-loading">
        <div className="cx-spinner" />
        <span>Carregando workspace Conectas...</span>
      </div>
    );
  }
  if (!perfil) return null;
  if (!perfil.ativo) {
    return (
      <div className="cx-wrap">
        <p className="empty">Seu acesso está desativado. Fale com a coordenação.</p>
      </div>
    );
  }

  const fin = perfil.fin !== "nenhum";
  const adm = perfil.papel === "admin";

  const grupos = [
    {
      titulo: "Operação & Projetos",
      itens: [
        ...(adm || perfil.ver_geral !== false ? [["/", "Visão geral"]] : []),
        ["/projetos", "Projetos"],
        ["/kanban", "Cronograma"],
        ["/calendario", "Calendário"],
        ["/atividades", "Minhas atividades"],
      ],
    },
    {
      titulo: "Inteligência & Clientes",
      itens: [
        ...(adm || perfil.ver_impactometro !== false ? [["/impactometro", "Impactômetro"]] : []),
        ...(adm || perfil.ver_capacidade ? [["/consultores", "Capacidade & Horas"]] : []),
        ["/clientes", "Clientes"],
      ],
    },
    {
      titulo: "Governança & Receita",
      itens: [
        ...(fin || perfil.papel === "gestora" ? [["/receita", "Financeiro"]] : []),
        ...(adm ? [["/admin", "Administração"]] : []),
      ],
    },
  ].filter((g) => g.itens.length > 0);

  const ativa = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const iniciais = (perfil.nome || "C")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const todosItens = grupos.flatMap((g) => g.itens);
  const paginaAtual = todosItens.find(([h]) => ativa(h))?.[1] || "Detalhes do Projeto";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sb-brand">
          <div className="sb-logo-pill">
            <img src="/conectas-logo.png" alt="Conectas" />
          </div>
          <div className="sb-sub">
            <span className="sb-dot" />
            <span>Enterprise Workspace</span>
          </div>
        </div>

        <nav className="sb-nav" aria-label="Navegação principal">
          {grupos.map((g) => (
            <div className="sb-group" key={g.titulo}>
              <div className="sb-group-label">{g.titulo}</div>
              {g.itens.map(([h, t]) => (
                <Link key={h} href={h} className={"sb-link" + (ativa(h) ? " on" : "")}>
                  <span className="sb-icon">{ICONS[h]}</span>
                  <span>{t}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{iniciais}</div>
            <div className="sb-user-info">
              <div className="sb-user-name">{perfil.nome}</div>
              <div className="sb-user-role">
                {PAPEL[perfil.papel] || perfil.papel} · Fin: {FIN[perfil.fin] || perfil.fin}
              </div>
            </div>
          </div>
          <div className="sb-actions">
            <button type="button" className="sb-btn" onClick={alternarTema} title="Alternar tema claro/escuro">
              {tema === "light" ? "☾ Escuro" : "☀ Claro"}
            </button>
            <button
              type="button"
              className="sb-btn danger"
              onClick={async () => {
                await sair();
                router.replace("/login");
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="tb-breadcrumb">
            <span className="tb-root">Conectas</span>
            <span className="tb-sep">/</span>
            <span className="tb-current">{paginaAtual}</span>
          </div>
          <div className="tb-right">
            <span className="tb-badge">
              <span className="tb-status-dot" />
              Operacional
            </span>
            <span className="tb-role-pill">{PAPEL[perfil.papel] || perfil.papel}</span>
          </div>
        </header>

        <main className="cx-wrap">{children}</main>
      </div>
    </div>
  );
}
