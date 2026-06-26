---
id: BRN-liberacao-meses-flexivel
type: brainstorm
created: 2026-06-25
updated: 2026-06-25
related: [0011F]
---

## TL;DR

Exploração sobre o fluxo de cobrança do PDV: lojista se cadastra sozinho, testa 7 dias, é travado, paga via PIX e o founder libera manualmente. O fluxo inteiro já existe na feature {{doc:0011F}} (super admin + assinatura). O único gap surgido na conversa: hoje a liberação é fixa em **+30 dias**; o desejo é poder liberar **N meses de uma só vez** via campo livre. Próximo passo é formalizar essa extensão em `/add.new`.

## TOC

- [Questions Explored](#questions-explored)
- [Candidate Directions](#candidate-directions)
- [Open Threads](#open-threads)

## Questions Explored

- O cadastro é auto-serviço ou criação manual pelo founder? → Auto-serviço (lojista cria sozinho), já implementado.
- O fluxo trial → suspensão → cobrança → liberação manual precisa ser construído? → Não, já existe na 0011F.
- Existe integração de pagamento (PIX/gateway)? → Não; cobrança é manual via WhatsApp `13 99130-6911`, founder atualiza a validade na mão.
- Qual o gap real frente ao que o lojista/founder precisa? → Liberar mais de um mês numa única ação.
- Como o founder informa a quantidade de meses? → Campo livre (digita o número), não botões fixos.
- A sessão tocou em automatizar a cobrança (gateway/PIX automático) ou liberar várias lojas em lote? → Não; ambos ficaram fora de escopo por intenção — o foco foi só a liberação de N meses para uma loja.

## Candidate Directions

- **Campo livre de meses na liberação** — founder digita quantos meses liberar; o sistema soma sobre a validade atual (acumula, igual ao comportamento de hoje).
  - **Pros:** flexível para qualquer combinação (1, 3, 6, 12...); reaproveita o fluxo de acúmulo já existente; menor esforço — parametriza algo que já roda fixo.
  - **Cons:** campo livre permite digitação errada (ex: número muito alto por engano); sem regra de negócio que limite o máximo, vira risco de liberar tempo demais sem querer.
  - **Open issues:** validação em duas camadas — UI (só número inteiro positivo) e regra de negócio (teto máximo de meses); mensagem de confirmação exibindo a nova validade antes de aplicar.

- **Botões fixos (1/3/6/12 meses)** — atalhos pré-definidos para os períodos comuns.
  - **Pros:** zero erro de digitação; clique único; deixa explícitos os planos que o founder pratica.
  - **Cons:** engessa períodos fora da lista; exige uma combinação extra para valores incomuns.
  - **Open issues:** descartado nesta conversa — founder prefere campo livre.

## Open Threads

- Existe um teto de meses por liberação (ex: 1–24) para evitar erro de digitação? Decidir antes de implementar.
- A confirmação atual ("+30 dias") precisa passar a exibir a nova validade calculada a partir dos N meses informados?
- O acúmulo sobre `validUntil` permanece a regra (somar N meses a partir do maior entre validade atual e hoje)? Tratar como pergunta aberta, não como decisão tomada — confirmar explicitamente no `/add.new` antes de implementar.
- O modelo de cobrança continua **manual via WhatsApp** (sem gateway/PIX automático)? Assumido como permanente para esta extensão; o about.md deve excluir explicitamente automação de pagamento.
- Próximo comando: `/add.new` para transformar esta extensão da 0011F em about.md.
