# iOS MaterialType Dekodlama Rehberi

Bu doküman, Google ile giriş yapan kullanıcıların koleksiyonlarını çekerken iOS istemcisinde görülen **“Collection sync failed: the data couldn’t be read because it isn’t in the correct format”** hatasının nedenlerini ve kalıcı çözümleri açıklar.

## Sorunun Özeti
- Hata yalnızca bazı kullanıcıların koleksiyonlarını senkronize ederken ortaya çıkıyor.
- Backend istekleri (`GET /collections`) başarıyla `200 OK` dönüyor; hata iOS tarafında JSON decode aşamasında fırlıyor.
- `DecodingError.dataCorrupted` istisnası, `materialType` alanındaki değerlerin iOS modeliyle eşleşmemesinden kaynaklanıyor.

## Backend Davranışı
- `Sample.materialType` alanı veritabanında basit `String` olarak tutulur (`prisma/schema.prisma:62`).
- API, sample kayıtlarını dönerken bu alanı olduğu gibi iletir (`src/modules/collections/service.ts:55`).
- Backend tarafında geçerli materyal türleri kısıtlanmadığından, kullanıcı veya seed verisi yeni/serbest değerler üretebilir (`ceramic`, `tile`, `illustration`, `fabric`, vb.).

## iOS Tarafındaki Kök Neden
- iOS kodunda `materialType` büyük olasılıkla `enum MaterialType: String, Decodable` şeklinde tanımlı.
- Enum değerleri backend’in gönderdiği string’lerle bire bir eşleşmediğinde, `init(from:)` çağrısı `DecodingError.dataCorrupted` hatası fırlatıyor ve koleksiyon senkronizasyonu duruyor.
- Apple hesabıyla giriş yapan kullanıcıların kayıtlarında enum’da tanımlı değerler yer aldığından hatayla karşılaşılmıyor; Google hesabıyla gelen kullanıcıların verileri yeni bir `materialType` içerdiğinde hata tetikleniyor.

## Çözüm Önerileri

**1. Enum’u güncel tutma**
- Backend’de kullanılan tüm `materialType` değerlerini belirleyin (DB sorgusu veya API yanıtı ile).
- iOS’ta enum listenize bu değerleri ekleyin.
- Yeni değerler eklenebileceğini unutmayın; bu yaklaşım düzenli bakım gerektirir.

**2. Güvenli fallback ile decode etme (önerilen)**
- `MaterialType` için enum yerine türü kapsayan bir struct kullanın veya enum’a `unknown` case ekleyin:

```swift
enum MaterialType: Codable, Equatable {
    case known(Value)
    case unknown(String)

    enum Value: String, Codable {
        case tile, ceramic, fabric, illustration, stone, metal, wood
        // Listeyi eldeki verilere göre güncelleyin.
    }

    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        if let known = Value(rawValue: value) {
            self = .known(known)
        } else {
            self = .unknown(value)
        }
    }

    func encode(to encoder: Encoder) throws {
        let raw: String
        switch self {
        case .known(let value): raw = value.rawValue
        case .unknown(let value): raw = value
        }
        var container = encoder.singleValueContainer()
        try container.encode(raw)
    }
}
```

- UI tarafında `unknown` değerlerini anlamlı bir varsayılan etiketle (örn. “Diğer”) gösterin.
- Bu yaklaşım backend’e yeni değer eklendiğinde istemcinin kırılmasını engeller.

**3. Geçici backend kısıtlaması (önerilmiyor)**
- Backend’de `materialType` alanını belirli bir whitelist ile sınırlamak mümkün. Ancak;
  - Kullanıcı deneyimini kısıtlar.
  - Yeni tür ekleme ihtiyacında hem backend hem iOS güncellemesini zorunlu kılar.
  - Uzun vadede bakım maliyeti yaratır.
- Bu nedenle kalıcı çözüm olarak istemcinin toleranslı olması tercih edilmelidir.

## Uygulama Planı
1. iOS kodunda `MaterialType` modelini fallback destekleyecek şekilde güncelleyin.
2. Hata alan kullanıcının koleksiyonunu tekrar çekerek `materialType` değerini kayıt altına alın; UI’da doğruluğunu test edin.
3. `GET /collections` için yazdığınız decoder testlerini yeni yapıyla güncelleyin.
4. Opsiyonel: Backend tarafında, telemetry’ye `materialType` değerlerini toplayacak bir log ekleyin; yeni değerler görüldüğünde iOS enum’unu güncellemek kolaylaşır.

## Test Önerileri
- **Unit test:** iOS’ta `MaterialType` decoder’ı bilinen ve bilinmeyen değerler için test edin.
- **Integration test:** Mock API yanıtında enum dışı bir `materialType` göndererek koleksiyon ekranının fallback metnini gösterdiğini doğrulayın.
- **Regression test:** Gerçek cihazda hem Apple hem Google hesabıyla giriş yapıp koleksiyon senkronizasyonunun hata üretmediğinden emin olun.

## Sık Sorulan Sorular
- **Backend neden enum döndürmüyor?** Ürün ekibi materyal türlerini dinamik olarak genişletmek istiyor; bu nedenle şema esnek bırakıldı.
- **Yeni değer eklendiğini nasıl fark ederiz?** Cloud logger’da belirli aralıklarla `materialType` histogramı almak veya QA sırasında `GET /samples` yanıtlarını incelemek yardımcı olur.
- **Fallback case kullanmak UX’i bozar mı?** “Unknown” değerleri kullanıcıya lokalize bir etiketle (“Diğer”) göstermek yeterlidir; veri kaybı yaşanmaz.

Bu adımları izleyerek iOS istemcisi backend’den gelecek yeni `materialType` değerlerine karşı dayanıklı hale gelir ve koleksiyon senkronizasyonu kullanıcı sağlayıcısından bağımsız şekilde sorunsuz çalışır.
