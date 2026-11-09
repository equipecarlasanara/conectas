export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.endsWith(".txt")) {
    url.pathname = "/projetos/detalhe.txt";
    return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
  }

  // Request /projetos/detalhe (without .html) to serve static export without Cloudflare 308 redirect
  url.pathname = "/projetos/detalhe";
  const res = await context.env.ASSETS.fetch(new Request(url.toString(), context.request));

  // If ASSETS returns any 3xx redirect, follow it internally so the browser always receives 200 OK
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
