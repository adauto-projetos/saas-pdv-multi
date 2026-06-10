---
id: 0001F
type: feature-design
slug: product-markup-pricing
created: 2026-06-08
updated: 2026-06-08
related: [0001F]
---

## TL;DR

Especificação de UX para {{doc:0001F}} — cadastro de produtos com calculadora de markup. Existe para guiar o scaffolding (greenfield) com telas, componentes e tokens definidos antes de codar. Decisão headline: **mobile-first** (operador no balcão), aesthetic **Minimal Clean + Data-Dense** (DQS 13/15), com elemento-assinatura **Live Price Preview** — painel estilo etiqueta/recibo (`font-mono`, número herói) que recalcula o preço de venda em tempo real ao digitar custo + margem %. 5 telas, 6 componentes novos sobre shadcn/ui; dinheiro em centavos, formatação BRL só na borda de UI.

## TOC

- [Screens](#screens)
- [Components](#components)
- [Flows](#flows)
- [Tokens](#tokens)
- [References](#references)

## Screens

| screen | purpose | primary action | entry |
|---|---|---|---|
| S1 — Lista de Produtos | Buscar/listar produtos; estoque readonly (RF07, RF08) | Criar produto (FAB mobile / botão header desktop) | sidebar/bottom-nav "Produtos"; `/produtos`; redirect pós-save |
| S2 — Novo Produto | Criar produto com markup em tempo real (RF01-RF04) | Salvar produto | botão "+ Novo" em S1; `/produtos/novo` |
| S3 — Editar Produto | Editar produto; dispara RF06 se custo mudar | Salvar alterações | clique no item da S1; `/produtos/[id]/editar` |
| S4 — Confirmar Recalc | Sugerir novo preço ao alterar custo (RF06) | Aplicar novo preço | automático ao salvar S3 com custo alterado (sem URL própria) |
| S5 — Margem Padrão | Configurar % padrão por tenant (RF05) | Salvar margem padrão | link "Configurar margem padrão" em S2/S3; `/configuracoes/margem-padrao` |

**Responsividade (mobile-first 320px → md/lg):** S1 cards → `<Table>`, FAB → botão no header. S2/S3 single-column + CTA sticky `pb-safe` → 2 colunas com Live Price Preview sticky `top-20`. S4 Vaul Drawer (bottom) → Dialog centralizado. S5 full-width → Card `max-w-sm`.

**Estados por tela (loading/empty/error/success):**
- **S1** — loading: 5 skeleton cards (h-24, stagger); empty: "Nenhum produto ainda" / "Cadastre o primeiro produto para começar a vender." / CTA "+ Adicionar produto"; error: "Não foi possível carregar os produtos." + "Tentar novamente"; success: lista cards/tabela.
- **S2/S3** — loading (S3): skeleton espelhando cada campo (h-11); empty (S2): form com margem % pré-preenchida do tenant; error: validação inline `text-destructive` + toast em erro de servidor; success: redirect S1 + toast "Produto salvo".
- **S4** — loading: botão "Aplicar" desabilitado + spinner; empty: n/a (abre só com dados); error: toast; success: fecha + redirect S1 + toast.
- **S5** — loading: skeleton h-11 no campo; empty: campo pré-preenchido com valor atual; error: toast; success: toast "Margem padrão salva" + `router.back()`.

## Components

Reusar shadcn/ui por referência (sem custom): `button`, `input`, `label`, `card`, `table`, `dialog`, `drawer` (vaul), `form` (react-hook-form + zod), `select`, `badge`, `skeleton`, `separator`, `tooltip`, `sonner` (toast). Componentes novos (kebab-case file, PascalCase export):

- **ProductList** — `components/products/product-list.tsx` (new) — props `products: Product[]`, `isLoading: boolean`, `onEdit: (id)=>void`; owns: responsive table↔cards, loading skeleton, empty/error states. Serve "abrir lista", "editar produto", "ver estoque readonly". `<md`: cards (touch h-20, tap navega); `md+`: `<Table>`. Stagger 0.04s via motion.
- **ProductForm** — `components/products/product-form.tsx` (new) — props `defaultValues?: ProductFormValues`, `onSubmit: (values)=>void`, `isSubmitting: boolean`, `mode: "create"|"edit"`; owns: validação zod, submit, detecção de `costChanged`. Single-column + CTA `fixed bottom-0 inset-x-0 p-4 pb-safe`. Serve salvar (com/sem custo), cancelar, link margem padrão.
- **MarkupFields** — `components/products/markup-fields.tsx` (new) — props `costCentavos`, `marginPercent`, `priceCentavos`, `isPriceManual: boolean`, `onChange: (patch)=>void`; owns: cálculo `price = cost + cost*(margin/100)`, flag manual override. Edição direta do preço → `isPriceManual=true` + Badge "Preço manual" (com botão × para resetar ao calculado). Serve "calcular preço (tempo real)", "sobrescrever preço".
- **LivePricePreview** — `components/products/live-price-preview.tsx` (new) — props `costCentavos`, `markupCentavos`, `priceCentavos`, `isPriceManual: boolean`; owns: display breakdown (Custo → Markup R$ → PREÇO herói `text-3xl font-mono font-bold text-primary`). Animação `<motion.span key={priceCentavos}>` (200ms ease-out) na troca; placeholder "—" se nulo; `isPriceManual` → herói em `muted-foreground` + badge. Display-only.
- **RecalcConfirmDialog** — `components/products/recalc-confirm-dialog.tsx` (new) — props `open`, `previousCostCentavos`, `newCostCentavos`, `suggestedPriceCentavos`, `currentPriceCentavos`, `isPriceManual`, `onApply`, `onKeep`, `onCancel`, `isSubmitting`; owns: render Drawer (mobile) vs Dialog (desktop) via `useMediaQuery("(min-width:768px)")`. Serve "aplicar novo preço", "manter preço atual", "cancelar". `isPriceManual` → badge destructive "Preço foi definido manualmente". Cancelar retorna a S3 sem salvar.
- **DefaultMarginSettings** — `components/settings/default-margin-settings.tsx` (new) — props `defaultMarginPercent: number`, `onSave: (percent)=>void`, `isSubmitting`; owns: validação min=0, inteiro; toast "Margem padrão salva" + `router.back()`. Serve RF05.

## Flows

Notação `passo → passo` com ramos anotados.

- **Criar produto (RF01-RF04):** S1 → "+ Novo" → S2 → digita custo/margem % `→ LivePricePreview atualiza <100ms (Doherty)` → [ramo: edita preço direto → flag manual, badge] → Salvar → S1 + toast "Produto salvo".
- **Editar sem mudar custo (RF07):** S1 → clique item → S3 (skeleton) → Salvar → S1 + toast "Produto atualizado".
- **Editar mudando custo (RF06):** S3 → altera custo → Salvar → S4 (Drawer/Dialog) com preço sugerido `custo + custo×% armazenada` → ramo **Aplicar** → salva custo+preço → S1 + toast "Preço atualizado"; ramo **Manter preço** → salva só custo → S1 + toast "Custo atualizado, preço mantido"; ramo **Cancelar** → volta a S3 sem salvar. [sub-ramo: preço atual era manual → S4 exibe aviso destructive antes dos botões].
- **Configurar margem padrão (RF05):** S2/S3 → link "Configurar margem padrão" (proximidade ao campo margem %) → S5 → Salvar → volta à origem + toast; próximos cadastros pré-preenchem o campo margem %.

## Tokens

Tokens introduzidos por esta feature (greenfield — sem design-system.md herdado). Cores em HSL (canal shadcn), dinheiro em centavos formatado BRL só na UI.

```json
{"colors":{"primary":"160 84% 39%","primaryForeground":"0 0% 100%","accent":"160 60% 95%","destructive":"0 72% 51%","muted":"240 5% 96%","mutedForeground":"240 4% 46%","background":"0 0% 100%","foreground":"240 10% 4%","border":"240 6% 90%"},"fonts":{"display":"Plus Jakarta Sans","body":"DM Sans","mono":"JetBrains Mono"},"radius":"0.5rem","darkMode":true,"touch":{"min":"44px","inputFontSize":"16px"},"breakpoints":{"base":"320","md":"768","lg":"1024"}}
```

## References

- {{doc:0001F}} — feature about/discovery (requisitos RF/RN, scope).
- design-system.md — inexistente (greenfield); tokens acima são a base; rodar Foundations mode ou `/add.xray` após primeiro build para consolidar.
- shadcn/ui (button, input, table, dialog, drawer/vaul, form, select, badge, skeleton, sonner) + motion (animações) + Plus Jakarta Sans / DM Sans / JetBrains Mono.
- Features dependentes: Estoque e Lucro/fechamento (Fase 2) — consomem produto, custo e margem definidos aqui.
