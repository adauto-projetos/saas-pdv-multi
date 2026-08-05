---
id: 0026F
type: feature-about
slug: instalacao-local
status: implemented
related: [BRN-fotos-emoji-instalacao-local, 0019H, 0020F, 0016F, 0011F]
created: 2026-08-04
updated: 2026-08-04
---

## TL;DR

Empacota o PDV existente (sem alterar código do app) para rodar via Docker direto no PC do único cliente ativo hoje, com os dados dele migrados da produção (Hetzner) para um Postgres local, mantendo a nuvem desse cliente ativa (parada, sem uso) em paralelo até validação. Processo documentado para ser repetível em outros clientes, caso o caminho de servidor gratuito em nuvem — ainda no plano para clientes futuros ({{doc:BRN-fotos-emoji-instalacao-local}}) — não vingue. Decisões validadas com o dono em 2026-08-04: fotos de produto são removidas na migração (feature de fotos sendo descontinuada em iniciativa separada, ver referência abaixo); verificação de assinatura é removida na cópia local (nunca bloqueia) e esse cliente passa a não pagar mensalidade a partir da migração (exceção comercial aceita); migração usa dump completo da estrutura + dados só desse tenant, podendo rodar em qualquer horário (risco de janela de dados aceito, reconciliação manual se precisar); acesso restrito a esse PC (sem multi-dispositivo por ora); atualização via script simples que o cliente roda quando avisado; sem plano formal de rollback (nuvem parada é só backup passivo).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

- **Afetados:** o founder (decide e mantém a hospedagem) e o único cliente ativo hoje (depende da disponibilidade do sistema pro próprio negócio, incluindo fiado — dinheiro a receber).
- **O que falta:** não existe hoje nenhum processo de instalação local nem script de migração de dados; todo cliente depende 100% da nuvem paga (Hetzner).
- **Sinal observável:** hospedagem paga desse cliente é um custo/risco recorrente que o founder quer eliminar; a alternativa cogitada de servidor gratuito em nuvem ainda não foi escolhida e carrega riscos próprios (instância "dormindo" fora do horário, banco com prazo de expiração) incompatíveis com um negócio real em produção.
- **Workaround atual:** nenhum — o cliente depende inteiramente da instância na nuvem hoje.

## Users

| Papel | Objetivo com a feature | Dor atual |
|---|---|---|
| Founder | Instalar e migrar o sistema desse cliente pro PC dele, de um jeito repetível | Sem processo pronto; hospedagem paga é custo/risco recorrente |
| Dono do estabelecimento (cliente) | Continuar operando o PDV normalmente, agora local | Depende de uma nuvem paga fora do controle dele |

## Scope

### Includes
- Processo de instalação local via Docker no PC do cliente, sem alterar o código do app (confirmado no discovery: sessão/cookie já é agnóstico de domínio).
- Geração de credenciais locais (SESSION_SECRET, senha do banco) durante a instalação.
- Script de migração: dump da estrutura completa do banco + dados apenas do tenant desse cliente, da produção (Hetzner) para o Postgres local. A migração pode rodar em qualquer horário (não exige loja fechada); risco aceito de venda/fiado lançado na janela entre o dump e o cliente trocar para o local — se acontecer, reconciliação é manual, sem mecanismo automático.
- Remoção da cobrança de assinatura desse cliente a partir da migração — exceção de modelo comercial aceita especificamente para ele, já que passa a rodar no próprio PC dele.
- Remoção das referências de foto de produto durante a migração — campo fica vazio, cai no fallback emoji/ícone já existente. Razão da remoção (não apenas do fallback): decisão tomada em {{doc:BRN-fotos-emoji-instalacao-local}}, feature de fotos sendo descontinuada em iniciativa separada ainda não formalizada.
- Remoção da verificação de assinatura (`valid_until`) na cópia local — essa instância nunca bloqueia por assinatura vencida, em vez de estender uma data que precisaria ser lembrada/renovada depois.
- Reaproveitamento da verificação de boot existente (`verify-prod.ts`) para confirmar que o isolamento entre lojas (RLS) está intacto após a migração.
- Script de atualização que o cliente roda manualmente quando avisado pelo founder, reaproveitando o processo de versionamento existente.
- Nuvem desse cliente permanece ligada (continua sendo paga, instância não é desativada) porém parada — sem receber novas vendas/dados — a partir do momento em que o cliente passa a operar só pelo local ("corte de uso"). Funciona como retrato congelado de segurança até o founder decidir o "desligamento da nuvem" (evento separado, gatilho ainda em aberto — ver Does NOT Include). O custo de hospedagem só é eliminado no desligamento, não no corte de uso.
- Documentação de instalação e migração voltada ao founder (quem executa essa parte, e também é usuário não técnico — {{doc:BRN-fotos-emoji-instalacao-local}} / perfil registrado em `docs/product/owner.md`); documentação de atualização separada, voltada ao cliente (quem roda o script de update).

