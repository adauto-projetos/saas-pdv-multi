---
id: 0007F
type: feature-about
slug: impressao
status: specified
created: 2026-06-14
updated: 2026-06-16
related: [0002F, 0006F, 0003F, 0004F, 0005F, PRODUCT, OWNER]
---

## TL;DR

Integra uma **impressora térmica USB** ao fluxo de venda: ao **lançar um item** na comanda, imprime automaticamente o **pedido de cozinha** (número sequencial + produto + quantidade + observação); ao **fechar** uma venda (direta ou via comanda), imprime o **cupom simples** (itens, total, forma de pagamento, data). Falha de impressora **não bloqueia** a operação — venda completa normalmente, toast avisa o operador e o erro é registrado em log. O operador pode **reimprimir** qualquer cupom ou pedido. Config via variável de ambiente (`PRINTER_DEVICE`). Sem NFC-e/SAT — cupom simples (sem SEFAZ). Uma impressora para cozinha e caixa. Incompatível com Vercel serverless — requer servidor Node.js local (setup atual: Docker + Next.js local).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

O sistema fecha vendas e comandas corretamente, mas **nada chega à cozinha** e **nenhum papel vai ao cliente**. O garçom precisa gritar o pedido ou ir pessoalmente à cozinha; o cliente não recebe comprovante. Sem impressão, o sistema não se sustenta no uso real de uma lanchonete/bar.

- Quem é afetado: operador/garçom (sem papel pra cozinha), cliente (sem cupom), dono (sem comprovante de venda).
- O que falta: integração com impressora térmica nos dois momentos críticos — lançamento de item e fechamento de venda.
- Workaround atual: grito/recado verbal para cozinha; sem cupom para cliente.

## Users

| role | goal | pain |
|---|---|---|
| Garçom/operador | Pedido chega na cozinha sem sair do caixa | Tem que ir pessoalmente comunicar o pedido |
| Cozinheiro | Receber pedidos em papel com observações | Depende de comunicação verbal; perde pedidos |
| Cliente | Receber comprovante do que pagou | Sem cupom, sem confiança no valor cobrado |
| Dono | Ter rastro impresso de cada venda | Sem papel, auditoria fica só no sistema |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio). Agrupados por frente.

### Impressão de cozinha

- **RF01:** Ao **lançar um item** numa comanda aberta (`addComandaItem`), o sistema imprime automaticamente na impressora USB um **pedido de cozinha** contendo: número sequencial do pedido (por tenant, reinicia a cada dia), rótulo da comanda (ex: "Mesa 3"), nome do produto, quantidade + unidade, observação (se houver). Impressão é iniciada após o item ser gravado no banco.
- **RF02:** O **número sequencial** do pedido de cozinha é gerado por tenant, por dia calendario (UTC-3). Começa em 1 a cada dia; incrementa a cada impressão de cozinha bem-sucedida. Exibido no formato `#001`, `#002`, etc.

### Impressão de cupom (recibo de venda)

- **RF03:** Ao **fechar uma venda** — tanto por `closeComanda` quanto por `finalizeSale` (venda direta) — o sistema imprime automaticamente na impressora USB um **cupom simples** contendo: nome do estabelecimento (tenant), data e hora, lista de itens (nome, quantidade, unidade, preço unitário, subtotal), total em reais, forma de pagamento (Dinheiro / Pix / Cartão / Fiado + nome do cliente se fiado), rodapé fixo ("Obrigado pela preferência!").
- **RF04:** O cupom **não é fiscal** — sem CNPJ, sem ICMS, sem integração SEFAZ, sem assinatura digital. É um recibo interno simples.

### Falha de impressora

- **RF05:** Se a impressora estiver offline ou retornar erro, a **venda/lançamento completa normalmente** (sem bloqueio). O sistema exibe toast de aviso: "Impressora offline — reimprima manualmente". O erro é registrado no `print_log` (status = 'falhou').
- **RF06:** Não há retry automático. O operador usa a ação de reimpressão (RF07) para recuperar.

### Reimpressão

- **RF07:** Qualquer usuário autenticado do tenant pode **reimprimir** qualquer cupom (por `sale_id`) ou pedido de cozinha (por `comanda_item_id`) a qualquer momento após o fato, usando os dados imutáveis já gravados (`SaleDto` / `ComandaItemDto`). Disponível via botão na tela de comandas e histórico de vendas. Sem restrição de papel (garçom e dono têm o mesmo acesso no MVP).

### Log de impressão

- **RF08:** Cada tentativa de impressão (sucesso ou falha) é registrada em `print_logs`: `id`, `tenant_id`, `type` ('cozinha' | 'cupom'), `trigger_id` (sale_id ou comanda_item_id), `status` ('ok' | 'falhou'), `error_message` (nullable), `printed_at`, `printed_by` (userId). Isolado por tenant (RLS).

