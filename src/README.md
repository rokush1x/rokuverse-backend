# ROXUVERSE Backend

Node.js + Express + PostgreSQL API untuk ROXUVERSE app.

## 🚀 Deploy ke Railway

1. **Push ke GitHub**
   ```bash
   git init && git add . && git commit -m "init"
   git remote add origin https://github.com/<user>/roxuverse-backend.git
   git push -u origin main
   ```

2. **Buat project di Railway** → New Project → Deploy from GitHub repo

3. **Add PostgreSQL plugin** → New → Database → PostgreSQL
   - `DATABASE_URL` otomatis di-inject ke service

4. **Set Environment Variables** di tab Variables:
   ```
   JWT_SECRET=<random 64 chars>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<password kuat>
   ```

5. **Deploy** — `npm start` akan otomatis run migrate + seed + server

6. **Setelah deploy sukses**, copy URL Railway (mis. `https://roxuverse-backend-production.up.railway.app`)
   dan update `API_URL` di frontend.

## 🔑 Endpoint

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/login` | – |
| GET  | `/api/user/me` | ✓ |
| POST | `/api/user/avatar` | ✓ |
| GET  | `/api/tools` | ✓ |
| GET  | `/api/products` | ✓ |
| GET  | `/api/payment/methods` | ✓ |
| POST | `/api/payment/deposit` | ✓ |
| POST | `/api/badges/buy` | ✓ |
| POST | `/api/badges/equip` | ✓ |
| GET  | `/api/chat/messages` | ✓ |
| POST | `/api/chat/messages` | ✓ |
| GET  | `/api/notifications` | ✓ |
| POST | `/api/notifications/read-all` | ✓ |

## 🛠️ Local dev
```bash
cp .env.example .env
npm install
npm run migrate && npm run seed
npm run dev
```

mkdir roxuverse-backend && cd roxuverse-backend
# copy semua file di atas sesuai struktur
git init
git add .
git commit -m "Initial ROXUVERSE backend"
git branch -M main
git remote add origin https://github.com/USERNAME/roxuverse-backend.git
git push -u origin main
