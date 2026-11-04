/* Camada IndexedDB (imóveis, vistorias e fotos) e salvamento automático. */
// ---- IndexedDB (dados e fotos; nada em localStorage) ----
const DB=(()=>{let d;const o=()=>d||(d=new Promise((ok,er)=>{const r=indexedDB.open('vistoria',1);r.onupgradeneeded=()=>['props','insps','photos'].forEach(s=>r.result.createObjectStore(s,{keyPath:'id'}));r.onsuccess=()=>ok(r.result);r.onerror=()=>er(r.error)}));
const t=async(s,m,f)=>{const db=await o();return new Promise((ok,er)=>{const x=db.transaction(s,m),q=f(x.objectStore(s));x.oncomplete=()=>ok(q&&q.result);x.onerror=()=>er(x.error)})};
return{all:s=>t(s,'readonly',x=>x.getAll()),put:(s,v)=>t(s,'readwrite',x=>x.put(v)),del:(s,k)=>t(s,'readwrite',x=>x.delete(k))}})();
const toast=m=>{const e=$('#toast');e.textContent=m;e.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.opacity=0,2200)};
const save=()=>{clearTimeout(T);T=setTimeout(()=>DB.put('insps',cur).then(()=>toast('Salvo ✓')),250)};
const uid=()=>crypto.randomUUID();
