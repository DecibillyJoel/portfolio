// The site answers on joeofsometrades.com and www.joeofsometrades.com, and
// nowhere else. The workers.dev address that was live first, and every version
// preview URL, are switched off in wrangler.jsonc, so no other host reaches
// this Worker and an unfinished version is never reachable.
//
// The Worker hands every request to the built assets. It stays as the one place
// a header or a redirect would live if the site needs one again.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
