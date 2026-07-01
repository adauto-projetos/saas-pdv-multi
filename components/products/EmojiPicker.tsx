"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type EmojiEntry = { emoji: string; keywords: string[] };

/**
 * Lista curada de emojis comuns de mercado/bar/lanchonete, com palavras-chave em
 * português. A busca é por palavra (sem acento) — digitar "cerveja", "pao" ou
 * "refri" filtra a lista. Os primeiros itens são os mais usados (palette padrão).
 */
const EMOJIS: EmojiEntry[] = [
  // Mais usados / genéricos
  { emoji: "🛒", keywords: ["mercado", "compras", "carrinho", "generico"] },
  { emoji: "📦", keywords: ["produto", "caixa", "generico", "pacote"] },
  // Bebidas
  { emoji: "🍺", keywords: ["cerveja", "chopp", "breja", "bar"] },
  { emoji: "🍻", keywords: ["cervejas", "brinde", "bar"] },
  { emoji: "🥤", keywords: ["refrigerante", "refri", "copo", "soda", "coca"] },
  { emoji: "🧃", keywords: ["suco", "caixinha", "nectar"] },
  { emoji: "💧", keywords: ["agua", "agua mineral"] },
  { emoji: "☕", keywords: ["cafe", "cafezinho", "expresso"] },
  { emoji: "🥛", keywords: ["leite", "copo de leite"] },
  { emoji: "🍷", keywords: ["vinho", "taca"] },
  { emoji: "🥂", keywords: ["espumante", "champanhe", "brinde"] },
  { emoji: "🍸", keywords: ["drink", "coquetel", "martini"] },
  { emoji: "🍹", keywords: ["drink", "caipirinha", "tropical"] },
  { emoji: "🥃", keywords: ["whisky", "cachaca", "dose", "destilado"] },
  { emoji: "🧉", keywords: ["chimarrao", "terere", "mate"] },
  { emoji: "🍵", keywords: ["cha", "mate"] },
  { emoji: "🍼", keywords: ["mamadeira", "leite bebe"] },
  { emoji: "🍾", keywords: ["espumante", "champanhe", "garrafa", "champagne"] },
  { emoji: "🫗", keywords: ["servir", "despejar", "bebida"] },
  { emoji: "🧋", keywords: ["bubble tea", "tapioca", "cha gelado", "milk shake"] },
  { emoji: "🍶", keywords: ["sake", "garrafa", "saque"] },
  // Lanches / comidas
  { emoji: "🍔", keywords: ["hamburguer", "lanche", "burguer", "x-burguer"] },
  { emoji: "🌭", keywords: ["cachorro quente", "hot dog", "dog"] },
  { emoji: "🍟", keywords: ["batata frita", "fritas"] },
  { emoji: "🍕", keywords: ["pizza"] },
  { emoji: "🥪", keywords: ["sanduiche", "misto", "sandes"] },
  { emoji: "🌮", keywords: ["taco"] },
  { emoji: "🌯", keywords: ["burrito", "wrap", "beirute"] },
  { emoji: "🥙", keywords: ["esfiha", "kebab", "pita"] },
  { emoji: "🧆", keywords: ["quibe", "falafel"] },
  { emoji: "🍳", keywords: ["ovo frito", "fritada"] },
  { emoji: "🥚", keywords: ["ovo"] },
  { emoji: "🥓", keywords: ["bacon"] },
  { emoji: "🍗", keywords: ["frango", "coxa", "asa"] },
  { emoji: "🍖", keywords: ["carne", "churrasco", "espetinho"] },
  { emoji: "🥩", keywords: ["carne", "bife", "picanha", "file"] },
  { emoji: "🍤", keywords: ["camarao", "frito"] },
  { emoji: "🍣", keywords: ["sushi", "japonesa"] },
  { emoji: "🍱", keywords: ["marmita", "comida japonesa"] },
  { emoji: "🍜", keywords: ["lamen", "miojo", "sopa"] },
  { emoji: "🍝", keywords: ["macarrao", "massa", "espaguete"] },
  { emoji: "🍲", keywords: ["sopa", "caldo", "ensopado"] },
  { emoji: "🥘", keywords: ["panela", "paella"] },
  { emoji: "🥗", keywords: ["salada"] },
  { emoji: "🥫", keywords: ["enlatado", "conserva", "lata"] },
  { emoji: "🍞", keywords: ["pao", "pao de forma"] },
  { emoji: "🥖", keywords: ["pao frances", "baguete"] },
  { emoji: "🥐", keywords: ["croissant"] },
  { emoji: "🥨", keywords: ["pretzel", "rosquinha salgada"] },
  { emoji: "🧀", keywords: ["queijo"] },
  { emoji: "🧇", keywords: ["waffle"] },
  { emoji: "🥞", keywords: ["panqueca"] },
  { emoji: "🥟", keywords: ["pastel", "guioza", "empanada", "dumpling"] },
  { emoji: "🍢", keywords: ["espetinho", "espeto", "churrasquinho"] },
  { emoji: "🫓", keywords: ["tapioca", "pao sirio", "crepe", "beiju"] },
  { emoji: "🥯", keywords: ["bagel", "rosca"] },
  { emoji: "🍛", keywords: ["comida", "prato feito", "pf", "curry", "marmita"] },
  { emoji: "🫔", keywords: ["pamonha", "pastel", "tamale"] },
  { emoji: "🥠", keywords: ["biscoito da sorte"] },
  { emoji: "🍥", keywords: ["kani", "narutomaki"] },
  // Doces
  { emoji: "🍦", keywords: ["sorvete", "casquinha"] },
  { emoji: "🍨", keywords: ["sorvete", "sundae"] },
  { emoji: "🍧", keywords: ["raspadinha", "gelo"] },
  { emoji: "🍩", keywords: ["donut", "rosquinha"] },
  { emoji: "🍪", keywords: ["biscoito", "cookie", "bolacha"] },
  { emoji: "🎂", keywords: ["bolo", "aniversario"] },
  { emoji: "🧁", keywords: ["cupcake", "bolinho"] },
  { emoji: "🍰", keywords: ["fatia de bolo", "torta"] },
  { emoji: "🥧", keywords: ["torta"] },
  { emoji: "🍫", keywords: ["chocolate"] },
  { emoji: "🍬", keywords: ["bala", "doce"] },
  { emoji: "🍭", keywords: ["pirulito"] },
  { emoji: "🍮", keywords: ["pudim", "flan"] },
  { emoji: "🍯", keywords: ["mel"] },
  { emoji: "🍿", keywords: ["pipoca"] },
  { emoji: "🍡", keywords: ["espetinho doce", "dango"] },
  { emoji: "🍘", keywords: ["biscoito de arroz", "bolacha"] },
  // Frutas
  { emoji: "🍎", keywords: ["maca", "fruta"] },
  { emoji: "🍏", keywords: ["maca verde"] },
  { emoji: "🍐", keywords: ["pera"] },
  { emoji: "🍊", keywords: ["laranja", "tangerina", "mexerica"] },
  { emoji: "🍋", keywords: ["limao"] },
  { emoji: "🍌", keywords: ["banana"] },
  { emoji: "🍉", keywords: ["melancia"] },
  { emoji: "🍇", keywords: ["uva"] },
  { emoji: "🍓", keywords: ["morango"] },
  { emoji: "🫐", keywords: ["mirtilo", "blueberry"] },
  { emoji: "🍈", keywords: ["melao"] },
  { emoji: "🍒", keywords: ["cereja"] },
  { emoji: "🍑", keywords: ["pessego"] },
  { emoji: "🥭", keywords: ["manga"] },
  { emoji: "🍍", keywords: ["abacaxi"] },
  { emoji: "🥥", keywords: ["coco"] },
  { emoji: "🥝", keywords: ["kiwi"] },
  { emoji: "🫒", keywords: ["azeitona", "oliva", "azeite"] },
  // Verduras / legumes
  { emoji: "🍅", keywords: ["tomate"] },
  { emoji: "🥑", keywords: ["abacate"] },
  { emoji: "🍆", keywords: ["berinjela"] },
  { emoji: "🥔", keywords: ["batata"] },
  { emoji: "🥕", keywords: ["cenoura"] },
  { emoji: "🌽", keywords: ["milho"] },
  { emoji: "🌶️", keywords: ["pimenta"] },
  { emoji: "🫑", keywords: ["pimentao"] },
  { emoji: "🥒", keywords: ["pepino"] },
  { emoji: "🥬", keywords: ["alface", "verdura", "folha"] },
  { emoji: "🥦", keywords: ["brocolis"] },
  { emoji: "🧄", keywords: ["alho"] },
  { emoji: "🧅", keywords: ["cebola"] },
  { emoji: "🍄", keywords: ["cogumelo"] },
  { emoji: "🥜", keywords: ["amendoim", "castanha"] },
  { emoji: "🌰", keywords: ["castanha", "castanha portuguesa"] },
  { emoji: "🫛", keywords: ["ervilha", "vagem"] },
  { emoji: "🫚", keywords: ["gengibre", "raiz"] },
  // Mercearia
  { emoji: "🍚", keywords: ["arroz"] },
  { emoji: "🫘", keywords: ["feijao", "grao"] },
  { emoji: "🌾", keywords: ["trigo", "cereal", "graos"] },
  { emoji: "🥣", keywords: ["cereal", "mingau", "tigela"] },
  { emoji: "🧈", keywords: ["manteiga", "margarina"] },
  { emoji: "🧂", keywords: ["sal", "tempero"] },
  { emoji: "🥡", keywords: ["marmita", "viagem", "quentinha"] },
  { emoji: "🧊", keywords: ["gelo"] },
  { emoji: "🫙", keywords: ["pote", "conserva", "vidro", "compota"] },
  // Higiene / limpeza
  { emoji: "🧴", keywords: ["sabonete liquido", "shampoo", "detergente", "alcool gel", "amaciante"] },
  { emoji: "🧼", keywords: ["sabao", "sabonete"] },
  { emoji: "🧽", keywords: ["esponja", "bucha"] },
  { emoji: "🧹", keywords: ["vassoura", "limpeza"] },
  { emoji: "🧺", keywords: ["cesto", "roupa"] },
  { emoji: "🧻", keywords: ["papel higienico", "papel toalha"] },
  { emoji: "🚿", keywords: ["chuveiro", "banho"] },
  { emoji: "🪥", keywords: ["escova de dente"] },
  { emoji: "🦷", keywords: ["creme dental", "dente"] },
  // Pet
  { emoji: "🐕", keywords: ["cachorro", "pet", "racao"] },
  { emoji: "🐈", keywords: ["gato", "pet"] },
  { emoji: "🦴", keywords: ["osso", "racao"] },
  // Casa / utilidades
  { emoji: "🔥", keywords: ["gas", "fogo", "botijao"] },
  { emoji: "⛽", keywords: ["gas", "combustivel"] },
  { emoji: "🔋", keywords: ["pilha", "bateria"] },
  { emoji: "💡", keywords: ["lampada"] },
  { emoji: "🕯️", keywords: ["vela"] },
  { emoji: "🔌", keywords: ["tomada", "carregador"] },
  { emoji: "🪣", keywords: ["balde"] },
  { emoji: "🧰", keywords: ["ferramenta"] },
  // Tabacaria / papelaria
  { emoji: "🚬", keywords: ["cigarro", "tabaco"] },
  { emoji: "✏️", keywords: ["lapis"] },
  { emoji: "🖊️", keywords: ["caneta"] },
  { emoji: "📒", keywords: ["caderno"] },
  { emoji: "✂️", keywords: ["tesoura"] },
  // Diversos
  { emoji: "💵", keywords: ["dinheiro"] },
  { emoji: "🎁", keywords: ["presente"] },
  { emoji: "🧸", keywords: ["brinquedo", "urso"] },
  { emoji: "🎈", keywords: ["balao", "festa"] },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const DEFAULT_COUNT = 28;
const MAX_RESULTS = 48;

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = React.useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return EMOJIS.slice(0, DEFAULT_COUNT);
    return EMOJIS.filter((e) =>
      e.keywords.some((k) => normalize(k).includes(q)),
    ).slice(0, MAX_RESULTS);
  }, [query]);

  function handleBlur() {
    // Atraso para o clique num emoji registrar antes de fechar a lista.
    blurTimer.current = setTimeout(() => setOpen(false), 130);
  }

  function select(emoji: string) {
    onChange(emoji);
    setQuery("");
    setOpen(false);
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input text-xl"
        >
          {value || "🔎"}
        </span>
        <Input
          id="emoji"
          className="text-base"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder="Busque: cerveja, pão, refri…"
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            onClick={() => select("")}
            className="shrink-0 text-xs text-muted-foreground hover:underline"
          >
            Limpar
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-input bg-popover p-2 shadow-md"
          // Evita que o blur do input feche a lista antes do clique.
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Nenhum emoji encontrado para “{query.trim()}”.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {results.map((e) => (
                <button
                  key={e.emoji}
                  type="button"
                  title={e.keywords[0]}
                  onClick={() => select(e.emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-accent ${
                    value === e.emoji ? "bg-accent ring-1 ring-ring" : ""
                  }`}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
