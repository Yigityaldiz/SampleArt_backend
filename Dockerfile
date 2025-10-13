# ----------------------------
# 1️⃣ Base image (ortak temel)
# ----------------------------
FROM node:20-bookworm-slim AS base

# Çalışma dizini
WORKDIR /app

# Corepack (pnpm yönetimi için)
RUN corepack enable

# Gereksiz paketleri tutmamak için temiz kurulum
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# ----------------------------
# 2️⃣ Dependencies (node_modules)
# ----------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./

# Cache kullanarak hızlı ve güvenli bağımlılık yükleme
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ----------------------------
# 3️⃣ Build aşaması (TypeScript → JS)
# ----------------------------
FROM deps AS build
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Prisma Client üretimi
RUN pnpm prisma generate

# Projeyi build et
RUN pnpm build

# Sadece production bağımlılıklarını bırak
RUN pnpm prune --prod

# ----------------------------
# 4️⃣ Runtime aşaması (prod container)
# ----------------------------
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# Non-root kullanıcı (güvenlik için)
RUN useradd -m -u 10001 appuser

# Prod için sadece gerekli dosyalar
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Upload klasörü (örnek: S3 öncesi local store)
RUN mkdir -p storage/uploads && chown -R appuser:appuser /app

# Non-root user olarak çalıştır
USER appuser

# Uygulama portu
EXPOSE 3000

# Başlat
CMD ["node", "dist/server.js"]
