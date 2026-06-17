---
id: 0008F
type: feature-about
slug: sidebar-layout
status: implemented
created: 2026-06-17
updated: 2026-06-17
related: [0001F, 0002F, 0003F, 0004F, 0005F, 0006F, 0007F]
---

## TL;DR

Substitui a navbar horizontal (`app/(app)/layout.tsx`) por um shell com sidebar vertical escura (220px), baseado no design de `PDVApp.jsx`. Mudança puramente de UI/layout — nenhuma página, server action, serviço ou tabela do banco é alterada. Entrega: dois novos componentes Client (`AppSidebar`, `AppTopBar`) + reescrita do layout shell.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Objective](#objective)
- [Scope](#scope)
- [Requirements](#requirements)
- [Out of Scope](#out-of-scope)
- [Success Metrics](#success-metrics)
- [Acceptance Criteria](#acceptance-criteria)
- [References](#references)

## Problem

**Quem é afetado:** Operadores e gerentes que usam o PDV diariamente para registrar vendas, gerenciar comandas e acompanhar financeiro.

**O que está ruim:** A navbar horizontal topo contém 8 links comprimidos em uma única linha, sem hierarquia visual entre módulos operacionais (Caixa, Comandas) e gerenciais (Lucro, Financeiro). O conteúdo é artificialmente estreitado por `max-w-5xl`, desperdiçando largura de tela em monitores de PDV.

**Sinal observável:** Em `app/(app)/layout.tsx`, todos os 8 links de navegação ficam alinhados horizontalmente em sequência sem separação visual. A área de conteúdo não aproveita a largura disponível.

**Workaround atual:** Nenhum — os usuários navegam com a navbar atual sem alternativa. O problema é de UX/design, não de funcionalidade quebrada.

## Users

| Role | Objetivo com a feature | Pain atual |
|------|------------------------|------------|
| Operador de caixa | Alternar rapidamente entre Caixa, Vendas e Comandas durante o turno | 8 links na mesma linha sem hierarquia — difícil identificar o módulo ativo de relance |
| Gerente / dono | Acessar Lucro, Financeiro e Configurações para gestão | Links gerenciais misturados com operacionais, sem separação visual |

## Objective

O design funcional do produto prevê uma sidebar vertical escura como shell principal do app. A sidebar separa visualmente módulos operacionais (parte superior) de gerenciais (parte inferior, após divisor), indica o módulo ativo com destaque colorido, e libera toda a largura horizontal para o conteúdo das páginas.

## Scope

**Incluído:**
- Reescrita de `app/(app)/layout.tsx` — novo shell `flex-row` com sidebar + coluna de conteúdo
- Novo `components/layout/AppSidebar.tsx` — Client Component com 8 links de navegação, logo, footer com usuário/logout
- Novo `components/layout/AppTopBar.tsx` — Client Component com título por pathname; título vazio para pathnames não mapeados
- Adição de CSS var `--pdv-sidebar: #0d1526` em `app/globals.css`
- Mover arquivo de design `Design funcional e moderno/PDVApp.jsx` para `docs/design/PDVApp.jsx.reference`

**Excluído:**
- Sidebar colapsável (feature separada futura)
- Responsividade mobile — sidebar em dispositivos < 768px (feature separada futura)
- Botões de ação de página no top bar (permanecem dentro das páginas)
- Mudança em qualquer página, server action, serviço ou schema de banco

## Requirements

### Funcionais (RF)

- **RF01** — Sidebar vertical escura (220px) com logo "PDV.multi", 8 links de navegação agrupados (operacionais + gerenciais separados por divisor) e footer com nome do usuário e botão de logout
- **RF02** — Link ativo destacado na sidebar com base no pathname atual (`usePathname`)
- **RF03** — Top bar por página (fundo branco, 52px) exibindo título derivado de mapa fixo `pathname → título`; pathnames não mapeados exibem título vazio (sem erro)
- **RF04** — Auth guard preservado: `getAuthUser()` em `layout.tsx` (Server Component) — redireciona para `/login` sem sessão

### Não-funcionais / Regras de Negócio (RN)

- **RN01** — Desktop-only: sem breakpoints mobile; sidebar sempre visível
- **RN02** — `app/(app)/layout.tsx` permanece Server Component (contém `await getAuthUser()`)
- **RN03** — `AppSidebar` e `AppTopBar` são Client Components (`"use client"`) — necessário para `usePathname()`
- **RN04** — Cor da sidebar registrada como CSS var `--pdv-sidebar: #0d1526` em `globals.css` (não reutilizar vars `--sidebar-*` do shadcn — são tokens de cor diferente)
- **RN05** — Tailwind v4: usar `bg-[var(--pdv-sidebar)]` ou classe utilitária; sem `tailwind.config.js`
- **RN06** — `<Toaster>` permanece em `app/layout.tsx` (root) — não duplicar
- **RN07** — Label "Admin" no footer da sidebar é string fixa neste MVP; gestão de roles é feature futura (único role no sistema atualmente)

## Out of Scope

| Item | Justificativa |
|------|---------------|
| Sidebar colapsável | Feature separada — não priorizada para este MVP |
| Responsividade mobile (< 768px) | PDV opera em PC/tablet; feature separada futura |
| Botões de ação no top bar | Evitar acoplamento layout↔página; botões ficam no conteúdo |
| Redesign de páginas individuais | Fora do escopo de layout shell |
| Gestão de roles de usuário | "Admin" é label fixo no MVP; roles são feature futura |

## Success Metrics

| Métrica | Definição | Target | Fonte |
|---------|-----------|--------|-------|
| Build limpo | `npm run build` sem erros após reescrita | 0 erros | CI / terminal local |
| Testes preservados | `npm test` sem novas falhas | 0 regressões | Vitest |
| Cobertura de rotas | Sidebar visível em todas as 8 rotas protegidas | 8/8 | QA manual |
| Link ativo correto | Link destacado corresponde à rota atual em cada página | 8/8 rotas | QA manual |

## Acceptance Criteria

- [x] AC01 — Sidebar visível em todas as rotas protegidas (`/caixa`, `/vendas`, `/products`, `/estoque`, `/comandas`, `/financeiro/*`, `/lucro`, `/settings`)
- [x] AC02 — Link ativo tem destaque visual distinto dos links inativos (background + cor do texto)
- [x] AC03 — Top bar exibe o título correto por pathname (ex.: `/caixa` → "Caixa"; `/vendas` → "Vendas de hoje"); pathname não mapeado → título vazio, sem erro
- [x] AC04 — Footer da sidebar exibe a inicial do nome do usuário autenticado, label fixo "Admin" (MVP) e botão de logout funcional
- [x] AC05 — Auth guard funciona: `/caixa` sem sessão redireciona para `/login`
- [x] AC06 — `npm run build` passa sem erros
- [x] AC07 — `npm run typecheck` passa sem erros
- [x] AC08 — Nenhum teste existente quebra (`npm test` → todos passam)
- [x] AC09 — CSS var `--pdv-sidebar` definida em `globals.css`; cor `#0d1526` aplicada na sidebar
- [ ] AC10 — Arquivo de design movido de `Design funcional e moderno/` para `docs/design/`

## References

- `d:\SAAS PDV.multi\Design funcional e moderno\download\PDVApp.jsx` — arquivo de design de referência visual (sidebar, topbar, paleta de cores, nav items)
- `app/(app)/layout.tsx` — layout atual a ser reescrito (auth guard, lista de links)
- `components/auth/SignOutButton.tsx` — componente de logout a ser integrado no footer da sidebar
