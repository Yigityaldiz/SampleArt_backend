# Backend Kuralları

## Başlangıç Stratejisi (Yerel Odaklı)

- MVP aşamasında veri modeli Users/Collections/Samples çekirdeği ile tutulur; API kapsamı genişledikçe eski Project/Artwork taslakları yeniden değerlendirilir.

- İlk sürüm tamamen yerelde çalışır; bulut bağımlılıkları son safhada eklenir.
- PostgreSQL yerel ortamda (Docker container veya native kurulum) çalıştırılır; `docker-compose` örneği `ops/local` altında saklanır.
- Dosya yüklemeleri başlangıçta yerel disk (`storage/uploads`) üzerinde tutulur; adapter mimarisi ile S3 entegrasyonu daha sonra devreye alınır.
- Redis veya kuyruk servisleri ilk etapta kurulmaz; API kapsamı tamamlandıktan sonra BullMQ + Redis eklenir.
- Local geliştirme `.env.local` dosyası ile yönetilir; paylaşılan örnek `.env.example` güncel tutulur.

## Temel Teknoloji Seçimleri

- Node.js 20 LTS kullanılır; farklı sürüm gerekiyorsa önce tartışılır.
- Express monolit başlangıç mimarisi korunur; modüler ihtiyaçlar arttığında NestJS geçişi tartışılır.
- ORM olarak Prisma kullanılır ve şema değişiklikleri migration ile yapılır.
- PostgreSQL varsayılan veritabanıdır; yerel geliştirmede Docker veya Railway tercih edilir.

## API Tasarımı ve Validasyon

- Tüm HTTP endpointleri için request/response şemaları Zod ile doğrulanır.
- Endpointler `src/modules/<kaynak>` altında gruplanır; router dosyaları yalın tutulur.
- Hata yönetimi için global error handler kullanılır ve kullanıcıya dönen mesajlar standartlaştırılır.

## Loglama ve İzleme

- `pino` varsayılan logger'dır; üretimde JSON format saklanır.
- Önemli iş akışları için contextual log alanları (`requestId`, `userId` gibi) doldurulur.
- Üretim ortamında Sentry entegrasyonu zorunludur; minimum breadcrumb bilgisi sağlanır.

## Güvenlik

- `helmet`, `cors` ve `express-rate-limit` global middleware olarak tanımlanır.
- Gizli anahtarlar `.env` yerine Secret Manager/GitHub Secrets üzerinden yönetilir.
- Auth işlemleri Clerk üzerinden yapılır; backend yalnızca doğrulanmış tokenlarla çalışır.
- Yerel geliştirmede Clerk yerine mock auth middleware (`x-mock-user-*` header'ları) devreye alınır; production ortamında `CLERK_*` anahtarları set edilerek gerçek doğrulama aktifleştirilir.

## Dosya Yükleme

- Yerelde dosyalar `storage/uploads` altında saklanır; cleanup scriptleri ile klasör düzenli tutulur.
- Upload servisleri interface üzerinden çağrılır; S3 adapteri hazır olduğunda production ortamında kullanılır.
- Yüklenen dosyaların meta verisi DB'de saklanır ve erişim rolleri tanımlanır.

## İş Kuyrukları

- Uzun süreli işler için BullMQ tercih edilir; kuyruk isimleri `domain:task` formatındadır.
- Yerel başlangıçta kuyruk kurulmaz; ihtiyaç oluştuğunda Redis container (Docker) devreye alınır.
- Kuyruk işçileri ayrı process olarak çalıştırılır (PM2 veya ayrı servis).

## E-posta

- Geliştirme/test ortamında Resend kullanılır; mock e-postalar loglanır.
- Üretimde AWS SES kullanılmadan önce alan doğrulaması yapılır.
- Tüm transactional e-postalar için şablon sürümlendirme tutulur.

## CI/CD ve Dağıtım

- Her PR'da testler ve Prisma migrate kontrolü GitHub Actions ile koşar.
- Deploy sürecinde PM2 kullanılır; config dosyaları repo dışı saklanır.
- Nginx reverse proxy ve Let's Encrypt sertifikaları zorunludur.

## Kod Kalitesi

- TypeScript zorunludur; `strict` modu kapatılmaz.
- ESLint + Prettier konfigürasyonları CI'da zorlanır.
- Yeni modüller dokümante edilir ve birim testleri yazılır.
