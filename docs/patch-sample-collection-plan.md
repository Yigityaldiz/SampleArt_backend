# PATCH /samples/:id için `collectionIds` Desteği Planı

Bu çalışma, sample düzenleme akışında koleksiyon seçimini tek istekte güncelleyebilmek için `PATCH /samples/:id` endpointine `collectionIds` alanı eklemeyi hedefliyor.

## Amaç
- Mevcut iki adımlı süreci (sample metadata PATCH + koleksiyon ekleme/çıkarma) tek REST çağrısına indirmek.
- iOS ve diğer istemcilerin sample düzenleme deneyimini basitleştirmek.

## Yapılacaklar
1. **Schema güncellemesi**
   - `updateSampleBodySchema` içine opsiyonel `collectionIds: string[]` alanı ekle.
   - Diziyi normalize etmek (trim, unique) için controller düzeyinde ek kontrol hazırla.

2. **Controller mantığı**
   - `updateSample` içinde `collectionIds` var mı kontrol et.
   - Mevcut koleksiyonları `Service.getById` ile al; hedef listeyle diff çıkar.
   - Eksik koleksiyonlar için `CollectionService.addSample`, fazlalıklar için `CollectionService.removeSample`, sıralama için `reorderSamples` çağır.
   - Koleksiyon bulunamazsa 404; başka kullanıcıya aitse 403 döndür.

3. **İşlem sırası ve hata yönetimi**
   - Sample alanlarını güncelle, ardından koleksiyon mutasyonlarını yap.
   - Koleksiyon güncellemeleri sırasında hata olursa sample değişikliklerini geri almak gerekmiyor (metadata update zaten idempotent), ancak cevapta 4xx/5xx ilet.

4. **Testler**
   - `sample.controller.test.ts` içine yeni senaryolar ekle:
     - Koleksiyon ekleme/çıkarma/sıralama patch akışı.
     - Hatalı koleksiyon ID’si veya başka kullanıcıya ait koleksiyon durumlarında 404/403.

5. **Dokümantasyon**
   - `docs/ios-collection-sample-guide.md` ve `docs/api-endpoints.md` dosyalarını güncelle; `PATCH /samples/:id` gövdesinde `collectionIds` kullanımını anlat.

6. **Manual doğrulama**
   - Yeni akışla sample’ı patch edip koleksiyon ataması yap; `GET /collections/:id` ve `GET /samples/:id` ile sonuçları doğrula.
