# EC2 Setup Activity Log

Bu dosya 3.254.169.147 (Ubuntu 24.04 / ip-172-31-45-204) üzerindeki backend kurulum adımlarını özetler.

## 1. İlk hazırlıklar
- `ssh -i ~/Downloads/sampleArtssh.pem ubuntu@3.254.169.147` ile bağlantı sağlandı.
- Sistemde Docker yoktu; `sudo apt-get update && sudo apt-get install -y docker.io` ile kuruldu.
- `ubuntu` kullanıcısı `docker` grubuna eklendi (`sudo usermod -aG docker ubuntu`), Docker servisi kontrol edildi (`systemctl status docker`).
- `~/.docker/cli-plugins` altında Buildx plugini indirildi (`docker-buildx v0.17.1`), çalıştırılabilir yapıldı.

## 2. Projenin hazırlanması
- Repo HTTPS ile klonlandı: `git clone https://github.com/Yigityaldiz/SampleArt_backend.git`.
- Klasör yapısı `/home/ubuntu/SampleArt_backend/SampleArt_backend` olarak doğrulandı.
- `.env.production` dosyası oluşturuldu ve daha sonra gerekli değerlerle güncellendi.

## 3. Docker imajı
- BuildKit gereksinimleri giderildi (pnpm için global kurulum, runtime’da OpenSSL paketleri).
- `DOCKER_BUILDKIT=1 docker build -t sample-art-backend:latest .` komutu ile imaj üretildi.
- Imaj doğrulandı: `docker images sample-art-backend`.

## 4. PostgreSQL kurulumu
- `sudo apt-get install -y postgresql postgresql-contrib` ile Postgres 16 kuruldu.
- Kullanıcı ve veritabanı oluşturuldu:
  - `CREATE USER sample_art WITH PASSWORD 'sample_art';`
  - `createdb -O sample_art sample_art`
- `postgresql.conf` içinde `listen_addresses='*'` ayarı yapıldı.
- `pg_hba.conf` dosyasına Docker bridge ağından erişim için `host all sample_art 172.17.0.0/16 scram-sha-256` satırı eklendi.
- Servis yeniden başlatıldı: `sudo systemctl restart postgresql`.

## 5. Uygulama konteyneri
- `.env.production` içindeki `DATABASE_URL` sunucunun private IP’si ile güncellendi (`172.31.45.204`).
- Konteyner başlatıldı:
  ```bash
  docker run -d --name sample-art-backend \
    --env-file .env.production \
    -e RUN_DB_MIGRATIONS=true \
    -p 3000:3000 \
    sample-art-backend:latest
  ```
- Loglarda Prisma migrasyonlarının başarıyla çalıştığı doğrulandı.
- `curl http://localhost:3000/health` ile servis sağlığı test edildi (`status: ok`).

## 6. Bekleyen adımlar
- Security group’ta 3000 ve 443 portlarının açılması.
- İmajın registry’ye push edilmesi.
- HTTPS kurulumu (domain yönlendirmesi + Certbot sertifikası).
- Production gizli anahtarlarının (`CLERK_*`, `AWS_*`) gerçek değerlerle güncellenmesi ve 3000 portunun kapatılması.

