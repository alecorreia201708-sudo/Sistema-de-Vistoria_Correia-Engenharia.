// Testes das regras puras. Execução: node --test tests/
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../js/validation.js','utf8')+';this.api={ikey,cfgOf,cfgMissing,naReason,validateInspection,validateBackup,BACKUP_APP,BACKUP_FORMAT}',ctx);
const A=ctx.api,it=o=>({id:'BAN-001',env:'e1',en:'Banheiro',ph:[],note:'',...o});
const errs=l=>A.validateInspection({items:l}).errors;

test('pendente impede finalizar',()=>assert.equal(errs([it({st:null})]).length,1));
test('não conforme exige descrição e localização',()=>{
  assert.equal(errs([it({st:'NAO_CONFORME',nc:{desc:'',loc:'',pri:'Média'}})]).length,2);
  assert.equal(errs([it({st:'NAO_CONFORME',nc:{desc:'  ',loc:'sala',pri:'Média'}})]).length,1);
  assert.equal(errs([it({st:'NAO_CONFORME',nc:{desc:'trinca',loc:'parede norte'}})]).length,0)});
test('não conforme sem foto é apenas aviso',()=>{const r=A.validateInspection({items:[it({st:'NAO_CONFORME',nc:{desc:'a',loc:'b'}})]});assert.equal(r.errors.length,0);assert.equal(r.warnings.length,1)});
test('não verificado exige motivo; "Outro" exige observação',()=>{
  assert.equal(errs([it({st:'NAO_VERIFICADO',nv:''})]).length,1);
  assert.equal(errs([it({st:'NAO_VERIFICADO',nv:'Acesso impedido'})]).length,0);
  assert.equal(errs([it({st:'NAO_VERIFICADO',nv:'Outro',note:''})]).length,1);
  assert.equal(errs([it({st:'NAO_VERIFICADO',nv:'Outro',note:'chave não entregue'})]).length,0)});
test('não se aplica exige justificativa e confirmação do automático',()=>{
  assert.equal(errs([it({st:'NAO_SE_APLICA',na:''})]).length,1);
  assert.equal(errs([it({st:'NAO_SE_APLICA',na:'sem box',auto:true})]).length,1);
  assert.equal(errs([it({st:'NAO_SE_APLICA',na:'sem box',auto:false})]).length,0)});
test('conforme completo passa',()=>assert.equal(errs([it({st:'CONFORME'})]).length,0));

test('aplicabilidade: dado não informado nunca é presumido',()=>{
  const c=A.cfgOf({});assert.deepEqual({...c},{box:undefined,exaustor:undefined,chuveiro:undefined});
  for(const n of [65,70,99,85,96])assert.equal(A.naReason(n,c),'');
  assert.deepEqual([...A.cfgMissing(65,c)],['box']);assert.deepEqual([...A.cfgMissing(96,c)],['chuveiro']);assert.equal(A.cfgMissing(10,c).length,0)});
test('aplicabilidade: string vazia ("Não informado") também é desconhecido',()=>{
  const c=A.cfgOf({box:'',exaustor:' ',chuveiro:''});assert.equal(c.box,undefined);assert.equal(A.naReason(66,c),'')});
test('aplicabilidade: com dado explícito sugere N/A',()=>{
  const c=A.cfgOf({box:'Não',exaustor:'Não',chuveiro:'Não instalado'});
  assert.ok(A.naReason(65,c));assert.ok(A.naReason(100,c));assert.ok(A.naReason(84,c));assert.ok(A.naReason(96,c));
  const e=A.cfgOf({box:'Sim',exaustor:'Sim',chuveiro:'Elétrico'});for(const n of [65,100,84,96])assert.equal(A.naReason(n,e),'')});

const good=()=>({app:A.BACKUP_APP,formatVersion:A.BACKUP_FORMAT,props:[{id:'p1'}],envs:[{id:'e1',pid:'p1'}],
  insps:[{id:'i1',pid:'p1',status:'EM_ANDAMENTO',startedAt:'2026-11-09T10:00:00Z',items:[{id:'BAN-001',env:'e1',st:'CONFORME',ph:['f1']}]}],
  photos:[{id:'f1',ins:'i1',data:'data:image/jpeg;base64,AAAA'}]});
const empty=()=>({props:[],envs:[],insps:[],photoIds:new Set()});
test('backup válido',()=>{const v=A.validateBackup(good(),empty());assert.equal(v.errors.length,0);assert.equal(v.counts.insps.nw,1)});
test('backup: rejeita não-objeto, campos ausentes e outro sistema',()=>{
  assert.ok(A.validateBackup([],empty()).errors.length);assert.ok(A.validateBackup('x',empty()).errors.length);
  const g=good();delete g.photos;assert.ok(A.validateBackup(g,empty()).errors.length);
  const o=good();o.app='outro';assert.ok(A.validateBackup(o,empty()).errors.length);
  const f=good();f.formatVersion=99;assert.ok(A.validateBackup(f,empty()).errors.length)});
test('backup: resultado inválido, ids duplicados e foto sem imagem',()=>{
  let g=good();g.insps[0].items[0].st='TALVEZ';assert.ok(A.validateBackup(g,empty()).errors.some(e=>e.includes('inválido')));
  g=good();g.props.push({id:'p1'});assert.ok(A.validateBackup(g,empty()).errors.some(e=>e.includes('duplicado')));
  g=good();g.photos[0].data='javascript:alert(1)';assert.ok(A.validateBackup(g,empty()).errors.length);
  g=good();g.insps[0].status='X';assert.ok(A.validateBackup(g,empty()).errors.length)});
test('backup: foto referenciada ausente vira aviso; conflito é detectado',()=>{
  let g=good();g.photos=[];assert.ok(A.validateBackup(g,empty()).warnings.some(w=>w.includes('não encontrada')));
  g=good();const l=empty();l.insps=[{...good().insps[0],status:'CONCLUIDA'}];
  const v=A.validateBackup(g,l);assert.deepEqual([...v.counts.insps.df],['i1']);
  l.insps=[good().insps[0]];assert.equal(A.validateBackup(good(),l).counts.insps.eq,1)});
test('backup antigo sem versão é aceito com aviso',()=>{const g=good();delete g.app;delete g.formatVersion;const v=A.validateBackup(g,empty());assert.equal(v.errors.length,0);assert.ok(v.legacy)});
