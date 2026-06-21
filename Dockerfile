# ─── Build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Deps primeiro (layer cache: só reinstala se package.json mudar)
COPY package*.json ./
RUN npm ci

# Código-fonte + build do Next.js
COPY . .
RUN npm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiamos tudo do builder: node_modules inclui drizzle-kit (devDep necessária
# para o comando de migração `npm run db:setup` no pré-deploy).
COPY --from=builder /app .

EXPOSE 3000

# Ao iniciar: aplica schema + RLS no banco e sobe o servidor.
# Se o banco não estiver pronto ainda, o container falha e o orquestrador
# (Coolify / Docker) reinicia automaticamente até conseguir.
CMD ["sh", "-c", "npm run db:setup && npm start"]
