# Dockerfile otimizado para Google Cloud Run + Supabase (PostgreSQL)
FROM node:20-alpine

WORKDIR /app

# Instalar dependências primeiro para aproveitar cache de camadas
COPY package*.json ./
RUN npm install

# Copiar código-fonte e fazer build do frontend (Vite) e backend (esbuild -> dist/server.cjs)
COPY . .
RUN npm run build

# Configuração padrão para Google Cloud Run
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Iniciar o servidor Express compilado (lê PORT automaticamente do Cloud Run)
CMD ["npm", "start"]
