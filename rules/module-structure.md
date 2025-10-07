# Modül ve Klasör Hiyerarşisi

## Genel İlkeler

- SOLID prensiplerine uyulur; her sınıf/fonksiyon tek sorumluluğa sahip olacak şekilde tasarlanır.
- Kod tekrarını önlemek için ortak işlevler `src/shared` altında toplanır ve tekrar kullanılabilir yardımcılar oluşturulur.
- Modüller arası bağımlılıklar minimize edilir; yüksek seviyeli modüller düşük seviyeli modüllere doğrudan bağımlı olamaz.
- Domain mantığı talep ettiği kadar küçük parçalara ayrılır; gereksiz soyutlamadan kaçınılır.
- Testler modülle aynı klasörde `__tests__` dizininde tutulur ve modülün public API'sini hedefler.

## src Klasörü

- `src/app.ts`: Express uygulamasının bootstrap edildiği dosya. Middleware ve router montajı burada yapılır.
- `src/server.ts`: Üretim giriş noktası; `app` import edilir ve port dinlemeye başlanır.
- `src/config`: Ortak konfigürasyon dosyaları; environment değişkenleri ve servis konfigleri.
- `src/shared`: Modüller arasında paylaşılan helper'lar, util fonksiyonları, adapterlar ve ortak tipler.
- `src/modules`: Domain odaklı modüller; her modül kendi alt klasöründe mantığını kapsüller.
- `src/jobs`: BullMQ iş tanımları ve işleyicileri; kuyruk isimleri burada merkezi yönetilir.
- `src/lib`: Üçüncü parti entegrasyonlar (S3 client, Clerk SDK wrapper vb.) için ince adapter katmanı.
- `src/middlewares`: Global veya yeniden kullanılabilir Express middleware'leri.
- `src/errors`: Custom hata sınıfları ve error handler implementasyonu.

## Modül Şablonu (`src/modules/<modül-adı>`)

- `controller.ts`: HTTP layer; yalnızca request/response yönetir. Zod şemaları burada uygulanır.
- `service.ts`: İş kuralları ve domain mantığı; SOLID kapsamında tek sorumluluk içerir.
- `repository.ts`: Prisma tabanlı data erişimi. Diğer katmanlarla interface üzerinden haberleşir.
- `schemas.ts`: Zod request/response şemaları ve tip türevleri.
- `router.ts`: Express Router tanımları; dışa sadece `Router` export eder.
- `index.ts`: Modülün public API'sini toplar; diğer katmanlar sadece bu dosyayı import eder.
- `__tests__/`: Modüle özgü testler; service/repository seviyesinde birim testleri, controller için integration testleri.

## Paylaşılan Kod Politikası

- Bir kod parçası iki farklı yerde tekrarlandığında `src/shared` veya ilgili domain modülüne refactor edilir.
- Ortak tip tanımları için `src/shared/types.ts` veya domain modülü altındaki `types.ts` kullanılır.
- Reusable middleware veya yardımcı sınıflar `src/shared` altında `middleware`, `utils`, `adapters` gibi alt klasörlere bölünür.

## Bağımlılık Yönetimi

- Modüller arası etkileşim `service` katmanı üzerinden interface'ler aracılığıyla yapılır.
- Döngüsel bağımlılıklardan kaçınmak için ortak protokoller `src/shared/contracts` altında tutulur.
- Harici servisler (S3, Clerk, Resend) için lib adapterları dependency injection ile modüllere verilir.
