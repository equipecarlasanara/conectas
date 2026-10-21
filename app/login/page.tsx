"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setOcupado(false);
    if (error) { setErro("E-mail ou senha incorretos. Confira e tente de novo."); return; }
    router.replace("/");
  }
  return (
    <div className="cx-wrap login">
      <div className="brandbar"><img src="/conectas-logo.png" alt="Conectas" /><span className="who">Projetos e receita</span></div>
      <form className="bx" onSubmit={entrar}>
        <h1>Entrar</h1>
        <div className="fg">
          <label className="f w">E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" /></label>
          <label className="f w">Senha<input type="password" required value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password" /></label>
        </div>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn p" disabled={ocupado}>{ocupado ? "Entrando..." : "Entrar"}</button>
      </form>
    </div>
  );
}
