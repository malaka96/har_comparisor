# syntax=docker/dockerfile:1

# ---- Build: install everything and build shared, server and client ----
# The output is plain JavaScript, so it is built once on the machine's own platform
# (no emulation) and copied into the runtime image of every target platform.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/e2e/package.json packages/e2e/
RUN npm ci --no-audit --no-fund --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/client packages/client
RUN npm run build

# ---- Runtime: production dependencies of the server only, plus built files ----
FROM node:26-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="HAR Comparisor" \
      org.opencontainers.image.description="Compare two HAR files side by side in your browser. Runs locally; nothing leaves your machine." \
      org.opencontainers.image.source="https://github.com/malaka96/har_comparisor" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production \
    PORT=9096 \
    HOST=0.0.0.0
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/e2e/package.json packages/e2e/
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts --workspace=@har-comparisor/server \
    && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/client/dist packages/client/dist

# Run as the unprivileged user that the Node image provides.
USER node
EXPOSE 9096
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||9096)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]
