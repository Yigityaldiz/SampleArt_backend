# Sample Art Backend API Referansı

Bu doküman, Sample Art Backend projesindeki HTTP uç noktalarının tamamını, beklenen JSON istek formatlarını ve temel gereklilikleri özetler. Tüm örnekler varsayılan JSON yanıt formatını kullanır.

## Genel Kurallar

- Tüm isteklerde `Content-Type: application/json` başlığı gönderin.
- `app.ts` üzerinden gelen hız limiti (rate limit) üretim ortamında dakika başına 100, diğer ortamlarda 500 istektir.
- Başarılı yanıtlar genellikle `200` veya `201` durum kodu ile `{"data": ...}` gövdesi döndürür. Silme işlemleri `204 No Content` veya `{"data": ...}` biçiminde yanıt verir.
- Hatalar `{"error": {"message": "<açıklama>"}}` şemasını takip eder ve uygun HTTP durum koduyla gelir.
- Sistem her isteğe benzersiz `X-Request-Id` başlığı üretir; bu başlık log takibi için kullanılabilir.

## Kimlik Doğrulama

- `/health` dışındaki tüm uç noktalar `requireAuth` korumasındadır; geçerli bir Clerk kimlik belirtecinin `Authorization: Bearer <JWT>` başlığıyla iletilmesi gerekir.
- Geliştirme ortamında `mockAuthMiddleware` test amaçlı sahte kullanıcı sağlar; üretimde `clerkAuthMiddleware` aktif olur.
- Kullanıcı rollerini `req.authUser.roles` belirler:
  - `admin`: Yönetici ayrıcalıkları.
  - `user` ve `viewer`: Normal kullanıcılar. Çoğu uç noktada yalnızca kendi kaynaklarına erişebilirler.

## Sağlık Kontrolü

### `GET /health`

- **Kimlik doğrulama:** Gerekli değil.
- **Başarılı yanıt (`200`):**

```json
{
  "status": "ok",
  "environment": "development",
  "uptime": 12.345,
  "timestamp": "2025-10-06T12:34:56.789Z"
}
```

## Kullanıcılar (`/users`)

- Tüm kullanıcı uç noktaları kimlik doğrulaması gerektirir.
- Yönetici olmayan kullanıcılar yalnızca kendi kayıtlarına erişebilir ve `POST /users` sırasında `id` alanının kendi kimliğiyle eşleşmesi gerekir.

### `GET /users`

- **Amaç:** Kullanıcıları listelemek.
- **Kimlik doğrulama:** Gerekli. Adminler tüm kullanıcıları görebilir; diğer roller yalnızca kendi kayıtlarının bulunduğu tek elemanlı bir liste alır.
- **Sorgu parametreleri:**
  - `skip` (opsiyonel, varsayılan 0): Atlama sayısı.
  - `take` (opsiyonel, varsayılan 25): 1–100 arası kayıt limiti.
- **Yanıt (`200`):**

```json
{
  "data": [
    {
      "id": "user_123",
      "email": "first@example.com",
      "name": "First User",
      "locale": "tr-TR",
      "createdAt": "2025-09-01T10:00:00.000Z",
      "updatedAt": "2025-09-10T15:30:00.000Z"
    }
  ]
}
```

### `GET /users/me`

- **Amaç:** Oturum açmış kullanıcının kaydını döndürmek (gerekirse oluşturur).
- **Kimlik doğrulama:** Gerekli.
- **Yanıt (`200`):** Kullanıcı nesnesi `data` içerisinde döner (bkz. yukarıdaki örnek).

### `GET /users/:id`

- **Amaç:** Belirli bir kullanıcıyı getirmek.
- **Kimlik doğrulama:** Gerekli. Kullanıcı yalnızca kendi ID’sini görebilir; adminler herkesi okuyabilir.
- **Yanıt (`200`):** Kullanıcı nesnesi `data` içinde.
- **Hata durumları:** `401` (kimlik doğrulaması yok), `403` (başka bir kullanıcıya erişim), `404` (kayıt bulunamadı).

### `POST /users`

- **Amaç:** Kullanıcı kaydı oluşturmak. Üretim senaryosunda Clerk kullanıcılarını yerel veritabanı ile senkronize etmek için kullanılır.
- **Kimlik doğrulama:** Gerekli. Gönderilen `id` alanı oturum açmış kullanıcının kimliğiyle aynı olmalıdır (adminler için router düzeyinde de bu kısıt geçerlidir).
- **İstek gövdesi:**

