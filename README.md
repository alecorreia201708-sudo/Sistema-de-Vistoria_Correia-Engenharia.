# Vistoria Técnica de Imóveis (HTML + JavaScript, sem PWA)

## Como abrir
O catálogo é lido de `data/*.json`, o que exige um servidor (não funciona com duplo clique em `index.html`).

**Local:** instale o Python, abra um terminal na pasta e rode `python -m http.server 8000`; depois acesse `http://localhost:8000`.
**Online:** envie a pasta inteira ao GitHub Pages e acesse o endereço gerado.

## Onde ficam os dados
No IndexedDB do navegador, neste aparelho. Limpar os dados do site apaga tudo. Use **Exportar backup** com frequência.

## Estrutura
`index.html` · `css/styles.css` · `js/` (utils, database, inspections, views, app) · `data/catalogo_vistoria_banheiro_v1.json`
`sw.js` só remove o service worker de versões anteriores e pode ser apagado depois.
