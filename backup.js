/* Backup: exportação com assinatura das fotos, validação, importação atômica e verificação de integridade. */
const blobData=b=>new Promise((ok,er)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>er(f.error);f.readAsDataURL(b)});
async function fpBytes(u){let h;if(window.crypto&&crypto.subtle){try{h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',u))].map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){}}
  if(!h){let x=2166136261;for(let i=0;i<u.length;i++){x^=u[i];x=Math.imul(x,16777619)>>>0}h='fnv'+x.toString(16)}return u.length+':'+h}
const fpBlob=async b=>fpBytes(new Uint8Array(await b.arrayBuffer()));
const dataBytes=s=>{const b=atob(s.slice(s.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const MAGIC={'image/jpeg':[[0xFF,0xD8,0xFF]],'image/png':[[0x89,0x50,0x4E,0x47]],'image/gif':[[0x47,0x49,0x46,0x38]],'image/webp':[[0x52,0x49,0x46,0x46]]};
const magicOk=(mime,u)=>(MAGIC[mime]||[]).some(m=>m.every((b,i)=>u[i]===b));
async function buildBackup(){await flush();const [p,e,ph]=await Promise.all([DB.all('props'),DB.all('envs'),DB.all('photos')]),out=[];
  for(const x of ph){const q={...x,data:await blobData(x.blob),fp:await fpBlob(x.blob)};delete q.blob;out.push(q)}
  const i=[...INS.values()];return{app:BACKUP_APP,formatVersion:BACKUP_FORMAT,exportedAt:new Date().toISOString(),counts:{props:p.length,envs:e.length,insps:i.length,photos:out.length},props:p,envs:e,insps:i,photos:out}}
function download(o,name){const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));l.download=name;l.click()}
const stamp=()=>new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
// Verificação de integridade entre os object stores (usada após importações)
async function integrityScan(){const [p,e,ph]=await Promise.all([DB.all('props'),DB.all('envs'),DB.all('photos')]),ins=[...INS.values()];
  const pid=new Set(p.map(x=>x.id)),phIds=new Set(ph.map(x=>x.id)),refd=new Set(),dangling=[];
  for(const i of ins)for(const x of i.items||[])for(const f of x.ph||[]){refd.add(f);if(!phIds.has(f))dangling.push(i.id+'|'+ikey(x)+'|'+f)}
  return{orphanPhotos:ph.filter(x=>!refd.has(x.id)).map(x=>x.id),danglingRefs:dangling,envsSemImovel:e.filter(x=>!pid.has(x.pid)).map(x=>x.id),vistoriasSemImovel:ins.filter(i=>!pid.has(i.pid)&&!i.prop).map(i=>i.id),fotosSemVistoria:ph.filter(x=>!INS.has(x.ins)).map(x=>x.id)}}
const REJ='Backup REJEITADO. Nenhum dado foi alterado.\n\n';
async function importBackup(file){
  let d;try{d=JSON.parse(await file.text())}catch(e){return alert('Backup REJEITADO: o arquivo não é um JSON legível.\nNenhum dado foi alterado.')}
  await flush();
  const [lp,le,lph]=await Promise.all([DB.all('props'),DB.all('envs'),DB.all('photos')]);
  const local={props:lp,envs:le,insps:[...INS.values()],photoIds:new Set(lph.map(x=>x.id)),photoIns:new Map(lph.map(x=>[x.id,x.ins]))};
  let v=validateBackup(d,local);
  if(v.errors.length)return alert(REJ+'Problemas encontrados ('+v.errors.length+'):\n'+fmtList(v.errors,10));
  // assinatura e conteúdo real das imagens
  const fpB=new Map(),fpL=new Map(),bad=[];
  try{for(const p of d.photos){const u=dataBytes(p.data),mime=p.data.slice(5,p.data.indexOf(';'));if(!u.length||!magicOk(mime,u)){bad.push(`Foto ${p.id}: o conteúdo não é uma imagem ${mime} válida.`);continue}
    const f=await fpBytes(u);fpB.set(p.id,f);if(p.fp&&!fpEq(p.fp,f))bad.push(`Foto ${p.id}: o conteúdo não corresponde à assinatura gravada no backup (arquivo corrompido).`)}}catch(e){bad.push('Dados de imagem ilegíveis: '+(e&&e.message||e))}
  if(bad.length)return alert(REJ+'Problemas encontrados ('+bad.length+'):\n'+fmtList(bad,10));
  for(const x of lph)if(fpB.has(x.id))fpL.set(x.id,await fpBlob(x.blob));
  v=validateBackup(d,local,{backup:fpB,local:fpL});
  const c=v.counts,nConf=c.props.df.length+c.envs.df.length+c.insps.df.length+c.photos.df.length,nNew=c.props.nw+c.envs.nw+c.insps.nw+c.photos.nw;
  let msg=`Backup válido.\nNovos: ${c.props.nw} imóvel(is), ${c.envs.nw} ambiente(s), ${c.insps.nw} vistoria(s), ${c.photos.nw} foto(s).\nJá existentes e idênticos (ignorados): ${c.props.eq+c.envs.eq+c.insps.eq+c.photos.eq}.\nJá existentes e DIFERENTES: ${nConf} (por padrão, os dados atuais são mantidos).`;
  if(v.warnings.length)msg+='\n\nAvisos ('+v.warnings.length+'):\n'+fmtList(v.warnings,5);
  if(!nNew&&!nConf)return alert('Nada a importar: todos os registros do backup já existem e são idênticos.');
  if(!confirm(msg+(nNew?'\n\nImportar os registros novos?':'\n\nNão há registros novos; só conflitos. Continuar?')))return;
  let rep=false;
  if(nConf&&confirm(`${nConf} registro(s) já existem com conteúdo diferente.\n\nOK = SUBSTITUIR pelos do backup (um backup do estado atual será baixado antes).\nCancelar = MANTER os dados atuais.`)){rep=true;download(await buildBackup(),`backup-antes-da-importacao-${stamp()}.json`)}
  try{
    const have=a=>new Set(a.map(r=>r.id)),pick=(arr,df,h)=>arr.filter(r=>!h.has(r.id)||(rep&&df.includes(r.id)));
    const P=pick(d.props,c.props.df,have(lp)),E=pick(d.envs||[],c.envs.df,have(le)),I0=pick(d.insps,c.insps.df,have(local.insps));
    // cópia das vistorias a importar: descarta referências a fotos inexistentes e preserva a numeração de versão
    const bph=new Set(d.photos.map(p=>p.id));let stripped=0;
    const I=I0.map(r=>{const q=JSON.parse(JSON.stringify(r)),lo=INS.get(q.id);for(const x of q.items){const k=[];for(const f of x.ph){if(bph.has(f)||local.photoIds.has(f))k.push(f);else stripped++}x.ph=[...new Set(k)]}q.rev=lo?(lo.rev||0)+1:(q.rev||0);return q});
    const refs=new Set(I.flatMap(q=>q.items.flatMap(x=>x.ph))),photos=[];let orph=0;
    for(const p of d.photos){if(!refs.has(p.id)){orph++;continue}
      if(!local.photoIds.has(p.id)||(rep&&c.photos.df.includes(p.id))){const b=await (await fetch(p.data)).blob();if(!b.size||!b.type.startsWith('image/'))throw new Error('Foto '+p.id+' ilegível.');const q={...p,blob:b};delete q.data;delete q.fp;photos.push(q)}}
    // fotos antigas de vistorias substituídas que não estão mais vinculadas
    const dels=lph.filter(x=>INS.has(x.ins)&&I.some(q=>q.id==x.ins)&&!refs.has(x.id)).map(x=>x.id);
    if(!P.length&&!E.length&&!I.length&&!photos.length&&!dels.length){toast('Nada foi importado; os dados atuais foram mantidos.');return}
    await DB.multi([...P.map(r=>['props','put',r]),...E.map(r=>['envs','put',r]),...I.map(r=>['insps','put',r]),...photos.map(r=>['photos','put',r]),...dels.map(id=>['photos','delete',id])]); // atômico
    for(const r of I){INS.set(r.id,r);UNSAVED.delete(r.id);DIRTY.delete(r.id);if(cur&&cur.id==r.id)cur=r;PL.delete(r.id)}
    for(const p of photos)delete urls[p.id];for(const id of dels)delete urls[id];
    await load();const sc=await integrityScan(),bad2=Object.entries(sc).filter(z=>z[1].length);
    go('home');
    const extra=[stripped?`${stripped} referência(s) a foto inexistente descartada(s)`:'',orph?`${orph} foto(s) órfã(s) do arquivo ignorada(s)`:'',dels.length?`${dels.length} foto(s) antiga(s) sem vínculo removida(s)`:''].filter(Boolean);
    toast(`Importado: ${P.length} imóvel(is), ${E.length} ambiente(s), ${I.length} vistoria(s), ${photos.length} foto(s)`);
    if(extra.length||bad2.length)alert('Importação concluída.\n'+extra.join('\n')+(bad2.length?'\n\nVerificação de integridade — itens a revisar:\n'+bad2.map(z=>`• ${z[0]}: ${z[1].length}`).join('\n'):''))
  }catch(e){alert('A importação FALHOU e nenhum dado foi alterado.\n'+(e&&e.message||e))}}
