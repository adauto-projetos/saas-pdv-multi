# Review: 0003F — Estoque

> **Date:** 2026-06-10 | **Branch:** feature/0003F-estoque

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — 0 erros |
| Spec Compliance | ✅ PASSED | 17/17 itens; RF01–RF08, RN01–RN08 cobertos |
| Code Review Score | ✅ PASSED | 8.5/10 pós-correções (backend 9, frontend 8) — threshold ≥ 7 |
| Product Validation | ✅ PASSED | RF: 8/8, RN: 8/8 |
| Validation Gates | ✅ PASSED | `typecheck → 0` · `lint → 0` · `test → 0 (99 passed)` · `build → 0` |
| **Overall** | **✅ PASSED** | **Pronto para merge** |

> Reviewed by: /add.review (2 reviewers paralelos: backend/database + frontend) · model: claude-opus-4-8

## Spec Compliance Audit

SPEC_AUDIT_STATUS = **COMPLIANT**. `tasks.md` 100% ticado; `Requirements Coverage` mapeia RF01–RF08 + RN01–RN08; sem STALE TICK.

## Code Review Summary

**0 falhas críticas reais de segurança.** O retrofit do `finalizeSale` foi auditado: `decrementProductStock` removido sem órfãos, `recordSaleExit` na mesma transação da venda, sinal correto (−qty), `sale_id` setado, sem dupla baixa, itens duplicados mesclados antes. Regressão da 0002F verde.

### Corrigido nesta review (auto-correção)

| ID | Sev | Arquivo | Correção |
|----|-----|---------|----------|
| C1/M1 | CRIT/MED | stock-service.ts | ajuste seta o estoque **direto** na contagem (`setProductStock`) — elimina drift de float; delta do log arredondado a 3 casas |
| H2 | HIGH | stock/data.ts | `selectMovements` ignora datas inválidas (não quebra a query) |
| L1 | LOW | stock-movements.ts | CHECK de sinal por tipo (entrada > 0, saída < 0) |
| L3 | LOW | estoque/actions.ts | `setMinStockAction` revalida `/products` (realce atualiza) |
| L4 | LOW | seed.ts | `seedProduct` aceita `minStock` |
| C-1/C-2 | CRIT/IMP | StockMovementDialog.tsx | guarda cliente `entrada > 0` + `min` condicional |
| C-3/C-4/U-3 | IMP | MovementHistory.tsx | estados de **loading** e **erro**; some o flash de vazio |
| SP-1 | IMP | MovementHistory.tsx | **filtro de período** (De/Até) — RF05 agora completo na UI |
| C-5/U-4 | IMP/LOW | StockMovementDialog.tsx | limpa produto após salvar; reseta quantidade ao trocar de modo |
| A-1/A-2/A-3 | CRIT/IMP | ProductPicker.tsx | ARIA combobox/listbox + `id` + `aria-label` do "trocar" |
| A-4 | LOW | MovementHistory.tsx | labels visíveis nos filtros |
| U-2 | MED | LowStockList.tsx | `min` nulo mostra "—" |
| Q-3 | MED | StockMovementDialog.test.tsx | + teste do caminho **ajuste** (countedQuantity) |
| Test gap | IMP | MovementHistory.test.tsx | novo teste (render + filtro por tipo) |

### Avaliado e dispensado (não-bloqueante)

- **C2 (silent zero-row):** mitigado pela **FK** `stock_movements.product_id → products` — produto inexistente faz o INSERT do movimento falhar (rollback), sem ghost movement.
- **H1 (pgEnum vs text+CHECK):** padrão do projeto (igual `unit`); CHECK no DB cobre.
- **Q-1 (ProductPicker duplica ProductSearch):** aceito; a divergência de ARIA foi corrigida. Extrair hook compartilhado fica para refactor futuro.

### Known Issues / Deferred

- Limpar `min_stock` de um produto **pela tela de edição** não persiste (o "" vira undefined = "não alterar"). Set funciona; limpar via `setMinStockAction(null)`. Edge raro — tratar depois.
- Fuso horário no histórico/datas usa o fuso do servidor (consistente com a 0002F; resolver na feature #6).

## Product Validation

| Faixa | Resultado |
|---|---|
| RF01–RF08 | ✅ todos implementados e testados |
| RN01–RN08 | ✅ todos (RLS, ajuste+log atômico, sinal, estoque negativo, numeric(10,3), user da sessão, sale_id) |
| Retrofit 0002F | ✅ venda registra `saída` sem quebrar a venda |

**Product Status: PASSED.**
