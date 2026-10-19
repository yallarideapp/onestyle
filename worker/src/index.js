// One Worker serves the site (dist/) and answers /api/*.
import { HttpError, json, fail } from './util.js';
import { getContent, publicCopy } from './content.js';
import { placeOrder } from './orders.js';
import { handleAdmin } from './admin.js';
import { handleCustomer } from './customer.js';
import { isPagePath, renderPage } from './pages.js';

const PHOTO = /^\/api\/photo\/([a-f0-9]{32})$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if ((request.method === 'GET' || request.method === 'HEAD') && isPagePath(url.pathname)) {
        try { return await renderPage(request, env, url); } catch (error) { console.error('page', error); }
      }
      return env.ASSETS.fetch(request);
    }
    try {
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new HttpError(403, 'https-only');
      const path = url.pathname;
      if (path === '/api/content' && request.method === 'GET') {
        const { version, content, fromSeed } = await getContent(env);
        return json({ version, published: !fromSeed, content: publicCopy(content) }, 200, { 'Cache-Control': 'no-cache' });
      }
      if (path === '/api/order' && request.method === 'POST') return await placeOrder(request, env, ctx);
      if (path.startsWith('/api/customer/')) return await handleCustomer(request, env, ctx, url, path.slice('/api/customer/'.length));
      if (path.startsWith('/api/admin/')) return await handleAdmin(request, env, ctx, url, path.slice('/api/admin/'.length));
      const photo = path.match(PHOTO);
      if (photo && request.method === 'GET') {
        // A photo never changes under the same id, so the edge cache spares KV reads.
        const cache = caches.default;
        const key = new Request(`${url.origin}${url.pathname}`, { method: 'GET' }); // ?anything can't skip the cache
        const hit = await cache.match(key);
        if (hit) return hit;
        const { value, metadata } = await env.PHOTOS.getWithMetadata(`photo:${photo[1]}`, 'arrayBuffer');
        if (!value) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
        const type = ['image/webp', 'image/png', 'image/jpeg'].includes(metadata?.type) ? metadata.type : 'image/webp';
        const response = new Response(value, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
        ctx.waitUntil(cache.put(key, response.clone()));
        return response;
      }
      throw new HttpError(404, 'not-found');
    } catch (error) {
      return fail(error);
    }
  },
};
