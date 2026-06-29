---
id: 0021C
type: feature-about
slug: doc-convencoes
status: draft
created: 2026-06-29
updated: 2026-06-29
related: [0019H, 0020F]
---

# Chore 0021C — Doc & Convenções (Unidade 3 da remediação da auditoria)

## TL;DR

Terceira e última unidade da remediação da auditoria 2026-06-28 ({{doc:0019H}} e {{doc:0020F}} fecharam as duas primeiras). Agrupa 5 itens de documentação e convenção de **risco zero ao runtime**: atualizar o CLAUDE.md stale, centralizar schemas Zod inline em `lib/validation/`, documentar vars de produção no `.env.example`, padronizar nome de arquivo de componente em PascalCase, e limpezas cosméticas. Nenhuma mudança de comportamento de produto. Decisões fechadas na discovery: CLAUDE.md permanece em PT-BR; `/add.xray` fica para chore própria; conflito de porta 80 vira nota de doc (sem mexer no deploy ativo).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A auditoria 2026-06-28 apontou doc stale e convenções inconsistentes que degradam o desenvolvimento assistido por IA e a consistência do código, sem afetar o runtime.

- **CLAUDE.md descreve o projeto como "Scaffolded — feature 0001F"** enquanto existem ~20 features e service layer completo (`CLAUDE.md:5-7`). Toda sessão de IA lê esse arquivo e parte de premissa errada. Sinal: 🟠 High na auditoria.
- **Seção "Implementation Patterns" diz "Sem código ainda"** e aponta para a skill `project-patterns`, que nunca foi gerada — ponteiro morto (`CLAUDE.md:63-65`). Sinal: 🟠 High.
- **Schemas Zod definidos inline nas actions** em vez de `lib/validation/`, violando o Architecture Contract (`app/(auth)/actions.ts:14-22`, `app/(app)/caixa/receipt-actions.ts:12`). Sinal: 🟡 Medium.
- **Nome de arquivo de componente inconsistente** — 84 PascalCase (`caixa/`, `comandas/`, `auth/`) vs 28 kebab-case (`components/admin/`). Sinal: 🟢 Low.
- **Comentário stale citando "Supabase"** em projeto que nunca usou Supabase (role real é `app_user`) (`db/index.ts:6-9`). Sinal: 🟢 Low.
- **`POSTGRES_PASSWORD` (var de prod) não documentada** no `.env.example` (`docker-compose.prod.yml`). Sinal: 🟢 Low.
- **`components/PDVApp.jsx`/`.css`** soltos fora do padrão, sem nenhum import no app (confirmado: zero referências). Sinal: 🟢 Low.
- **Gap de ID de feature 0012** (0011F → 0013F) sem confirmação de intencionalidade. Sinal: 🟢 Low.
- **Conflito potencial de porta 80** entre prod (`80:3000`) e proxy (`80:80`) se rodados no mesmo host. Sinal: 🟢 Low.

Workaround atual: nenhum — os itens convivem, mas a doc stale induz erro de IA e a inconsistência de naming/validação acumula dívida.

## Users

| Role | Goal com este chore | Pain atual |
|---|---|---|
| Founder (beginner, pt-br) | CLAUDE.md reflete o estado real do projeto na própria língua | Doc diz "scaffold sem código"; decisões de IA partem de premissa errada |
| IA assistente (toda sessão) | Ler contexto fiel e padrões vivos do projeto | "Status"/"Patterns" stale + ponteiro morto para skill inexistente |
| Dev (manutenção) | Convenção única de naming e validação centralizada | Naming misto (PascalCase vs kebab); Zod espalhado nas actions |

## Scope

### Includes

