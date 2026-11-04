/* Navegação, eventos, fotos, backup e inicialização. */
// ---- render / navegação ----
const TT={home:'Vistoria Técnica',prop:'Imóvel',start:'Nova vistoria',insp:'Vistoria',cat:'Critérios',rel:'Relatório'};
async function render(){const y=scrollY;$('#ttl').textContent=S.v=='cat'?CAT.categories.find(g=>g.id==S.c).name:TT[S.v];$('#back').style.visibility=S.v=='home'?'hidden':'visible';
  if(cur&&(S.v=='cat'||S.v=='rel'))for(const p of await DB.all('photos'))if(p.ins==cur.id&&!urls[p.id])urls[p.id]=URL.createObjectURL(p.blob);
  $('#app').innerHTML=V[S.v]();scrollTo(0,y)}
const go=(v,o={})=>{S={v,...o};render();scrollTo(0,0)};
$('#back').onclick=()=>S.v=='cat'||S.v=='rel'&&cur&&S.from=='insp'?go('insp'):S.v=='rel'&&!S.from?go('home'):go(S.v=='cat'?'insp':'home');
const shrink=f=>new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,1600/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);c.toBlob(b=>r(b),'image/jpeg',.8)};i.src=URL.createObjectURL(f)});
async function onClick(e){const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,x=t.dataset.x,i=t.dataset.i;
 if(a=='newp')go('prop',{p:{id:uid(),name:'',developer:'',address:'',unit:'',tower:'',client:'',date:'',notes:''}});
 if(a=='editp')go('prop',{p:{...props.find(p=>p.id==x)}});
 if(a=='savep'){if(!(S.p.name||'').trim())return alert('Informe o nome do empreendimento.');await DB.put('props',S.p);await load();go('home');toast('Imóvel cadastrado ✓')}
 if(a=='delp'){if(insps.some(v=>v.pid==S.p.id))return alert('Este imóvel possui vistorias e não pode ser excluído.');if(confirm('Excluir imóvel?')){await DB.del('props',S.p.id);await load();go('home')}}
 if(a=='start')go('start',{pid:x});
 if(a=='go'){if(!CAT)await loadCat();const c={box:$('#c_box').checked,exaustor:$('#c_ex').checked,chuveiro:$('#c_ch').value},m=CAT.metadata;
  cur={id:uid(),pid:S.pid,status:'EM_ANDAMENTO',insp:$('[data-p=insp]').value,startedAt:new Date().toISOString(),notes:'',cfg:c,cat:{id:m.catalog_id,version:m.version,status:m.status},refs:CAT.reference_library,
  items:CAT.criteria.filter(k=>k.active).map(k=>{const n=+k.id.slice(4),r=naReason(n,c);return{id:k.id,cat:k.category_id,catName:k.category,d:k.description,tipo:k.inspection_type,inst:k.recommended_instrument=='—'?'':k.recommended_instrument,origin:k.origin,st:r?'NAO_SE_APLICA':null,auto:!!r,na:r,note:'',nv:'',nc:null,ph:[]}})};
  await DB.put('insps',cur);await load();go('insp');toast('Vistoria iniciada ✓')}
 if(a=='open'){cur=insps.find(v=>v.id==x);go('insp')}
 if(a=='cat')go('cat',{c:x});
 if(a=='st'){const it=cur.items[i];it.st=x;it.auto=false;if(x=='NAO_CONFORME'&&!it.nc)it.nc={desc:'',loc:'',pri:'Média',rec:'',obs:''};it.at=new Date().toISOString();save();render()}
 if(a=='delph'){const it=cur.items[i];it.ph=it.ph.filter(f=>f!=x);await DB.del('photos',x);save();render()}
 if(a=='pause'){cur.status=cur.status=='PAUSADA'?'EM_ANDAMENTO':'PAUSADA';save();render()}
 if(a=='fin'&&confirm('Finalizar a vistoria?')){cur.status='CONCLUIDA';cur.finishedAt=new Date().toISOString();await DB.put('insps',cur);await load();go('home')}
 if(a=='rel'){cur=insps.find(v=>v.id==x)||cur;go('rel',{from:S.v=='insp'?'insp':''})}
 if(a=='print')print();
 if(a=='exp'){const ph=await DB.all('photos');for(const p of ph){p.data=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(p.blob)});delete p.blob}
  const b=new Blob([JSON.stringify({props,insps,photos:ph})],{type:'application/json'}),l=document.createElement('a');l.href=URL.createObjectURL(b);l.download='backup-vistoria-'+new Date().toISOString().slice(0,10)+'.json';l.click()}}
document.addEventListener('click',e=>onClick(e).catch(err=>alert('Erro: '+(err&&err.message||err))));
addEventListener('unhandledrejection',e=>alert('Erro: '+(e.reason&&e.reason.message||e.reason)));
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.p!==undefined&&S.p)S.p[t.dataset.p]=t.value;
 if(t.dataset.g){cur.notes=t.value;save()}
 if(t.dataset.k){const it=cur.items[t.dataset.i],k=t.dataset.k;if(k.startsWith('nc.'))it.nc[k.slice(3)]=t.value;else it[k]=t.value;save()}});
document.addEventListener('change',async e=>{const t=e.target;
 if(t.dataset.ph!==undefined&&t.files[0]){const b=await shrink(t.files[0]),id=uid();await DB.put('photos',{id,ins:cur.id,item:cur.items[t.dataset.ph].id,blob:b,at:new Date().toISOString()});urls[id]=URL.createObjectURL(b);cur.items[t.dataset.ph].ph.push(id);save();render()}
 if(t.id=='imp'&&t.files[0]){const d=JSON.parse(await t.files[0].text());if(!confirm('Importar backup? Registros com o mesmo ID serão substituídos.'))return;
  for(const p of d.props)await DB.put('props',p);for(const v of d.insps)await DB.put('insps',v);
  for(const p of d.photos){p.blob=await (await fetch(p.data)).blob();delete p.data;await DB.put('photos',p)}await load();go('home');toast('Backup importado')}});
const net=()=>$('#net').textContent=navigator.onLine?'online':'offline';addEventListener('online',net);addEventListener('offline',net);net();
if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).catch(()=>{});
if(window.caches)caches.keys().then(k=>k.forEach(x=>caches.delete(x))).catch(()=>{});
navigator.storage&&navigator.storage.persist&&navigator.storage.persist();
Promise.all([load(),loadCat()]).then(()=>go('home')).catch(e=>{$('#app').innerHTML='<div class="card">Não foi possível carregar o catálogo: '+esc(e.message)+'. Abra o app por um endereço http(s), não pelo arquivo local.</div>'});
