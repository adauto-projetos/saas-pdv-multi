# SETUP — Instalação Local (guia do founder)

Este guia é para você (founder), que vai instalar o PDV no PC de um cliente
específico, migrando os dados dele da nuvem (Hetzner) para o computador dele.
Não é preciso saber programar — siga os passos na ordem.

Contexto completo da decisão de negócio: `docs/features/0026F-instalacao-local/about.md`.

## Antes de começar

- O PC do cliente precisa ter o **Docker Desktop** instalado e aberto (ícone
  da baleia rodando na barra de tarefas). Sem isso, nada nos passos abaixo
  funciona.
- Você vai precisar acessar a produção (Hetzner, `pdv.art.br`) para gerar o
  arquivo de dados do cliente — mesmo acesso que você já usa para deploy.
- **Fotos de produto são removidas na migração.** O cliente vai ficar sem as
  fotos que cadastrou; o sistema volta a mostrar o emoji/ícone padrão no
  lugar (igual a um produto que nunca teve foto). Isso é intencional — a
  feature de fotos está sendo descontinuada em outra frente.
- **A partir da migração, esse cliente para de pagar mensalidade.** É uma
  exceção comercial aceita especificamente para ele — não existe nenhuma
  trava técnica de cobrança, é só um acordo que você mantém de cabeça (ou
  anotado em algum lugar seu, fora deste sistema).

## Passo a passo

### 1. Clonar o repositório no PC do cliente (uma vez só)

No PC do cliente, com o Docker Desktop já aberto, clone o repositório:

```bash
git clone <url-do-repositorio> pdv
cd pdv
```

Isso baixa o código do sistema, mas ainda não instala nada — os scripts dos
próximos passos é que fazem a instalação de verdade.

### 2. Gerar o arquivo de dados do cliente (na produção)

Ainda na sua máquina (ou via SSH na Hetzner, do jeito que você já acessa a
produção hoje), rode o script de exportação, passando o ID do tenant do
cliente:

```bash
npx tsx scripts/export-tenant.ts <tenantId> tenant-export.json
```

Isso gera um arquivo `tenant-export.json` com **todos os dados desse
cliente** (produtos, vendas, clientes, fiado, caixa, etc.) — e só desse
cliente, nenhum dado de outra loja.

**Esse arquivo é sensível — nunca envie para o Git.** Ele contém dados
pessoais dos clientes e as senhas dos usuários (em formato criptografado,
mas ainda assim sensível). O repositório do sistema é **público** no GitHub.
Gere e guarde esse arquivo em local separado da pasta `pdv` clonada (ex.: sua
pasta pessoal), e só copie/mova para dentro da pasta `pdv` no PC do cliente
no passo 4, na hora de rodar a instalação. Depois que a instalação terminar
com sucesso (passo 4) e você confirmar que os dados estão corretos, **apague
esse arquivo** de todo lugar onde ele ficou (sua máquina, Hetzner, PC do
cliente) — ele não precisa mais existir depois de importado.

**Você pode rodar isso a qualquer horário**, não precisa esperar a loja
fechar. O risco aceito é: se o cliente fizer uma venda ou lançar um fiado
*depois* desse export e *antes* de trocar para o sistema local, essa venda
não vai aparecer no local — ela ficou só na nuvem. Não existe reconciliação
automática para isso. Se acontecer, você (ou o cliente) precisa lançar essa
venda manualmente no sistema local depois, comparando com o que ficou
registrado na nuvem.

### 3. Transferir o arquivo para o PC do cliente

O arquivo `tenant-export.json` gerado no passo 2 precisa chegar no PC do
cliente. Não existe um caminho automático para isso — copie manualmente, do
jeito que for mais prático para você, por exemplo:

```bash
# Se você gerou o export dentro do container na Hetzner:
docker cp pdv_app:/app/tenant-export.json ./tenant-export.json

# Para levar da sua máquina até o PC do cliente (rede local, pendrive, etc.):
scp tenant-export.json usuario@pc-do-cliente:/caminho/pdv/tenant-export.json
```

O importante é que, ao final deste passo, o arquivo `tenant-export.json`
esteja em algum lugar acessível no PC do cliente — não precisa estar dentro
da pasta `pdv` clonada no passo 1 (você aponta o caminho completo, ou
relativo, no passo 4). Evite deixá-lo dentro da pasta `pdv` por mais tempo do
que o necessário, pelo motivo de segurança explicado no passo 2.

### 4. Rodar a instalação

Dentro da pasta `pdv` (clonada no passo 1), com o arquivo do passo 3 já
transferido, rode:

```bash
bash scripts/install-local.sh tenant-export.json
```

Esse script, sozinho:

- confere se o Docker está rodando;
- gera credenciais locais fortes e aleatórias (nunca são as mesmas da
  produção, nem um valor fixo);
- sobe o banco de dados local;
- reconstrói a estrutura do banco (igual à da produção);
- importa todos os dados do cliente a partir do arquivo do passo 3;
- **zera as fotos de produto** (viram emoji/ícone, ver acima);
- **desbloqueia a assinatura localmente** — o sistema local nunca mostra tela
  de "assinatura vencida", independentemente do estado que a assinatura
  tinha na nuvem;
- verifica que o isolamento entre lojas (RLS) está íntegro no banco novo;
- sobe o sistema.

Se tudo correr bem, a última linha impressa é:

```
✅ Instalação concluída — acesse http://localhost
```

Abra esse endereço no navegador do PC do cliente para confirmar que o
sistema está de pé, com os dados dele.

Se o script travar com um erro, ele para na hora (não deixa a instalação
pela metade) — leia a mensagem de erro impressa e corrija o que ela apontar
antes de rodar de novo. Rodar o script uma segunda vez só funciona se você
apagar o arquivo `.env` criado na primeira tentativa (ele existe como guarda
para não instalar duas vezes por cima).

### 5. Corte de uso

A partir do momento em que o sistema local subiu e você confirmou que os
dados estão lá, o cliente passa a operar **só pelo local** — pare de usar a
URL da nuvem (`pdv.art.br`) para esse cliente no dia a dia.

**A instância na nuvem desse cliente continua ligada** (e continua sendo
paga) — ela não é desativada neste passo. Ela só para de receber novos dados
a partir de agora: funciona como uma cópia de segurança congelada, um
retrato do sistema no momento do corte, caso algo dê errado no local. O
"desligamento da nuvem" (quando a instância paga é de fato desativada e o
custo desaparece) é uma decisão separada, que você toma mais para a frente,
quando estiver confiante de que o local está estável — não faz parte deste
processo.

Não existe um procedimento formal de "voltar para a nuvem" se o local falhar
depois do corte de uso — a nuvem parada é só um backup passivo, sem plano de
reativação pronto.

## E se o cliente precisar de uma atualização depois?

Isso é outro processo, feito pelo próprio cliente — veja
`docs/features/0026F-instalacao-local/UPDATE.md`. Você só precisa avisar
quando uma nova versão estiver disponível.
