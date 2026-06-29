---
id: CHG0023
type: changelog
date: 2026-06-29
related: [0022C, 0021C]
---

# CHG0023 — Chore 0022C: X-Ray & Skill project-patterns

## TL;DR

Roda o `/add.xray` que o chore {{doc:0021C}} deixou como follow-up: mapeia a arquitetura e gera a skill local `project-patterns` (`.codeadd/skills/project-patterns/` — frontend 15 tópicos, backend 12, database 9; ~36 no total, com refs `path:line`) mais uma auditoria de qualidade pontual em `docs/code-quality-review.md`. No repo entram só os artefatos versionáveis: o ponteiro de "Implementation Patterns" no CLAUDE.md passa a apontar para a skill agora existente (deixou de dizer "não gerada"), o bloco de Validation Gates vira `{"validation_gates":{...}}` machine-readable, e o contexto é propagado para `AGENTS.md` (+ shell policy Windows/Git Bash) e `GEMINI.md`. A própria skill fica local por design do add-pro (`.codeadd/` é gitignored — cache regenerável, não artefato de produto). Sem mudança de comportamento de produto.

## Changes

- docs(patterns): gerada a skill `project-patterns` via dispatch paralelo de 4 analisadores (frontend/backend/database + code-quality); `.codeadd/skills/project-patterns/{SKILL.md,frontend.md,backend.md,database.md}` com frontmatter + TL;DR + TOC + chunks topic-first e exemplos `path:line` — `pattern-search.sh --list` lista 3 áreas / ~36 tópicos — {{doc:0022C}}
- docs(claude): "Implementation Patterns" reescrito de "skill ainda não gerada" para ponteiro vivo (ONDE × COMO) à skill `project-patterns`; bloco de Validation Gates normalizado para `{"validation_gates":{lint,typecheck,test,build}}` (formato lido pelo Gate 7 do `/add.review`) — {{doc:0022C}}
- docs(engines): `GEMINI.md` criado como cópia idêntica do CLAUDE.md; `AGENTS.md` criado como cópia + seção "Shell policy (Windows)" apontando para o Git Bash — {{doc:0022C}}
- docs(quality): `docs/code-quality-review.md` — auditoria pontual (SOLID 8/10, Clean Code 8/10): backend limpo (layer contract respeitado, ~0 `any`, erros funilados, suite de isolamento de tenant), dívida concentrada na UI (222 inline `style`, componentes client grandes, helpers de estilo duplicados) registrada para refactor próprio — {{doc:0022C}}

## Breaking

none — risco zero ao runtime. Nenhum arquivo de código (`app/`, `components/`, `lib/`, `db/`) alterado; apenas docs e arquivos de contexto de IA. typecheck e test (525) verdes pós-mudança.

## Migration

Nenhuma. A skill `project-patterns` é local e regenerável via `/add.xray` (não versionada — `.codeadd/` gitignored por design). Um clone novo roda `/add.xray` para reconstruí-la; CLAUDE.md/AGENTS.md/GEMINI.md já vêm versionados.

## Quick Ref

```json
{
  "id": "C0022",
  "domain": "architecture-discovery",
  "touched": [
    "CLAUDE.md",
    "AGENTS.md",
    "GEMINI.md",
    "docs/code-quality-review.md",
    ".codeadd/skills/project-patterns/"
  ],
  "patterns": [
    "xray-architecture-mapping",
    "jit-pattern-skill",
    "multi-engine-context-propagation",
    "machine-readable-validation-gates"
  ],
  "keywords": [
    "add.xray",
    "project-patterns",
    "pattern-search",
    "code-quality",
    "AGENTS.md",
    "validation_gates"
  ]
}
```
