# UPDATE — Atualização Local (guia do cliente)

Este guia é para você, que usa o sistema instalado no seu próprio
computador. De vez em quando, quando tiver uma correção ou novidade
disponível, quem cuida do sistema (o founder) vai te avisar. Quando isso
acontecer, siga os passos abaixo — você consegue fazer sozinho, sem precisar
de ajuda remota.

## Antes de começar

- O programa **Docker Desktop** precisa estar aberto no seu computador (o
  mesmo que já fica aberto quando você usa o sistema no dia a dia).
- Você precisa estar na pasta onde o sistema foi instalado (a mesma pasta
  usada na instalação original).

## Passo a passo

1. Abra o terminal na pasta do sistema (a mesma da instalação).
2. Rode o comando:

   ```bash
   bash scripts/update-local.sh
   ```

3. Aguarde. O script busca a versão mais recente, reconstrói o sistema com
   ela e reinicia automaticamente. Isso pode levar alguns minutos —
   principalmente na primeira vez, é normal demorar um pouco mais.
4. Quando terminar, você vai ver esta mensagem:

   ```
   ✅ Atualização concluída — acesse http://localhost
   ```

5. Abra `http://localhost` no navegador (ou atualize a página se já
   estava aberta) e confira que o sistema voltou a funcionar normalmente.

## O que esse processo NÃO faz

- **Não apaga nem altera seus dados.** Vendas, produtos, clientes, fiado,
  caixa — nada disso é tocado. O script só troca o código do sistema por uma
  versão mais nova e reinicia.
- **Não precisa de ninguém acessando seu computador remotamente.** Você roda
  o comando sozinho, na sua máquina.

## Se algo der errado

Se o comando parar com uma mensagem de erro, ou se o sistema não voltar a
abrir em `http://localhost` depois de alguns minutos, entre em contato
com quem instalou o sistema para você, informando a mensagem que apareceu no
terminal.
