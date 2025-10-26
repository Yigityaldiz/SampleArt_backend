# Yerel Kurulum Rehberi

Bu doküman backend'i tamamen yerel kaynaklarla ayağa kaldırmak için gereken adımları özetler. Bulut servisleri (S3, Redis vb.) bu aşamada devreye alınmaz.

## Ön Koşullar

- Node.js 20 LTS (nvm veya Volta ile yönetilmesi önerilir).
- Paket yöneticisi npm.
- Docker Desktop (veya Docker Engine) + Docker Compose v2.
- Prisma CLI (`npx prisma`) proje bağımlılıkları yüklendiğinde hazır olur.

## Dizin Yapısı

- `ops/local/docker-compose.yml`: Yerel PostgreSQL servisini tanımlar.
- `storage/uploads/`: Geliştirme sırasında kullanılan yerel dosya deposu.
- `rules/backend-guidelines.md`: Yerel odaklı başlangıç stratejisi ve prensipler.

## Ortam Değişkenleri

1. `cp .env.example .env.local` (dosya yoksa oluşturup paylaşılan değerleri ekleyin).
2. Aşağıdaki örneği `.env.local` içine uyarlayın:

```env
DATABASE_URL="postgresql://sample_art:sample_art@localhost:5432/sample_art?schema=public"
PORT=3000
UPLOAD_ROOT=storage/uploads
# Cognito, Resend vb. değerler gerektikçe eklenecek.
```

> `.env.local` dosyası git'e eklenmez; örnek değerler `.env.example` üzerinden paylaşılır.

## PostgreSQL'i Başlatma

1. Docker servisini çalıştırın: `docker compose -f ops/local/docker-compose.yml up -d`
2. Varsayılan erişim parametreleri:
   - Kullanıcı: `sample_art`
   - Şifre: `sample_art`
   - Veritabanı: `sample_art`
   - Port: `5432`
3. Sağlık durumunu kontrol edin: `docker compose -f ops/local/docker-compose.yml ps`
4. Veritabanına CLI ile bağlanmak için: `docker exec -it sample-art-postgres psql -U sample_art sample_art`

Container durdurma/temizleme:

- Durdur: `docker compose -f ops/local/docker-compose.yml down`
- Verileri sıfırlamak için `ops/local/postgres-data` dizinini silmeden önce ekibi bilgilendirin.

## Prisma Migrasyonları

1. Bağımlılıkları yükleyin: `pnpm install` (zaten yapıldıysa atlayın).
2. Prisma client oluştur: `pnpm prisma:generate` veya ilk migrate sırasında otomatik oluşur.
3. Şema değişikliklerinden sonra: `pnpm prisma migrate dev --name <migration-adi>`.
4. İlk kurulumda örnek veri gerekiyorsa `pnpm db:seed` komutunu çalıştırın.
5. PostgreSQL için `citext` uzantısını ilk migration içine eklemeyi unutmayın: `CREATE EXTENSION IF NOT EXISTS citext;`.
6. Auth için Cognito User Pool konfigurasyonu gerekiyorsa `.env.local` içine `COGNITO_*` değerlerini ekleyin; lokal/test ortamında mock auth devrede kalabilir.

## Yerel Upload Dizinleri

- Uygulama varsayılan olarak `storage/uploads` dizinini kullanır.
- Depolanan dosyalar git tarafından izlenmez (`storage/uploads/.gitignore`).
- Gerektiğinde klasörü temizlemek için: `rm -rf storage/uploads/*`

## Sunucuyu Çalıştırma

1. Geliştirme modu: `pnpm dev` (veya proje script'ine göre).
2. Sunucu `.env.local` içeriğini okumalı; `dotenv` benzeri çözüm projeye eklenmelidir.
3. API testleri için Postman/Insomnia profillerini `http://localhost:3000` üzerinden yönetin.

## Sorun Giderme

- Docker container ayağa kalkmıyorsa port çatışmalarını kontrol edin (`lsof -i :5432`).
- Prisma `DATABASE_URL` değerini bulamazsa `.env.local` dosyasının yüklendiğinden emin olun.
- Upload dizini yetkileri macOS/Linux ortamında sorun çıkarırsa `chmod -R 755 storage/uploads` komutunu uygulayın.
