FROM node:24-alpine AS build
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
RUN corepack enable && pnpm install --frozen-lockfile
COPY backend ./backend
RUN pnpm --dir backend run build

FROM node:24-alpine
WORKDIR /src
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
RUN corepack enable && pnpm install --prod --frozen-lockfile --filter @subculture/dsa-proto-api
COPY --from=build /src/backend/dist ./backend/dist
COPY --from=build /src/backend/fixtures ./backend/fixtures
COPY migrations ./migrations
WORKDIR /src/backend
EXPOSE 8080
CMD ["node", "dist/index.js"]
