# Build context is the monorepo root (not backend/) because backend depends
# on the @echory/contract workspace package. See docker-compose.yml.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
RUN npm ci

COPY shared ./shared
COPY backend ./backend

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "backend"]
