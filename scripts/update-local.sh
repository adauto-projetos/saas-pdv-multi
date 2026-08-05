#!/usr/bin/env bash
# update-local.sh — atualização da instalação local do PDV (feature 0026F)
# Uso: bash scripts/update-local.sh
# Rodado pelo CLIENTE, sozinho, quando o founder avisar que uma nova versão
# está disponível. Não toca em dados — só busca o código novo e reconstrói/
# reinicia o container do app.

set -e

COMPOSE_FILE="docker-compose.prod.yml"

# Guarda: só atualiza uma instalação que já existe.
if [ ! -f .env ]; then
  echo "✗ Instalação não encontrada (.env não existe). Rode primeiro: bash scripts/install-local.sh <arquivo-export.json>"
  exit 1
fi

echo "📥 Buscando a versão mais recente..."
git fetch origin --tags

LATEST_TAG=$(git tag --list 'v*' --sort=-v:refname | head -n 1)
TARGET="${LATEST_TAG:-master}"

echo "🔀 Atualizando para: $TARGET"
git checkout "$TARGET"

# Schema, dados e a verificação de integridade NÃO são tocados por este
# script — o processo de inicialização do container do app já reaplica essas
# etapas de forma idempotente toda vez que ele sobe (mesmo caminho usado em
# produção), então atualizar aqui é só trocar o código e reiniciar o serviço.
echo "📦 Reconstruindo o app..."
docker compose -f "$COMPOSE_FILE" build app

echo "🚀 Reiniciando o app..."
docker compose -f "$COMPOSE_FILE" up -d app

echo ""
echo "✅ Atualização concluída — acesse http://localhost"
