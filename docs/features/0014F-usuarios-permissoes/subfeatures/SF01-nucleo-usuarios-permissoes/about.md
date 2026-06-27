---
id: 0014F
type: feature-about
slug: sf01-nucleo-usuarios-permissoes
status: draft
created: 2026-06-26
updated: 2026-06-26
related: [0011F]
---

## TL;DR

Núcleo do epic de usuários: o Administrador cadastra operadores (email + senha provisória), liga/desliga 8 permissões granulares por usuário, e o sistema passa a esconder no menu e bloquear nas actions o que o operador não pode. Inclui papel `operator` em `tenant_members`, tabela `user_permissions`, soft-delete (`is_active`), anti-escalonamento, invalidação de sessão ao desativar e presets de permissão. É a base de SF02, SF03 e SF04.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Não existe operador no sistema: só o dono tem login, e nenhuma action checa autorização. Para colocar um funcionário no balcão, o dono entrega a própria senha — expondo custo, faturamento e configurações.

- `tenant_members.role` só assume `owner` hoje; não há valor `operator` nem vínculo de funcionário.
- Toda server action chama só `requireAuthContext()` (autenticação); nenhuma valida permissão.
- O menu (`AppSidebar`) mostra todos os módulos para qualquer usuário logado.
- Não há coluna de soft-delete: "remover" um funcionário hoje significaria apagar o registro e órfãos no histórico (vendas referenciam `userId`).
- **Sinal observável:** todo histórico (vendas, caixas, comandas) aparece com a identidade do dono — não há rastreio por funcionário, porque só existe o login dele (zero registros `role='operator'`).
- **Workaround atual:** senha do dono compartilhada — sem rastro nem limite do que o funcionário acessa.

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Administrador (dono) | Criar operador, marcar permissões, desativar quando sair | Só o login dele existe; ou entrega tudo ou não delega |
| Operador (funcionário) | Logar e ver/usar só os módulos liberados | Usa a senha do dono e vê tudo |
| Gerente de turno (operador com "Gerenciar usuários") | Criar operadores e definir permissões que ele mesmo possui | Não há delegação |

> "Gerente de turno" não é um papel no banco — é um Operador com a permissão "Gerenciar usuários". Os valores de `tenant_members.role` são só `owner` e `operator`. Se essa permissão for revogada dele, ele perde o acesso à tela de usuários, mas as permissões que ele já concedeu a outros operadores permanecem (revogação não cascateia).

## Scope

### Includes

- Migração de schema: coluna `is_active boolean not null default true` em `tenant_members`; tabela `user_permissions(tenant_id, user_id, permission_code, granted_by, created_at)` com RLS por tenant.
- Catálogo fixo de 8 permissões (códigos): `vendas`, `comanda`, `caixa`, `produtos`, `estoque`, `financeiro`, `loja`, `gerenciar_usuarios`.
- Tela "Usuários" (acesso por permissão `gerenciar_usuarios` ou `owner`): listar, criar, editar dados (nome/email), editar permissões e desativar/reativar operadores. Editar dados e editar permissões são fluxos distintos (a edição de permissões respeita o anti-escalonamento, RF13).
- Criar operador: nome, email, senha provisória definida pelo dono, e marcação de permissões (≥1 obrigatória).
- Presets de permissão na criação: "Caixa" (vendas+comanda), "Gerente" (tudo menos `loja`), e seleção manual.
- Login do operador: reusa a auth existente (email+senha+cookie). Operador troca a própria senha em "Meu perfil".
- Reset de senha pelo Administrador (define nova senha provisória).
- Guard `requirePermission(ctx, code)` em `lib/auth/`: valida na action, entre `requireAuthContext()` e a chamada de serviço. Owner sempre passa (todas as permissões implícitas).
- Menu (`AppSidebar`) filtrado: módulos sem permissão não aparecem para o operador.
- Hierarquia: o `owner` da loja não pode ser editado nem desativado por ninguém.
- Anti-escalonamento: operador com `gerenciar_usuarios` só concede permissões que ele mesmo possui; não pode se auto-promover nem mexer no owner.
- Invalidação de sessão: requests de um operador desativado (`is_active=false`) são rejeitados imediatamente (checagem por request).

### Does NOT Include

- Override de ação sensível — é SF02; aqui sem permissão o botão/módulo apenas some.
- Limite de operadores por plano — é SF03; aqui o cadastro não é limitado.
- Tela de auditoria "quem fez o quê" — é SF04; aqui só grava-se autoria (já existente).
- Convite/recuperação de senha por email — sem infra de email; senha provisória + reset pelo dono cobrem o MVP.
- Permissão por registro (só o que o operador abriu) — escolhido por módulo; por registro é mais complexo e fora do pedido.
- Mesmo operador vinculado a mais de uma loja — fora do MVP; cada operador pertence a uma única loja.
- Permissões com validade/turno (ativas só em certo horário) — fora do MVP; permissão é ligada/desligada sem janela de tempo.
- Transferência do papel `owner` para outro usuário — o dono-criador é fixo; sucessão não está no escopo desta entrega.

## Requirements

### Schema

