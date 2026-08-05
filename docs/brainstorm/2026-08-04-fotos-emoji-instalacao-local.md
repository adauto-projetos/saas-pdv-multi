---
id: BRN-fotos-emoji-instalacao-local
type: brainstorm
created: 2026-08-04
updated: 2026-08-04
related: []
---

## TL;DR

Sessão de brainstorm sobre reduzir a carga do sistema de fotos/emoji no catálogo de produtos e sobre onde hospedar o PDV para o cliente atual. Existe para registrar as direções exploradas antes de formalizar em `/add.new`. Decisão da sessão: remover o sistema de fotos (mantendo o emoji, que não tem custo de performance) e pilotar uma instalação local no PC do único cliente ativo hoje, mantendo o plano de servidor gratuito em nuvem como caminho para clientes futuros.

## TOC

- [Questions Explored](#questions-explored)
- [Candidate Directions](#candidate-directions)
- [Open Threads](#open-threads)

## Questions Explored

- Fotos e emoji realmente travam/pesam o servidor, ou é só uma das duas coisas?
- Emoji tem custo de performance real, ou é apenas texto sem impacto?
- Remover só a exibição das fotos, ou arrancar toda a feature (armazenamento, upload, referência no banco)?
- O único cliente ativo já tem produto com foto cadastrada — o que aparece no lugar depois de remover?
- O sistema já tem loja real em produção, ou ainda é só teste?
- Qual servidor gratuito em nuvem suporta o stack atual (banco + app em container) sem exigir grandes ajustes?
- É viável instalar o app já existente, sem alterar código, direto no computador de um cliente?
- O computador do cliente tem capacidade para isso?
- O que acontece com a versão em nuvem desse cliente depois da instalação local?
- Como uma correção ou novidade futura chega a um sistema instalado localmente?
- Existe backup se o computador do cliente falhar, for formatado ou roubado?

## Candidate Directions

- **Remover fotos e emoji juntos** — hipótese inicial do dono: as duas coisas juntas travavam o servidor. Pros: uma única remoção, decisão simples. Cons: emoji é só texto — não tem custo de performance, então removê-lo não resolve nada; perde-se um identificador visual sem necessidade real. Desfecho: rejeitada — emoji mantido, só a foto sai.
- **Remover o sistema de fotos por completo** — a foto tem custo real de servidor no momento do envio (processamento de imagem a cada upload); a exibição em si não pesa, pois vem de um armazenamento externo. Pros: elimina o único ponto real de carga de processamento ligado a imagem; simplifica o cadastro de produto. Cons: catálogo perde o diferencial de distinguir produtos parecidos por foto real, voltando a depender só de nome + emoji/ícone; produtos que já têm foto cadastrada caem automaticamente no emoji (ou ícone genérico, se não tiverem emoji) assim que a foto sai — mesma cadeia de fallback que já existe hoje. Desfecho: escolhida — banco, upload e armazenamento saem por completo.
- **Migrar a hospedagem para um servidor gratuito em nuvem** — opções levantadas: um provedor com máquina e disco persistente (mais parecido com a hospedagem paga atual), ou provedores mais simples com plano gratuito, que "dormem" depois de um tempo sem uso e podem expirar o banco de dados. Pros: mantém o modelo de hospedagem única e centralizada; um só lugar para atualizar todos os clientes de uma vez. Cons: opção mais simples tem risco real de indisponibilidade (sistema "dormindo" no início do expediente) e de perda de dado (banco com prazo de expiração); opção mais robusta tem cadastro mais burocrático. Desfecho: mantida como caminho para clientes futuros; provedor específico ainda não escolhido.
- **Instalação local no computador do cliente atual** — rodar o mesmo sistema, sem alterar nada do que já existe, direto no computador do único cliente ativo hoje, com os dados dele copiados para lá. Pros: elimina custo e risco de hospedagem em nuvem para esse cliente; o sistema já roda do mesmo jeito em ambiente local, então não exige mudar nada no que está pronto. Cons: sem um lugar central para acessar/corrigir à distância; toda correção ou novidade futura exige uma ação manual (script que o próprio cliente roda); sem um plano de backup combinado, a perda do computador apaga o histórico desse cliente — incluindo fiado (dinheiro a receber); depende da capacidade do computador (memória, se roda o ambiente necessário), ainda não confirmada. Desfecho: escolhida para esse cliente, em modelo híbrido — a versão em nuvem desse cliente continua ativa até o local ser validado, só depois é desligada. Decisão de escopo: o empacotamento deve ficar repetível (documentado/reaproveitável), não uma solução artesanal só para esse cliente — pensando em uso por outros clientes se o caminho de servidor gratuito não vingar.

## Open Threads

- Capacidade do computador do cliente (memória disponível, se consegue rodar o ambiente necessário) — ainda não confirmada.
- Provedor de servidor gratuito para clientes futuros — não escolhido entre as opções levantadas.
- Ausência de backup no computador local foi aceita como risco por ora — revisitar antes de desligar a nuvem desse cliente de vez.
- Gatilho concreto para desligar a nuvem desse cliente (prazo fixo vs. validação manual sem prazo) — discutido e explicitamente adiado; decidir antes de executar o corte.
- Motivo original de remover fotos ("travar/pesar o servidor") não tem evidência observável registrada (crash, CPU sustentada, ou só lentidão percebida) — não bloqueou a decisão, mas vale registrar ao formalizar a feature de remoção de fotos.
- Mitigações mais leves para o custo de upload de foto (compressão menor, cap de tamanho, lazy loading adicional) não foram comparadas antes de optar por remover a feature inteira — considerar ao formalizar a feature de remoção de fotos, mesmo que a decisão já tomada seja remover.

Next: `/add.new` para formalizar as duas frentes — remoção do sistema de fotos, e instalação local com migração de dados do cliente atual.
