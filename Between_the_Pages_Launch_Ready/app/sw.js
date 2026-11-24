// Between the Pages v2.4.1 beta — network-first pages, offline shell.
const CACHE_NAME='btp-app-shell-v2.4.1-beta';
const FILES=['./','./index.html','./feedback.html','./manifest-0963.webmanifest','./btp-home-0963.png','./btp-home-192-0963.png','./btp-home-512-0963.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('btp-app-shell-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||r.mode!=='navigate')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;
  e.respondWith(fetch(r).then(response=>{if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(r,copy)))}return response}).catch(async()=>{const c=await caches.open(CACHE_NAME);return(await c.match(r))||(await c.match('./index.html'))||Response.error()}));
});
