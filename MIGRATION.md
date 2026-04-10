# การย้ายโครงสร้างโฟลเดอร์

โปรเจกต์นี้ถูกปรับโครงสร้างให้แยก frontend/backend ออกจากกัน

## โครงสร้างใหม่

```
AUNQA-ESAR/
├── frontend/          ← React/Vite
│   ├── src/           ← ย้ายมาจาก src/
│   ├── public/        ← ย้ายมาจาก public/
│   ├── index.html     ← ย้ายมาจาก index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── backend/           ← Express/Node
│   ├── server-mongo.cjs  ← ย้ายมาจาก root
│   ├── server/           ← ย้ายมาจาก server/
│   ├── scripts/          ← ย้ายมาจาก scripts/
│   ├── api/              ← ย้ายมาจาก api/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml       ← Production (Swarm)
├── docker-compose.dev.yml   ← Local dev
└── .gitlab-ci.yml
```

## ขั้นตอนการย้ายไฟล์ (ทำครั้งเดียว)

```bash
# Frontend
mv src/ frontend/
mv public/ frontend/
mv index.html frontend/
mv eslint.config.js frontend/
mv .npmrc frontend/

# Backend
mv server-mongo.cjs backend/
mv server/ backend/
mv scripts/ backend/
mv api/ backend/
```

## GitLab CI Variables ที่ต้องตั้งใน GitLab Settings > CI/CD > Variables

| Variable | Description |
|---|---|
| `CI_REGISTRY_USER` | GitLab registry username |
| `CI_REGISTRY_PASSWORD` | GitLab registry password |
| `VITE_API_BASE_URL` | URL ของ backend เช่น `https://aunqa-api.wrf.rmutsv.app` |
| `SWARMPIT_URL` | URL ของ Swarmpit |
| `SWARMPIT_TOKEN` | Swarmpit API token |
| `FRONTEND_HOST` | Domain ของ frontend |
| `BACKEND_HOST` | Domain ของ backend |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT secret key (สุ่มให้ปลอดภัย) |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `CORS_ORIGIN` | Frontend URL สำหรับ CORS |
