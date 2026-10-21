"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Perfil = { id:string; nome:string; email:string; papel:string; fin:string; ativo:boolean; acesso_projetos?:string; ver_geral?:boolean; ver_impactometro?:boolean; ver_pax_consultor?:boolean; ver_capacidade?:boolean; carga_horas_mes?:number };
type Ctx = { carregando:boolean; perfil:Perfil|null; sair:()=>Promise<void>; recarregar:()=>Promise<void> };
const C = createContext<Ctx>({ carregando:true, perfil:null, sair:async()=>{}, recarregar:async()=>{} });
export const useAuth = () => useContext(C);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<Perfil|null>(null);
  async function carregar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPerfil(null); setCarregando(false); return; }
    const { data } = await supabase.from("perfis").select("*").eq("id", session.user.id).maybeSingle();
    setPerfil(data as Perfil|null); setCarregando(false);
  }
  useEffect(() => {
    carregar();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { carregar(); });
    return () => sub.subscription.unsubscribe();
  }, []);
  return (<C.Provider value={{ carregando, perfil, recarregar:carregar, sair: async()=>{ await supabase.auth.signOut(); setPerfil(null); } }}>{children}</C.Provider>);
}
