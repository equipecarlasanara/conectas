export const STATUS: Record<string,string> = {
  nao_iniciado:"Não iniciado", planejado:"Planejado", em_andamento:"Em andamento",
  aguardando_cliente:"Aguardando cliente", aguardando_terceiro:"Aguardando terceiro",
  concluido:"Concluído", cancelado:"Cancelado" };
export const STATUS_COR: Record<string,string> = {
  nao_iniciado:"var(--s0)", planejado:"var(--s0)", em_andamento:"var(--s1)",
  aguardando_cliente:"var(--s2)", aguardando_terceiro:"var(--s2)", concluido:"var(--s3)", cancelado:"var(--s0)" };
export const SITUACAO: Record<string,string> = {
  em_recebimento:"Em recebimento", planejamento:"Planejamento", em_execucao:"Em execução",
  pausado:"Pausado", concluido:"Concluído", cancelado:"Cancelado" };
export const TIPOS_PROJETO = ["Palestra", "Workshop", "Programa", "Projeto", "Consultoria"];
export const FASE: Record<string,string> = { a_iniciar: "A iniciar", execucao: "Execução", entrega: "Entrega", finalizado: "Finalizado" };
export const PRIORIDADE: Record<string,string> = { alta:"Alta", media:"Média", baixa:"Baixa" };
export const RESP: Record<string,string> = { conectas:"Conectas", cliente:"Cliente", terceiro:"Terceiro" };
export const PAPEL: Record<string,string> = { admin:"Administração", gestora:"GP (gestão de projetos)", instrucional:"Desenvolvimento instrucional", comercial:"Comercial", financeiro:"Financeiro", marketing:"Marketing", consultor:"Consultor" };
export const FIN: Record<string,string> = { nenhum:"Sem acesso", ver:"Visualizar", editar:"Editar", validar:"Editar e validar" };

export const brl = (n:number) => (Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const brk = (n:number) => (Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
export const hoje = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
export const dataBR = (s?:string|null) => { if(!s) return "-"; const a=s.slice(0,10).split("-"); return a[2]+"/"+a[1]+"/"+a[0]; };
export const mesBR = (s:string) => s.slice(5,7)+"/"+s.slice(0,4);
export function dias(prazo?:string|null){ if(!prazo) return null; return Math.round((new Date(prazo+"T00:00").getTime()-new Date(hoje()+"T00:00").getTime())/864e5); }
export function prazoTag(prazo?:string|null, status?:string){
  if(!prazo || status==="concluido" || status==="cancelado") return null;
  const d = dias(prazo)!;
  if(d<0) return {t:`Atrasado ${-d}d`, c:"late"};
  if(d===0) return {t:"Vence hoje", c:"late"};
  if(d<=7) return {t:`Vence em ${d}d`, c:"soon"};
  return null;
}
export const atrasado = (prazo?:string|null,status?:string) => !!prazo && status!=="concluido" && status!=="cancelado" && (dias(prazo)||0)<0;

export const nps = (notas:number[]) => { if(!notas.length) return null; const p=notas.filter(n=>n>=9).length, d=notas.filter(n=>n<=6).length; return Math.round((p-d)/notas.length*100); };
export const zonaNps = (v:number|null):[string,string] => v===null?["Sem dados","var(--s0)"]:v>=75?["Excelente","var(--s3)"]:v>=50?["Bom","var(--s1)"]:v>=0?["Razoável","var(--s2)"]:["Crítico","var(--late)"];
export const catNps = (n:number) => n>=9?"Promotor":n>=7?"Neutro":"Detrator";
export const pct = (n:number) => (Math.round(n*10)/10).toLocaleString("pt-BR")+"%";

export const LOGISTICA: Record<string,string> = { conectas:"Logística nossa", cliente:"Logística do cliente", compartilhada:"Compartilhada" };
export const ACESSO: Record<string,string> = { todos:"Todos os projetos", selecionados:"Somente projetos selecionados (e os seus)" };
// Capitais por UF (para o Impactômetro por estado e capital)
export const UFS: Record<string,string> = { AC:"Rio Branco",AL:"Maceió",AP:"Macapá",AM:"Manaus",BA:"Salvador",CE:"Fortaleza",DF:"Brasília",ES:"Vitória",GO:"Goiânia",MA:"São Luís",MT:"Cuiabá",MS:"Campo Grande",MG:"Belo Horizonte",PA:"Belém",PB:"João Pessoa",PR:"Curitiba",PE:"Recife",PI:"Teresina",RJ:"Rio de Janeiro",RN:"Natal",RS:"Porto Alegre",RO:"Porto Velho",RR:"Boa Vista",SC:"Florianópolis",SP:"São Paulo",SE:"Aracaju",TO:"Palmas" };
export const semAcento = (t?: string|null) => (t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export const ehCapital = (uf?: string|null, cidade?: string|null) => !!uf && !!cidade && semAcento(UFS[uf]) === semAcento(cidade);
// Status automático (macroetapa/entregável) a partir dos itens abaixo
export function statusAuto(itens: { status: string }[]) {
  const ativos = itens.filter(i => i.status !== "cancelado");
  if (itens.length === 0) return "nao_iniciado";
  if (ativos.length === 0) return "cancelado";
  if (ativos.every(i => i.status === "concluido")) return "concluido";
  if (ativos.some(i => i.status !== "nao_iniciado" && i.status !== "planejado")) return "em_andamento";
  return "nao_iniciado";
}
export const numBR = (v: any) => (v === "" || v == null ? null : Number(String(v).replace(/\./g, "").replace(",", ".")));
export const txtBR = (v: any) => (v == null ? "" : String(v).replace(".", ","));
