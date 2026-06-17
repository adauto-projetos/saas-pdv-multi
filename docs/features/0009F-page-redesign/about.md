---
id: 0009F
type: feature-about
slug: page-redesign
status: discovery
created: 2026-06-17
updated: 2026-06-17
related: [0008F]
---

## TL;DR

Restyle visual das 8 páginas principais do app (`/caixa`, `/vendas`, `/products`, `/estoque`, `/comandas`, `/financeiro/caixa`, `/lucro`, `/settings`) para igualar ao design de referência `PDVApp.jsx`. Mudança puramente de UI — zero alterações em server actions, services, schema ou banco. Entrega: primitivos compartilhados (`PageCard`, `StatCard`, `SectionLabel`) + restyle de cada página.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

**Quem é afetado:** Operadores e donos que usam o PDV diariamente — percebem inconsistência visual entre o shell (sidebar escura moderna, 0008F) e o conteúdo das páginas (layout antigo sem cards, tipografia plana, fundo sem container).

**O que está ruim:** As páginas seguem o padrão introduzido em 0001F (`div.grid gap-6 + h1 text-xl`) que não tem cards com sombra, hierarquia tipográfica, espaçamento ou paleta definida pelo design de referência. O resultado é um shell moderno envolvendo conteúdo visualmente defasado.

**Sinal observável:** Abrindo qualquer rota protegida após 0008F, o conteúdo da `<main>` não tem container visual — flutua sobre o fundo `bg-slate-100` sem separação clara de seções. Comparação com `PDVApp.jsx` mostra cards com `rounded-xl border shadow-sm`, rows de stats, headers de seção e espaçamento consistente ausentes.

**Workaround atual:** Nenhum. O usuário navega com o visual atual sem alternativa.

## Users

| Role | Objetivo com a feature | Pain atual |
|------|------------------------|------------|
| Operador de caixa | Abrir `/caixa` e identificar carrinho, total e botões de pagamento de relance | Layout plano sem separação visual entre áreas do caixa |
| Gerente / dono | Consultar Lucro e Financeiro com clareza hierárquica dos dados | Números e seções sem destaque — difícil scannear valores-chave |
| Usuário geral | Navegar pelo app com visual coerente do início ao fim | Contraste entre sidebar moderna e páginas desatualizadas |

## Scope

### Includes

- Primitivos compartilhados: `PageCard`, `PageCardHeader`, `StatCard`, `SectionLabel` em `components/ui/`
- Restyle de `/caixa` — layout full-height flex, cart table redesenhada, payment pills, bottom bar de pagamento
- Restyle de `/vendas` — row de 3 stats (`StatCard`) + card wrapping conteúdo
- Restyle de `/products` — search input visual, tabela wrapped em `PageCard`
- Restyle de `/estoque` — seções de entrada/ajuste wrapped em `PageCard` com `SectionLabel`
- Restyle de `/comandas` — grid de cards `auto-fill minmax(270px,1fr)` com status visual
- Restyle de `/financeiro/caixa` — 2-col header, seções wrapped em `PageCard`
- Restyle de `/lucro` — hero value destacado + grid 2×2 de stats
- Restyle de `/settings` — form wrapped em `PageCard` com `max-w-lg`

### Does NOT Include

- Server actions, services, schema ou banco — mudança de lógica é fora do escopo desta feature (RN01)
- `/financeiro/clientes`, `/financeiro/receber`, `/financeiro/pagar` — sub-rotas secundárias; restyle em feature futura
- `/estoque/[id]` (detalhe de movimentação) — não representada no PDVApp.jsx; restyle futuro
- `/products/new`, `/products/[id]/edit` — páginas de edição; não representadas no PDVApp.jsx; restyle futuro
- Slot de botões no `AppTopBar` — botões de ação permanecem dentro das páginas (sem acoplamento shell↔conteúdo); ver RN02
- Mobile responsiveness — PDV opera em desktop; feature separada futura
- Dark mode — PDVApp.jsx é light-only; dark mode é decisão de produto futura, não derivável deste design
- Animações e transições de página — PDVApp.jsx não define motion; animation polish é feature separada
- Migração de library de componentes — `shadcn/ui` (Base UI) permanece; restyle usa Tailwind sobre os componentes existentes

