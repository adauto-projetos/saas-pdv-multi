---
id: 0010F
type: feature-about
slug: mobile-responsive
status: done
created: 2026-06-21
updated: 2026-06-21
related: [0008F, 0009F]
---

## TL;DR

Tornar o SAAS PDV.multi totalmente utilizável em dispositivos móveis. O fix é aditivo: o wrapper da sidebar recebe `hidden lg:flex` no layout — os inline styles internos da sidebar permanecem intactos; a sidebar simplesmente some em `< 1024px` e uma bottom navigation bar com 5 ícones + drawer "Mais" aparece no lugar. Tablets em landscape (≥ 1024px) recebem a sidebar normalmente. A tela `/caixa` recebe layout especial com tabs "Produtos/Carrinho" em mobile. Todas as rotas do app ganham responsividade. Motivação: 0008F e 0009F explicitamente adiaram mobile como "feature separada futura" — este é o momento.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Architecture Decisions](#architecture-decisions)
- [Requirements](#requirements)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

**Quem é afetado:** Operadores de caixa e donos de estabelecimento que tentam usar o PDV em tablet ou smartphone.

**O que quebra:** A sidebar tem `width: 248px` hardcoded sem nenhum breakpoint. Em dispositivos móveis, ela ocupa ~40% da largura da tela, comprimindo o conteúdo a ponto de inutilizá-lo. A tela `/caixa` tem um painel de carrinho de 392px fixo ao lado — em mobile, os dois juntos excedem a largura total.

**Sinal observável:** Abrir qualquer rota protegida em Chrome DevTools com viewport `< 768px` mostra sidebar intacta e conteúdo esmagado. `AppSidebar.tsx` usa 100% inline styles; não existe nenhum `@media`, `hidden`, `lg:`, `md:` ou `sm:` em nenhum arquivo do shell.

**Workaround atual:** Nenhum. O produto não é utilizável em mobile.

## Users

| Role | Objetivo com a feature | Pain atual |
|---|---|---|
| Operador de caixa | Registrar vendas e lançar comandas (mesmo role — único operacional no MVP) via tablet ou smartphone em ambientes sem espaço para PC | Layout quebrado em mobile — sidebar ocupa tela, carrinho inutilizável |
| Dono do estabelecimento | Consultar Lucro, Financeiro e Estoque de qualquer dispositivo fora do balcão | Páginas de gestão inacessíveis em mobile pela mesma sidebar fixa |

## Scope

### Includes

- Shell responsivo: `app/(app)/layout.tsx` com `hidden lg:flex` na sidebar e `lg:hidden` na bottom nav
- `AppSidebar.tsx` oculta em `< 1024px` (`lg:hidden`)
- `AppTopBar.tsx` exibe título da página em mobile (já existe `TITLE_MAP`; garantir visibilidade em qualquer viewport)
- Novo componente `components/layout/BottomNav.tsx` — 5 ícones fixos (Caixa, Comandas, Produtos, Financeiro, "Mais") + drawer com Vendas, Estoque, Lucro, Configurações
- Touch targets de 44×44px nos ícones da bottom nav (Material Design / Apple HIG mínimo)
- `padding-bottom: env(safe-area-inset-bottom)` na bottom nav (iPhones com home bar, Android notch)
- Página `/caixa` em mobile: tabs "Produtos" e "Carrinho" em vez de layout duas colunas; badge de quantidade no tab Carrinho
- Tratamento do teclado virtual em `/caixa`: scroll container correto para evitar que o teclado empurre o carrinho para fora da tela
- Todas as rotas protegidas do app (lista exaustiva — qualquer rota não listada abaixo está fora do escopo desta feature): `/caixa`, `/vendas`, `/products`, `/products/new`, `/products/[id]/edit`, `/estoque`, `/estoque/[id]`, `/comandas`, `/financeiro/caixa`, `/financeiro/clientes`, `/financeiro/receber`, `/financeiro/pagar`, `/lucro`, `/settings`

### Does NOT Include

- Dark mode — 0009F explicitamente deixou dark mode como decisão de produto futura; não derivável do design de referência atual
- Sidebar colapsável em desktop — comportamento de toggle no desktop é feature separada com UX própria; não confundir com "sidebar some em mobile"
- PWA / instalação na tela inicial — adicionaria Service Worker e manifest; escopo de produto separado
- Animações de transição de página ou slide do drawer — 0009F deixou animation polish como feature futura; não incluir aqui para não criar dependência de uma lib de motion
- Tablets em landscape (≥ 1024px) com sidebar — este viewport recebe layout desktop (sidebar 248px); não há modo "tablet especial"; o breakpoint `lg` é o corte único e intencional
- Testes em dispositivo físico / emulador Android formalizado — validação manual no Chrome DevTools Responsive Mode (Chrome) pelo próprio desenvolvedor cobre o critério de aceite desta feature

## Architecture Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Breakpoint `lg` (1024px) para sidebar/mobile | Tablets em portrait (768px) ficam mobile — sidebar de 248px é difícil de usar até landscape; `lg:` é o corte correto | `md` (768px): tablets portrait mostrariam sidebar, experiência ruim |
| Bottom nav: 5 itens + drawer "Mais" | Limite de 5 por legibilidade (Nielsen); operações diárias no primeiro nível, consultivas no drawer | 8 itens com scroll horizontal: ruim UX — itens cortados sem indicação visual |
| `/caixa` mobile: tabs Produtos/Carrinho | Padrão de POS mobile consolidado (Square, iFood PDV); operador foca em uma ação por vez | Stacking vertical: produtos + carrinho na mesma tela com scroll — carrinho some durante busca |
| Ícones lucide-react já existentes | Reutilização direta; sidebar já usa 8 ícones do mesmo pacote | Nova lib de ícones: dep desnecessária |

## Requirements

### Funcionais (RF)

- **RF01:** Em viewport `< 1024px`, sidebar some e bottom nav aparece na parte inferior da tela
- **RF02:** Em viewport `≥ 1024px`, sidebar permanece visível (248px) e bottom nav não aparece
- **RF03:** Bottom nav exibe 5 itens: Caixa (`/caixa`), Comandas (`/comandas`), Produtos (`/products`), Financeiro (`/financeiro/caixa`), "Mais"
- **RF04:** Item "Mais" abre drawer deslizante de baixo para cima com: Vendas (`/vendas`), Estoque (`/estoque`), Lucro (`/lucro`), Configurações (`/settings`)
- **RF05:** Item ativo na bottom nav tem destaque visual (ícone + label com cor indigo) correspondente ao pathname atual
- **RF06:** `AppTopBar` exibe título da página derivado do `TITLE_MAP` existente em todos os viewports, inclusive mobile
- **RF07:** Página `/caixa` em mobile exibe tabs "Produtos" e "Carrinho" comutáveis; tab "Carrinho" exibe badge com quantidade de itens no carrinho
- **RF08:** Tab "Produtos" em `/caixa` mobile: grade de produtos em scroll vertical com barra de busca no topo
- **RF09:** Tab "Carrinho" em `/caixa` mobile: lista de itens, total e botões Cobrar/Limpar
- **RF10:** Todas as rotas listadas no Scope → Includes renderizam sem overflow horizontal ou conteúdo cortado em viewport de 375px (iPhone SE)

### Não-funcionais (RNF)

- **RNF01:** Bottom nav recebe `padding-bottom: env(safe-area-inset-bottom)` para não sobrepor home bar de iPhones e Androids com notch
- **RNF02:** Cada ícone/item interativo na bottom nav tem área de toque mínima de 44×44px (Material Design / Apple HIG)
- **RNF03:** Em `/caixa` mobile, a abertura do teclado virtual não empurra o total ou botão Cobrar para fora do viewport

### Regras de Negócio (RN)

- **RN01:** Zero mudanças em server actions, services, schema ou banco — esta feature é exclusivamente de UI/layout
- **RN02:** `AppSidebar.tsx` e `BottomNav.tsx` nunca aparecem simultaneamente; controle via breakpoint Tailwind v4 (`lg:hidden` / `hidden lg:flex`)
- **RN03:** A autenticação (`getAuthUser()` em `layout.tsx`) permanece como Server Component — shell responsivo não altera a camada de auth
- **RN04:** Estado do carrinho em `/caixa` é preservado ao alternar entre tabs Produtos e Carrinho (não recarregar/resetar)
- **RN05:** Nenhum teste existente pode quebrar — mudanças são de markup/CSS e não tocam lógica testada

## Success Metrics

| Métrica | Definição | Target | Fonte |
|---|---|---|---|
| Zero overflow horizontal | Nenhuma rota do app gera scroll horizontal em 375px de largura (iPhone SE) | 0 rotas com overflow | Chrome DevTools Responsive Mode — viewport 375×667 |
| Bottom nav funcional | Todos os 5 ícones e drawer "Mais" navegam para a rota correta; ícone ativo destacado em indigo | 5/5 ícones + 4/4 drawer | Chrome DevTools viewport 375×667 — desenvolvedor percorre cada rota e verifica navegação + destaque ativo |
| Sidebar preservada em desktop | Em viewport ≥ 1024px, sidebar visível e bottom nav ausente em todas as 14 rotas protegidas | 0 regressões visuais | Chrome DevTools viewport 1280×800 — desenvolvedor percorre as mesmas 14 rotas |
| Caixa mobile usável | Tab "Produtos" lista produtos com busca; tab "Carrinho" mostra itens + total + botões Cobrar/Limpar; badge no tab Carrinho atualiza ao adicionar item; abertura de teclado na busca não empurra conteúdo para fora da tela | 4/4 comportamentos validados | Chrome DevTools viewport 375×667, Responsive → "Show keyboard" ativo durante teste de busca |
| Build limpo | `npm run build` sem erros após implementação | 0 erros | terminal local |
| Sem regressões de tipo | `npm run typecheck` sem erros | 0 erros | tsc |
| Sem regressões de teste | `npm test` sem novas falhas | 0 falhas novas | Vitest |

## References

- `{{doc:0008F}}` — sidebar-layout: componentes `AppSidebar`, `AppTopBar`, ícones, links e estrutura do shell que esta feature torna responsiva
- `{{doc:0009F}}` — page-redesign: restyle visual das páginas que esta feature torna responsivas; out-of-scope explícito de mobile em ambas as features
- `components/layout/AppSidebar.tsx` — sidebar a ser ocultada em mobile (`hidden lg:flex`)
- `components/layout/AppTopBar.tsx` — top bar que precisa do título visível em mobile
- `app/(app)/layout.tsx` — shell principal a ser refatorado para breakpoint responsivo
- `components/caixa/CashierScreen.tsx` — implementação atual do caixa (layout duas colunas a ser substituído por tabs em mobile)
- `docs/design/PDVApp.jsx.reference` — design de referência visual que definiu a sidebar; não define mobile layout

---

## Addendum: Additional Deliveries

| Entrega | Descrição | Justificativa |
|---------|-----------|---------------|
| `components/caixa/CaixaShell.tsx` (novo) | Shell client com tabs Caixa + Notas a Receber; CSS-hide preserva estado do carrinho | Solicitado pelo usuário durante validação: necessidade de consultar fiados pendentes sem sair da tela de caixa |
| `components/caixa/PaymentDialog.tsx` (scope extension) | Step de sucesso universal para todos os métodos de pagamento; `printInBrowser()` com janela de cupom 280px; label fiado neutro | Solicitado pelo usuário: impressão de cupom para todos os métodos + ocultar "fiado" do cliente |
| `app/(app)/caixa/receipt-actions.ts` (novo server action) | `getSaleReceiptAction` com RLS + duplo filtro `saleId + tenantId`; validação Zod UUID; retorna `ReceiptDto` | Suporte à impressão no browser; RN01 aceito como extensão documentada — sem modificação de actions/services existentes |
| Widget QTD em CashierScreen | State `preQty` na barra de busca; `addProductWithQty` acionado no clique; reset a 1 pós-add | Solicitado pelo usuário: definir quantidade antes de selecionar o produto |
| Clientes em AppSidebar NAV_SECONDARY | Link `/financeiro/clientes` na navegação lateral desktop | Solicitado pelo usuário: acesso rápido ao cadastro de clientes fiado |

**Impact:** Aumentou o scope da feature 0010F de "apenas layout responsivo" para "caixa operacional mobile completo com fiado e impressão". Nenhuma mudança em services, schema ou banco além de `receipt-actions.ts`.
