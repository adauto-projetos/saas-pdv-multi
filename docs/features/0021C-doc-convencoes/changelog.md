---
id: CHG0022
type: changelog
date: 2026-06-29
related: [0021C, 0019H, 0020F]
---

# CHG0022 — Chore 0021C: Doc & Convenções (Unidade 3 da remediação da auditoria)

## TL;DR

Fecha a Unidade 3 (e última) da remediação da auditoria 2026-06-28 ({{doc:0019H}} e {{doc:0020F}} fecharam as duas primeiras): 9 achados de doc/convenção agrupados em 5 itens, todos de **risco zero ao runtime**. O `CLAUDE.md` stale ("Scaffolded — 0001F") passa a refletir o MVP+ real (v0.11.0, ~20 services) e perde o ponteiro morto para a skill `project-patterns`; os schemas Zod inline saem das actions para `lib/validation/`; o `.env.example` documenta as vars de produção e passa a ser versionado; os 15 arquivos de `components/admin/` migram de kebab-case para PascalCase (com a regra atualizada no CLAUDE.md); e 4 limpezas cosméticas (comentário Supabase→app_user, remoção do `PDVApp.jsx/css` órfão, confirmação do gap de ID 0012, nota de topologia da porta 80). Nenhuma mudança de comportamento de produto.

## Changes

- docs(claude): "Status" reescrito de "Scaffolded — 0001F" para "MVP+ em produção (pdv.art.br) v0.11.0, ~20 services"; "Implementation Patterns" perde o ponteiro morto para `project-patterns` (skill nunca gerada) e aponta para a discovery de cada feature; tabela de Conventions ganha a regra explícita de naming PascalCase × kebab (`components/ui/`) — {{doc:0021C}}
- refactor(validation): `loginSchema`/`signUpSchema` movidos de `app/(auth)/actions.ts` para `lib/validation/auth.ts` (novo); `receiptSchema` movido de `app/(app)/caixa/receipt-actions.ts` para `lib/validation/sale.ts` — actions passam a importar de `lib/validation/`, restaurando o Architecture Contract (0 `z.object` inline nas actions) — {{doc:0021C}}
- chore(env): `.env.example` documenta `POSTGRES_PASSWORD` e a obrigatoriedade de `SESSION_SECRET`/`R2_*` em produção; `.gitignore` ganha exceção `!.env.example` para o template (que só contém placeholders) passar a ser versionado — {{doc:0021C}}
- refactor(admin): 15 arquivos de `components/admin/` renomeados de kebab-case para PascalCase (10 componentes + 5 `.test.tsx`); imports ajustados em `app/(admin)/superadmin/page.tsx` e nos testes; primitivos `components/ui/` (kebab, convenção oficial shadcn) preservados — {{doc:0021C}}
- chore(cleanup): comentário stale "Supabase" em `db/index.ts` corrigido para citar `app_user`/RLS reais; `components/PDVApp.jsx`/`.css` órfãos removidos (zero imports no app); nota de topologia mutuamente exclusiva da porta 80 adicionada em `docker-compose.prod.yml` e `docker-compose.proxy.yml` (sem alterar mapeamentos); gap de ID 0012 documentado como intencional — {{doc:0021C}}

## Breaking

none — risco zero ao runtime. Os renames de arquivo mantêm os identificadores de componente e os imports foram atualizados no mesmo changeset; os schemas Zod movidos são idênticos (mesmas mensagens e regras); os comentários de compose não tocam mapeamentos de porta (preserva o deploy ativo em pdv.art.br). Nenhum comportamento de produto muda.

## Migration

Nenhuma migração de dados, schema ou API. Deploy normal pelo fluxo padrão; o `.env.example` versionado serve apenas de template (placeholders, sem segredos). Rollback: reverter o commit da chore restaura nomes de arquivo, schemas inline e textos de doc — nenhum estado de dados é afetado.

## Quick Ref

```json
{
  "id": "C0021",
  "domain": "documentation-conventions",
  "touched": [
    "CLAUDE.md",
    ".env.example",
    ".gitignore",
    "app/(auth)/",
    "app/(app)/caixa/",
    "app/(admin)/superadmin/",
    "lib/validation/",
    "components/admin/",
    "db/index.ts",
    "docker-compose.prod.yml",
    "docker-compose.proxy.yml"
  ],
  "patterns": [
    "centralized-validation-schemas",
    "component-file-naming-pascalcase",
    "stale-doc-remediation",
    "env-template-versioning",
    "topology-documentation"
  ],
  "keywords": [
    "CLAUDE.md",
    "zod",
    "lib/validation",
    "PascalCase",
    "env.example",
    "audit-remediation",
    "conventions"
  ]
}
```
