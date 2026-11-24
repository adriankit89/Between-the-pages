// Preserve legacy home-screen shortcut and cache the published app shell for offline use.
const CACHE='btp-site-shell-2.4.1-pilot';
const FILES=['/','/app/','/app/index.html','/app/feedback.html','/app/manifest-0963.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('btp-app-shell-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||r.mode!=='navigate')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;
e.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(r,copy)))}return res}).catch(async()=>{const c=await caches.open(CACHE);return (await c.match(r))||(await c.match(u.pathname.startsWith('/app/')?'/app/index.html':'/'))||Response.error()}))});
