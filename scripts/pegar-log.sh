#!/usr/bin/env bash
# pegar-log.sh — junta as informações de diagnóstico num arquivo só, para
# enviar a quem dá suporte ao sistema.
# Uso: bash scripts/pegar-log.sh
#
# Não altera nada: só lê o estado atual e grava um arquivo de texto na Área de
# Trabalho. Pode rodar a qualquer momento, inclusive com o sistema no ar.

export MSYS_NO_PATHCONV=1

# Área de Trabalho; se não existir (ex.: redirecionada pro OneDrive), cai na
# pasta pessoal, que sempre existe.
DEST="$HOME/Desktop/log-pdv.txt"
[ -d "$HOME/Desktop" ] || DEST="$HOME/log-pdv.txt"

# O bloco inteiro é redirecionado com "2>&1": sem isso, as mensagens de ERRO
# (que saem por um canal separado da saída normal) apareceriam só na tela e
# ficariam de fora do arquivo — justamente a parte que o suporte precisa ver.
{
  echo "===== PDV — coleta de diagnóstico ====="
  echo "quando (local): $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "quando (UTC):   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "pasta:          $PWD"
  if [ -f package.json ]; then
    echo "versao:         $(grep '"version"' package.json | head -n 1 | tr -d ' ",' | cut -d: -f2)"
  else
    echo "versao:         (rode este script de dentro da pasta do sistema para saber)"
  fi
  if [ -f .env ]; then
    PORT=$(grep -E '^APP_PORT=' .env | tail -n 1 | cut -d= -f2)
    echo "porta:          ${PORT:-80}"
  fi

  echo ""
  echo "===== containers ====="
  docker ps -a --filter "name=pdv_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" \
    || echo "(nao consegui listar os containers — o Docker Desktop esta aberto?)"

  echo ""
  echo "===== log do sistema (ultimas 500 linhas) ====="
  docker logs pdv_app --tail 500 --timestamps \
    || echo "(nao consegui ler o log do sistema)"

  echo ""
  echo "===== log do banco de dados (ultimas 100 linhas) ====="
  docker logs pdv_db --tail 100 --timestamps \
    || echo "(nao consegui ler o log do banco)"

  echo ""
  echo "===== fim ====="
} > "$DEST" 2>&1

echo "✅ Diagnóstico salvo em:"
echo "   $DEST"
echo ""
echo "Envie esse arquivo para quem dá suporte ao sistema."
