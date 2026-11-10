// Testes de navegador (Playwright). Uso: node tests/e2e-playwright.js <caminho-ou-url-do-index.html>
const {chromium}=require(process.env.PW||'playwright');const path=require('path');const fs=require('fs');
const URL=process.argv[2],IMG=path.join(__dirname,'foto-teste.png');let ok=0,bad=0;
const chk=(n,c,x='')=>{c?ok++:bad++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  '+x))};
const wait=(p,ms=500)=>p.waitForTimeout(ms);
async function mkPage(b){const c=await b.newContext({viewport:{width:390,height:800},acceptDownloads:true}),p=await c.newPage();p.msgs=[];p.errs=[];p.ans=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('dialog',async d=>{p.msgs.push(d.message());const a=p.ans.length?p.ans.shift():true;a?await d.accept():await d.dismiss()});
  await p.goto(URL);await p.waitForSelector('[data-a=newp]');return p}
const setup=async p=>{await p.click('[data-a=newp]');await p.fill('[data-p=name]','Res Teste');await p.fill('[data-p=unit]','101');await p.click('[data-a=savep]');await p.waitForSelector('[data-a=envs]');await p.click('[data-a=envs]');await p.click('[data-a=defenvs]');await p.waitForSelector('text=Quarto 2')};
const startInsp=async(p,names)=>{await p.click('#back');await p.click('[data-a=start]');await p.fill('[data-p=insp]','Eng. Teste');
  await p.evaluate(n=>document.querySelectorAll('[data-env]').forEach(c=>c.checked=n.includes(c.parentElement.textContent.trim())),names);await p.click('[data-a=go]');await wait(p,400)};
const dbIns=(p,id)=>p.evaluate(async id=>(await DB.all('insps')).find(i=>i.id==id),id);
(async()=>{const b=await chromium.launch();let p=await mkPage(b);await setup(p);

// ---- 1. aplicabilidade sem dados ----
await startInsp(p,['Banheiro']);
chk('1a aviso de configuração não informada ao iniciar',p.msgs.some(m=>m.includes('Configuração não informada')&&m.includes('box')),p.msgs.join('|'));
let s=await p.evaluate(()=>({na:cur.items.filter(x=>x.st=='NAO_SE_APLICA').length,pe:cur.items.filter(x=>!x.st).length,miss:cur.items.filter(x=>(x.cfgMissing||[]).length).length}));
chk('1b sem dados: nenhum N/A automático, 112 pendentes',s.na==0&&s.pe==112,JSON.stringify(s));
chk('1c critérios dependentes marcados como "configuração não informada"',s.miss==8+3+8,JSON.stringify(s));
// configurar e iniciar outra
await p.click('#back');await p.click('[data-a=envs]');await p.locator('.card',{hasText:'Banheiro'}).locator('[data-a=editenv]').first().click();await p.selectOption('[data-p=box]','Não');await p.click('[data-a=saveenv]');
await startInsp(p,['Banheiro']);
s=await p.evaluate(()=>({na:cur.items.filter(x=>x.st=='NAO_SE_APLICA'&&x.auto).length}));chk('1d box=Não informado: 8 N/A sugeridos (auto)',s.na==8,JSON.stringify(s));
const idB=await p.evaluate(()=>cur.id);
// finalização bloqueada: tudo conforme exceto auto N/A não confirmados
await p.evaluate(()=>{cur.items.forEach(x=>{if(!x.st)x.st='CONFORME'});go('insp')});await wait(p,300);p.msgs.length=0;await p.click('[data-a=fin]');await wait(p,300);
chk('1e N/A automático não confirmado impede finalizar',p.msgs.some(m=>m.includes('automático ainda não confirmado')),p.msgs.join('|'));

// ---- 2. finalização com campos incompletos ----
await p.evaluate(()=>{const l=cur.items.filter(x=>!x.auto);l[0].st='NAO_CONFORME';l[0].nc={desc:'',loc:'',pri:'Média',rec:'',obs:''};l[1].st='NAO_VERIFICADO';l[1].nv='';l[2].st='NAO_SE_APLICA';l[2].na='';l[2].auto=false;cur.items.filter(x=>x.auto).forEach(x=>x.auto=false);go('insp')});
await wait(p,300);p.msgs.length=0;await p.click('[data-a=fin]');await wait(p,300);const m=p.msgs.join('|');
chk('2a bloqueia NC sem descrição/localização',m.includes('sem descrição')&&m.includes('sem localização'),m);
chk('2b bloqueia NV sem motivo',m.includes('não verificado sem motivo'),m);
chk('2c bloqueia N/A sem justificativa',m.includes('não se aplica sem justificativa'),m);
chk('2d vistoria continua EM_ANDAMENTO',(await dbIns(p,idB)).status!='CONCLUIDA');
await p.evaluate(()=>{const l=cur.items.filter(x=>!x.auto);l[0].nc={desc:'trinca',loc:'parede',pri:'Alta',rec:'',obs:''};l[1].nv='Acesso impedido';l[2].na='não existe';go('insp')});await wait(p,300);
p.msgs.length=0;await p.click('[data-a=fin]');await wait(p,500);
chk('2e completo: finaliza (com aviso de NC sem foto)',(await dbIns(p,idB)).status=='CONCLUIDA'&&p.msgs.some(m=>m.includes('sem fotografia')),p.msgs.join('|'));
// concluída é protegida
await p.evaluate(()=>{const x=cur.items[0];x.note='';go('cat',{c:x.cat,e:x.env})});await wait(p,300);
await p.locator('textarea[data-k=note]').first().fill('alteração indevida');await wait(p,500);
chk('2f vistoria concluída não aceita edição',!(await dbIns(p,idB)).items.some(x=>x.note=='alteração indevida'));
await p.evaluate(()=>go('insp'));await wait(p,200);p.msgs.length=0;await p.click('[data-a=reopen]');await wait(p,300);
const rb=await dbIns(p,idB);chk('2g reabertura registrada',rb.status=='EM_ANDAMENTO'&&rb.reopened&&rb.reopened.length==1);

// ---- 3. alterações rápidas e navegação entre vistorias ----
await startInsp(p,['Cozinha']);const idA=await p.evaluate(()=>cur.id);
await p.evaluate(()=>go('cat',{c:cur.items[0].cat,e:cur.items[0].env}));await wait(p,300);
// digita e navega NO MESMO INSTANTE para outra vistoria / relatório
await p.evaluate(({idB})=>{const t=document.querySelector('textarea[data-k=note]');t.value='nota rapida A';t.dispatchEvent(new Event('input',{bubbles:true}));cur=INS.get(idB);go('insp')},{idB});
await wait(p,700);chk('3a edição seguida de troca imediata de vistoria é salva na vistoria correta',(await dbIns(p,idA)).items[0].note=='nota rapida A');
chk('3b outra vistoria não foi alterada',!(await dbIns(p,idB)).items.some(x=>x.note=='nota rapida A'));
await p.evaluate(({idA})=>{cur=INS.get(idA);go('cat',{c:cur.items[0].cat,e:cur.items[0].env})},{idA});await wait(p,300);
await p.evaluate(({idA})=>{const t=document.querySelector('textarea[data-k=note]');t.value='nota rapida 2';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#back').click();cur=INS.get(idA)},{idA});await wait(p,700);
chk('3c edição seguida de voltar é salva',(await dbIns(p,idA)).items[0].note=='nota rapida 2');
// DOM antigo recebe digitação depois que cur mudou: deve ir para a vistoria do próprio campo
await p.evaluate(({idA})=>{cur=INS.get(idA);go('cat',{c:cur.items[0].cat,e:cur.items[0].env})},{idA});await wait(p,300);
await p.evaluate(({idB})=>{window._t=document.querySelector('textarea[data-k=note]');cur=INS.get(idB);window._t.value='DOM antigo';window._t.dispatchEvent(new Event('input',{bubbles:true}))},{idB});await wait(p,700);
chk('3d campo da vistoria A editado enquanto cur=B grava em A',(await dbIns(p,idA)).items[0].note=='DOM antigo'&&!(await dbIns(p,idB)).items.some(x=>x.note=='DOM antigo'));
// rajada de 30 alterações de status
await p.evaluate(({idA})=>{cur=INS.get(idA);go('cat',{c:cur.items[0].cat,e:cur.items[0].env})},{idA});await wait(p,300);
await p.evaluate(()=>{const bs=[...document.querySelectorAll('[data-a=st][data-x=CONFORME]')];bs.forEach(b=>b.click())});await wait(p,900);
const nA=await p.evaluate(()=>cur.items.filter(x=>x.cat==cur.items[0].cat&&x.st=='CONFORME').length),dA=(await dbIns(p,idA)).items.filter(x=>x.st=='CONFORME').length;
chk('3e rajada de cliques: memória e banco coincidem ('+nA+')',nA>0&&nA==dA,nA+' vs '+dA);

// ---- 4. fotos ----
await p.evaluate(({idA})=>{cur=INS.get(idA);go('cat',{c:cur.items[0].cat,e:cur.items[0].env})},{idA});await wait(p,300);
const inp=p.locator('input[data-ph]').first();await inp.setInputFiles(IMG);
await p.evaluate(({idB})=>{cur=INS.get(idB);go('home')},{idB}); // troca de vistoria durante a gravação da foto
await wait(p,1200);const ia=await dbIns(p,idA),ib=await dbIns(p,idB);
const ph=await p.evaluate(()=>DB.all('photos').then(l=>l.map(x=>({id:x.id,ins:x.ins,item:x.item,key:x.itemKey,size:x.blob.size}))));
chk('4a foto adicionada ao critério da vistoria correta mesmo com troca imediata',ia.items[0].ph.length==1&&ib.items.every(x=>x.ph.length==0)&&ph.length==1&&ph[0].ins==idA&&ph[0].key==ia.items[0].env+'|'+ia.items[0].id&&ph[0].size>0,JSON.stringify(ph));
await p.evaluate(({idA})=>{cur=INS.get(idA);go('cat',{c:cur.items[0].cat,e:cur.items[0].env})},{idA});await wait(p,500);
chk('4b miniatura exibida',await p.locator('.ph img').count()==1);
await p.locator('[data-a=delph]').first().click();await wait(p,500);
chk('4c remoção: vínculo e arquivo removidos',(await dbIns(p,idA)).items[0].ph.length==0&&(await p.evaluate(()=>DB.all('photos'))).length==0);
await p.locator('input[data-ph]').first().setInputFiles(IMG);await wait(p,800); // foto fica para o backup
// ---- 5. fechar a página ----
await p.evaluate(()=>{const t=document.querySelector('textarea[data-k=note]');t.value='antes de fechar';t.dispatchEvent(new Event('input',{bubbles:true}));location.reload()});
await p.waitForSelector('[data-a=newp]');await wait(p,500);chk('5a recarregar a página logo após digitar preserva a edição',(await dbIns(p,idA)).items[0].note=='antes de fechar');
chk('5b dados persistem após reabrir (vistorias: 3)',(await p.evaluate(()=>DB.all('insps'))).length==3);

// ---- 6. backup ----
const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>onClick({target:(()=>{const e=document.createElement('i');e.dataset.a='exp';return e})()}))]);
const bk=path.join('/tmp','bk.json');await dl.saveAs(bk);const B=JSON.parse(fs.readFileSync(bk,'utf8'));
chk('6a backup tem identificação, contagens e fotos',B.app=='vistoria-correia'&&B.formatVersion==3&&B.counts.insps==3&&B.photos.length==1&&B.photos[0].data.startsWith('data:image'),JSON.stringify(B.counts));
const imp=async(file,answers)=>{p.msgs.length=0;p.ans=answers||[];await p.locator('#imp').setInputFiles(file);await wait(p,1200)};
fs.writeFileSync('/tmp/lixo.json','isto nao e json');await imp('/tmp/lixo.json');chk('6b rejeita arquivo que não é JSON',p.msgs.some(x=>x.includes('REJEITADO')));
fs.writeFileSync('/tmp/semcampos.json',JSON.stringify({app:'vistoria-correia',props:[]}));await imp('/tmp/semcampos.json');chk('6c rejeita backup sem campos obrigatórios',p.msgs.some(x=>x.includes('REJEITADO')&&x.includes('insps')));
const inv=JSON.parse(JSON.stringify(B));inv.insps[0].items[0].st="TALVEZ";fs.writeFileSync("/tmp/invalido.json",JSON.stringify(inv));
const before=await p.evaluate(()=>DB.all('insps').then(l=>JSON.stringify(l.map(i=>i.id).sort())));await imp('/tmp/invalido.json');
chk('6d rejeita resultado inválido e não altera nada',p.msgs.some(x=>x.includes('REJEITADO'))&&before==await p.evaluate(()=>DB.all('insps').then(l=>JSON.stringify(l.map(i=>i.id).sort()))));
await imp(bk);chk('6e backup idêntico: "nada a importar"',p.msgs.some(x=>x.includes('Nada a importar')),p.msgs.join('|'));
// conflito: altera local e importa o backup antigo
await p.evaluate(({idA})=>{INS.get(idA).insp='Alterado Depois';return save(INS.get(idA),true)},{idA});
let dls=0;p.on('download',()=>dls++);
await imp(bk,[true,false]);chk('6f conflito: por padrão MANTÉM os dados atuais',(await dbIns(p,idA)).insp=='Alterado Depois'&&p.msgs.some(x=>x.includes('DIFERENTES')),p.msgs.join('|'));
await imp(bk,[true,true]);await wait(p,800);chk('6g substituir: baixa backup de segurança antes e aplica o backup',dls>=1&&(await dbIns(p,idA)).insp=='Eng. Teste',dls+' '+(await dbIns(p,idA)).insp);
// restaurar em navegador limpo
const p2=await mkPage(b);const bytes=await p2.evaluate(()=>DB.all('insps').then(l=>l.length));
await p2.locator('#imp').setInputFiles(bk);await wait(p2,1500);
const r2=await p2.evaluate(async()=>({i:(await DB.all('insps')).length,p:(await DB.all('props')).length,e:(await DB.all('envs')).length,f:await DB.all('photos').then(l=>l.map(x=>x.blob.size>0&&x.blob.type))}));
chk('6h restauração em banco vazio recupera tudo (inclusive fotos)',bytes==0&&r2.i==3&&r2.p==1&&r2.e==9&&r2.f.length==1&&r2.f[0]=='image/jpeg',JSON.stringify(r2));
const lk=await p2.evaluate(async()=>{const i=(await DB.all('insps')).find(i=>i.items.some(x=>x.ph.length));const f=i.items.find(x=>x.ph.length).ph[0];return (await DB.all('photos')).some(x=>x.id==f&&x.ins==i.id)});
chk('6i foto restaurada continua vinculada ao critério e à vistoria',lk);

chk('7 nenhum erro de JavaScript em toda a execução',p.errs.length==0&&p2.errs.length==0,p.errs.concat(p2.errs).join('|'));
console.log(`\nRESULTADO: ${ok} aprovados, ${bad} reprovados`);await b.close();process.exit(bad?1:0)})().catch(e=>{console.error('ERRO NO TESTE',e);process.exit(2)});
