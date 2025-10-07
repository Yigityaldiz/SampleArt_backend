# Backend Roadmap & Task Tracker

Bu dosya backend geliştirme sürecindeki görevleri mikro seviyede takip etmek için kullanılır. Tamamlanan görevler `[x]`, devam edenler `[~]`, bloklananlar `[!]`, bekleyenler `[ ]` olarak işaretlenir.

## Phase 0 – Hazırlık

- [x] Backend teknoloji yönergelerini yaz (`rules/backend-guidelines.md`)
- [x] Modül/klasör hiyerarşisini tanımla (`rules/module-structure.md`)
- [x] Yerel kurulum rehberini hazırla (`rules/local-setup.md`)
- [x] Yol haritası ve görev takip sistemini oluştur (`rules/backend-roadmap.md`)

## Phase 1 – Proje Bootstrap

**Proje İskeleti**

- [x] pnpm + TypeScript ile proje paketini başlat (`package.json`, `tsconfig.json`)
- [x] `src` temel klasör yapısını oluştur (`app.ts`, `server.ts`, `config/` vb.)
- [x] ESLint + Prettier yapılandır ve scriptlere ekle
- [ ] Commit kancaları için Husky + lint-staged kur (opsiyonel, ekibe göre)
- [x] `dotenv` + zod tabanlı konfigürasyon yükleyici yaz

**Sunucu Çalıştırma**

- [x] Express uygulamasını boot eden `app.ts` dosyasını yaz
- [x] `helmet`, `cors`, `express-rate-limit` middleware'lerini entegre et
- [x] Health-check endpoint'i ekle (`GET /health`)
- [x] Global hata yakalayıcı ve 404 handler ekle

**Loglama & Error Handling**

- [x] `pino` logger'ını yapılandır
- [x] Request başına `requestId` oluşturan middleware ekle
- [x] Merkezî hata sınıfları (`src/errors/`) ve serializer oluştur

## Phase 2 – Veritabanı & ORM

- [x] Prisma kur ve `prisma/schema.prisma` dosyasını oluştur
- [x] Başlangıç modellerini ekle (User, Collection, Sample, SampleImage)
- [x] `src/lib/prisma.ts` ile Prisma Client paylaşımını ayarla
- [x] Repository katmanını iskelet olarak yaz (`src/modules/*/repository.ts`)
- [x] `pnpm prisma migrate dev` ve seed scriptlerini ekle

## Phase 3 – Çekirdek Modüller

**Auth (Clerk entegrasyonuna hazırlık)**

- [x] Yerel geliştirme için mock auth middleware'i yaz
- [x] Clerk entegrasyon katmanını hazırlayan adapter (`src/lib/clerk.ts`)
- [x] Auth guard middleware'leri (`requireAuth`, `requireRole`)

**Users Modülü**

- [x] Zod şemalarını tanımla (`schemas.ts`)
- [x] Service katmanını yaz ve repository API'sini uyarl
- [x] Controller + router oluştur (`GET/POST/PATCH /users`)
- [ ] Service ve controller testlerini yaz

**Samples Modülü**

- [x] Zod şemalarını tanımla (`schemas.ts`)
- [x] Sample servis + repository akışını tamamla (CRUD, soft delete)
- [x] Sample image yükleme/metadata servislerini uygula
- [x] Controller + router oluştur (`GET/POST/PATCH/DELETE /samples`)
- [ ] Modül testlerini yaz (service + controller)

**Collections Modülü**

- [ ] Collections API tasarımını tamamla (CRUD + listeleme)
- [ ] Koleksiyona sample eklerken `CollectionSample.position` değerini üret
- [ ] Drag-and-drop / yeniden sıralama durumlarında position normalizasyonu stratejisi oluştur
- [ ] Koleksiyon ↔ sample ilişkileri için testleri yaz

## Phase 4 – Yerel Geliştirme Destekleri

- [x] PostgreSQL için Docker Compose ekle (`ops/local/docker-compose.yml`)
- [x] Yerel upload dizinini oluştur (`storage/uploads/`)
- [ ] `package.json` scriptlerine `db:up`, `db:down`, `db:migrate` komutlarını ekle
- [ ] Geliştirici deneyimi için `README` veya `CONTRIBUTING`te hızlı başlangıç rehberi oluştur
- [ ] Opsiyonel: `make` / `just` komutları ile görev otomasyonu ekle

## Phase 5 – Test & Kalite Güvencesi

- [ ] Jest veya Vitest tabanlı test runner kur
- [ ] Integration testleri için `supertest` yapılandır
- [ ] Kod örtüşme hedefleri belirle (%80+)
- [ ] GitHub Actions pipeline taslağını yaz (lint + test + prisma validate)

## Phase 6 – Üretim Hazırlığı (Sonra)

- [ ] Legacy Project/Artwork/Material domainini Collections/Samples entegrasyonuna göre yeniden tasarla
- [ ] S3 adapter'ını yaz ve yerel adapter ile soyutlama katmanında birleştir
- [ ] BullMQ + Redis altyapısını planla ve belgeye ekle
- [ ] PM2 + Nginx için deployment dökümanı hazırla
- [ ] Sentry entegrasyonu ve yapılandırma anahtarlarını belgele
- [ ] Prod env için AWS Secrets Manager stratejisini yaz

## Notlar

- Veri modeli API tamamen oturana kadar Users/Collections/Samples çekirdeğiyle sadeleştirildi; sonraki fazlarda Project/Artwork yapıları yeniden değerlendirilecek.
- Yeni görevler eklendikçe ilgili faz altında listelenmeli.
- Tamamlanan görevler işaretlendikten sonra tarih/commit bilgisi eklenebilir.
- Bloklanan görevler `[!]` ile işaretlenip açıklama eklenmeli.
