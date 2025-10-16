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
- [x] Service ve controller testlerini yaz

**Samples Modülü**

- [x] Zod şemalarını tanımla (`schemas.ts`)
- [x] Sample servis + repository akışını tamamla (CRUD, soft delete)
- [x] Sample image yükleme/metadata servislerini uygula
- [x] Controller + router oluştur (`GET/POST/PATCH/DELETE /samples`)
- [x] Modül testlerini yaz (service + controller)

**Collections Modülü**

- [x] Collections API tasarımını tamamla (CRUD + listeleme)
- [x] Koleksiyona sample eklerken `CollectionSample.position` değerini üret
- [x] Drag-and-drop / yeniden sıralama durumlarında position normalizasyonu stratejisi oluştur
- [x] Koleksiyon ↔ sample ilişkileri için testleri yaz
- [x] Workspace RBAC katmanını (Owner/Editor/ViewOnly) ve üyelik/davet akışını uygula

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

## Phase 6 – S3 Entegrasyonu (Uploads)

**6.1 Altyapı & IAM**

- [ ] S3 bucket oluştur: `sample-art-uploads-<env>` (region: `eu-central-1`, SSE-S3 açık, public access kapalı)
- [ ] Minimum izinli IAM policy tanımla (`s3:PutObject`, `s3:GetObject`) → `arn:aws:s3:::sample-art-uploads-*/samples/*`
- [ ] (Opsiyonel) CloudFront dağıtımı oluştur ve `CDN_BASE_URL` değerini kaydet

**6.2 Konfigürasyon**

- [ ] `.env.local` içine AWS kimlik bilgilerini ekle (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, ops: `CDN_BASE_URL`)
- [x] `src/config/env.ts` şemasına yeni alanları ekle (opsiyonel `CDN_BASE_URL` dahil)
- [ ] Prod gizli anahtarlarını Secret Manager veya GitHub Secrets’a taşı

**6.3 Bağımlılıklar**

- [x] `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

**6.4 S3 Kütüphanesi**

- [x] `src/lib/s3.ts` dosyasını oluştur ve `S3Client` + yardımcıları (`buildObjectKey`, `createPutObjectPresign`, `publicUrlFor`) ekle

**6.5 Uploads Router (Pre-signed URL)**

- [x] `src/modules/uploads` modülünü oluştur
- [x] `POST /uploads/presign` endpoint’ini yaz (body: `{ contentType, extension? }`, `requireAuth` koruması)
- [x] `createPutObjectPresign` çağrısı ile `{ uploadUrl, key, publicUrl }` döndür
- [x] `src/app.ts` içinde `uploadsRouter`’ı mount et

**6.6 Samples ile Entegrasyon**

- [ ] README / API dokümantasyonuna iOS akışı ekle:
  1. `POST /uploads/presign` → dönen URL ile PUT yükleme
  2. `POST /samples` isteğinde `image` alanını `{ "storageProvider": "s3", "objectKey": key, "url": publicUrl, ... }` olarak gönder
- [ ] Şemanın `storageProvider` alanının `"s3"` değerini kabul ettiğini not et (şu an zaten generic)

**6.7 (Opsiyonel) İmzalı GET URL**

- [ ] `GET /uploads/sign-get?key=<objectKey>` endpoint’i ekle (5 dk geçerli imzalı URL döndür)
- [ ] Private içerik senaryosu için iOS dokümantasyonuna alternatif akışı ekle

**6.8 Güvenlik & Doğrulamalar**

- [ ] `POST /uploads/presign` girişinde `contentType` beyaz liste kontrolü (`image/*`)
- [ ] (Opsiyonel) Maksimum dosya boyutu (örn. 10 MB) için doğrulamalar ve iOS sıkıştırma rehberi yaz
- [ ] Pino log’larına `userId` ve `objectKey` bağlamını ekle

**6.9 Test & Doğrulama (Yerel)**

- [ ] Postman ile `POST /uploads/presign` çağrısı yap ve `uploadUrl` döndüğünü doğrula
- [ ] `curl -X PUT` ile test görselini yükle → 200 bekle
- [ ] `POST /samples` ile kayıt oluştur; veritabanında `sample_images` satırını kontrol et
- [ ] (Varsa) `GET /uploads/sign-get` ile imzalı URL üretip görüntüle
- [ ] Hata senaryoları: yanlış `contentType`, eksik auth, bucket/region uyuşmazlığı

**6.10 Geliştirici Dokümantasyonu**

- [ ] `README.md` içine “Uploads (S3)” bölümü ekle (akış diyagramı + örnek istek/yanıt)
- [ ] iOS entegrasyon snippet’i paylaş (PUT upload örneği, `Content-Type` başlıkları)

## Phase 7 – Üretim Hazırlığı (Sonra)

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
