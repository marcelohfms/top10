# Etapa 1: build do cliente (precisa das devDependencies: tsc + vite)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: runtime enxuto — so o que `tsx servidor.ts` precisa
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY servidor.ts tsconfig.json tsconfig.node.json ./
COPY src ./src

# Snapshot das salas: monte um volume em /app/dados para sobreviver a redeploys
ENV PORTA=3000 DADOS=/app/dados/salas.json
RUN mkdir -p /app/dados && chown -R node:node /app
USER node
EXPOSE 3000
# tsx direto (sem `npm start`) para SIGTERM chegar ao processo e o snapshot ser gravado
CMD ["node_modules/.bin/tsx", "servidor.ts"]