```json
{
  "id": "user_123",
  "email": "first@example.com",
  "name": "First User",
  "locale": "tr-TR"
}
```

`email`, `name` ve `locale` alanları opsiyonel veya `null` olabilir.

- **Yanıt (`201`):** Oluşturulan kullanıcı nesnesi `data` içinde.
- **Hata durumları:** `401`, `403`.

### `PATCH /users/:id`

- **Amaç:** Kullanıcı bilgilerini güncellemek.
- **Kimlik doğrulama:** Gerekli. Yalnızca kendi kaydınızı güncelleyebilirsiniz.
- **İstek gövdesi:** En az bir alan içermelidir.

```json
{
  "email": "updated@example.com",
  "name": "Updated User",
  "locale": "en-US"
}
```

- **Yanıt (`200`):** Güncellenmiş kullanıcı nesnesi.
- **Hata durumları:** `401`, `403`, `404`.

## Örnekler (`/samples`)

- Tüm uç noktalar kimlik doğrulaması gerektirir.
- Admin olmayan kullanıcılar yalnızca kendi örneklerine erişebilir. Listeleme sırasında `includeDeleted` bayrağı otomatik olarak `false` olur ve `userId` parametresi görmezden gelinir.

### `GET /samples`

- **Amaç:** Örnekleri listelemek.
- **Sorgu parametreleri:**
  - `userId` (opsiyonel): Sadece adminler tarafından kullanılabilir.
  - `skip` (opsiyonel): 0 ve üzeri tamsayı.
  - `take` (opsiyonel): 1–100 arası tamsayı.
  - `includeDeleted` (opsiyonel): `true` gönderilse bile admin olmayanlar için her zaman `false` kabul edilir.
- **Yanıt (`200`):**

```json
{
  "data": [
    {
      "id": "samp_123",
      "userId": "user_123",
      "title": "Mermer Doku",
      "materialType": "marble",
      "applicationArea": "bathroom",
      "surface": "matte",
      "colorHex": "#AABBCC",
      "colorName": "Gri Mavi",
      "companyName": "Sample Corp",
      "priceMinor": 12500,
      "priceCurrency": "TRY",
      "quantityValue": 12.5,
      "quantityUnit": "m2",
      "sizeText": "30x60",
      "locationLat": 41.0082,
      "locationLng": 28.9784,
      "notes": "Showroomdan alındı",
      "isDeleted": false,
      "image": {
        "id": "img_123",
        "storageProvider": "s3",
        "objectKey": "samples/user_123/abc.jpg",
        "url": "https://cdn.example.com/samples/user_123/abc.jpg",
        "width": 1024,
        "height": 768,
        "blurhash": "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
        "exif": {
          "Model": "iPhone"
        }
      },
      "collections": [
        {
          "collectionId": "col_123",
          "position": 1
        }
      ],
      "createdAt": "2025-09-10T08:00:00.000Z",
      "updatedAt": "2025-09-12T18:45:00.000Z"
    }
  ]
}
```

### `GET /samples/:id`

- **Amaç:** Tek bir örneği okumak.
- **Kimlik doğrulama:** Gerekli. Kaynağın sahibi veya admin olmalısınız.
- **Yanıt (`200`):** Üstte örneklenen `SampleResponse`.
- **Hata durumları:** `401`, `403`, `404`.

### `POST /samples`

- **Amaç:** Yeni örnek eklemek.
- **Kimlik doğrulama:** Gerekli. Admin olmayanlar yalnızca kendi kullanıcı ID’leriyle kayıt oluşturabilir.
- **İstek gövdesi:** `createSampleBodySchema` tarafından tanımlanır. Temel alanlar:

```json
{
  "userId": "user_123",
  "title": "Mermer Doku",
  "materialType": "marble",
  "applicationArea": "bathroom",
  "surface": "matte",
  "colorHex": "#AABBCC",
  "colorName": "Gri Mavi",
  "companyName": "Sample Corp",
  "priceMinor": 12500,
  "priceCurrency": "TRY",
  "quantityValue": "12.5",
  "quantityUnit": "m2",
  "sizeText": "30x60",
  "locationLat": "41.0082",
  "locationLng": "28.9784",
  "notes": "Showroomdan alındı",
  "image": {
    "storageProvider": "s3",
    "objectKey": "samples/user_123/abc.jpg",
    "url": "https://cdn.example.com/samples/user_123/abc.jpg",
    "width": 1024,
    "height": 768,
    "blurhash": "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
    "exif": {
      "Model": "iPhone"
    }
  },
  "collectionIds": ["col_123", "col_456"]
}
```