## Requirements

> Notas de trabalho derivadas do discovery; serão formalizadas e detalhadas em `feature-plan` (executar `/add.plan` antes de implementar).

### Funcionais (RF)

- **RF01:** Sistema disponibiliza `PageCard`, `PageCardHeader`, `StatCard`, `SectionLabel` como componentes exportados de `components/ui/` reutilizáveis por qualquer página
- **RF02:** Página `/caixa` exibe layout full-height flex com busca + QTD no topo, área de carrinho em `PageCard` expandível, bottom bar fixo com pills de pagamento e botões Cobrar/Limpar
- **RF03:** Página `/vendas` exibe row de 3 `StatCard` (total do dia, nº de vendas, ticket médio) seguida de tabela de vendas em `PageCard`
- **RF04:** Página `/products` exibe search input visual acima de tabela de produtos wrapped em `PageCard`
- **RF05:** Página `/estoque` exibe seções de entradas e ajustes cada uma wrapped em `PageCard` com `SectionLabel` no header
- **RF06:** Página `/comandas` exibe grid de comandas `auto-fill minmax(270px,1fr)`, cada comanda em card com status colorido
- **RF07:** Página `/financeiro/caixa` exibe header 2-col (saldo + botão) e seções de movimentos wrapped em `PageCard`
- **RF08:** Página `/lucro` exibe valor hero (lucro do dia) em tipografia grande + grid 2×2 de `StatCard` (faturamento, custo, margem, vendas)
- **RF09:** Página `/settings` exibe form de configurações wrapped em `PageCard` com largura máxima `max-w-lg`

### Regras de Negócio (RN)

- **RN01:** Zero mudanças em server actions, services, schema ou banco — esta feature é exclusivamente de UI/CSS
- **RN02:** Botões de ação de página (ex.: "Abrir comanda", "+ Novo produto") ficam dentro das páginas, não no `AppTopBar` — evitar acoplamento shell↔conteúdo
- **RN03:** `PageCard` e `StatCard` são componentes visuais puros — não importam lógica de negócio, server actions ou hooks de dados
- **RN04:** Visual fiel ao `PDVApp.jsx`: `CARD = bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden`; paleta indigo/green/slate; tipografia scale do design de referência
- **RN05:** Tailwind v4 (sem `tailwind.config.js`) — usar classes utilitárias ou `var(--token)` de `globals.css`
- **RN06:** Nenhum teste existente pode quebrar — mudanças são de markup/CSS, não de lógica testada
- **RN07:** Primitivos em `components/ui/` seguem o padrão Server Component por default; só adicionar `"use client"` se precisar de estado

## Success Metrics

| Métrica | Definição | Target | Fonte |
|---------|-----------|--------|-------|
| Visual parity | Cada uma das 8 páginas abertas no browser lado a lado com a tela correspondente do `PDVApp.jsx` — card borders, espaçamento e tipografia devem ser indistinguíveis; aprovação pelo dono do produto (djadauto) | 8/8 aprovadas | QA manual no browser (Chrome DevTools, zoom 100%) |
| Zero regressões de lógica | `npm test` sem novas falhas após restyle | 0 falhas novas | Vitest |
| Build limpo | `npm run build` sem erros após implementação | 0 erros | terminal local |
| Testes de tipo | `npm run typecheck` sem erros | 0 erros | tsc |

## References

- `Design funcional e moderno/download/PDVApp.jsx` — design de referência visual autoritativo (paleta, card styles, layouts de cada página); arquivo estático criado pelo dono do produto como protótipo funcional; considerado congelado para esta feature — mudanças no arquivo não reabrem o escopo sem nova feature
- `docs/features/0008F-sidebar-layout/about.md` — shell (sidebar + topbar) que 0009F deve preencher com conteúdo visual coerente
- `docs/features/0009F-page-redesign/discovery.md` — inventário de páginas, delta por página, primitivos identificados
- `docs/features/0009F-page-redesign/past-features.md` — features passadas que tocaram páginas relevantes