### Does NOT Include
- Acesso de múltiplos aparelhos da loja ao sistema local (ex: celular do dono) — só o PC onde foi instalado acessa por enquanto. (Razão: começar simples; o discovery confirmou que o app já é compatível com acesso por rede local sem mudança de código, então pode ser habilitado depois sem retrabalho.)
- Armazenamento local de fotos de produto (fallback sem R2) — fotos são removidas na migração, não substituídas por um armazenamento local. (Razão: a feature de fotos do produto está sendo descontinuada em iniciativa separada; não faz sentido construir suporte local pra algo que está saindo do produto.)
- Instalador completo (atalho de área de trabalho, checagem automática de espaço em disco/porta livre antes de instalar) — versão inicial usa só um script simples de instalação/atualização. (Razão: insight do consultor foi recusado pelo founder; escopo inicial prioriza a entrega mínima funcional.)
- Backup contínuo ou cópia de segurança pontual pós-migração — nenhum backup automático faz parte desta entrega. (Razão: risco aceito explicitamente pelo founder; revisitar antes de desligar a nuvem desse cliente de vez.)
- Critério automático ou pré-definido para o "desligamento da nuvem" (evento separado do corte de uso — é quando a instância paga é de fato desativada e o custo some) — o gatilho fica em aberto, decidido manualmente pelo founder quando ele considerar validado. (Razão: decisão adiada explicitamente pelo founder; não bloqueia esta entrega.)
- Requisitos técnicos mínimos do PC do cliente (specs, se precisa instalar Docker antes) e se a instalação é feita presencial ou remota pelo founder — não fazem parte deste documento. (Razão: são decisões de execução/logística, não de escopo de negócio; ficam para `/add.plan`.)
- Procedimento formal de rollback (voltar a operar pela nuvem se o local falhar depois do corte de uso) — a nuvem parada funciona só como backup passivo, sem plano de reativação definido. (Razão: decisão explícita do founder; reavaliar se um caso real de falha exigir isso.)

## Success Metrics

| Métrica | Alvo | Fonte de medição |
|---|---|---|
| Instalação local concluída sem erro | Sistema sobe e passa na verificação de RLS (`verify-prod.ts`) na primeira tentativa | Log de boot do container local |
| Migração de dados sem perda de integridade | Suite de regressão de isolamento (`tenant-isolation-regression.test.ts`) passa 100% após a migração | Execução da suite de teste no ambiente local pós-migração |
| Cliente opera sem bloqueio de assinatura | Sistema local abre sem tela de "assinatura vencida" no primeiro acesso | Verificação manual do founder no primeiro uso |
| Atualização aplicável pelo cliente | Cliente consegue rodar o script de atualização sozinho, sem suporte remoto | Observação do founder na primeira atualização aplicada |
| Local pronto para justificar o desligamento da nuvem | Sistema roda o período de validação sem incidente, dando ao founder base para decidir o "desligamento da nuvem" (evento fora desta entrega — ver Does NOT Include) | Observação do founder durante o período de validação |

Nota: o custo de hospedagem (motivação central do Problem) só é eliminado no "desligamento da nuvem", decisão explicitamente adiada pelo founder — esta entrega mede o que a habilita, não a eliminação do custo em si.

## References

- {{doc:BRN-fotos-emoji-instalacao-local}} — brainstorm que originou esta feature: modelo híbrido (só esse cliente vai local), fotos removidas, gatilho de corte da nuvem adiado
- {{doc:0019H}} — verificação de boot (SESSION_SECRET + RLS) reaproveitada sem alteração
- {{doc:0020F}} — migrações push-only + suite de regressão de RLS, base técnica da migração de dados
- {{doc:0016F}} — feature de fotos de produto; dependência de R2 removida nesta migração
- {{doc:0011F}} — modelo de assinatura (trial/active/locked), base da decisão de remover a verificação na cópia local
- `docs/features/0026F-instalacao-local/discovery.md` — análise técnica completa do codebase
- `docs/features/0026F-instalacao-local/past-features.md` — mapeamento de features passadas relevantes
