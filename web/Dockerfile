FROM node:24-alpine AS build
WORKDIR /src
ARG VITE_API_URL=http://localhost:8080
ARG VITE_DEMO_READ_ONLY=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_READ_ONLY=$VITE_DEMO_READ_ONLY
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY web ./web
RUN pnpm --dir web run build

FROM nginx:1.27-alpine
COPY --from=build /src/web/dist /usr/share/nginx/html
EXPOSE 80
