# Relatório da Etapa 2 — correções técnicas, segurança e integridade
Sistema de Vistoria Técnica de Imóveis — Correia Engenharia

## 1. Alterações realizadas
| Problema identificado | Alteração realizada | Resultado |
|---|---|---|
| Injeção de HTML: identificadores (`x.id`, `p.id`, `i.id`, `e.id`, `g.id`, `cur.id`, id de foto) e lista de materiais entravam no HTML sem escape; `esc()` não tratava aspa simples | `esc()` aplicado a todos os identificadores e materiais; `esc()` passou a tratar `'`; a validação de backup só aceita identificadores com letras, números e `. _ : -` (até 100 caracteres); CSP restritiva no HTML | Testado (unitário e navegador) |
| Conflito de fotografias: fotos tratadas como idênticas só pelo ID | Comparação por tamanho + hash SHA-256 do conteúdo; assinatura gravada no backup e conferida na importação; a assinatura divergente rejeita o arquivo | Testado |
| Importação com substituição deixava fotos antigas e referências quebradas | Fotos antigas de vistorias substituídas e sem vínculo são removidas; fotos órfãs do arquivo não são importadas; referências a fotos inexistentes são descartadas; verificação de integridade após importar | Testado |
| Validação de backups superficial | Validação de tipos, campos obrigatórios, referências (imóvel, vistoria, ambiente, foto), status, duplicidade, formato real da imagem (cabeçalho do arquivo) e tamanho; separação entre erros (bloqueiam) e avisos (exigem confirmação) | Testado (20 testes unitários + navegador) |
| Transação de importação podia gravar parcialmente se ocorresse erro ao enfileirar | `multi()` aborta toda a transação em qualquer erro | Testado (falha simulada na 3ª gravação: nada foi gravado) |
| Salvamento: duas abas podiam sobrescrever uma à outra; indicador era só um aviso passageiro; sem nova tentativa | Versão (`rev`) por vistoria verificada dentro da transação; indicador permanente (Alterações pendentes, Salvando…, Salvo, Erro ao salvar, Conflito); "Salvo" só depois da confirmação do IndexedDB; nova tentativa automática a cada 4 s; diário de emergência no `localStorage` recuperado na abertura seguinte | Testado |
| Validação da vistoria | Regras preservadas e reverificadas; configuração desconhecida continua sem presumir ausência de box, exaustor ou chuveiro | Testado |
| Estrutura do IndexedDB | **Sem alteração** de estrutura ou versão (o campo `rev` é acrescentado aos registros; registros antigos sem `rev` continuam válidos) | Testado (registros sem `rev` gravam normalmente) |

## 2. Testes executados
**Testes de código (automatizados, Node):** 20 testes unitários das regras puras (`tests/unit.test.mjs`): validação de finalização, aplicabilidade, identificadores, tipos, referências, fotos, avisos e erros de backup. Resultado: 20 aprovados.

**Testes em navegador (automatizados, Chromium via Playwright, `tests/e2e.js`):**
- *seguranca:* backup com HTML, `<script>`, atributos e `<svg onload>` nos textos; nome de arquivo malicioso; oito tipos de identificador com caracteres especiais; verificação de que nada executa nas telas início, ambientes, nova vistoria, vistoria, critérios e relatório.
- *backup, backup2:* exportar vistoria com foto; importar em navegador vazio; reimportar; mesmo ID com conteúdo diferente; manter e substituir; backup preventivo; troca de foto e remoção da antiga; referência fantasma e foto órfã; foto sem vistoria; imagem adulterada; JSON inválido, incompleto, incompatível; falha no meio da importação.
- *salvamento, concorrencia:* troca imediata entre vistorias; cliques de status em sequência; digitar e recarregar; digitar e fechar a aba; estados do indicador; falha de gravação com nova tentativa; sem internet e em segundo plano; conflito entre duas abas; recuperação pelo diário.
- *finalizacao, aplicabilidade:* cada regra de validação isolada, finalização correta, reabertura registrada, configuração não informada.
- *fotos:* fotos em dois quartos com o mesmo código de critério, adicionar e remover foto, relatório com fotos.
- *regressao:* cadastro e edição de imóvel e cliente, ambientes, criação de vistoria, status, observação, foto, pausar e retomar, relatório, impressão e geração de PDF pelo navegador, bloqueio de exclusão de imóvel com vistoria, exportação.
- Importação de backup no formato antigo (sem versão e sem assinatura de fotos): testada por script avulso.

**Testes manuais:** nenhum.

**Testes ainda pendentes:** iPhone/Safari, Android/Chrome real, câmera real, grande volume de fotos, uso prolongado.

## 3. Limitações
- Os testes foram feitos só no Chromium.
- `pagehide` e `beforeunload` não garantem a conclusão de gravações assíncronas. O diário de emergência reduz o risco, mas depende de `localStorage` disponível (pode estar bloqueado em navegação privada). Se o aparelho for desligado ou o navegador encerrado à força, uma janela de cerca de 120 ms de digitação pode se perder.
- A CSP permite `unsafe-inline` porque o sistema é um único arquivo HTML. A defesa principal contra injeção é o escape de todos os dados e a validação de identificadores.
- O controle de edição entre abas cobre as vistorias; imóveis e ambientes não têm esse controle.
- Alterações feitas numa aba em conflito não são gravadas; ao recarregar, elas se perdem.
- Foto salva sem vínculo por interrupção entre as duas gravações pode permanecer; a verificação de integridade só roda após importação.
- Os dados continuam apenas no navegador do aparelho. Backups periódicos continuam necessários.

## 4. Como atualizar no GitHub Pages sem perder os dados
1. **Antes de tudo**, no app atual, toque em "Exportar backup" e guarde o arquivo.
2. No repositório do GitHub, envie o novo `index.html` com o mesmo nome (Add file → Upload files) e confirme o commit.
3. Aguarde cerca de um minuto e abra o mesmo endereço de sempre.
4. Os dados continuam no navegador porque o endereço (origem) é o mesmo e a estrutura do banco não mudou.
5. Se algo parecer antigo, feche e reabra o navegador. Se precisar restaurar, use "Importar backup".
