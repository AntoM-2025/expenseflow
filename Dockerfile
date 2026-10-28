# syntax=docker/dockerfile:1

# ==========================================
# STAGE 1: BUILD FRONTEND REACT
# ==========================================

FROM node:24-bookworm-slim AS client-build

WORKDIR /app/client

# Installazione dipendenze frontend
COPY client/package.json client/package-lock.json ./

RUN npm ci

# Copia codice React
COPY client/ ./

# Compilazione React
RUN npm run build


# ==========================================
# STAGE 2: BUILD BACKEND TYPESCRIPT
# ==========================================

FROM node:24-bookworm-slim AS server-build

WORKDIR /app/server

# Installazione dipendenze backend
COPY server/package.json server/package-lock.json ./

RUN npm ci

# Copia configurazione TypeScript
COPY server/tsconfig*.json ./

# Copia codice backend
COPY server/src/ ./src/

# Compilazione TypeScript
RUN npm run build

# Rimuove le dipendenze necessarie solo
# durante lo sviluppo
RUN npm prune --omit=dev


# ==========================================
# STAGE 3: IMMAGINE DI PRODUZIONE
# ==========================================

FROM node:24-bookworm-slim AS production

ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app/server

# Copia package.json
COPY --from=server-build --chown=node:node \
  /app/server/package.json ./package.json

# Copia dipendenze di produzione
COPY --from=server-build --chown=node:node \
  /app/server/node_modules ./node_modules

# Copia backend compilato
COPY --from=server-build --chown=node:node \
  /app/server/dist ./dist

# Copia frontend React compilato
COPY --from=client-build --chown=node:node \
  /app/client/dist /app/client/dist

COPY --chown=node:node database/migrations/ /app/database/migrations/

# Esecuzione senza privilegi root
USER node

# Porta HTTP del server
EXPOSE 10000

# Avvio del backend
CMD ["node", "dist/app.js"]