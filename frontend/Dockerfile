# Build context is the monorepo root (not frontend/) because frontend depends
# on the @echory/contract workspace package. See docker-compose.yml.
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY shared ./shared
COPY frontend ./frontend
RUN npm run build -w frontend

# Static output only from here -- nginx, not a Node runtime, serves the
# built assets. The dashboard calls the backend directly at
# http://localhost:3000 from the browser (frontend/src/lib/api.ts), so this
# container needs no runtime config or network link to the backend itself.
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
