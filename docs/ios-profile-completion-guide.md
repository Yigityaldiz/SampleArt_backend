## iOS Profile Completion Integration

Bu doküman, iOS istemcisinde zorunlu profil tamamlama (`name`) akışını uygulamak için gerekli çağrıları ve JSON yapıları özetler.

### 1. İlk Oturum Sonrası Bootstrap

- `GET /users/me`
- Header: `Authorization: Bearer <Clerk JWT veya mock token>`

#### Örnek Yanıt

```json
{
  "data": {
    "id": "user_123",
    "email": "jane@example.com",
    "name": null,
    "displayName": "jane",
    "profileStatus": "INCOMPLETE",
    "requiredFields": ["name"],
    "locale": "en",
    "createdAt": "2024-10-15T07:05:12.123Z",
    "updatedAt": "2024-10-15T07:05:12.123Z"
  }
}
```

### 2. Profil Tamamlama Ekranını Açma

- `profileStatus === "INCOMPLETE"` ise kullanıcı uygulama akışına geçmeden önce tek adımlık modal/sayfa gösterin.
- `requiredFields` dizisini kontrol ederek hangi alanların zorunlu olduğunu belirleyin (şu an yalnızca `"name"`).

### 3. İsim Doğrulama Kuralları

- Minimum 2, maksimum 80 karakter.
- Baş ve sondaki boşluklar backend tarafından kırpılır; birden fazla boşluk tek boşluğa indirgenir.
- Yalnızca yazdırılabilir karakterler kabul edilir; kontrol karakterleri 400 hatası üretir.

### 4. Profili Güncelleme

- `PATCH /users/{id}`
  - `id`, `GET /users/me` yanıtındaki `data.id`.
  - Header: `Authorization: Bearer …`

#### İstek Gövdesi

```json
{
  "name": "Jane Doe"
}
```

#### Başarılı Yanıt

```json
{
  "data": {
    "id": "user_123",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "displayName": "Jane Doe",
    "profileStatus": "COMPLETE",
    "requiredFields": [],
    "locale": "en",
    "createdAt": "2024-10-15T07:05:12.123Z",
    "updatedAt": "2024-10-15T07:15:42.456Z"
  }
}
```

#### Geçersiz Girdi Örneği

```json
{
  "error": {
    "message": "Validation failed",
    "errors": {
      "name": ["name must be at least 2 characters"]
    }
  }
}
```

### 5. Akış Önerileri

1. Oturum açma -> `GET /users/me`.
2. `profileStatus === "INCOMPLETE"` ise zorunlu alan modalını göster.
3. Kullanıcı geçerli `name` girdiğinde `PATCH /users/{id}` çağır.
4. Başarılı yanıtla birlikte `profileStatus === "COMPLETE"` döner; modal kapanır ve normal akışa devam edilir.

### 6. Üyelik/Davet Listeleri

- Liste uçlarından gelen kullanıcı nesnelerinde `displayName` alanını kullanarak isim/placeholder gösterin.