- **RF01:** Migração adiciona `tenant_members.is_active boolean not null default true`.
- **RF02:** Tabela `user_permissions`: `tenant_id` (FK), `user_id` (FK), `permission_code` (text), `granted_by` (FK user), `created_at`. Unicidade por `(tenant_id, user_id, permission_code)`.
- **RN01:** Códigos de permissão restritos ao catálogo de 8; valor fora do catálogo é rejeitado na validação (zod).
- **RNF01:** `user_permissions` tem RLS: leitura/escrita filtradas pelo tenant do usuário da sessão (mesmo padrão `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = current_app_user())`).

### Cadastro de operador

- **RF03:** Administrador cria operador com nome, email, senha provisória e ≥1 permissão; cria registro em `tenant_members` com `role='operator'`, `is_active=true`.
- **RF04:** Email do operador é único por tenant (não pode repetir dentro da loja).
- **RF05:** Criação grava as permissões marcadas em `user_permissions` com `granted_by = <criador>`.
- **RF06:** Presets aplicam um conjunto pré-definido de permissões marcáveis/desmarcáveis antes de salvar.
- **RN02:** Cadastro sem nenhuma permissão é bloqueado (guardrail "ninguém nasce sem acesso").
- **RN03:** Senha provisória é gravada com bcrypt, igual ao dono (sem armazenar texto puro).

### Login e troca de senha

- **RF07:** Operador loga pela mesma rota/fluxo do dono (email+senha → cookie assinado).
- **RF08:** Operador troca a própria senha em "Meu perfil"; Administrador pode resetar para nova provisória.
- **RN04:** Operador desativado (`is_active=false`) não consegue logar nem manter sessão.

### Autorização

- **RF09:** `requirePermission(ctx, code)` lança erro de autorização se o usuário não tem a permissão; owner sempre autorizado.
- **RF10:** Cada server action de módulo protegido chama `requirePermission` com o código correspondente antes do serviço: `vendas`→finalizar venda, `comanda`→ações de comanda, `caixa`→abrir/fechar caixa, `produtos`→CRUD produto, `estoque`→movimentações, `financeiro`→contas/fluxo, `loja`→configs, `gerenciar_usuarios`→tela de usuários.
- **RF11:** `AppSidebar` renderiza só os itens cujo código o usuário possui (owner vê todos).
- **RNF02:** A checagem de permissão é defesa em profundidade: além da action, o menu esconde e a RLS limita; nenhuma camada sozinha é suficiente.

### Hierarquia e sessão

- **RF12:** Tentativa de editar/desativar o `owner` é bloqueada por qualquer usuário (inclusive outro com `gerenciar_usuarios`).
- **RF13:** Ao conceder permissões, o concedente só pode marcar códigos que ele próprio possui (owner concede qualquer um).
- **RF14:** Desativar operador seta `is_active=false`; o registro e a autoria no histórico são preservados.
- **RF15:** Request autenticado de operador desativado é rejeitado na resolução da sessão (não espera o cookie expirar).
- **RF16:** Reativar operador seta `is_active=true`; as permissões que ele tinha são preservadas (não precisam ser remarcadas).
- **RN05:** Operador não pode desativar a si mesmo nem se conceder `gerenciar_usuarios` se ainda não o tem.

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Papel `operator` em `tenant_members.role` | Reusa a coluna que já distingue `owner`; RLS por tenant já isola | Tabela `operators` separada — duplica vínculo usuário↔loja |
| Permissões em tabela `user_permissions` | Granular, com RLS e unicidade por permissão | JSON em `tenant_members` — sem RLS fina nem constraint |
| Owner com permissões implícitas (não gravadas) | Owner é dono-supremo; gravar 8 linhas para ele é redundante e arriscado (poderia ser revogado) | Gravar permissões do owner como linhas — risco de revogar o dono |
| `requirePermission` na camada de action | Padrão já estabelecido: action autentica e chama serviço; gate encaixa entre os dois sem mexer no serviço | Checar permissão dentro do serviço — mistura autorização com regra de negócio |
| Invalidação de sessão por request (lê `is_active`) | Desligamento tem efeito imediato | Esperar expiração do cookie — operador desligado continua agindo |
| Senha provisória pelo dono | Sem serviço de email no projeto | Convite por email — infra inexistente |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Operadores cadastrados que logam pelo menos uma vez (delegação real) | ≥ 80% | `tenant_members` (role=operator) cruzado com eventos de login |
| Operadores ativos com permissão além do preset básico de caixa (delegação significativa) | ≥ 40% | Contagem em `user_permissions` por operador |
| Operador acessa/age em módulo sem a permissão (vazamento) | 0 incidentes | Testes de gate + RLS; ausência de relato do dono |

## References

- {{doc:0011F}} — padrão de guard (`requireFounder` em `lib/auth/admin.ts`) e edição via owner connection
- db/schema/tenant-members.ts — coluna `role`; recebe `is_active`
- db/schema/users.ts — credenciais (bcrypt), base do login do operador
- db/rls.ts — `withUserRls` / `current_app_user()`; modelo para RLS de `user_permissions`
- lib/auth/session.ts, lib/auth.ts — `requireAuthContext`; ponto de inserção de `requirePermission`
- components/layout/AppSidebar.tsx — menu a ser filtrado por permissão
- [discovery.md](../../discovery.md) — confirmação em código (auth, RLS, papel em tenant_members)
