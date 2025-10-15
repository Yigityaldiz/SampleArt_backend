# AWS EC2 Deployment Micro-Tasks

## Repository & Image Prep
- [x] Add Docker entrypoint to run Prisma migrations automatically
- [x] Build production image locally (`docker build -t sample-art-backend .`)
- [ ] Tag and push image to container registry (ECR or Docker Hub)
- [ ] Review `.env` for production-safe values (no test keys)

## EC2 Provisioning
- [x] Launch EC2 instance with Docker installed (Ubuntu 22.04 LTS recommended)
- [x] Open required security-group ports (22 for SSH, 3000 temporarily, 443 for HTTPS)
- [x] Copy production `.env`/secrets to instance (use SSM or scp, avoid committing)
- [x] Pull or load backend image on EC2 (`docker pull` or `docker load`)

## HTTP Smoke Test
- [x] Start container in HTTP mode (`PORT=3000`, `RUN_DB_MIGRATIONS=true`)
- [x] Confirm migrations succeed in logs (`Prisma migrations completed.`)
- [x] Hit `http://<ec2-ip>:3000/health` and core endpoints to validate
- [ ] Verify S3/Clerk integrations with test actions (upload, auth)

## Domain & HTTPS Enablement
- [x] Point domain A-record to EC2 public IPv4
- [x] Install Certbot (`sudo snap install --classic certbot` or apt)
- [x] Issue Let’s Encrypt cert (`certbot certonly --standalone -d example.com`)
- [x] Mount cert/key into container (`/etc/letsencrypt/live/...` → `/tls/`)
- [x] Update env: `PORT=443`, `HTTPS_CERT_PATH`, `HTTPS_KEY_PATH`, `FORCE_HTTPS_REDIRECT=true`
- [x] Restart container in HTTPS mode (`docker run ... -p 443:443`)
- [x] Smoke test `https://example.com/health` and critical APIs

## Post-Deployment Hygiene
- [ ] Configure `certbot renew` cron + post-renew hook to restart container
- [ ] Close temporary port 3000 in security group
- [ ] Set up monitoring (certificate expiry, container health, logs)
- [ ] Document runbook for future updates (image deploy, env changes)
