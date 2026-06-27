---
id: 0016F
type: feature-about
slug: fotos-produto
status: implemented
created: 2026-06-27
updated: 2026-06-27
related: [0011F]
---

## TL;DR

Cada produto pode ter 1 foto real, enviada pelo operador no cadastro ou edição e armazenada no Cloudflare R2 (object storage S3-compatible). O banco guarda apenas a referência (chave + URL pública) — nunca o binário. A foto é exibida no PDV e no catálogo; quando ausente, cai no `emoji` já existente e, sem emoji, num ícone genérico. Decisão central: storage externo (R2) com arquivo público de nome aleatório e isolamento por tenant via prefixo de chave. Modelo de acesso assumido conscientemente: enquanto o arquivo existe, qualquer um com a URL o acessa sem autenticação (a segurança vem da URL imprevisível, não de controle de acesso); trocar ou excluir a foto remove o arquivo do R2, encerrando esse acesso.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

O único identificador visual de um produto hoje é o campo `emoji` (texto, opcional), exibido no PDV em 36x36 (`components/caixa/CashierScreen.tsx`). Um emoji genérico não distingue produtos parecidos (duas bebidas, dois salgados), o que atrasa o operador na hora de achar o item no caixa.

- Afetados: operador de caixa (busca lenta) e dono que cadastra o catálogo (sem forma de mostrar o produto real).
- O que falta: não existe nenhum mecanismo de upload, armazenamento de arquivo ou exibição de imagem no sistema (zero código S3/R2/FormData hoje).
- Sinal observável: produtos só se diferenciam por nome + emoji na tela do caixa.
- Workaround atual: escolher emojis distintos manualmente — limitado e impreciso.

## Users

| Papel | Objetivo com a feature | Dor atual |
|---|---|---|
| Operador de caixa | Reconhecer o produto pela foto e achar mais rápido no PDV | Só nome + emoji; produtos parecidos se confundem |
| Dono / cadastrador | Cadastrar o produto com foto real do item | Sem forma de representar o produto visualmente |

## Requirements

- **RF01:** Operador pode anexar 1 foto ao produto durante o cadastro de novo produto.
- **RF02:** Operador pode anexar, trocar ou remover a foto durante a edição de um produto existente.
- **RF03:** Sistema exibe uma pré-visualização da foto escolhida antes de salvar, com opção de removê-la.
- **RF04:** Sistema exibe a foto do produto no PDV (`CashierScreen`) e na listagem de produtos.
- **RF05:** Quando o produto não tem foto, a exibição cai no `emoji`; sem emoji, num ícone genérico (cadeia de fallback foto → emoji → ícone).
- **RF06:** Ao trocar a foto, o arquivo anterior é removido do R2.
- **RF07:** Ao excluir o produto, sua foto é removida do R2. (Implementação: o app ainda não tem fluxo de exclusão de produto na UI; a feature entregou a capacidade no service — `deleteProduct(ctx,id)` apaga a linha sob RLS e remove o arquivo no R2 — pronta para quando a exclusão de produto for exposta na interface.)
- **RF08:** Se o upload da foto falhar (R2 indisponível, rede), o cadastro/edição do produto não é bloqueado — o produto é salvo sem foto e o operador pode tentar anexar de novo na edição.
- **RF09:** Se a remoção do arquivo antigo no R2 falhar (ao trocar ou excluir), a operação principal ainda conclui — o produto fica com a nova referência (ou é excluído) e o arquivo antigo é tolerado como órfão, sem bloquear o operador. (Coerente com a exclusão de job de limpeza no Scope: órfão raro é custo operacional aceito.)
- **RN01:** A foto é opcional — produto sem foto continua válido.
- **RN02:** Cada produto tem no máximo 1 foto.
- **RN03:** A chave do arquivo no R2 fica numa pasta por loja, prefixada pelo `tenant_id`: `<slug-do-nome-da-loja>-<tenant_id>/<aleatório>.webp` (ex.: `bar-do-ze-889c8f.../3f8a...c1.webp`). O slug do nome deixa a pasta reconhecível no painel do R2; o `tenant_id` (imutável e único) é o que garante o isolamento — duas lojas de mesmo nome nunca compartilham pasta, e renomear a loja não mistura tenants. O slug é cosmético; a unicidade e a segurança não dependem dele. Esclarecimento de modelo de acesso: a RLS protege apenas a **linha do produto no banco** (qual loja vê qual referência); o **objeto no R2 é servido por URL pública** (domínio público do bucket, ex.: `r2.dev` ou domínio custom) e não é coberto por RLS. "Público" aqui = acessível por quem tem a **chave exata**, com **listagem do bucket desabilitada** (ninguém enumera os objetos) — não é URL assinada nem bucket que permite listar. O isolamento do arquivo entre lojas vem do nome imprevisível (RN04), não da RLS.
- **RN04:** O nome do arquivo é aleatório/imprevisível (não derivado de dados do produto). Como o objeto é público por URL, isso impede que uma loja descubra/liste os arquivos de outra.
- **RN05:** Upload aceita apenas arquivos de imagem, validados pelo conteúdo real (magic bytes), não só pela extensão.
- **RN06:** Tamanho máximo de upload: 5 MB por arquivo.
- **RNF01:** Antes de armazenar, a imagem é redimensionada para um quadrado fixo de 600x600px no modo *contain* (a foto inteira cabe sem corte; a sobra é preenchida com fundo branco) e convertida para WebP, reduzindo custo de storage e padronizando o tamanho de exibição.
- **RNF02:** Credenciais do R2 (access key, secret, endpoint/account id, bucket, URL pública) vivem em variáveis de ambiente (`.env.local`), nunca no código nem no Git.
- **RNF03:** No PDV e na listagem (que podem ter centenas de itens), as fotos carregam com lazy-loading; o WebP reduzido (RNF01) serve como thumbnail, sem requisição de versão extra. Evita travar a tela do caixa ao rolar o catálogo.

