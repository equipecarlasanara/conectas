import ProjetoDetalheClient from "./ProjetoDetalheClient";

export function generateStaticParams() {
  return [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }, { id: "detalhe" }];
}

export default function Page() {
  return <ProjetoDetalheClient />;
}
