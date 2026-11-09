export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.endsWith(".txt")) {
    url.pathname = "/projetos/detalhe.txt";
    return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
  }

  const match = url.pathname.match(/\/projetos\/([^/?#]+)/);
  const seg = match ? match[1] : "";

  // Se for acessado /projetos/<qualquer-id>, redireciona para /projetos/detalhe?id=<qualquer-id>
  if (seg && seg !== "detalhe" && !seg.includes(".")) {
    const targetUrl = new URL(`/projetos/detalhe?id=${encodeURIComponent(seg)}`, url.origin);
    return Response.redirect(targetUrl.toString(), 302);
  }

  // Serve a exportação estática de detalhe
  url.pathname = "/projetos/detalhe";
  const res = await context.env.ASSETS.fetch(new Request(url.toString(), context.request));

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("Location");
    if (loc) {
      const target = new URL(loc, url.origin);
      const follow = await context.env.ASSETS.fetch(new Request(target.toString(), context.request));
      return new Response(follow.body, {
        status: 200,
        headers: follow.headers,
      });
    }
  }

  return res;
}