- `userId` gönderilmezse kimlik doğrulanan kullanıcının ID’si kullanılır.
- `collectionIds` maks. 20 öge olabilir ve tüm koleksiyonlar hedef kullanıcıya ait olmalıdır.
- **Yanıt (`201`):** Oluşturulan örnek `data` içinde döner (koleksiyon bağlantıları yüklenmiş şekilde).
- **Hata durumları:** `401`, `403`, `404` (koleksiyon bulunamadı), `400` (hedef kullanıcı yok veya doğrulama hatası).

### `PATCH /samples/:id`

- **Amaç:** Örnek güncellemek.
- **Kimlik doğrulama:** Gerekli. Kaynağın sahibi veya admin olmalısınız.
- **İstek gövdesi:** Opsiyonel alanlar; en az bir alan gönderilmelidir. `image` alanı gönderilirse mevcut görsel `upsert` edilir.
- **Yanıt (`200`):** Güncellenen örnek.
- **Hata durumları:** `401`, `403`, `404`.

### `DELETE /samples/:id`

- **Amaç:** Örneği yumuşak silmek (soft delete). Geri alınabilir.
- **Kimlik doğrulama:** Gerekli. Kaynağın sahibi veya admin olmalısınız.
- **Yanıt (`200`):** `isDeleted: true` olan örnek nesnesi.
- **Hata durumları:** `401`, `403`, `404`.

## Koleksiyonlar (`/collections`)

- Uç noktalar yalnızca oturum açmış kullanıcının sahip olduğu koleksiyonlar üzerinde çalışır.

### `GET /collections`

- **Amaç:** Koleksiyonları listelemek.
- **Sorgu parametreleri:** `skip`, `take`, `includeSamples` alanları mevcut olsa da istek kimliği doğrulanan kullanıcının kimliğiyle sınırlandırılır.
- **Yanıt (`200`):**

```json
{
  "data": [
    {
      "id": "col_123",
      "userId": "user_123",
      "name": "Favoriler",
      "samples": [
        {
          "sampleId": "samp_123",
          "position": 1,
          "addedAt": "2025-09-12T08:15:00.000Z",
          "sample": {
            "id": "samp_123",
            "userId": "user_123",
            "title": "Mermer Doku",
            "materialType": "marble",
            "isDeleted": false,
            "createdAt": "2025-09-10T08:00:00.000Z",
            "updatedAt": "2025-09-12T18:45:00.000Z"
          }
        }
      ],
      "createdAt": "2025-09-10T07:30:00.000Z",
      "updatedAt": "2025-09-12T18:50:00.000Z"
    }
  ]
}
```

### `GET /collections/:id`

- **Amaç:** Tek koleksiyonu döndürmek.
- **Kimlik doğrulama:** Gerekli. Yalnızca koleksiyon sahibi erişebilir.
- **Hata durumları:** `401`, `403`, `404`.

### `POST /collections`

- **Amaç:** Yeni koleksiyon oluşturmak.
- **İstek gövdesi:**

```json
{
  "name": "Favoriler",
  "userId": "user_123"
}
```

- `userId` alanı opsiyoneldir ancak gönderilirse kimlik doğrulanan kullanıcıyla aynı olmalıdır; aksi halde `403`.
- **Yanıt (`201`):** Oluşturulan koleksiyon.

### `PATCH /collections/:id`

- **Amaç:** Koleksiyon adını güncellemek.
- **İstek gövdesi:**

```json
{
  "name": "Yeni Koleksiyon Adı"
}
```

- **Yanıt (`200`):** Güncellenmiş koleksiyon.
- **Hata durumları:** `401`, `403`, `404`.

### `DELETE /collections/:id`

- **Amaç:** Koleksiyonu kalıcı olarak silmek.
- **Yanıt (`204`):** Gövde yok.
- **Hata durumları:** `401`, `403`, `404`.

### `POST /collections/:id/samples`

- **Amaç:** Bir örneği koleksiyona eklemek.
- **İstek gövdesi:**