### Regras de negócio

- **RN01:** Todo print é isolado por tenant (RLS em `print_logs`; config lida do contexto de tenant).
- **RN02:** O número sequencial de cozinha (`kitchen_order_seq`) é por tenant + dia (UTC-3). Reset à meia-noite. Incremento atômico (não repete mesmo com concorrência).
- **RN03:** Reimpressão usa dados imutáveis — mesmo template, mesmo `SaleDto`/`ComandaItemDto` já gravados. Não recalcula.
- **RN04:** Falha de print não reverte a transação de venda/lançamento — print é side-effect, não parte do core da venda.
- **RN05:** Cupom sem dados fiscais: sem CNPJ do estabelecimento, sem CPF do cliente, sem ICMS, sem chave de acesso SEFAZ.
- **RN06:** Config de impressora via variável de ambiente `PRINTER_DEVICE` (ex: `\\.\COM3` no Windows, `/dev/usb/lp0` no Linux). Uma única impressora para cozinha e cupom. Prints são enviados sequencialmente (não concorrentes) — o driver USB não recebe dois jobs simultâneos; segundo job aguarda o primeiro completar.
- **RN07:** Feature requer servidor Node.js local com acesso USB — **incompatível com Vercel serverless**. Documentado como limitação de deploy; MVP roda local.
- **RN08:** O nome do estabelecimento no cupom é lido do tenant (campo `name` na tabela `tenants`).

### Requisitos não-funcionais

- **RNF01:** Print deve completar em < 3 s em condições normais (velocidade padrão de impressora térmica 80mm).
- **RNF02:** Biblioteca: `escpos` + `@escpos/usb` (ou equivalente) para acesso ao dispositivo USB via Node.js.
- **RNF03:** Formato de papel: 80mm (padrão mercado); 48 colunas de caracteres.

## Scope

### Includes

- Impressão de **pedido de cozinha** no lançamento de item na comanda (RF01, RF02).
- Impressão de **cupom simples** no fechamento de venda direta e de comanda (RF03, RF04).
- **Falha suave**: venda completa, toast, log (RF05, RF06).
- **Reimpressão** de cupom e pedido por operador (RF07).
- **Log de impressão** por tentativa (RF08).
- **Número sequencial** diário por tenant no pedido de cozinha (RN02).

### Does NOT Include

- **NFC-e / SAT / CFe** — documento fiscal eletrônico com SEFAZ, CNPJ, assinatura digital: complexidade de meses, exige CNPJ (founder não tem). Fase 3 posterior.
- **Tela de configuração de impressora** — config via `PRINTER_DEVICE` env var; sem UI de settings.
- **Duas impressoras separadas** (cozinha vs caixa) — uma impressora única para ambos; donos maiores adicionam depois.
- **Impressora de rede (TCP/IP)** — USB apenas no MVP; rede em versão futura.
- **Auto-discovery de impressora** — path manual via env var.
- **Retry automático** — operador usa reimpressão manual.
- **Impressão de balança** (etiqueta de peso) — escopo separado.
- **KDS (Kitchen Display System)** — tela digital na cozinha em vez de papel; fora do MVP.
- **Impressão fiscal para venda direta de mercado via `finalizeSale`** — cupom impresso normalmente; sem nota fiscal eletrônica.

## Success Metrics

| metric | target | source |
|---|---|---|
| Pedidos de cozinha impressos / itens lançados | ≥ 95% | query `print_logs` (type=cozinha, status=ok) / contagem `comanda_items` |
| Cupons impressos / vendas fechadas | ≥ 95% | query `print_logs` (type=cupom, status=ok) / contagem `sales` |
| Tempo de impressão (disparado → ok no log) | < 3 s | `printed_at` − trigger timestamp nos logs |
| Falhas que bloquearam venda | 0 | (RF05/RN04: nenhuma venda deve falhar por print) |

## References

- {{doc:0006F}} — Comanda/mesa: `addComandaItem` (trigger cozinha), `closeComanda` (trigger cupom); `ComandaItemDto.observation`.
- {{doc:0002F}} — Venda rápida: `finalizeSale` (trigger cupom direto); `SaleDto` com snapshot completo.
- {{doc:0004F}} — Financeiro: customer name para fiado no cupom; paymentMethod label.
- {{doc:0005F}} — Lucro: `costCentsSnapshot` em `sale_items`; `tenants.name` para cabeçalho do cupom.
- {{doc:PRODUCT}} — Fase 3 do roadmap; risco de impressão de cozinha fora do MVP.
- {{doc:OWNER}} — Perfil beginner; sem CNPJ (NFC-e/SAT fora de escopo).
