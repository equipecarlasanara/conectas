"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./Auth";
import { PAPEL } from "@/lib/format";

export default function Shell({ children }: { children: React.ReactNode }) {
  const { carregando, perfil, sair } = useAuth();
  const path = usePathname(); const router = useRouter();
  useEffect(() => { if (!carregando && !perfil) router.replace("/login"); }, [carregando, perfil, router]);
  if (carregando) return <div className="cx-wrap"><p className="empty">Carregando...</p></div>;
  if (!perfil) return null;
  if (!perfil.ativo) return <div className="cx-wrap"><p className="empty">Seu acesso está desativado. Fale com a coordenação.</p></div>;
  const fin = perfil.fin !== "nenhum";
  const adm = perfil.papel === "admin";
  const abas = [
    ...(adm || perfil.ver_geral !== false ? [["/", "Visão geral"]] : []),
    ["/projetos", "Projetos"], ["/calendario", "Calendário"], ["/atividades", "Minhas atividades"], ["/kanban", "Cronograma"], ["/clientes", "Clientes"],
    ...(adm || perfil.ver_capacidade ? [["/consultores", "Consultores"]] : []),
    ...(adm || perfil.ver_impactometro !== false ? [["/impactometro", "Impactômetro"]] : []),
    ...(fin || perfil.papel === "gestora" ? [["/receita", "Financeiro"]] : []),
    ...(adm ? [["/admin", "Administração"]] : []),
  ];
  const ativa = (h: string) => h === "/" ? path === "/" : path.startsWith(h);
  return (
    <div className="cx-wrap">
      <div className="brandbar">
        <img src="/conectas-logo.png" alt="Conectas" />
        <span className="who">
          <span>{perfil.nome} · {PAPEL[perfil.papel]}</span>
          <button className="btn sm" onClick={async () => { await sair(); router.replace("/login"); }}>Sair</button>
        </span>
      </div>
      <nav className="tabs" aria-label="Navegação">
        {abas.map(([h, t]) => <Link key={h} href={h} className={ativa(h) ? "on" : ""}>{t}</Link>)}
      </nav>
      {children}
    </div>
  );
}