```json
{
  "sampleId": "samp_123"
}
```

- Örnek aynı kullanıcıya ait olmalıdır; aksi halde `403`.
- Koleksiyonda zaten varsa `409` hatası döner.
- **Yanıt (`201`):**

```json
{
  "data": {
    "sampleId": "samp_123",
    "position": 3,
    "addedAt": "2025-09-13T09:00:00.000Z",
    "sample": {
      "id": "samp_123",
      "userId": "user_123",
      "title": "Mermer Doku",
      "materialType": "marble",
      "isDeleted": false,
      "createdAt": "2025-09-10T08:00:00.000Z",
      "updatedAt": "2025-09-12T18:45:00.000Z"
    }
  }
}
```

### `PATCH /collections/:id/samples/reorder`

- **Amaç:** Koleksiyon içindeki örnek sırasını yeniden düzenlemek.
- **İstek gövdesi:**

```json
{
  "sampleIds": ["samp_456", "samp_123"]
}
```

- Gönderilen `sampleIds` benzersiz olmalı ve koleksiyonda kayıtlı olmalıdır; kısmi liste gönderilebilir, gönderilmeyenler mevcut sıranın sonuna eklenir.
- **Yanıt (`200`):** Güncellenmiş koleksiyon.
- **Hata durumları:** `400`, `401`, `403`, `404`.

### `DELETE /collections/:id/samples/:sampleId`

- **Amaç:** Koleksiyondan örnek çıkarmak.
- **Yanıt (`200`):** Güncellenmiş koleksiyon.
- **Hata durumları:** `401`, `403`, `404`.

## Yüklemeler (`/uploads`)

- Tüm uç noktalar kimlik doğrulaması gerektirir. S3 yapılandırması (`S3_BUCKET`) yoksa servis `503` döner.

### `POST /uploads/presign`

- **Amaç:** Görsel yüklemek için önceden imzalanmış bir PUT URL’i oluşturmak.
- **İstek gövdesi:**

```json
{
  "contentType": "image/jpeg",
  "extension": "jpg"
}
```

- `contentType` yalnızca `image/` ile başlayan değerleri kabul eder. `extension` opsiyoneldir ve alfanümerik olmalıdır.
- **Yanıt (`201`):**

```json
{
  "data": {
    "key": "samples/user_123/1696608000-abc.jpg",
    "uploadUrl": "https://s3.amazonaws.com/bucket/samples/user_123/1696608000-abc.jpg?...",
    "publicUrl": "https://cdn.example.com/samples/user_123/1696608000-abc.jpg",
    "expiresIn": 900,
    "expiresAt": "2025-09-10T09:15:00.000Z",
    "contentType": "image/jpeg"
  }
}
```

- **Hata durumları:** `401`, `503`, `500`.

### `POST /uploads/presign-download`

- **Amaç:** Görsel indirmek için önceden imzalanmış bir GET URL’i oluşturmak.
- **İstek gövdesi:**

```json
{
  "objectKey": "samples/user_123/1696608000-abc.jpg"
}
```

- Kullanıcılar yalnızca `samples/<kendi_kullanıcı_idleri>/` ile başlayan nesne anahtarlarına erişebilir. Adminler (`roles` içinde `admin`) tüm `samples/` anahtarlarını indirebilir.
- **Yanıt (`200`):**

```json
{
  "data": {
    "key": "samples/user_123/1696608000-abc.jpg",
    "downloadUrl": "https://s3.amazonaws.com/bucket/samples/user_123/1696608000-abc.jpg?...",
    "expiresIn": 900,
    "expiresAt": "2025-09-10T09:15:00.000Z"
  }
}
```

- **Hata durumları:** `401`, `403`, `400`, `503`, `500`.

## Hata Kodları Özeti

- `400 Bad Request`: Doğrulama hatası, eksik parametre.
- `401 Unauthorized`: Kimlik doğrulaması eksik veya geçersiz.
- `403 Forbidden`: Kaynak sahibi değilsiniz veya rol yetersiz.
- `404 Not Found`: Kaynak bulunamadı.
- `409 Conflict`: Koleksiyona zaten ekli örnek vb. çakışmalar.
- `500/503`: Sunucu veya altyapı kaynaklı hatalar.

Bu referans, proje içindeki mevcut uç noktaların tamamını kapsar. Yeni uç noktalar eklendiğinde dokümanın güncellenmesi gerekir.
