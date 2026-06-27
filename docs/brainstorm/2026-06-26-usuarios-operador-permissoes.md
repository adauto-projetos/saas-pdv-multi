---
id: BRN-usuarios-operador-permissoes
type: brainstorm
created: 2026-06-26
updated: 2026-06-26
related: [0011F, 0013F]
---

## TL;DR

Exploração de como o lojista (Administrador) cadastra funcionários (Operadores) com acesso limitado no PDV. Existe porque hoje toda loja tem um único usuário "dono" que pode tudo — não há como dar acesso a um caixa sem entregar preço, faturamento e configurações. A direção favorecida — validada com o founder nesta sessão e a ser ratificada como requisitos no `/add.new`, não decidida aqui — é um modelo de **permissões granulares por usuário** (o próprio lojista marca função por função), com **rastreio de autoria** em cada venda e **limite de operadores por plano**. O número de 3 operadores é ponto de partida, não teto final: vira "por plano" quando houver planos diferentes (ver Open Threads). Próximo passo: formalizar via `/add.new`.

## TOC

- [Questions Explored](#questions-explored)
- [Candidate Directions](#candidate-directions)
- [Open Threads](#open-threads)

## Questions Explored

- Como o funcionário entra no PDV sem atrapalhar a velocidade do balcão?
- O lojista precisa de papéis prontos ou de liberdade pra escolher cada acesso?
- O que exatamente um caixa não deveria enxergar nem fazer?
- Ao cadastrar um funcionário novo, ele já nasce podendo algo ou nada?
- O que acontece quando o funcionário precisa de uma ação sensível (desconto, estorno) que não tem liberada?
- Dá pra saber, depois, quem fez cada venda e fechou cada caixa?
- Quantos funcionários cabem por loja e de onde sai esse número?
- Quem é o "chefe" que ninguém pode trancar, e quem mais pode autorizar?
- O que acontece com o histórico quando um funcionário vai embora?

## Candidate Directions

### Login do funcionário

- **Email + senha (favorecido)** — funcionário entra igual ao dono. Pros: reusa o login que já existe, mais seguro, nada novo pra construir. Cons: digitar email a cada turno é lento no balcão. Open issue: nenhum — aceito como suficiente pro MVP.
- **PIN curto** — apelido/PIN de 4–6 dígitos. Pros: troca de turno rápida. Cons: menos seguro, exige um fluxo de login novo. Descartado por custo no MVP.

### Modelo de acesso

- **Permissões granulares (favorecido)** — o lojista liga/desliga cada função por usuário (Vendas, Comanda, Caixa, Produtos, Estoque, Financeiro, Loja). Pros: quem conhece a operação decide; cresce sem precisar de novos papéis fixos. Cons: tela mais complexa, mais trabalho; risco do lojista esquecer de liberar o básico. Guardrail favorecido (a virar requisito no `/add.new`): o cadastro pede marcar ao menos uma função, pra ninguém nascer sem acesso nenhum.
- **Dois papéis fixos (Administrador/Operador)** — conjunto de bloqueios pronto. Pros: simples e rápido. Cons: rígido, não cobre o "cada loja é de um jeito". Descartado a favor do granular.

### Ação sensível sem permissão

- **Override com senha do Administrador (favorecido)** — funcionário tenta desconto/estorno/cancelamento; o sistema pede a senha de um Administrador pra liberar aquela ação pontual, **na hora**: digitou senha → ação acontece. Não há estado "pendente", então desativar um Administrador durante o turno não deixa override órfão. Quem autoriza é o dono **ou** qualquer um com a permissão "gerenciar usuários"; sem Administrador no balcão, o dono autoriza à distância ditando a senha. Pros: resolve no balcão sem trocar de usuário; mantém o controle. Cons: mais trabalho de construir; ditar a senha por telefone expõe a credencial do dono — risco aceito pra não travar o atendimento.
- **Bloqueio simples (on/off)** — sem permissão, o botão some. Pros: trivial. Cons: trava o atendimento quando o caso é legítimo. Preterido em favor do override.

### Hierarquia e proteção

- **Dono supremo + delegação controlada (favorecido)** — o usuário que criou a loja é intocável (não pode ser desativado nem editado por funcionário). Quem recebe "gerenciar usuários" também cria operadores e autoriza overrides. Pros: permite gerente de turno sem abrir mão da segurança. Cons: precisa de uma trava. Guardrail favorecido (a virar requisito no `/add.new`): **anti-escalonamento** — um operador não pode se dar permissão que ele mesmo não tem, nem desativar/editar o dono.

### Rastreio e saída do funcionário

- **Gravar autoria + desativar (favorecido)** — cada venda e cada caixa guardam qual operador fez; "remover" funcionário é **desativar**, preservando o histórico com o nome. Pros: presta contas por turno e por pessoa — é o motivo real de ter operadores. Cons: não pode apagar de vez (histórico ficaria órfão). Excluir de vez foi descartado por conflitar com o rastreio.

### Limite de operadores

- **Limite por plano, número único hoje (favorecido)** — teto de **3 operadores por loja** (o dono não conta), guardado na config da plataforma junto do preço mensal e editável pelo founder no painel super admin, sem deploy. Pros: vira gancho de monetização e muda sem mexer no código. Cons: hoje só existe um plano, então o "por plano" é, na prática, um número global. Ligado a {{doc:0011F}}.
- **Número fixo em código** — Pros: destrava sem depender do billing. Cons: vira dívida técnica pra amarrar no plano depois. Preterido.
- **Ilimitado** — Pros: zero amarra. Cons: perde a alavanca de receita. Preterido.

## Open Threads

- **Tiers de plano.** Hoje existe um único plano (preço mensal único em `platform-settings`), então o limite de operadores é um número global. Quando surgirem planos diferentes (ex: básico/pro), esse limite precisa virar "por plano" — depende da evolução de {{doc:0011F}}. Não bloqueia a feature de usuários; bloqueia só a parte de diferenciar limite entre planos.
- **Editar o limite no painel.** O painel super admin (SF02 de {{doc:0011F}}) já existe e edita o `platform-settings` (preço mensal). Risco a confirmar no `/add.new`: se esse painel ainda não tiver campo pro novo "máximo de operadores", ligar esse campo é **pré-requisito da parte de limite** — não bloqueia o resto da feature de usuários.

> Próximo passo: `/add.new` para transformar as direções favorecidas em requisitos (RF/RN) e escopo da feature de usuários.
