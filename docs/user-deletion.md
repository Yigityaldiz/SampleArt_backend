## User Deletion & Sample Cleanup Notes

### 1. Clerk Webhook → Soft Delete Trigger

- Ek endpoint: `/webhooks/clerk`.
- Sadece `user.deleted` olayını dinle.
- Gönderimi imza ile doğrula (Clerk Signing Secret).
- Payload içindeki `user_id` için:
  - `users` tablosunda `deletedAt` vb. alanları doldur (soft delete).
  - `samples`, `collections`, `sample_images` için `isDeleted` / `deletedAt` alanlarını işaretle.
  - Silinen kayıtları `cleanup_tasks` (ör. `{ entityType, entityId, objectKeys[], status }`) tablosuna ekle.

### 2. Cron Job İşleyişi

- Belirli aralıklarla çalışan cron job (`CLEANUP_POLL_INTERVAL_MS` ile ayarlanabilir) `cleanup_tasks` tablosunu tarar:
 1. Görev statüsü `pending` veya `failed` olanları al (`scheduledAt <= now()`).
  2. `objectKeys[]` listesini S3’ten batch halinde sil (`DeleteObjects`).
  3. Başarılıysa ilişkili DB kayıtlarını hard delete et (transaction ile).
  4. Başarısızsa `status = failed`, `attempts += 1` gibi alanlar tut; tekrar deneme politikası belirle.
- Farklı görev tipleri:
  - `sample-delete`: Tek bir sample için S3 görseli + DB hard delete.
  - `user-delete`: Kullanıcı tüm varlıkları (samples, collections, vb.).

### 3. Sample Silme Akışı

- API `DELETE /samples/:id` → soft delete (`isDeleted = true`, `deletedAt = now()`).
- Soft delete sonrasında:
  - `cleanup_tasks` içine sample’a ait `objectKey` ve `sampleId` ile bir kayıt yaz.
  - Cron job S3 dosyasını silip sample kaydını hard delete eder.

### 4. Kullanıcı Silme Akışı

- Clerk webhook tetiklediğinde:
  - Kullanıcı ve ilişkili tüm varlıklar soft delete.
  - Tüm sample image key’leri `cleanup_tasks` kaydına eklenir.
  - Cron job S3 temizliği + veritabanı hard delete işlemini yürütür.
- Öncelik sırası: önce S3 nesneleri, sonra DB.

### 5. Güvenlik & İzleme

- Cron job logları: hangi key’ler silindi, hangi kayıtlar hard delete edildi.
- Hata durumunda görev `failed` durumuna alınır, `scheduledAt` ileri atılır; tekrar deneme sayısı (`attempts`) artar.
- Soft delete alanları (`deletedAt`, `deletedBy`) sayesinde audit mümkün; admin panelde “silinmiş bekleyen” kayıtları filtreleyebiliriz (opsiyonel).
