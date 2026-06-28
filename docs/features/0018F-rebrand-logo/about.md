---
id: 0018F
type: feature-about
slug: rebrand-logo
status: draft
created: 2026-06-27
updated: 2026-06-27
related: [BRN-logo-rebrand-pdv-art-br]
---

## TL;DR

Renomeia a marca do produto de "PDV.multi" para "PDV.ART.br" (alinhada ao domínio de produção pdv.art.br) em todas as 12 superfícies onde aparece, e introduz o logotipo nas telas de login, criação de conta e PDV. Login e signup passam a usar tema escuro com o logo de fundo preto; o caixa exibe o logo de fundo branco no header; sidebar, admin e manual usam a marca em texto estilizado. O recibo impresso passa a mostrar o nome da loja com rodapé "via PDV.ART.br". Adiciona favicon simplificado, hoje ausente. Decisões consolidadas em {{doc:BRN-logo-rebrand-pdv-art-br}}.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A marca antiga "PDV.multi" está espalhada e as telas de entrada não têm identidade visual.

- **Afetados:** novos lojistas (primeiro contato é o login/signup sem marca) e clientes finais das lojas (recebem recibo com marca de software, não da loja).
- **O que quebra:** o nome "PDV.multi" não bate com o domínio real pdv.art.br nem com o logotipo já criado; login/signup/PDV não exibem o logo que já existe em `public/`.
- **Sinal observável:** "PDV.multi" hardcoded em 12 pontos (`app/layout.tsx:18`, metadata de 6 páginas, `components/layout/AppSidebar.tsx:239`, `app/(admin)/layout.tsx:57`, `components/caixa/PaymentDialog.tsx:78`, `components/manual/manual-data.ts:29`); aba do navegador sem favicon (mostra ícone padrão do Next); recibo do cliente impresso com "PDV.multi" em vez do nome da loja.
- **Workaround atual:** nenhum — a marca antiga simplesmente permanece.

## Users

| Role | Goal com esta feature | Pain atual |
|---|---|---|
| Lojista (novo) | Reconhecer a marca PDV.ART.br já no login/signup | Telas de entrada sem logo, marca inconsistente com o domínio |
| Lojista (operando) | Ver o logo no PDV durante o uso | Nenhuma identidade visual na tela de caixa |
| Cliente final da loja | Receber recibo com o nome da loja onde comprou | Recibo impresso mostra "PDV.multi" (marca do software), não a loja |
| Super admin (founder) | Painel admin com a marca correta | Header admin ainda exibe "PDV.multi" |

## Requirements

- **RF01:** As 12 ocorrências enumeradas de "PDV.multi" (ver Problem) passam a exibir "PDV.ART.br" — root metadata, metadata das 6 páginas (login, signup, auditoria, manual, perfil, usuários), sidebar, header admin, recibo e texto do manual. Critério de aceite: `grep "PDV.multi"` no repositório retorna 0 (garante que nenhuma ocorrência fora da lista permaneça).
- **RF02:** As telas de login e criação de conta usam tema escuro e exibem o logo de fundo preto (origem `public/logo (1).png`) acima do título do card.
- **RF03:** A tela de PDV (caixa) exibe o logo de fundo branco (origem `public/logo (2).png`) no header da `CaixaShell`.
- **RF04:** Sidebar, header admin e intro do manual exibem a marca em texto estilizado "PDV.ART.br" (não a imagem).
- **RF05:** O recibo impresso no checkout exibe o nome da loja (tenant) como cabeçalho e um rodapé discreto "via PDV.ART.br".
- **RF06:** O app define um favicon próprio (versão simplificada do logo) exibido na aba do navegador.
- **RNF01:** Ambos os arquivos de logo usados nas telas (login/signup e caixa) são otimizados para WebP e cada um servido com menos de 100 KB, contra os 1,1 MB e 1,5 MB atuais.
- **RNF02:** As telas de login/signup em tema escuro atendem contraste WCAG AA em inputs, placeholders e mensagens de erro.
- **RN01:** O sufixo da marca em texto segue o tratamento de cor existente (hoje "PDV**.multi**" colorido) adaptado para "PDV**.ART**.br", consistente com as cores do logotipo.
- **RN02:** O cabeçalho do recibo usa o nome da loja do tenant da sessão; na ausência do nome, recai para "PDV.ART.br".

## Scope

### Includes
- Substituição textual "PDV.multi" → "PDV.ART.br" nas 12 superfícies mapeadas.
- Logo nas telas de login, signup (fundo preto + tema escuro) e PDV/caixa (fundo branco).
- Marca em texto estilizado na sidebar, header admin e manual.
- Recibo com nome da loja + rodapé "via PDV.ART.br".
- Favicon simplificado configurado.
- Otimização dos dois assets de logo para WebP + renomeação para nomes válidos de URL.

### Does NOT Include
- **Logo por loja (upload por tenant)** — descartado nesta rodada; vira feature própria de upload/storage/fallback. A marca é única do produto.
- **Logo da loja no recibo** — o recibo mostra o nome textual do tenant, não uma imagem enviada pela loja; upload de logo da loja fica fora.
- **Redesign completo das telas de login/signup** — só fundo escuro + logo + contraste; estrutura do card e campos permanecem.
- **Splash screen / PWA / app icon mobile** — fora; o escopo de ícone cobre apenas o favicon de navegador.
- **Imagem de compartilhamento social (`og:image`)** — fora; rebrand não inclui SEO/preview de redes sociais nesta rodada.
- **Marca em e-mails transacionais** — fora; não há fluxo de e-mail de marca neste escopo (rebrand é só in-app + recibo).

## Success Metrics

| Métrica | Alvo | Fonte |
|---|---|---|
| Ocorrências de "PDV.multi" restantes no código | 0 | grep no repositório |
| Peso do logo carregado no login | < 100 KB | tamanho do arquivo servido |
| Peso do logo do caixa | < 100 KB | tamanho do arquivo servido |
| Contraste das telas de login escuro | WCAG AA (≥ 4.5:1 texto) | checagem de contraste |
| Marca em texto exibe "PDV.ART.br" | sidebar, header admin e intro do manual | inspeção visual das 3 telas |
| Favicon próprio configurado | aba do navegador mostra o ícone da marca | inspeção da aba + `app/icon` presente |
| Recibo com nome da loja | 100% dos recibos | inspeção do template de impressão |

## References

- {{doc:BRN-logo-rebrand-pdv-art-br}} — brainstorm que originou as decisões.
- Domínio de produção: pdv.art.br (deploy Hetzner).
- Assets fornecidos: `public/logo (1).png` (fundo preto), `public/logo (2).png` (fundo branco).
- Padrão de imagem do projeto: `<img>` puro com `loading="lazy"` (ver feature 0016F / `components/products/ProductImageUpload.tsx`).

---

## Addendum: Additional Deliveries

| Delivery | Description | Justification |
|----------|-------------|---------------|
| EmojiPicker | Busca/seleção de emoji por palavra-chave (pt-BR) no cadastro de produto | improvement |
| QuantityInput fix | Campo de estoque pode ser apagado (não força 0); reescrito sem setState-in-effect | improvement |
| Cards do caixa | Redução ~30% para caber mais produtos por linha | improvement |

**Impact:** melhorias de UX no cadastro de produto e no caixa, finalizadas na mesma branch a pedido do owner; não alteram o escopo de marca do 0018F.
