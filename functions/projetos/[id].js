export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.endsWith(".txt")) {
    url.pathname = "/projetos/detalhe.txt";
  } else {
    url.pathname = "/projetos/detalhe.html";
  }
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}
