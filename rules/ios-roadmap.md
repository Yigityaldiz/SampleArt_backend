# iOS Upload Entegrasyonu Yol Haritası

Bu plan Swift ekibinin S3 tabanlı upload akışını backend ile entegre ederken izlemesi gereken adımları özetler. Başlıklar sırayla tamamlanacak işleri ve kritik notları içerir.

## 1. Hazırlık & Ortam

- [ ] `API_BASE_URL`, `CDN_BASE_URL` ve AWS bölge bilgilerini proje konfigürasyonuna ekle.
- [ ] Geliştirme/değerlendirme ortamlarında kullanılacak kullanıcı token’larını hazırla (prod için Clerk Bearer token, dev için `x-mock-user-id`, `x-mock-user-roles`)
- [ ] Local build’lerde görsel önizlemesi için placeholder asset ve hata görselleri belirle.

## 2. Pre-signed Upload Akışı

1. Kullanıcı oturum açtıktan sonra bir kez `GET /users/me` çağırıp backend’in kullanıcı kaydını oluşturmasına izin ver.
2. `POST /uploads/presign` çağrısı yap (`Content-Type: application/json`, body `{ "contentType": "image/jpeg", "extension": "jpg" }`).
3. Yanıttan `uploadUrl`, `key`, `publicUrl`, `expiresAt` değerlerini al ve iOS tarafında sakla.
4. Dönen `uploadUrl`’e aynı MIME türüyle `PUT` isteği yap (`Content-Type` başlığını eksiksiz gönder; ekstra header gerekmiyor). 5xx/4xx hatalarını yakalayıp yeniden dene.
5. Upload işlemi başarıyla bittiğinde `publicUrl` (veya CloudFront/CDN URL’si) ile önizlemeyi güncelle.

_Notlar:_ `uploadUrl` yaklaşık 15 dakika geçerlidir; süre `expiresAt` alanında ISO 8601 formatında döner. İçerik tipi sadece `image/*` kabul edilir.

## 3. Sample Oluşturma

- [ ] `POST /samples` isteğinde zorunlu alanlar: `userId`, `title`, `materialType` (prod’da auth kullanıcısının ID’si ile aynı olmalı). Diğer alanlar opsiyonel; gönderilmeyen değerler backend’de `null`/`undefined` olarak kalır.
- [ ] Görsel gönderiyorsan `image` nesnesini `{ "storageProvider": "s3", "objectKey": key, "url": publicUrl }` şeklinde doldur.

Örnek `POST /samples` gövdesi (tüm alanlar doldurulmuş senaryo):

```json
{
  "userId": "usr_9c3f17f2f5d4",
  "title": "Organik Pamuk Kumaş",
  "materialType": "fabric",
  "applicationArea": "upholstery",
  "surface": "matte",
  "colorHex": "#F5F0E6",
  "colorName": "Fildişi",
  "companyName": "EcoTextiles",
  "priceMinor": 1899,
  "priceCurrency": "TRY",
  "quantityValue": "2.5",
  "quantityUnit": "meter",
  "sizeText": "2.5m x 1.4m rulo",
  "locationLat": "41.0321",
  "locationLng": "28.9768",
  "notes": "Yumuşak doku, döşeme için ideal",
  "image": {
    "storageProvider": "s3",
    "objectKey": "samples/usr_9c3f17f2f5d4/organik-pamuk.jpg",
    "url": "https://cdn.sampleart.app/samples/usr_9c3f17f2f5d4/organik-pamuk.jpg",
    "width": 2048,
    "height": 1536,
    "blurhash": "LFPI{mxa%MRjV?jZtRoz-pWBR*f6"
  }
}
```

Opsiyonel alanlar (`applicationArea`, `surface`, `priceMinor`, `quantityValue`, `image.width` vb.) sadece değer varsa gönderilmeli; aksi halde backend otomatik olarak `null` döner.

Notlar:

- `quantityValue`, `locationLat`, `locationLng` gibi ondalık alanlar string (örn. "2.5") olarak gönderilmeli.
- `priceCurrency` backend’de uppercase’e çevrilir; üç harfli ISO kodu beklenir.
- `image.blurhash`, `image.width`, `image.height`, `image.exif` opsiyoneldir; veri yoksa göndermeyin.
- `contentType` için desteklenen görsel türleri: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/heic`, `image/heif`, `image/gif`.
- Bucket private ise `publicUrl` tarayıcıda 403 dönebilir; CloudFront kullanın ya da gelecekteki imzalı GET endpoint’ini bekleyin.
- [ ] S3 yüklemesi başarısızsa sample kaydını oluşturmadan önce kullanıcıya tekrar deneme seçeneği sun.
- [ ] Sample oluşturulduktan sonra koleksiyon akışı hazır olana kadar yalnızca sample listeleri güncellenmeli.

## 4. Hata Yönetimi & Geri Dönüşler

- [ ] Pre-signed isteği 401 dönerse auth yenile; 403 dönerse kullanıcıyı çıkışa zorla.
- [ ] `POST /samples` doğrulama hatalarında backend mesajını kullanıcıya çevrilebilir formatta göster.
- [ ] Upload veya sample oluşturma başarısız olursa lokalde tutulan fotoğraf referansını temizlemeyi unutma.

## 5. Test & İzleme

- [ ] Xcode Unit/UI testlerinde mock endpoint’lerle `POST /uploads/presign` ve `PUT` upload akışını taklit et.
- [ ] Gerçek backend ile QA sırasında `curl` ve cihaz loglarını kullanarak upload süresini ölç.
- [ ] Firebase Crashlytics veya alternatif loglama aracına hata kodlarını (`upload_url_expired`, `sample_create_failed` vb.) push et.

## 6. Sonraki Adımlar (Opsiyonel)

- [ ] Private içerik ihtiyacı oluşursa `GET /uploads/sign-get` endpoint’i eklendiğinde UI tarafına adaptasyon planı çıkar.
- [ ] Çoklu fotoğraf yükleme desteği için upload kuyruğu ve eş zamanlılık stratejisini araştır.
