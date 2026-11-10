/* "Como inspecionar?": orientação exibida junto de cada critério durante a vistoria.
   Conteúdo derivado do método, dos instrumentos e dos avisos do catálogo; se o catálogo trouxer
   um procedimento próprio do critério (campo "procedure" ou "how_to"), ele é exibido em destaque. */
const OPEN={};
const HOW_METHOD={
 visual:['Visual','Observe com boa iluminação (lanterna, quando indicada) e de mais de um ângulo: acabamento, limpeza, integridade e continuidade do componente.'],
 funcional:['Funcional','Opere o componente em condições normais de uso, sem forçar, e observe funcionamento, folgas, travamentos e ruídos anormais.'],
 dimensional:['Dimensional','Meça com o instrumento indicado, anote o valor encontrado e compare com projeto ou memorial, se disponível. Não conclua atendimento a norma sem referência validada.'],
 documental:['Documental','Confira se o documento (projeto, memorial, manual ou outro) foi fornecido e se o que foi executado condiz com ele.']};
const rx=(s,r)=>r.test(s||'');
function howTo(x){
 const d=x.d||'',ins=x.inst||'',all=d+' '+ins,tp=(x.tipo||'').toLowerCase();
 const m=Object.keys(HOW_METHOD).filter(k=>tp.includes(k));
 const sf=['Inspeção ordinária é não destrutiva: não desmontar componentes, abrir quadros, perfurar nem remover revestimentos.'];
 if(rx(all,/água|torneira|chuveiro|descarga|vazamento|ralo|sifão|registro|hidr/i))sf.push('Teste com água só com abastecimento disponível, autorização e condições seguras. Se não for possível, marque "Não verificado" e registre o motivo.');
 if(rx(all,/tomada|interruptor|elétric|disjuntor|quadro|iluminação|luminária|testador|multímetro/i))sf.push('Elétrica: faça apenas verificação visual e funcional simples. Medições, abertura de quadros e manuseio de condutores são de profissional habilitado.');
 if(rx(all,/gás/i))sf.push('Gás: apenas verificação visual de identificação e acabamento. Teste de estanqueidade somente por procedimento específico e profissional habilitado.');
 return`<div class="how">
${x.proc?`<p><b>Procedimento do catálogo</b><br>${esc(x.proc)}</p>`:''}
<p><b>Método:</b> ${esc(x.tipo||'não informado')}</p>${m.map(k=>`<p><b>${HOW_METHOD[k][0]}.</b> ${HOW_METHOD[k][1]}</p>`).join('')}
<p><b>Instrumentos:</b> ${ins?esc(ins):'nenhum instrumento específico indicado'}</p>
<p><b>Cuidados</b></p><ul>${sf.map(s=>`<li>${s}</li>`).join('')}</ul>
<p><b>Como registrar</b></p><ul><li><b>Conforme:</b> item verificado e sem ocorrência; observações são opcionais.</li><li><b>Não conforme:</b> descreva a ocorrência, a localização exata e registre foto.</li><li><b>Não se aplica:</b> informe a justificativa.</li><li><b>Não verificado:</b> informe o motivo (por exemplo, sem água, sem energia ou acesso impedido).</li></ul>
<p class="mut">Nenhuma referência normativa está vinculada a este critério; as referências do catálogo estão pendentes de validação.</p>
<p class="mut">Orientação geral derivada do método e dos avisos do catálogo. Não é procedimento técnico específico deste critério nem substitui ensaios.</p></div>`}
const howBtn=(x,i)=>`<div style="margin-top:8px"><button class="how-b" data-a="how" data-i="${i}">${OPEN[cur.id+':'+ikey(x)]?'Ocultar orientação':'Como inspecionar?'}</button></div>${OPEN[cur.id+':'+ikey(x)]?howTo(x):''}`;
