# Database Setup (Turso / libSQL)

แอปเก็บข้อมูล 2 อย่างใน DB:
- **Dashboard** — feedback 300 รายการ (อ่านอย่างเดียว) ในตาราง `feedback` + `dashboard_meta`
- **Gacha** — ประวัติ simulation ในตาราง `sim_history` (เพิ่ม/อ่าน/ล้าง)

โค้ดใช้ libSQL client ตัวเดียว: ถ้ามี env ของ Turso จะใช้ Turso, ถ้าไม่มีจะใช้ไฟล์ SQLite local ที่ `.data/app.db` อัตโนมัติ

---

## รันแบบ local (ไม่ต้องสมัครอะไร)

```bash
cd exam-app
npm install
npm run db:seed     # สร้างตาราง + ใส่ feedback 300 รายการ ลงไฟล์ .data/app.db
npm run dev         # http://localhost:5000
```

Dashboard จะอ่านจาก DB; Gacha จะบันทึกประวัติลง DB
(ถ้ายังไม่ `db:seed` Dashboard จะ fallback ไปใช้ไฟล์ static JSON ให้อัตโนมัติ — แอปไม่พัง)

---

## ใช้ Turso (สำหรับ deploy บน Vercel)

### 1. สร้าง DB บน Turso
ทางเว็บ [turso.tech](https://turso.tech) หรือ CLI:
```bash
# ติดตั้ง CLI (ครั้งเดียว)
curl -sSfL https://get.tur.so/install.sh | bash

turso auth signup
turso db create game-insight
turso db show game-insight --url          # ได้ค่า TURSO_DATABASE_URL
turso db tokens create game-insight       # ได้ค่า TURSO_AUTH_TOKEN
```

### 2. ตั้ง env แล้ว seed
สร้างไฟล์ `exam-app/.env` (ดูตัวอย่างใน `.env.example`):
```
TURSO_DATABASE_URL=libsql://game-insight-xxxx.turso.io
TURSO_AUTH_TOKEN=xxxxx
```
แล้วรัน:
```bash
cd exam-app
npm run db:seed     # คราวนี้ลงข้อมูลที่ Turso
```

### 3. Deploy บน Vercel
- import repo, ตั้ง **Root Directory = `exam-app`**
- ใส่ Environment Variables 2 ตัว: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- Deploy

> หมายเหตุ: บน Vercel ต้องใช้ Turso (ไฟล์ local เขียนไม่ได้บน serverless) — แต่ถ้าลืมตั้ง env Dashboard ยัง fallback เป็น static JSON ได้

---

## ตาราง

| ตาราง | ใช้ทำอะไร |
|-------|-----------|
| `feedback` | feedback 300 รายการ + ป้าย AI (category, sentiment, priority, owner, theme, ai_summary) |
| `dashboard_meta` | ค่าสรุป/aggregate ของ dashboard (JSON 1 แถว) |
| `sim_history` | ประวัติการ simulate ของหน้า Gacha |

seed ใหม่เมื่อไรก็ได้ด้วย `npm run db:seed` (จะล้าง `feedback`/`dashboard_meta` แล้วใส่ใหม่ ไม่ยุ่งกับ `sim_history`)