- **Atualizar CLAUDE.md (em PT-BR):** reescrever "Status" para refletir MVP+ (~20 features, v0.11.0, service layer completo) e reescrever "Implementation Patterns" removendo o ponteiro morto para `project-patterns` (registrar que `/add.xray` será rodado em chore própria).
- **Centralizar Zod:** mover `loginSchema`/`signUpSchema` e `receiptSchema` das actions para `lib/validation/`; as actions passam a importar de lá.
- **Documentar vars de prod no `.env.example`:** bloco comentado com `POSTGRES_PASSWORD` e nota de que `SESSION_SECRET` e `R2_*` são obrigatórias em produção.
- **Padronizar naming de componente em PascalCase:** renomear os 15 arquivos de `components/admin/` (10 componentes + 5 `.test.tsx`, hoje kebab-case) para PascalCase, ajustando os imports (concentrados em `app/(admin)/superadmin/page.tsx`); atualizar a regra no CLAUDE.md (arquivo de componente de app React = PascalCase; primitivos shadcn/ui em `components/ui/` = kebab-case por convenção oficial do shadcn; demais arquivos = kebab-case).
- **Limpezas cosméticas (4 sub-itens, todos confirmados em escopo):** (a) corrigir o comentário "Supabase" em `db/index.ts:6-9` (citar `app_user`/RLS reais); (b) remover `components/PDVApp.jsx` e `.css` — confirmado sem imports no app via grep estático de `PDVApp` em `*.tsx/*.ts/*.jsx/*.js` (excluindo `node_modules`), zero referências de entrada no código da aplicação; (c) documentar a confirmação do gap de ID 0012 como intencional; (d) adicionar nota nos composes de que `80:3000` (prod) e `80:80` (proxy) são topologias mutuamente exclusivas.

### Does NOT Include

- **Rodar `/add.xray` / gerar a skill `project-patterns`** — operação generativa pesada (dispatch de agentes + nova skill); misturar com limpeza cosmética incharia o review. Vai para chore própria após o merge.
- **Traduzir CLAUDE.md para inglês** — o founder é beginner e lê o arquivo em PT-BR toda sessão; a regra `add-claude-md-style` (inglês) fica registrada como exceção consciente, não aplicada.
- **Alterar mapeamentos de porta no código** — mexer em `docker-compose.prod.yml`/`proxy.yml` pode quebrar o deploy ativo em pdv.art.br; resolve-se por nota de doc, não por mudança de runtime.
- **Renomear os arquivos já em PascalCase** — são a maioria de-facto e já corretos pela convenção escolhida; apenas a pasta `admin/` (15 arquivos kebab) será renomeada.
- **Renomear os 13 primitivos shadcn/ui em `components/ui/`** — `button.tsx`, `dialog.tsx`, `card.tsx` etc. são kebab-case por convenção oficial do shadcn (geração via CLI); manter alinha o projeto ao upstream e evita churn em todo import de UI.
- **Qualquer mudança de comportamento de produto** — por definição esta unidade é risco zero ao runtime.

## Success Metrics

| Metric | Target | Source |
|---|---|---|
| Itens de trabalho fechados (9 achados da auditoria agrupados em 5 itens: CLAUDE.md, Zod, `.env.example`, naming, cosméticos — este último cobre 4 achados) | 5 de 5 itens / 9 de 9 achados | {{doc:0019H}} mapa de rastreabilidade + changelog 0021C |
| Validation gates do projeto | typecheck + lint + test + build exit 0 | CLAUDE.md → Validation Gates |
| Naming de componente de app consistente | 0 arquivos kebab fora de `components/ui/` (primitivos shadcn ficam kebab) | `find components -name "*.tsx"` exceto `components/ui/` |
| Schemas Zod inline nas actions | 0 (todos em `lib/validation/`) | grep `z.object` em `app/**/actions.ts` |

## References

- {{doc:0019H}} — Unidade 1 (Segurança & Deploy), contém o mapa de rastreabilidade 13-de-13 e as 3 unidades.
- {{doc:0020F}} — Unidade 2 (Camada de Dados & Services).
- {{doc:BRN-remediacao-auditoria}} — brainstorm que definiu o agrupamento em 3 unidades e as decisões de naming/migrations.
- {{doc:AUDIT-2026-06-28}} — auditoria técnica de origem; itens P2/P3/P4 desta unidade nos achados de Architecture, Documentation, Data e Infrastructure.
