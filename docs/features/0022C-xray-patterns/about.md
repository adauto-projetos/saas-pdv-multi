---
id: 0022C
type: feature-about
slug: xray-patterns
status: draft
created: 2026-06-29
updated: 2026-06-29
related: [0021C]
---

# Chore 0022C — X-Ray & Skill project-patterns

## TL;DR

Roda o `/add.xray` (operação generativa deixada fora de escopo pelo chore {{doc:0021C}}): mapeia a arquitetura do projeto e gera a skill local `project-patterns` (`.codeadd/skills/project-patterns/` — frontend/backend/database, ~36 tópicos com refs `path:line`), além de uma auditoria de qualidade pontual (`docs/code-quality-review.md`). Atualiza o ponteiro de "Implementation Patterns" no CLAUDE.md (que o 0021C deixou registrado como "skill ainda não gerada") para apontar para a skill agora existente, padroniza o bloco `validation_gates` em formato machine-readable, e propaga o contexto para `AGENTS.md`/`GEMINI.md` (outros engines). Sem mudança de comportamento de produto.

## Problem

O chore 0021C corrigiu o ponteiro morto no CLAUDE.md, mas deixou explícito que a skill `project-patterns` ainda **não existia** — toda sessão de IA precisava reconstruir os padrões do projeto a partir da discovery de cada feature. Faltava a camada transversal "COMO implementar" (state, validação, RLS, error handling) carregável sob demanda.

## Users

| Role | Goal com este chore | Pain atual |
|---|---|---|
| IA assistente (toda sessão) | Carregar padrões do projeto por área via `pattern-search.sh` (JIT) | Sem skill; padrões espalhados nas discoveries |
| Dev / Founder | CLAUDE.md aponta para padrões vivos; outros engines (Gemini/Codex) têm o mesmo contexto | Ponteiro registrado como "não gerado"; só CLAUDE.md existia |

## Scope

### Includes

- **Gerar a skill `project-patterns`** via dispatch paralelo de analisadores (frontend, backend, database) + analisador de qualidade — arquivos em `.codeadd/skills/project-patterns/` (SKILL.md índice + 3 áreas) e `docs/code-quality-review.md`.
- **Atualizar CLAUDE.md:** seção "Implementation Patterns" passa a apontar para a skill existente (ONDE × COMO); bloco de Validation Gates vira `{"validation_gates":{...}}` machine-readable.
- **Propagar contexto:** `GEMINI.md` (cópia idêntica do CLAUDE.md) e `AGENTS.md` (cópia + shell policy Windows/Git Bash).

### Does NOT Include

- **Versionar a skill no Git** — `.codeadd/` e `.claude/` são gitignored por design do add-pro ("managed by code-addiction"); a skill é cache local regenerável via `/add.xray`, não artefato do repo de produto. Só CLAUDE.md/AGENTS.md/GEMINI.md/`docs/code-quality-review.md` entram no commit.
- **Corrigir a dívida de UI apontada na auditoria** (222 inline `style`, componentes client grandes) — diagnóstico fica registrado em `docs/code-quality-review.md` para um refactor próprio.
- **Qualquer mudança de comportamento de produto** — risco zero ao runtime.

## Success Metrics

| Metric | Target | Source |
|---|---|---|
| Skill `project-patterns` funcional | `pattern-search.sh --list` lista 3 áreas, ~36 tópicos | `.codeadd/scripts/pattern-search.sh --list` |
| Ponteiro do CLAUDE.md | aponta para a skill (não mais "não gerada") | `CLAUDE.md → Implementation Patterns` |
| Context files dos engines | CLAUDE.md = GEMINI.md; AGENTS.md = CLAUDE.md + shell policy | diff dos 3 arquivos |
| Validation gates do projeto | typecheck + lint + test + build exit 0 | CLAUDE.md → Validation Gates |

## References

- {{doc:0021C}} — chore anterior que registrou o `/add.xray` como follow-up e deixou o ponteiro do CLAUDE.md preparado.
