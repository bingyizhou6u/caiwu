// _worker.ts
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        if (!env.workers) {
          return new Response("Worker binding not configured. Please configure Service Binding in Cloudflare Dashboard.", { status: 500 });
        }
        return await env.workers.fetch(request);
      } catch (error) {
        console.error("Worker fetch error:", error);
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  worker_default as default
};
