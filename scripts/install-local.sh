#!/usr/bin/env bash
# install-local.sh — instalação local do PDV no PC do cliente (feature 0026F)
# Uso: bash scripts/install-local.sh <arquivo-export-tenant.json>
# Pré-requisitos: Docker Desktop instalado e rodando; repositório já clonado
# (git clone manual, passo a passo em docs/features/0026F-instalacao-local/SETUP.md).
#
# Este script SÓ empacota/orquestra containers e credenciais — não altera
# nenhum código do app. Os passos de banco (schema + dados + verificação de
# RLS) rodam DENTRO do container `app` já construído (docker compose run),
# não no host: Docker Desktop continua sendo o único pré-requisito do PC do
# cliente, Node.js nunca precisa ser instalado separadamente (ver plan.md >
# Architecture Decisions).

set -e

# No Git Bash do Windows (ambiente esperado no PC do cliente, já que é onde o
# Docker Desktop roda), o MSYS traduz caminhos POSIX (/d/pasta/...) só que
# quebra silenciosamente quando o caminho vai dentro de um valor combinado
# tipo "-v origem:destino:ro" — o container sobe sem erro, mas o arquivo
# montado simplesmente não existe do lado de dentro (confirmado via teste
# manual). Essa var desliga essa tradução automática só para chamadas do
# Docker; sem efeito em Linux/Mac (a var não existe/não é usada lá).
export MSYS_NO_PATHCONV=1

COMPOSE_FILE="docker-compose.prod.yml"

# 1. Docker precisa estar rodando.
echo "🔎 Verificando Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "✗ Docker não está rodando. Abra o Docker Desktop e tente novamente."
  exit 1
fi

# 2. Guarda: instalação roda só uma vez por PC. Reinstalar por cima apagaria
#    a trilha de credenciais já geradas; atualização de versão é responsabilidade
#    de update-local.sh, que não mexe em dados.
if [ -f .env ]; then
  echo "✗ Já instalado (.env existe). Para atualizar para uma nova versão, use: bash scripts/update-local.sh"
  exit 1
fi

# 3. Exige o caminho do arquivo de export do tenant (gerado na produção e
#    transferido manualmente pro PC do cliente — ver SETUP.md).
EXPORT_FILE="$1"
if [ -z "$EXPORT_FILE" ]; then
  echo "Uso: bash scripts/install-local.sh <arquivo-export-tenant.json>"
  exit 1
fi
if [ ! -f "$EXPORT_FILE" ]; then
  echo "✗ Arquivo de export não encontrado: $EXPORT_FILE"
  exit 1
fi
# Caminho absoluto — necessário para o bind mount do "docker compose run" abaixo.
EXPORT_FILE_ABS="$(cd "$(dirname "$EXPORT_FILE")" && pwd)/$(basename "$EXPORT_FILE")"

# 4. Garante estado limpo antes de gerar credenciais novas. A imagem oficial
#    do Postgres só aplica POSTGRES_PASSWORD na PRIMEIRA inicialização de um
#    volume vazio — se uma tentativa anterior chegou a subir o banco (passo 6)
#    e falhou depois disso, o volume "pdv_pgdata" já ficou com a senha ANTIGA
#    gravada. Como só chegamos aqui quando ".env" não existe (guarda acima —
#    ou é a primeira instalação, ou uma tentativa anterior falhou), remover
#    qualquer container/volume remanescente é sempre seguro: numa máquina
#    limpa isso é um no-op; numa retentativa, evita gerar uma senha nova que
#    nunca vai bater com a já gravada no volume antigo.
docker compose -f "$COMPOSE_FILE" down -v > /dev/null 2>&1 || true

# 5. Gera credenciais locais fortes — nunca hardcoded, nunca o default de dev
#    (o guard de sessão rejeita segredo fraco/default em produção).
echo "🔑 Gerando credenciais locais..."
cp .env.example .env
sed -i '/^SESSION_SECRET=/d' .env
sed -i '/^POSTGRES_PASSWORD=/d' .env
# .env.example traz um DATABASE_URL de dev (senha fraca "postgres", hardcoded)
# para uso com docker-compose.yml local — não é lido pelo docker-compose.prod.yml
# (que monta a sua própria connection string a partir de POSTGRES_PASSWORD acima),
# mas deixá-lo no .env de um cliente é ruído/risco desnecessário: remove.
sed -i '/^DATABASE_URL=/d' .env
SESSION_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 32)
{
  echo "SESSION_SECRET=$SESSION_SECRET"
  echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
} >> .env

# 6. Sobe só o banco primeiro, espera ficar saudável (healthcheck já definido
#    no compose).
echo "🐘 Subindo o banco de dados..."
docker compose -f "$COMPOSE_FILE" up -d db

echo "⏳ Aguardando o banco ficar saudável..."
TRIES=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' pdv_db 2>/dev/null)" = "healthy" ]; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge 60 ]; then
    echo "✗ Banco não ficou saudável a tempo (timeout)."
    exit 1
  fi
  sleep 2
done
echo "✓ Banco saudável."

# 7. Schema (push-only) + dados só desse tenant + verificação de RLS/segredo,
#    tudo dentro do container app antes dele virar o serviço definitivo.
echo "🗄️  Aplicando schema, importando dados do tenant e verificando RLS..."
docker compose -f "$COMPOSE_FILE" run --rm \
  -v "$EXPORT_FILE_ABS:/tmp/import.json:ro" \
  app \
  sh -c "npm run db:setup && npx tsx scripts/import-tenant.ts /tmp/import.json && npm run verify:prod"

# 8. Sobe o app definitivo.
echo "🚀 Subindo o app..."
docker compose -f "$COMPOSE_FILE" up -d app

echo ""
echo "✅ Instalação concluída — acesse http://localhost"
