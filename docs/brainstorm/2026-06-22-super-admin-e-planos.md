---
id: BRN-super-admin-e-planos
type: brainstorm
created: 2026-06-22
updated: 2026-06-22
related: []
---

## TL;DR

Sessão explorou dois temas acoplados: um **painel super admin** (acesso exclusivo do founder a todas as lojas) e o **controle de assinatura mensal** (trial de 7 dias + cobrança manual via PIX). Hoje nada disso existe — `tenants` não tem estado de assinatura, não há papel global de super admin e a RLS isola 100% por loja. A sessão explorou um modelo de billing manual (founder recebe PIX e libera +30 dias) e um painel de gestão/suporte com impersonação auditada. Direções e questões em aberto abaixo; o próximo passo é formalizar via `/add.new` (provável duas features separadas).

## TOC

- [Questions Explored](#questions-explored)
- [Candidate Directions](#candidate-directions)
- [Open Threads](#open-threads)

## Questions Explored

- Quem é o super admin e o que ele pode fazer dentro do produto?
- Como o super admin entra numa loja para dar suporte sem pedir senha ao cliente?
- Como o founder protege a si mesmo desse acesso "que vê tudo"?
- Como uma loja deixa de ser gratuita e passa a pagar?
- O que acontece com a loja quando o período pago vence?
- Como o founder, recebendo PIX na mão, religa a loja?
- Os dados do cliente somem quando a conta vence?
- Como o founder enxerga o estado do negócio (quem está testando, quem paga, quem vence)?

## Candidate Directions

### Painel super admin (gestão + suporte)

- **Resumo** — área exclusiva do founder, fora do fluxo normal de loja, para enxergar e gerir todas as lojas.
- **Acesso** — login do founder ganha uma marca de "super admin"; uma rota `/admin` separada abre o painel. Só o founder entra.
- **Pode fazer** — listar lojas, ver estado de cada uma, liberar/renovar assinatura, suspender, e entrar numa loja (impersonação) para dar suporte.
- **Pros** — controle central total; suporte sem fricção (não precisa pedir senha ao cliente); base para crescer métricas.
- **Cons** — quem vê tudo é o ponto único de risco; um acesso amplo sem rastro vira um "backdoor invisível".
- **Mitigação alinhada** — toda impersonação é registrada (qual loja, quando), virando prova de que o acesso foi suporte legítimo.
- **Open issues** — como tecnicamente o painel "vê todas as lojas" sem quebrar a regra de isolamento por loja; o que exatamente o suporte pode alterar dentro da loja impersonada.

### Métricas do painel

- **Resumo** — visão de saúde do negócio na tela inicial do painel admin.
- **O que mostra** — número de lojas por estado (testando / ativas / travadas); faturamento por loja (= quanto a loja vendeu aos clientes dela, somado do banco de vendas de cada loja); último acesso de cada loja; lista de quem vence nos próximos 3 dias (para o founder cobrar).
- **Pros** — o founder sabe a quem cobrar antes do vencimento; enxerga lojas abandonadas (último acesso antigo).
- **Cons** — "último acesso" depende de registrar de propósito o último login de cada loja.
- **Open issues** — com que frequência cada número atualiza (tempo real vs. cálculo periódico).

### Assinatura mensal com trial e cobrança manual via PIX

- **Resumo** — toda loja nasce em teste grátis por 7 dias; depois precisa de liberação mensal paga.
- **Estado da loja (a "carteirinha")** — cada loja carrega uma situação (`testando` / `ativa` / `travada`) e uma data "válido até". No cadastro, nasce `testando` válida por 7 dias.
- **Pagamento** — cliente paga via PIX e fala com o founder; founder recebe e, no painel, libera a loja empurrando a data +30 dias e marcando `ativa`.
- **Vencimento** — uma rotina automática à meia-noite (00:00, horário de Brasília) varre as lojas; quem passou da data vira `travada`.
- **Loja travada** — o dono ainda entra e **vê** seus dados (relatórios, histórico), mas toda ação de escrita (vender, abrir comanda, lançar) fica bloqueada com aviso visível — não falha silenciosa. O aviso diz "Pague via PIX para reativar — WhatsApp 13 99130-6911".
- **Dados** — preservados para sempre; travar nunca apaga nada.
- **Pros** — zero integração de pagamento no MVP; o founder fica no controle do caixa; cliente não perde histórico.
- **Cons** — cobrança e liberação 100% manuais não escalam; depende do founder lembrar de liberar; PIX recebido precisa ser casado com a loja certa na mão.
- **Open issues** — o que exatamente o modo somente-leitura bloqueia (quais telas/ações); como o cliente sinaliza o pagamento de forma que o founder ache a loja certa rápido.

## Open Threads

- Painel admin e assinatura são **uma feature ou duas**? São temas acoplados (o painel é onde se libera a assinatura), mas têm escopos distintos — decidir antes de `/add.new`.
- Super admin é **só o founder** no MVP — delegar suporte a terceiros (mais de um super admin) fica fora de escopo até haver necessidade de escala.
- Mecanismo técnico do "ver todas as lojas" e da impersonação sem violar o isolamento por loja — precisa de definição na fase de plano, não no brainstorm.
- Escopo preciso do modo somente-leitura: lista de ações bloqueadas (vendas, comandas, lançamentos) vs. permitidas (relatórios, leitura).
- Origem e frequência de cada métrica (faturamento por loja, último acesso) — alguns dados podem precisar ser registrados de propósito.
- Gatilho exato do início do trial (no signup) e o que acontece se o cliente pagar **antes** de vencer (acumula dias ou conta a partir do pagamento?).
- Como o founder casa um PIX recebido com a loja certa (identificador no pagamento? confirmação por WhatsApp?).

> Próximo passo: `/add.new` para formalizar — provavelmente duas features (painel super admin + assinatura/billing manual).
