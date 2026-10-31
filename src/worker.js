// The site answers on joeofsometrades.com. It also stayed reachable on the
// workers.dev address that was live first, so an old link keeps working: that
// host now sends the visitor to the custom domain, and everything else is
// served from the built assets exactly as before.
//
// The redirect carries no fragment of its own, so the browser passes on the
// fragment the visitor asked for. A deep link such as #radio still lands on the
// radio view.
const CANONICAL_ORIGIN = 'https://joeofsometrades.com';

// Hosts that forward to the canonical origin. A version preview URL is a
// different workers.dev name, so it is not forwarded.
const FORWARDED_HOSTS = new Set(['portfolio.joeofsometrades.workers.dev']);

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const forwards = FORWARDED_HOSTS.has(url.hostname);
    if (forwards && (request.method === 'GET' || request.method === 'HEAD')) {
      return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
