---
id: BRN-logo-rebrand-pdv-art-br
type: brainstorm
created: 2026-06-27
updated: 2026-06-27
related: []
---

## TL;DR

Sessão explorou a troca da marca de "PDV.multi" para "PDV.ART.br" (alinhada ao domínio de produção pdv.art.br) e a presença do logotipo nas telas de login, criação de conta e PDV. Hoje a marca só aparece como texto na sidebar; login, signup e PDV não exibem nada. O usuário forneceu dois arquivos de logo (fundo preto e fundo branco) e fechou a direção (todas escolhidas): rebrand no app inteiro (sidebar, título da aba, manual — o inventário das ocorrências é tarefa de implementação, não nova decisão), login/signup com tema escuro usando o logo de fundo preto, e o logo de fundo branco dentro do PDV.

## TOC

- [Questions Explored](#questions-explored)
- [Candidate Directions](#candidate-directions)
- [Open Threads](#open-threads)

## Questions Explored

- A marca deve ser logotipo (imagem) ou só nome em texto estilizado?
- O logo é único do produto ou cada loja (tenant) tem o seu?
- O rebrand cobre só as 3 telas ou o app inteiro (sidebar, título da aba, manual)?
- Logo com fundo sólido preto numa tela clara fica feio — muda-se a tela ou recorta-se o fundo?
- Onde o logo grande ajuda e onde atrapalha (telas amplas vs. sidebar pequena vs. favicon)?

## Candidate Directions

- **Logo único do produto (escolhido)** — mesma marca PDV.ART.br para todas as lojas — prós: simples, sem upload por loja, sem feature de tenant; contras: nenhuma personalização por estabelecimento — open issues: nenhum.
- **Logo por loja (tenant)** — cada estabelecimento sobe seu próprio logo — prós: identidade própria por loja; contras: vira feature maior (upload, storage, fallback) — open issues: descartado nesta rodada.
- **Imagem fornecida pelo usuário (escolhido)** — dois PNGs em public/ (fundo preto e fundo branco) — prós: identidade pronta, casa com o domínio; contras: arquivos pesados (1,1 MB e 1,5 MB) e nomes com espaço/parênteses inválidos para URL — open issues: renomear e otimizar para WebP.
- **Login/signup em tema escuro (escolhido)** — fundo escuro nas telas de entrada para combinar com o logo de fundo preto — prós: visual premium, logo encaixa sem moldura; contras: redesenha as telas de login e signup — open issues: contraste/acessibilidade dos campos no tema escuro.
- **Recortar fundo do logo (transparente)** — alternativa ao tema escuro, logo flutua em qualquer cor — prós: não mexe no layout das telas; contras: depende de edição da imagem — open issues: descartado em favor do tema escuro.
- **Marca em texto na sidebar/manual (escolhido)** — "PDV.ART.br" como texto, não a imagem reduzida — prós: legível em tamanho pequeno; contras: dois tratamentos visuais da marca (imagem grande vs. texto) — open issues: definir estilo do texto (peso, cor das partes ".ART" / ".br") na implementação, não bloqueia.

## Open Threads

- Favicon: o logo encolhido vira borrão na aba do navegador — precisa de versão simplificada (só o monitor ou as iniciais); não resolvido nesta sessão.
- Otimização dos assets (BLOQUEIA): decidir se converte para WebP (~50 KB) reaproveitando o pipeline de imagem de produto (0016F) ou faz conversão única manual — alvo de dimensão ainda não definido.
- Renomeação dos arquivos `logo (1).png` / `logo (2).png` para nomes válidos de URL (ex.: `logo.png` / `logo-dark.png`) — NÃO bloqueia, é tarefa mecânica de implementação.
- Acessibilidade do login em tema escuro: contraste de inputs, placeholders e mensagens de erro precisa ser validado.
- Inventário completo das ocorrências de "PDV.multi" no código (sidebar, metadata/title, manual) antes do rebrand global.

> Próximo passo: formalizar em `/add.new` (mudança visual + tema escuro no login + rebrand global justificam uma feature).
