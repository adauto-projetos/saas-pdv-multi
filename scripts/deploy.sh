#!/usr/bin/env bash
# deploy.sh — versiona, push GitHub e redeploy no Hetzner
# Uso: bash scripts/deploy.sh
# Requer: SSH key em /tmp/pdv_deploy, git configurado, docker no servidor

set -e

SERVER="root@37.27.220.149"
KEY="/tmp/pdv_deploy"
APP_DIR="/opt/pdv"

# 1. Bump patch version (0.0.1 → 0.0.2)
echo "🔢 Incrementando versão..."
npm version patch --no-git-tag-version
VERSION=$(node -p "require('./package.json').version")
echo "   → v$VERSION"

# 2. Commit + tag + push GitHub
echo "📦 Enviando para GitHub..."
git add package.json package-lock.json
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"
git push origin master
git push origin "v$VERSION"

# 3. Deploy no Hetzner
echo "🚀 Deploy no Hetzner (pdv.art.br)..."
ssh -o StrictHostKeyChecking=no -i "$KEY" "$SERVER" "
  cd $APP_DIR
  git pull origin master
  docker compose -f docker-compose.prod.yml build --no-cache app
  docker compose -f docker-compose.prod.yml up -d
  echo 'Containers:'
  docker ps --format 'table {{.Names}}\t{{.Status}}'
"

echo ""
echo "✅ Deploy v$VERSION concluído — https://pdv.art.br"
