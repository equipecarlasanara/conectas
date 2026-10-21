import "./globals.css";
import { AuthProvider } from "@/components/Auth";
export const metadata = { title: "Conectas | Projetos" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="pt-BR"><body><AuthProvider>{children}</AuthProvider></body></html>);
}
