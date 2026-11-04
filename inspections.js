/* Regras da vistoria: aplicabilidade sugerida, contagens de progresso e carregamento de dados/catálogo. */
// ---- aplicabilidade SUGERIDA (a validar pelo engenheiro) ----
const naReason=(n,c)=>(n>=65&&n<=72&&!c.box&&'Unidade sem box/divisória')||(n>=99&&n<=101&&!c.exaustor&&'Unidade sem exaustor')||(n>=83&&n<=89&&c.chuveiro=='Não instalado'&&'Chuveiro não instalado')||(n==96&&c.chuveiro!='Elétrico'&&'Chuveiro não é elétrico')||'';
const cnt=i=>{const c={CONFORME:0,NAO_CONFORME:0,NAO_SE_APLICA:0,NAO_VERIFICADO:0,pe:0};i.items.forEach(x=>x.st?c[x.st]++:c.pe++);c.n=i.items.length;c.pct=Math.round((c.n-c.pe)/c.n*100);return c};
const tag=s=>s?`<span class="tag ${ST[s][1]}">${ST[s][0]}</span>`:'<span class="tag pe">Pendente</span>';
const pn=id=>props.find(p=>p.id==id)||{name:'(imóvel removido)'};
const fld=(l,k,v,t='text')=>`<label>${l}</label><input type="${t}" data-p="${k}" value="${esc(v)}">`;
async function load(){[props,insps]=await Promise.all([DB.all('props'),DB.all('insps')]);insps.sort((a,b)=>b.startedAt.localeCompare(a.startedAt))}
async function loadCat(){const r=await fetch('data/catalogo_vistoria_banheiro_v1.json');if(!r.ok)throw new Error('data/catalogo_vistoria_banheiro_v1.json não encontrado ('+r.status+')');CAT=await r.json()}
