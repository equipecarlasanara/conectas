import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cria um usuário (com e-mail e senha provisória). Só administradores. A chave service_role fica só no servidor.
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return NextResponse.json({ erro: "O servidor ainda não tem a chave SUPABASE_SERVICE_ROLE_KEY configurada." }, { status: 500 });
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ erro: "Sessão inválida. Entre novamente." }, { status: 401 });

  const quem = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await quem.auth.getUser(token);
  if (!u?.user) return NextResponse.json({ erro: "Sessão inválida. Entre novamente." }, { status: 401 });
  const { data: me } = await quem.from("perfis").select("papel,ativo").eq("id", u.user.id).maybeSingle();
  if (!me || me.papel !== "admin" || !me.ativo) return NextResponse.json({ erro: "Apenas a administração pode cadastrar usuários." }, { status: 403 });

  const b = await req.json();
  const nome = String(b.nome || "").trim(), email = String(b.email || "").trim().toLowerCase(), senha = String(b.senha || "");
  const papel = String(b.papel || "gestora"), fin = String(b.fin || "nenhum");
  if (!nome || !email.includes("@")) return NextResponse.json({ erro: "Informe nome e um e-mail válido." }, { status: 400 });
  if (senha.length < 8) return NextResponse.json({ erro: "A senha provisória precisa ter ao menos 8 caracteres." }, { status: 400 });
  if (!["admin", "gestora", "instrucional", "comercial", "financeiro", "marketing", "consultor"].includes(papel)) return NextResponse.json({ erro: "Papel inválido." }, { status: 400 });
  if (!["nenhum", "ver", "editar", "validar"].includes(fin)) return NextResponse.json({ erro: "Permissão financeira inválida." }, { status: 400 });

  const adm = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
  if (error || !data.user) return NextResponse.json({ erro: error?.message?.includes("already") ? "Já existe um usuário com esse e-mail." : "Não foi possível criar o usuário: " + (error?.message || "") }, { status: 400 });
  const { error: e2 } = await adm.from("perfis").update({ nome, papel, fin }).eq("id", data.user.id);
  if (e2) return NextResponse.json({ erro: "Usuário criado, mas não foi possível definir o papel: " + e2.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
