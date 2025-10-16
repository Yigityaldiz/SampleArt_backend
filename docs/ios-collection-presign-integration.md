# iOS Integration Notes — Collection Presign Access

- Update shared-collection views to fetch entries via `GET /samples?collectionId=<collectionId>` so collaborators receive the shared samples after the backend membership check.
- Update the network layer that calls `POST /uploads/presign-download` to supply the new `sampleId` (and optional `collectionId` when available) fields alongside `objectKey`.
- Ensure request/response models reflect the backend schema changes so decoding still succeeds after the API update.
- Review any cached or prebuilt `objectKey` download flows; they now need the associated sample context before requesting a URL.
- Verify media viewers opened from shared collections continue displaying assets once the new parameters are passed.

## Request Details

- **Endpoint**: `POST /uploads/presign-download`
- **Headers**: Standard auth bearer/token headers required for other authenticated calls.
- **Body**:

  ```json
  {
    "objectKey": "samples/usr_123/abc.jpg",
    "sampleId": "sample_456",
    "collectionId": "col_789"
  }
  ```

  - `objectKey`: S3 anahtarı (Sample API'nin image alanından gelir).
  - `sampleId`: Görüntülenecek sample kimliği (zorunlu).
  - `collectionId`: Sample hangi koleksiyon bağlamından açıldıysa ekleyin; bilinmiyorsa alanı atlayabilirsiniz.

## Response Example

```json
{
  "data": {
    "key": "samples/usr_123/abc.jpg",
    "downloadUrl": "https://s3-presign-url...",
    "expiresIn": 900,
    "expiresAt": "2024-06-15T12:34:56.000Z"
  }
}
```

## Notes

- Backend `sampleId` + `objectKey` eşleşmesini doğruluyor; uyumsuzlukta 404 dönebilir.
- Koleksiyon üyelerinin hem liste hem de download aşamasında doğrulanması için, koleksiyon ekranı `collectionId` parametresiyle list endpoint’ini çağırmalı; download isteğinde de aynı kimliği göndermek doğrulamayı hızlandırır.
- Kullanıcı sample sahibi değilse, koleksiyon üyeliği kontrolü yapılır. `collectionId` sağlanırsa erişim kararını hızlandırır.
- Önceki istemci uygulamaları yalnızca `objectKey` gönderiyordu; yeni sürümde `sampleId` zorunlu olduğu için model/decoder güncellemesi şart.
