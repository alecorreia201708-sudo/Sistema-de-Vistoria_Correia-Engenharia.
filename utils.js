/* Utilitários, constantes e estado global da aplicação. */
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ST={CONFORME:['Conforme','ok'],NAO_CONFORME:['Não conforme','nc'],NAO_SE_APLICA:['Não se aplica','na'],NAO_VERIFICADO:['Não verificado','nv']};
const NV=['Ausência de fornecimento de água','Ausência de energia elétrica','Acesso impedido','Equipamento não instalado ou indisponível','Teste não autorizado','Condição insegura','Outro'];
const PRI=['Baixa','Média','Alta','Crítica'];
let CAT,props=[],insps=[],cur,S={v:'home'},urls={},T;
