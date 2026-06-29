---
id: BRN-remediacao-auditoria
type: brainstorm
created: 2026-06-28
updated: 2026-06-28
related: [AUDIT-2026-06-28]
---

# Brainstorm — Como organizar a remediação da auditoria 2026-06-28

## TL;DR

Sessão para decidir como atacar as 13 recomendações da auditoria técnica ({{doc:AUDIT-2026-06-28}}) sem misturar trabalho de naturezas diferentes. Premissa inicial do founder — "resolver tudo numa feature única com sub-features" — foi descartada (mapa de cobertura 13-de-13 em [Rastreabilidade](#rastreabilidade-das-13-recomendações)): os itens variam de hardening de segurança urgente a limpeza cosmética, e juntá-los num só fluxo trava review e teste. Direção escolhida para explorar: **3 unidades de trabalho agrupadas por tema, arquivos e perímetro de teste** (cada unidade é validável como bloco coeso, sem sobrepor o teste das outras), sequenciadas por risco decrescente. Nenhuma decisão de implementação fechada aqui — isso fica para `/add.hotfix` (Unidade 1) e `/add.new` (Unidades 2 e 3).

## TOC

- [Questions Explored](#questions-explored)
- [Candidate Directions](#candidate-directions)
- [Rastreabilidade das 13 recomendações](#rastreabilidade-das-13-recomendações)
- [Open Threads](#open-threads)

## Questions Explored

- As 13 recomendações da auditoria cabem numa única "feature"?
- O que conta como feature (capacidade de produto) vs. hardening/refactor/chore neste ecossistema?
- Como agrupar itens heterogêneos para que cada lote tenha um review e um teste coerentes?
- Em que ordem atacar para reduzir primeiro o risco que afeta loja/dinheiro?

> A verificação de RLS no deploy (travar boot vs. reprovar CI) e a estratégia de migrations foram levantadas mas não decididas — ver [Open Threads](#open-threads).

## Candidate Directions

- **Feature única com sub-features** — colocar as 13 recomendações num só fluxo de feature — prós: um único branch, uma visão geral — contras: mistura urgência de segurança com cosmético; review enorme e impossível de testar como unidade; "feature" no ecossistema é capacidade de produto pro lojista, e nada disso é — open issues: nenhum (direção descartada na sessão).

- **Três unidades agrupadas por tema/risco** (direção preferida para levar adiante):
  - **Unidade 1 — Segurança & Deploy** — `SESSION_SECRET` fail-fast em prod, RLS sempre reaplicado + assertion em `pg_policies`, `npm audit fix` (undici) — prós: protege o dado mais sensível (sessão do dono + isolamento entre lojas); itens pequenos, tema único; cabe num só branch — contras: exige decisão sobre o comportamento da verificação de RLS — open issues: rota `/add.hotfix`; é a primeira a fazer.
  - **Unidade 2 — Camada de dados & services** — mover persistência do super-admin para service/repository, resolver a história de migrations (migration `0000` stale), índice em `override_log`, batch do N+1 em `listOperators`, teste de regressão de `tenant_id` — prós: tudo toca `lib/services/` + `db/`, um só review estrutural; estabiliza o backend — contras: a decisão de migrations (push-only vs. regenerar) é de estratégia, não mecânica — open issues: rota `/add.new` com plan; segunda na fila.
  - **Unidade 3 — Doc & convenções** — atualizar CLAUDE.md + rodar `/add.xray`, centralizar Zod em `lib/validation/`, padronizar nome de componentes, documentar vars de prod no `.env.example`, limpezas cosméticas (comentário Supabase, `PDVApp.jsx`, gap de ID 0012, porta 80) — prós: risco zero ao runtime; agrupável num lote único de chore — contras: baixa prioridade pode ser adiada indefinidamente se não for agendada — open issues: rota `/add.new` (chore) ou edição direta; última na fila.

## Rastreabilidade das 13 recomendações

Cobertura 13-de-13 das recomendações de {{doc:AUDIT-2026-06-28}}. Nenhuma deixada de fora; cada item cai em exatamente uma unidade.

| Unidade | Recomendações cobertas (prioridade na auditoria) |
|---|---|
| **U1 — Segurança & Deploy** | P1 fail-fast `SESSION_SECRET`; P1 RLS sempre reaplicado + assertion `pg_policies`; P1 `npm audit fix` (undici) |
| **U2 — Dados & services** | P2 mover super-admin pra service/repository; P2 resolver migrations; P3 índice `override_log`; P3 batch N+1 `listOperators`; P3 teste de regressão `tenant_id` |
| **U3 — Doc & convenções** | P2 atualizar CLAUDE.md + `/add.xray`; P3 centralizar Zod; P4 documentar vars de prod; P4 padronizar nome de componente; P4 limpezas cosméticas |

> Total: 3 (U1) + 5 (U2) + 5 (U3) = 13.

## Próximos passos por unidade

Fluxo de comando confirmado na sessão. As três unidades não exigem novo brainstorm; este doc é a discovery comum.

- **U1** → `/add.hotfix` (hardening urgente, sem plan formal) — primeira, após o founder confirmar o disparo.
- **U2** → `/add.new` → `/add.plan` (mudança estrutural exige plan) — segunda.
- **U3** → `/add.new` em modo chore, ou edição direta para os itens triviais — terceira.

## Open Threads

- **Comportamento da verificação de RLS no deploy** — travar o boot da aplicação (mais seguro, mas pode bloquear um deploy fora de horário) **ou** apenas reprovar o CI (mais permissivo)? Bloqueia o fechamento da Unidade 1.
- **Estratégia de migrations** — assumir push-only oficialmente (documentar, aposentar `db:migrate`, tratar o snapshot como fonte) **ou** regenerar as migrations com `drizzle-kit generate` e adotar `db:migrate`? Bloqueia a Unidade 2.
- **Convenção de nome de componente** — padronizar em PascalCase (maioria de-facto) **ou** kebab-case (regra atual no CLAUDE.md)? Decisão impacta CLAUDE.md e renomeações na Unidade 3.
- **Ponto de entrada** — começar pela Unidade 1 via `/add.hotfix` é o consenso da sessão; falta o founder confirmar o disparo (go/no-go administrativo, não bloqueia o conteúdo das unidades).
