# iOS için Koleksiyonlara Sample Ekleme Rehberi

Bu rehber, iOS istemcisinin mevcut koleksiyonlara sample (örnek içerik) ekleyebilmesi için gereken API uç noktalarını ve izlenmesi gereken adımları özetler. Aşağıdaki senaryo, koleksiyona yeni bir sample eklerken tipik olarak ihtiyaç duyulan çağrıları temel alır.

## Kimlik Doğrulama

- Tüm `collections` ve `samples` uç noktaları, `Authorization: Bearer <Clerk JWT>` başlığını bekler.
- Token geçersiz veya eksikse sunucu `401 Unauthorized` döner. İlgili kullanıcıya ait bir token kullanıldığından emin olun.

## İlgili Uç Noktalar

- `GET /collections` — Kullanıcının koleksiyonlarını listeler. Her koleksiyonun `samples` dizisi dolu gelir ve mevcut sıralamayı gösterir.
- `GET /collections/:collectionId` — Tek bir koleksiyonun detaylarını ve içindeki sample listesini döner.
- `POST /samples` — Sample yaratırken isteğe bağlı `collectionIds` alanı ile yeni sample'ı seçili koleksiyon(lar)a otomatik ekler.
- `POST /collections/:collectionId/samples` — Belirli bir sample'ı koleksiyona ekler. (Temel işlemi gerçekleştiren uç nokta)
- `DELETE /collections/:collectionId/samples/:sampleId` — Sample'ı koleksiyondan çıkarır (opsiyonel).
- `GET /samples` veya `GET /samples/:sampleId` — Kullanıcının sample'larını almak ve doğru `sampleId`'yi bulmak için kullanılır.

## Adım Adım Akış

1. **Eklemek istediğiniz sample'ı bulun**
   - `GET /samples` ile kullanıcının sample listesini çekin veya UI'da zaten seçili sample'ın `id` bilgisini kullanın.
   - Sample, koleksiyon sahibiyle aynı kullanıcıya ait olmalıdır; aksi halde `403 Forbidden` döner.

2. **Koleksiyonun güncel durumunu kontrol edin (opsiyonel fakat önerilir)**
   - `GET /collections/:collectionId` çağrısı ile koleksiyonun size ait olduğunu doğrulayın ve halihazırda ekli sample'ları görün.
   - Sample zaten koleksiyonda ise sunucu `409 Conflict` döndüreceği için, istemci tarafında da bu kontrol yapılabilir.

3. **Sample'ı koleksiyona ekleyin**
   - Uç nokta: `POST /collections/:collectionId/samples`
   - Gövde: `{"sampleId": "<eklenecek_sample_id>"}` (JSON olarak)
   - Başarılı durumda `201 Created` ve aşağıdaki örneğe benzer bir `data` yanıtı gelir:

```json
{
  "data": {
    "sampleId": "sample_123",
    "position": 3,
    "addedAt": "2024-05-10T12:34:56.000Z",
    "sample": {
      "id": "sample_123",
      "userId": "user_456",
      "title": "Soyut Çizim",
      "materialType": "illustration",
      "isDeleted": false,
      "createdAt": "2024-04-01T09:12:00.000Z",
      "updatedAt": "2024-05-01T10:00:00.000Z"
    }
  }
}
```

- Dönen `position` değeri sample'ın koleksiyon içindeki sırasını belirtir. UI'da koleksiyon görünümünü güncellerken bu değeri kullanabilirsiniz.
- **Alternatif:** `POST /samples` çağrısında `collectionIds: ["<collection_id>"]` gönderirseniz backend, sample'ı hem oluşturur hem de seçili koleksiyonlara ekler. Hatalı koleksiyon kimliği gönderilirse istek `404` ile reddedilir ve sample oluşturulmaz.

4. **Koleksiyon görünümünü yenileyin**
   - İstemci tarafında koleksiyonun `samples` dizisini güncelleyin veya `GET /collections/:collectionId` ile taze veriyi alın.
   - Kullanıcıya başarılı ekleme bildirimini gösterin.

## Hata Kodları ve Çözümleri

- `401 Unauthorized`: Token eksik/geçersiz. Kullanıcıyı yeniden kimlik doğrulamaya yönlendirin.
- `403 Forbidden`: Sample veya koleksiyon başka bir kullanıcıya ait. UI'da seçim yapılmasına izin vermeyin.
- `404 Not Found`: `collectionId` veya `sampleId` hatalı. Gönderilen kimliklerin geçerli olduğundan emin olun.
- `409 Conflict`: Sample zaten koleksiyonda. Kullanıcıya bilgilendirme yapıp tekrar ekleme denemesini engelleyin.

## Örnek cURL Çağrısı

```bash
curl -X POST https://<api-url>/collections/col_ABC/samples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_CLERK_JWT>" \
  -d '{"sampleId": "sample_123"}'
```

Bu komut örneği, iOS tarafında `URLRequest` veya benzeri bir HTTP istemcisiyle yapacağınız çağrının HTTP seviyesindeki karşılığıdır.

## Ek Notlar

- Mevcut bir sample'ı düzenlerken koleksiyon listesini değiştirmek için `PATCH /samples/:sampleId` isteğine `collectionIds` alanı ekleyebilirsiniz. Liste koleksiyon üyeliğini tamamen yeniden yazar; boş gönderilirse sample tüm koleksiyonlardan çıkarılır.
- Bir sample'ı kaldırmak için `DELETE /collections/:collectionId/samples/:sampleId` çağrısını kullanın; sunucu kalan sample'ların pozisyonlarını otomatik olarak normalize eder.
