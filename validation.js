/* Regras puras (sem DOM): chave de item, aplicabilidade, validação de finalização e de backup.
   Podem ser testadas fora do navegador (ver tests/). */
const ikey=x=>(x.env||'')+'|'+x.id;
const known=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
// Campos de configuração de que cada critério do BANHEIRO depende. Valor desconhecido NUNCA é presumido.
const cfgNeeds=n=>n>=65&&n<=72?['box']:n>=99&&n<=101?['exaustor']:(n>=83&&n<=89)||n==96?['chuveiro']:[];
const CFG_LABEL={box:'box/divisória',exaustor:'exaustor',chuveiro:'tipo de chuveiro'};
const cfgOf=e=>({box:known(e.box)?e.box=='Sim':undefined,exaustor:known(e.exaustor)?e.exaustor=='Sim':undefined,chuveiro:known(e.chuveiro)?e.chuveiro:undefined});
const cfgMissing=(n,c)=>cfgNeeds(n).filter(f=>c[f]===undefined);
// Regras SUGERIDAS (a validar). Só disparam com informação explícita; sem informação, retornam ''.
const naReason=(n,c)=>(n>=65&&n<=72&&c.box===false&&'Unidade sem box/divisória')||(n>=99&&n<=101&&c.exaustor===false&&'Unidade sem exaustor')||(n>=83&&n<=89&&c.chuveiro=='Não instalado'&&'Chuveiro não instalado')||(n==96&&c.chuveiro!==undefined&&c.chuveiro!='Elétrico'&&'Chuveiro não é elétrico')||'';
const blank=s=>!String(s??'').trim();
const STATUS=['CONFORME','NAO_CONFORME','NAO_SE_APLICA','NAO_VERIFICADO'];
const itemLabel=x=>`${x.en?x.en+' › ':''}${x.id}`;
// Retorna {errors:[], warnings:[]}. errors impedem a finalização.
function validateInspection(ins){
  const errors=[],warnings=[];
  const add=(l,x,m)=>l.push(`${itemLabel(x)}: ${m}`);
  for(const x of ins.items||[]){
    if(!x.st){add(errors,x,'pendente de avaliação');continue}
    if(x.st=='NAO_CONFORME'){
      if(!x.nc||blank(x.nc.desc))add(errors,x,'não conforme sem descrição da ocorrência');
      if(!x.nc||blank(x.nc.loc))add(errors,x,'não conforme sem localização exata');
      if(!(x.ph||[]).length)add(warnings,x,'não conforme sem fotografia');
    }
    if(x.st=='NAO_VERIFICADO'){
      if(blank(x.nv))add(errors,x,'não verificado sem motivo');
      else if(x.nv=='Outro'&&blank(x.note))add(errors,x,'motivo "Outro" exige descrição em Observações');
    }
    if(x.st=='NAO_SE_APLICA'){
      if(blank(x.na))add(errors,x,'não se aplica sem justificativa');
      if(x.auto)add(errors,x,'"Não se aplica" automático ainda não confirmado');
    }
  }
  return{errors,warnings};
}
const fmtList=(l,n=8)=>l.slice(0,n).map(s=>'• '+s).join('\n')+(l.length>n?`\n… e mais ${l.length-n}`:'');
// ---- backup ----
const BACKUP_APP='vistoria-correia',BACKUP_FORMAT=3;
const isObj=v=>v&&typeof v=='object'&&!Array.isArray(v);
// Identificadores aceitos: letras, números e . _ : - (nunca aspas, espaços, < > ou barras). Protege atributos HTML e chaves.
const SAFE_ID=/^[A-Za-z0-9._:-]{1,100}$/,okId=v=>typeof v=='string'&&SAFE_ID.test(v);
const sh=v=>{const t=String(v);return t.length>40?t.slice(0,40)+'…':t};
const strOpt=v=>v===undefined||v===null||typeof v=='string';
const IMG_RX=/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/]+={0,2}$/,MAX_IMG=15e6;
const PRI_OK=['Baixa','Média','Alta','Crítica'];
const FIELDS_P=['name','developer','address','unit','tower','client','date','notes'];
// assinatura "tamanho:hash"; algoritmos diferentes (sha256 x fallback) comparam só o tamanho
const fpEq=(a,b)=>{if(!a||!b)return false;const[x,hx='']=a.split(':'),[y,hy='']=b.split(':');return x===y&&(hx.startsWith('fnv')!==hy.startsWith('fnv')||hx===hy)};
// d: arquivo; local:{props,envs,insps,photoIds:Set,photoIns:Map}; fp:{backup:Map,local:Map} (assinaturas das imagens).
// Retorna {errors (bloqueiam), warnings (exigem confirmação), counts, legacy}
function validateBackup(d,local,fp){
  const errors=[],warnings=[];
  local=local||{};local.props=local.props||[];local.envs=local.envs||[];local.insps=local.insps||[];local.photoIds=local.photoIds||new Set();local.photoIns=local.photoIns||new Map();
  if(!isObj(d))return{errors:['O arquivo não é um backup válido (o conteúdo não é um objeto JSON).'],warnings,counts:{}};
  if(d.app!==undefined&&d.app!==BACKUP_APP)errors.push(`Arquivo de outro sistema ("${sh(d.app)}").`);
  if(d.formatVersion!==undefined&&!(Number.isInteger(d.formatVersion)&&d.formatVersion>=1&&d.formatVersion<=BACKUP_FORMAT))errors.push(`Versão de backup incompatível (${sh(d.formatVersion)}); a suportada é até ${BACKUP_FORMAT}.`);
  const legacy=d.formatVersion===undefined;if(legacy)warnings.push('Backup antigo (sem identificação de versão); validado apenas pelo conteúdo.');
  for(const k of ['props','insps','photos'])if(!Array.isArray(d[k]))errors.push(`Campo obrigatório ausente ou inválido: ${k}.`);
  if(d.envs!==undefined&&!Array.isArray(d.envs))errors.push('Campo "envs" inválido.');
  if(errors.length)return{errors,warnings,counts:{}};
  const envs=d.envs||[],ids={};
  const chk=(k,arr)=>{const st=new Set();arr.forEach((r,n)=>{if(!isObj(r))errors.push(`${k}[${n}]: registro inválido (não é objeto).`);else if(!okId(r.id))errors.push(`${k}[${n}]: identificador inválido ou ausente (${sh(r.id)}). Use apenas letras, números e . _ : -`);else if(st.has(r.id))errors.push(`${k}: identificador duplicado (${sh(r.id)}).`);else st.add(r.id)});ids[k]=st};
  chk('props',d.props);chk('envs',envs);chk('insps',d.insps);chk('photos',d.photos);
  if(errors.length)return{errors,warnings,counts:{}};
  if(isObj(d.counts)){const m={props:d.props.length,envs:envs.length,insps:d.insps.length,photos:d.photos.length};for(const k in m)if(d.counts[k]!==undefined&&d.counts[k]!==m[k])warnings.push(`Contagem declarada de ${k} (${sh(d.counts[k])}) difere do conteúdo (${m[k]}).`)}
  const allProps=new Set([...ids.props,...local.props.map(p=>p.id)]);
  for(const p of d.props)for(const f of FIELDS_P)if(!strOpt(p[f]))errors.push(`Imóvel ${sh(p.id)}: o campo "${f}" deve ser texto.`);
  for(const e of envs){if(!okId(e.pid))errors.push(`Ambiente ${sh(e.id)}: imóvel (pid) inválido ou ausente.`);else if(!allProps.has(e.pid))errors.push(`Ambiente ${sh(e.id)}: refere-se a imóvel inexistente (${sh(e.pid)}).`);
    if(typeof e.name!='string'||!e.name.trim())errors.push(`Ambiente ${sh(e.id)}: nome ausente.`);if(!strOpt(e.type))errors.push(`Ambiente ${sh(e.id)}: tipo inválido.`)}
  const phMap=new Map(d.photos.map(p=>[p.id,p])),refBy=new Map();
  for(const i of d.insps){
    const I=`Vistoria ${sh(i.id)}`;
    if(!Array.isArray(i.items)){errors.push(`${I}: lista de critérios ausente.`);continue}
    if(!['EM_ANDAMENTO','PAUSADA','CONCLUIDA'].includes(i.status))errors.push(`${I}: situação inválida (${sh(i.status)}).`);
    if(typeof i.startedAt!='string'||isNaN(Date.parse(i.startedAt)))errors.push(`${I}: data de início inválida.`);
    if(i.status=='CONCLUIDA'&&(typeof i.finishedAt!='string'||isNaN(Date.parse(i.finishedAt))))warnings.push(`${I}: concluída sem data de conclusão válida.`);
    if(i.pid!==undefined&&!okId(i.pid))errors.push(`${I}: identificador de imóvel inválido (${sh(i.pid)}).`);
    else if(!allProps.has(i.pid)){if(isObj(i.prop))warnings.push(`${I}: imóvel não encontrado; será usado o registro do imóvel gravado na vistoria.`);else errors.push(`${I}: refere-se a imóvel inexistente (${sh(i.pid)}).`)}
    for(const f of ['insp','notes','limitations'])if(!strOpt(i[f]))errors.push(`${I}: o campo "${f}" deve ser texto.`);
    if(i.rev!==undefined&&!(Number.isInteger(i.rev)&&i.rev>=0))errors.push(`${I}: número de revisão inválido.`);
    let envSet=null;
    if(i.envs!==undefined){if(!Array.isArray(i.envs))errors.push(`${I}: lista de ambientes inválida.`);else{envSet=new Set();for(const e of i.envs){if(!isObj(e)||!okId(e.id))errors.push(`${I}: ambiente com identificador inválido (${sh(e&&e.id)}).`);else envSet.add(e.id)}}}
    const seen=new Set();
    for(const x of i.items){
      if(!isObj(x)){errors.push(`${I}: critério inválido (não é objeto).`);continue}
      if(!okId(x.id)){errors.push(`${I}: critério com código inválido ou ausente (${sh(x.id)}).`);continue}
      const X=`${I}, ${x.id}`;
      if(x.env!==undefined&&x.env!==''&&!okId(x.env))errors.push(`${X}: identificador de ambiente inválido (${sh(x.env)}).`);
      else if(envSet&&x.env&&!envSet.has(x.env))errors.push(`${X}: critério de ambiente inexistente na vistoria (${sh(x.env)}).`);
      if(x.cat!==undefined&&!okId(x.cat))errors.push(`${X}: categoria com identificador inválido (${sh(x.cat)}).`);
      const k=ikey(x);if(seen.has(k))errors.push(`${I}: critério repetido (${sh(k)}).`);seen.add(k);
      if(x.st!==undefined&&x.st!==null&&!STATUS.includes(x.st))errors.push(`${X}: resultado inválido (${sh(x.st)}).`);
      for(const f of ['note','na','nv','d','tipo','inst','catName','en'])if(!strOpt(x[f]))errors.push(`${X}: o campo "${f}" deve ser texto.`);
      if(x.st=='NAO_CONFORME'&&!isObj(x.nc))warnings.push(`${X}: não conforme sem registro da ocorrência.`);
      if(x.nc!==undefined&&x.nc!==null){if(!isObj(x.nc))errors.push(`${X}: registro de ocorrência inválido.`);else{for(const f of ['desc','loc','pri','rec','obs'])if(!strOpt(x.nc[f]))errors.push(`${X}: ocorrência com campo "${f}" inválido.`);if(x.nc.pri&&!PRI_OK.includes(x.nc.pri))warnings.push(`${X}: prioridade desconhecida (${sh(x.nc.pri)}).`)}}
      if(!Array.isArray(x.ph)){errors.push(`${X}: lista de fotos inválida.`);continue}
      for(const f of x.ph){
        if(!okId(f)){errors.push(`${X}: identificador de foto inválido (${sh(f)}).`);continue}
        const p=phMap.get(f);
        if(p){if(p.ins!==i.id)errors.push(`${X}: foto ${sh(f)} pertence a outra vistoria (${sh(p.ins)}).`);(refBy.get(i.id)||refBy.set(i.id,new Set()).get(i.id)).add(f)}
        else if(local.photoIds.has(f)){if(local.photoIns.get(f)!==i.id)warnings.push(`${X}: foto ${sh(f)} existe localmente em outra vistoria.`)}
        else warnings.push(`${X}: referencia a foto ${sh(f)} que não existe; a referência será descartada na importação.`)}
    }
  }
  for(const p of d.photos){
    const P=`Foto ${sh(p.id)}`;
    if(typeof p.data!='string'||!IMG_RX.test(p.data))errors.push(`${P}: dados de imagem ausentes ou em formato inválido.`);
    else if(p.data.length*0.75>MAX_IMG)errors.push(`${P}: imagem excede o tamanho máximo permitido.`);
    if(!okId(p.ins))errors.push(`${P}: sem vínculo válido com uma vistoria.`);
    else if(!ids.insps.has(p.ins)&&!local.insps.some(i=>i.id==p.ins))errors.push(`${P}: vinculada a vistoria inexistente (${sh(p.ins)}).`);
    if(p.itemKey!==undefined&&typeof p.itemKey!='string')errors.push(`${P}: vínculo com critério inválido.`);
    const lo=local.photoIns.get(p.id);if(lo!==undefined&&lo!==p.ins)errors.push(`${P}: o mesmo identificador já existe neste aparelho em outra vistoria.`);
    if(ids.insps.has(p.ins)&&!(refBy.get(p.ins)&&refBy.get(p.ins).has(p.id)))warnings.push(`${P}: não está vinculada a nenhum critério (órfã); não será importada.`);
  }
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const cmp=(arr,localArr)=>{const m=new Map(localArr.map(r=>[r.id,r]));let nw=0,eq=0;const df=[];for(const r of arr){const o=m.get(r.id);if(!o)nw++;else if(same(o,r))eq++;else df.push(r.id)}return{nw,eq,df}};
  const ph={nw:0,eq:0,df:[]};
  for(const p of d.photos){if(!local.photoIds.has(p.id))ph.nw++;else if(fp&&fp.backup&&fp.local&&fpEq(fp.backup.get(p.id),fp.local.get(p.id)))ph.eq++;else ph.df.push(p.id)}
  return{errors,warnings,counts:{props:cmp(d.props,local.props),envs:cmp(envs,local.envs),insps:cmp(d.insps,local.insps),photos:ph},legacy};
}
