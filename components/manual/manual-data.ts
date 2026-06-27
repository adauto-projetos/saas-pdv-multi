// Conteúdo do Manual do app (guia escrito completo, por área).
// Linguagem voltada ao dono/operador iniciante — sem jargão técnico.
// Renderizado por components/manual/ManualContent.tsx.

export type ManualBlock =
  | { kind: "p"; text: string }
  | { kind: "steps"; title?: string; items: string[] }
  | { kind: "fields"; title?: string; items: { label: string; desc: string }[] }
  | { kind: "tips"; title?: string; items: string[] }
  | { kind: "rules"; title?: string; items: string[] };

export interface ManualSection {
  id: string;
  icon: string;
  title: string;
  summary: string;
  blocks: ManualBlock[];
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "primeiros-passos",
    icon: "🚀",
    title: "Primeiros passos",
    summary: "Visão geral do app e como é o fluxo de um dia de trabalho.",
    blocks: [
      {
        kind: "p",
        text: "O PDV.multi controla a sua loja num só lugar: vendas, comandas de mesa, produtos, estoque, dinheiro do caixa, fiado, contas a pagar e o lucro do período. Tudo é separado por loja — os dados de um estabelecimento nunca se misturam com os de outro.",
      },
      {
        kind: "steps",
        title: "Como é um dia típico",
        items: [
          "De manhã: abra o caixa informando quanto dinheiro tem na gaveta (saldo inicial).",
          "Durante o dia (mercado): bipe o produto, aperte Enter, clique em Finalizar venda e escolha como o cliente pagou.",
          "Durante o dia (bar/lanchonete): abra uma comanda por mesa, vá lançando os itens e feche quando o cliente for embora.",
          "Reponha o estoque ao receber mercadoria e lance as contas a pagar/receber conforme aparecem.",
          "No fim do dia: confira o Lucro, depois feche o caixa conferindo o dinheiro contado x esperado.",
        ],
      },
      {
        kind: "tips",
        title: "Modo Ajuda (dicas dentro do app)",
        items: [
          "Na barra lateral, o botão 'Modo Ajuda' liga as dicas contextuais.",
          "Com ele ligado, passe o mouse sobre qualquer botão ou campo para ver para que serve.",
          "Onde aparecer um '?' azul, clique para abrir uma explicação mais detalhada.",
          "Este Manual é o guia completo; o Modo Ajuda é a ajuda rápida em cima de cada tela.",
        ],
      },
    ],
  },
  {
    id: "caixa",
    icon: "🛒",
    title: "Caixa / Venda rápida",
    summary: "Tela de venda do dia a dia: bipe produtos, monte o carrinho e finalize.",
    blocks: [
      {
        kind: "p",
        text: "É a tela de checkout do mercado. Você bipa o código de barras ou busca pelo nome, monta o carrinho, vê o total atualizar na hora e finaliza escolhendo a forma de pagamento.",
      },
      {
        kind: "steps",
        title: "Fazer uma venda",
        items: [
          "Confirme que o caixa está aberto (sem caixa aberto, a venda é bloqueada).",
          "Na busca 'Bipe o código ou busque pelo nome', leia o código de barras ou digite o nome.",
          "Aperte Enter (ou clique no produto na grade) — ele entra no carrinho à direita.",
          "Use o campo QTD (− / +) para definir a quantidade antes de adicionar várias unidades.",
          "Confira o Total no rodapé do carrinho.",
          "Clique em Finalizar venda e escolha o pagamento: Dinheiro, Cartão, Pix ou Fiado.",
          "Em Dinheiro, digite o valor recebido para o sistema mostrar o troco. Em Fiado, escolha o cliente.",
        ],
      },
      {
        kind: "fields",
        title: "Campos e botões",
        items: [
          { label: "Busca / código de barras", desc: "Procura por código (leitor ou teclado) ou por parte do nome do produto." },
          { label: "QTD (− / +)", desc: "Define a quantidade antes de adicionar o item ao carrinho." },
          { label: "Grade de produtos", desc: "Clique no card para adicionar; mostra preço, estoque e emoji." },
          { label: "Carrinho", desc: "Lista os itens; dá para mudar a quantidade ou remover cada linha." },
          { label: "Finalizar venda", desc: "Abre a tela de pagamento para fechar a venda." },
          { label: "Notas a Receber", desc: "Aba com os clientes que têm fiado em aberto." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "Precisa de caixa aberto para registrar venda.",
          "Estoque baixo não bloqueia a venda — ele pode até ficar negativo, e você repõe depois.",
          "O preço é gravado no momento da venda; mudar o preço do produto depois não altera vendas antigas.",
          "Venda em dinheiro entra no caixa; venda no fiado vira uma conta a receber do cliente.",
        ],
      },
      {
        kind: "tips",
        title: "Dúvidas comuns",
        items: [
          "Errou a quantidade? Clique no item no carrinho e ajuste, ou remova e adicione de novo.",
          "Impressora desconectada? A venda grava normalmente; um aviso aparece e você pode reimprimir o cupom depois.",
        ],
      },
    ],
  },
  {
    id: "comandas",
    icon: "🍽️",
    title: "Comandas / Mesas",
    summary: "Para bar e lanchonete: abra uma conta por mesa e feche no fim.",
    blocks: [
      {
        kind: "p",
        text: "Use comandas quando o cliente consome ao longo do atendimento. Abra uma conta com um nome livre (ex.: 'Mesa 3' ou 'João'), vá lançando os itens e feche escolhendo o pagamento no final. Você pode ter várias comandas abertas ao mesmo tempo.",
      },
      {
        kind: "steps",
        title: "Atender uma mesa",
        items: [
          "Clique em Abrir comanda e dê um rótulo (ex.: 'Mesa 3', 'João').",
          "Clique no card da comanda para expandir o painel de itens.",
          "Lance cada item buscando por código ou nome, com a quantidade.",
          "Use Observação para pedidos especiais (ex.: 'sem cebola') — aparece no pedido da cozinha.",
          "Clique em Adicionar item: o estoque baixa na hora e o pedido vai para a cozinha.",
          "Quando o cliente for embora, clique em Fechar, confira o valor e escolha o pagamento.",
        ],
      },
      {
        kind: "fields",
        title: "Ações da comanda",
        items: [
          { label: "Abrir comanda", desc: "Cria uma nova conta com um rótulo livre (nome ou número da mesa)." },
          { label: "Adicionar item", desc: "Lança um produto na comanda; baixa estoque e imprime o pedido da cozinha." },
          { label: "Observação", desc: "Texto livre por item, só informativo, visível na cozinha." },
          { label: "Remover item", desc: "Tira um item lançado e devolve a quantidade ao estoque (estorno)." },
          { label: "Fechar", desc: "Encerra a comanda e abre a tela de pagamento." },
          { label: "Cancelar", desc: "Cancela a comanda inteira e estorna todos os itens; nenhuma venda é criada." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "O estoque baixa quando você lança o item, não no fechamento.",
          "Fiado exige um cliente selecionado.",
          "Comanda fechada não reabre — se errou, abra uma nova.",
          "Cancelar uma comanda pode exigir liberação de um gerente (override), se você não tiver permissão.",
        ],
      },
      {
        kind: "tips",
        title: "Dúvidas comuns",
        items: [
          "Dividir a conta entre duas pessoas? Abra duas comandas separadas.",
          "Mudar a quantidade de um item já lançado? Remova e lance de novo (o estoque é estornado).",
          "Cupom não saiu? Reimprima pelo histórico da comanda.",
        ],
      },
    ],
  },
  {
    id: "produtos",
    icon: "📦",
    title: "Produtos",
    summary: "Cadastro do catálogo: nome, código de barras, unidade, preço e estoque.",
    blocks: [
      {
        kind: "p",
        text: "Aqui você cadastra tudo o que vende. Cada produto tem nome, código de barras (opcional), unidade de venda, preço e estoque. A lista mostra preço de venda e quantidade atual.",
      },
      {
        kind: "steps",
        title: "Cadastrar um produto",
        items: [
          "Clique em + Novo produto.",
          "Preencha o nome (obrigatório); opcionalmente emoji e categoria.",
          "Informe o código de barras, se tiver, para poder bipar no caixa.",
          "Escolha a unidade: 'un' (peça) ou 'kg' (granel/peso).",
          "Informe o estoque inicial e, se quiser, o estoque mínimo (alerta).",
          "Preencha custo e margem para o preço calcular sozinho, ou digite o preço direto.",
          "Clique em Salvar produto.",
        ],
      },
      {
        kind: "fields",
        title: "Campos principais",
        items: [
          { label: "Nome", desc: "Como o produto aparece no caixa (ex.: 'Leite Integral 1L')." },
          { label: "Código de barras", desc: "Número impresso no produto; permite bipar. Opcional e único por loja." },
          { label: "Unidade", desc: "'un' para peças/caixas; 'kg' para produtos vendidos por peso." },
          { label: "Estoque inicial", desc: "Quantidade que você tem agora (pode ser 0)." },
          { label: "Estoque mínimo (alerta)", desc: "Quando cair até esse número, o produto aparece em 'Estoque baixo'." },
          { label: "Custo", desc: "Quanto você pagou ao fornecedor. Usado para calcular preço e lucro." },
          { label: "Margem %", desc: "Quanto quer ganhar sobre o custo. Ex.: custo R$ 10 + 50% = R$ 15." },
          { label: "Preço de venda", desc: "O quanto o cliente paga. Calcula sozinho ou você digita." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "O código de barras é único por loja: dois produtos não podem ter o mesmo.",
          "Você pode cadastrar sem custo/margem, digitando o preço manualmente.",
          "Ao digitar o preço manual, ele não muda mais sozinho ao alterar a margem.",
        ],
      },
    ],
  },
  {
    id: "precos",
    icon: "🏷️",
    title: "Preços e margem (markup)",
    summary: "Como o preço de venda é calculado a partir do custo e da margem.",
    blocks: [
      {
        kind: "p",
        text: "Em vez de calcular preço na mão, o sistema faz por você: Preço de venda = Custo + (Custo × Margem %). Você define uma margem padrão da loja e ajusta por produto quando precisar.",
      },
      {
        kind: "steps",
        title: "Definir a margem padrão",
        items: [
          "Vá em Configurações.",
          "Preencha 'Margem padrão (%)' com o quanto quer ganhar por padrão (ex.: 50).",
          "Clique em Salvar. Novos produtos já virão com essa margem preenchida.",
        ],
      },
      {
        kind: "fields",
        title: "Como ler os campos",
        items: [
          { label: "Custo", desc: "Seu preço de compra, em reais." },
          { label: "Margem %", desc: "Sua porcentagem de ganho sobre o custo." },
          { label: "Preço final", desc: "O número grande que confirma quanto o cliente vai pagar." },
        ],
      },
      {
        kind: "tips",
        title: "Dicas práticas",
        items: [
          "Margens comuns: mercado 30–50%, bar/lanchonete 50–100%. Ajuste por produto.",
          "Mudou o custo de um produto que já vende? O sistema sugere um novo preço para você confirmar.",
          "A margem padrão vale só para produtos novos; os já cadastrados mantêm o preço.",
        ],
      },
    ],
  },
  {
    id: "estoque",
    icon: "📊",
    title: "Estoque",
    summary: "Entradas, ajustes de inventário e histórico de movimentações.",
    blocks: [
      {
        kind: "p",
        text: "Controla quanto você tem de cada produto. As vendas baixam o estoque sozinhas; você registra as entradas (compras) e os ajustes (quando a contagem física não bate com o sistema).",
      },
      {
        kind: "steps",
        title: "Registrar uma entrada (recebimento)",
        items: [
          "Vá em Estoque e, em 'Nova movimentação', clique em Entrada.",
          "Busque o produto pelo nome.",
          "Digite a 'Quantidade a adicionar' (quanto chegou).",
          "Opcional: escreva o motivo (ex.: 'Compra fornecedor X').",
          "Clique em Registrar movimentação — o estoque sobe.",
        ],
      },
      {
        kind: "steps",
        title: "Fazer um ajuste de inventário",
        items: [
          "Em 'Nova movimentação', clique em Ajuste (inventário).",
          "Busque o produto e informe a 'Contagem real' (o que você contou de verdade).",
          "Clique em Registrar — o sistema substitui o estoque pelo número contado.",
        ],
      },
      {
        kind: "fields",
        title: "Tipos de movimentação",
        items: [
          { label: "Entrada", desc: "Soma ao estoque. Use ao receber mercadoria." },
          { label: "Saída", desc: "Diminui o estoque. As vendas registram isso automaticamente." },
          { label: "Ajuste", desc: "Substitui o estoque pelo número contado fisicamente." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "O estoque pode ficar negativo (a venda não bloqueia); aparece em vermelho avisando.",
          "O histórico é imutável: você não edita movimentações antigas, registra novas para corrigir.",
          "O sistema grava qual usuário fez cada movimentação.",
        ],
      },
      {
        kind: "tips",
        title: "Entrada x Ajuste",
        items: [
          "Entrada: 'recebi 12 unidades' → o estoque sobe 12.",
          "Ajuste: 'contei 30 no total' → o estoque vira 30, e a diferença fica registrada.",
        ],
      },
    ],
  },
  {
    id: "financeiro",
    icon: "💰",
    title: "Financeiro (caixa, fiado, contas)",
    summary: "Dinheiro do caixa, contas a receber (fiado) e contas a pagar.",
    blocks: [
      {
        kind: "p",
        text: "Controla o dinheiro em três frentes: o Caixa (dinheiro físico do turno), as Contas a Receber (o que os clientes devem — fiado) e as Contas a Pagar (o que você deve). Só dinheiro mexe no caixa físico; Pix e cartão atualizam as contas sem entrar na gaveta.",
      },
      {
        kind: "steps",
        title: "Abrir e usar o caixa",
        items: [
          "Em Financeiro → Caixa, clique em Abrir caixa e informe o saldo inicial (troco).",
          "Suprimento (entrada): use ao colocar dinheiro no caixa (ex.: troco do banco).",
          "Sangria (saída): use ao retirar dinheiro (ex.: levar para o cofre).",
          "Cada movimento manual pede um valor e uma descrição.",
        ],
      },
      {
        kind: "steps",
        title: "Fiado: cliente, conta e recebimento",
        items: [
          "Cadastre o cliente em Financeiro → Clientes (nome é obrigatório).",
          "Lance uma conta a receber escolhendo o cliente, valor e, se quiser, vencimento.",
          "Para receber, abra a conta, informe o valor pago (pode ser parcial) e a forma.",
          "Em dinheiro o valor entra no caixa; em Pix/cartão só atualiza a conta.",
        ],
      },
      {
        kind: "steps",
        title: "Contas a pagar",
        items: [
          "Em Financeiro → Contas a pagar, crie a conta com descrição, valor e categoria.",
          "Opcional: informe o vencimento.",
          "Ao pagar, escolha a forma; em dinheiro sai do caixa, em Pix/cartão só atualiza a conta.",
        ],
      },
      {
        kind: "steps",
        title: "Fechar o caixa",
        items: [
          "Em Financeiro → Caixa, clique em Fechar caixa.",
          "Informe o dinheiro contado na gaveta (e, se quiser, totais de cartão e Pix).",
          "O sistema mostra Esperado x Contado e a Divergência (sobra ou falta).",
        ],
      },
      {
        kind: "fields",
        title: "Termos importantes",
        items: [
          { label: "Saldo inicial", desc: "Dinheiro no caixa ao abrir o turno." },
          { label: "Suprimento", desc: "Dinheiro que você coloca no caixa durante o dia." },
          { label: "Sangria", desc: "Dinheiro que você retira do caixa durante o dia." },
          { label: "Saldo devedor", desc: "Quanto ainda falta pagar de uma conta." },
          { label: "Vencimento", desc: "Prazo-limite para receber ou pagar; contas vencidas ficam marcadas." },
          { label: "Divergência", desc: "Diferença entre o esperado e o contado no fechamento." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "Só um caixa (turno) aberto por vez.",
          "Não dá para receber/pagar mais do que o saldo devedor.",
          "Contas são imutáveis; para corrigir, lance um movimento compensatório.",
          "Só dinheiro entra ou sai do caixa físico; Pix e cartão não.",
        ],
      },
    ],
  },
  {
    id: "lucro",
    icon: "📈",
    title: "Lucro",
    summary: "Quanto você realmente ganhou no período (faturamento menos custo).",
    blocks: [
      {
        kind: "p",
        text: "Mostra o ganho real do período, não só o dinheiro que girou. Lucro = Faturamento (preço das vendas) − Custo (o que custou a mercadoria vendida). Também mostra a margem % e o número de vendas.",
      },
      {
        kind: "steps",
        title: "Ver o lucro",
        items: [
          "Vá em Lucro (abre o dia de hoje por padrão).",
          "Em 'Período de análise', escolha De/Até para outro intervalo.",
          "Clique em Filtrar para ver lucro, faturamento, custo, margem e número de vendas.",
        ],
      },
      {
        kind: "rules",
        title: "Como o cálculo funciona",
        items: [
          "Lucro não é o mesmo que dinheiro no caixa: o fiado conta no lucro mas ainda não entrou na gaveta.",
          "O custo é congelado no momento da venda; mudar o custo do produto depois não altera vendas antigas.",
          "Produto sem custo cadastrado deixa o lucro superestimado — o sistema avisa quando isso acontece.",
          "O lucro pode ser negativo (prejuízo) se vender abaixo do custo.",
        ],
      },
      {
        kind: "tips",
        title: "Dicas",
        items: [
          "Apareceu 'lucro superestimado'? Cadastre o custo dos produtos que faltam.",
          "Para aumentar a margem: suba o preço ou negocie um custo menor com o fornecedor.",
        ],
      },
    ],
  },
  {
    id: "vendas",
    icon: "🧾",
    title: "Vendas (histórico do dia)",
    summary: "Resumo e lista das vendas realizadas hoje.",
    blocks: [
      {
        kind: "p",
        text: "Mostra as vendas do dia: total faturado, número de vendas, ticket médio e a lista de cada transação com hora, itens, forma de pagamento e valor. Cada venda finalizada no caixa entra aqui automaticamente.",
      },
      {
        kind: "fields",
        title: "O que aparece",
        items: [
          { label: "Total do dia", desc: "Faturamento bruto em reais." },
          { label: "Vendas", desc: "Quantidade de transações finalizadas." },
          { label: "Ticket médio", desc: "Total dividido pelo número de vendas." },
          { label: "Pagamento", desc: "Forma usada: Dinheiro, Pix, Cartão ou Fiado." },
        ],
      },
      {
        kind: "tips",
        title: "Dicas",
        items: [
          "Para períodos anteriores, use a Auditoria (filtra por data) ou o Lucro.",
          "Confira o total daqui antes de fechar o caixa — ajuda a bater a contagem.",
        ],
      },
    ],
  },
  {
    id: "usuarios",
    icon: "👥",
    title: "Usuários e permissões",
    summary: "Crie operadores e escolha o que cada um pode acessar.",
    blocks: [
      {
        kind: "p",
        text: "Permite que o dono crie operadores (funcionários) com acesso limitado, sem compartilhar a senha do dono nem expor dados sensíveis como custo, lucro e configurações. Cada operador tem e-mail, senha e permissões por função.",
      },
      {
        kind: "steps",
        title: "Criar um operador",
        items: [
          "Vá em Usuários e preencha nome, e-mail e senha provisória (mín. 6 caracteres).",
          "Escolha um preset: Caixa (vendas e comanda) ou Gerente (quase tudo, menos loja).",
          "Ou marque manualmente cada permissão desejada.",
          "Clique em Criar operador. O operador troca a senha no primeiro acesso.",
        ],
      },
      {
        kind: "fields",
        title: "As permissões",
        items: [
          { label: "Vendas", desc: "Registrar vendas no caixa." },
          { label: "Comanda", desc: "Abrir/fechar comandas e lançar itens." },
          { label: "Caixa", desc: "Abrir e fechar a sessão de caixa." },
          { label: "Produtos", desc: "Cadastrar e editar produtos." },
          { label: "Estoque", desc: "Registrar entradas e ajustes." },
          { label: "Financeiro", desc: "Ver lucro, custo, contas e fluxo de dinheiro." },
          { label: "Loja", desc: "Acessar as configurações da loja." },
          { label: "Gerenciar usuários", desc: "Criar/editar operadores e liberar ações sensíveis." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "O dono tem acesso a tudo e não pode ser editado ou desativado.",
          "Quem gerencia usuários só concede permissões que ele mesmo tem (não dá para se promover).",
          "Sem permissão, o item some do menu e fica inacessível.",
          "Desativar um operador corta o acesso na hora, mas preserva o histórico dele.",
          "Cada plano permite um número máximo de operadores; o dono não conta no limite.",
        ],
      },
      {
        kind: "tips",
        title: "Dúvidas comuns",
        items: [
          "Operador esqueceu a senha? O dono usa 'Resetar senha' (não há recuperação automática).",
          "Atingiu o limite de operadores? Desative um para liberar espaço.",
        ],
      },
    ],
  },
  {
    id: "auditoria",
    icon: "🔎",
    title: "Auditoria",
    summary: "Quem fez o quê, por operador e período.",
    blocks: [
      {
        kind: "p",
        text: "Relatório de atividade por operador no período escolhido: vendas e faturamento, caixas abertos/fechados, comandas abertas/fechadas/canceladas e movimentações de estoque e dinheiro. Útil para conferir produtividade e investigar divergências.",
      },
      {
        kind: "steps",
        title: "Consultar a auditoria",
        items: [
          "Vá em Auditoria.",
          "Filtre por operador (ou Todos) e por período (De/Até, ou clique em Hoje).",
          "Clique em Aplicar para ver a tabela por operador.",
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "Só o dono ou quem tem 'Gerenciar usuários' acessa.",
          "Operadores desativados continuam aparecendo nas ações que fizeram (com marca de inativo).",
        ],
      },
    ],
  },
  {
    id: "configuracoes",
    icon: "⚙️",
    title: "Configurações",
    summary: "Ajustes da loja, como a margem padrão.",
    blocks: [
      {
        kind: "p",
        text: "Centraliza ajustes da loja. Hoje permite definir a margem padrão (markup) aplicada automaticamente a novos produtos.",
      },
      {
        kind: "fields",
        title: "Campos",
        items: [
          { label: "Margem padrão (%)", desc: "Porcentagem de lucro pré-preenchida em cada novo produto." },
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "Só quem tem a permissão 'Loja' acessa.",
          "Vale apenas para produtos novos; os já cadastrados mantêm a margem original.",
        ],
      },
    ],
  },
  {
    id: "perfil",
    icon: "🔑",
    title: "Meu perfil",
    summary: "Troque a sua própria senha.",
    blocks: [
      {
        kind: "p",
        text: "Página pessoal onde qualquer usuário troca a própria senha. Operadores criados pelo dono usam a senha provisória no primeiro acesso e devem trocá-la aqui.",
      },
      {
        kind: "steps",
        title: "Trocar a senha",
        items: [
          "Vá em Meu perfil.",
          "Informe a senha atual e a nova senha (mín. 6 caracteres).",
          "Clique em Salvar nova senha.",
        ],
      },
      {
        kind: "rules",
        title: "Regras importantes",
        items: [
          "Qualquer usuário pode trocar a própria senha.",
          "Não há 'esqueci a senha' — só o dono pode resetar a senha de um operador.",
        ],
      },
    ],
  },
  {
    id: "impressao",
    icon: "🖨️",
    title: "Impressão",
    summary: "Pedido da cozinha e cupom do cliente em impressora térmica.",
    blocks: [
      {
        kind: "p",
        text: "O app usa uma impressora térmica USB em dois momentos: o pedido da cozinha sai automaticamente ao lançar um item na comanda, e o cupom/recibo sai ao fechar uma venda (direta ou comanda). O cupom não é fiscal (não é nota da SEFAZ).",
      },
      {
        kind: "rules",
        title: "Como funciona",
        items: [
          "Falha na impressora não bloqueia a venda: um aviso aparece e a venda grava normalmente.",
          "Dá para reimprimir o cupom ou o pedido pelo histórico, quando precisar.",
          "O número do pedido da cozinha reinicia todo dia.",
        ],
      },
    ],
  },
];
