// Esta versão NÃO usa Service Worker. Este arquivo existe apenas para remover o service worker
// instalado por versões anteriores (se o arquivo sumisse, o navegador manteria o antigo). Pode ser apagado depois.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>self.registration.unregister())));
