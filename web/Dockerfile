FROM node:24-alpine AS build
WORKDIR /src
ARG VITE_API_URL=http://localhost:8080
ARG VITE_DEMO_READ_ONLY=false
ARG VITE_FOUNDATION_V1=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_READ_ONLY=$VITE_DEMO_READ_ONLY
ENV VITE_FOUNDATION_V1=$VITE_FOUNDATION_V1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
COPY packages/foundation-client/package.json ./packages/foundation-client/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/foundation-client ./packages/foundation-client
COPY web ./web
RUN pnpm --dir web run build

FROM nginx:1.27-alpine
COPY --from=build /src/web/dist /usr/share/nginx/html
EXPOSE 80
