#!/usr/bin/env bash
# coletar-logs.sh — gera um arquivo com os logs da instalação local (chore 0027C)
# Uso: bash scripts/coletar-logs.sh
# Rodado no PC do cliente (pelo cliente ou por quem estiver com ele) quando
# algo dá errado. Gera um único arquivo .txt com versão, status dos
# containers e os logs recentes do app e do banco — pra enviar a quem cuida
# do sistema, sem precisar de acesso remoto ao PC do cliente. Não toca em
# nenhum dado nem em código do app — só leitura.

set -e

COMPOSE_FILE="docker-compose.prod.yml"

# Guarda: só faz sentido coletar logs de uma instalação que já existe.
if [ ! -f .env ]; then
  echo "✗ Instalação não encontrada (.env não existe). Nada para coletar."
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT="logs-pdv-$TIMESTAMP.txt"

echo "📋 Coletando informações do sistema..."

{
  echo "=== PDV — coleta de logs ($TIMESTAMP) ==="
  echo ""
  echo "--- Versão instalada ---"
  node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "desconhecida"
  echo ""
  echo "--- Status dos containers ---"
  docker compose -f "$COMPOSE_FILE" ps 2>&1
  echo ""
  echo "--- Logs do app (últimas 300 linhas) ---"
  docker compose -f "$COMPOSE_FILE" logs --no-color --tail=300 app 2>&1
  echo ""
  echo "--- Logs do banco (últimas 100 linhas) ---"
  docker compose -f "$COMPOSE_FILE" logs --no-color --tail=100 db 2>&1
} > "$OUT"

echo ""
echo "✅ Log gerado: $OUT"
echo "Envie esse arquivo (por e-mail, WhatsApp, pendrive) pra quem cuida do"
echo "sistema. Ele não contém senhas nem dados de cartão — só o que o"
echo "próprio sistema já imprime no terminal quando roda."