## Scope

### Includes
- Coluna(s) no produto para referenciar a foto (chave R2 + URL pública).
- Upload de foto no formulário de cadastro e de edição de produto.
- Redimensionamento + conversão para WebP antes do armazenamento.
- Armazenamento no Cloudflare R2 com chave prefixada por tenant e nome aleatório.
- Pré-visualização antes de salvar e botão de remover.
- Validação de tipo (imagem real) e tamanho (≤5 MB).
- Exibição da foto no PDV e na listagem de produtos, com fallback foto → emoji → ícone.
- Remoção do arquivo no R2 ao trocar a foto ou excluir o produto.
- Documentação das variáveis de ambiente do R2 no `.env.example`.

### Does NOT Include
- Múltiplas fotos / galeria por produto — escopo é 1 foto; galeria é feature futura. (Razão: complexidade de UI e storage desproporcional ao ganho no PDV.)
- Limite de fotos/armazenamento por plano (tie-in com billing 0011F) — adiado; não bloqueia o uso. (Razão: requer contagem de uso por tenant; tratar quando billing amadurecer.)
- Edição de imagem (corte, filtros, rotação manual) — só redimensionamento automático. (Razão: fora do objetivo de identificar o produto.)
- Job de limpeza de arquivos órfãos pré-existentes — remoção é síncrona no fluxo; varredura retroativa é operacional. (Razão: sem histórico de órfãos num recurso novo.)

## Success Metrics

| Métrica | Alvo | Fonte de medição |
|---|---|---|
| Produtos com foto cadastrada | ≥30% do catálogo ativo por loja, medido aos 60 dias após release | Consulta no banco (coluna de imagem preenchida) |
| Upload concluído sem erro | ≥98% das tentativas, avaliado mensalmente | Logs do route handler de upload |
| Peso médio do arquivo armazenado | ≤50 KB após redimensionamento, verificado a cada release | Tamanho dos objetos no bucket R2 — dono verifica; ultrapassar gera alerta para revisar o redimensionamento, não bloqueia release |

## References

- {{doc:0011F}} — super admin / billing (referência para o tie-in futuro de limite por plano, fora de escopo aqui)
- `db/schema/products.ts` — schema do produto (campo `emoji` existente)
- `components/caixa/CashierScreen.tsx` — exibição atual do emoji no PDV
- Cloudflare R2 (object storage S3-compatible) — provedor de armazenamento escolhido
- `docs/features/0016F-fotos-produto/discovery.md` — análise técnica do codebase
