# 🎮 Game Insight Suite

เว็บแอป 3 เมนูสำหรับโจทย์สอบ AI-Assisted Development — สร้างด้วย **Nuxt 3 + Vue 3** ใช้ **AI (Claude)** ช่วยวิเคราะห์ข้อมูล และดึง**ข้อมูลจริง**จาก Google Places API

## 🔗 Links

| | |
|---|---|
| **🌐 Production** | https://ai-assistance-project.vercel.app |
| **📦 Repository** | https://github.com/taechaput211040/AI-assistance-project |

> ผู้ช่วย AI ในแอป: กดไอคอน ⚙ ที่แผงแชตด้านขวา ใส่ API key ของคุณเอง (Anthropic หรือ OpenAI) — key เก็บในเบราว์เซอร์เท่านั้น

---

## 📋 3 เมนู

### 1️⃣ Dashboard — Player Feedback Insight Report
เปลี่ยน feedback ผู้เล่น 300 รายการ (free-text ไทย) เป็น report ที่ใช้งานต่อได้
- AI (Claude) จัดหมวดทุกแถว: Category / Sentiment / Priority (P1-P3) / Suggested Owner / AI Summary
- KPI, กราฟ (sentiment, priority, หมวด, ทีม, trend), Top pain points เรียงตาม impact, Action ที่แนะนำ
- ตาราง drill-down กรอง+เรียงได้, Export report/CSV
- 📄 รายละเอียด: [docs/MENU1_DASHBOARD.md](docs/MENU1_DASHBOARD.md) · ไฟล์ส่งมอบ: [deliverables/](deliverables/)

### 2️⃣ Gacha Drop Rate Simulator
จำลองการสุ่มกาชาด้วยความน่าจะเป็นจริง
- ตั้งเรต SSR/SR/R/N (รวมต้อง 100%), จัด item pool, ระบบ Pity (hard+soft), Free roll
- Single simulation + ตารางเรตตั้ง vs ออกจริง + Export CSV
- Player POV: Monte Carlo จากงบเติมเงิน → P(≥1 SSR), เฉลี่ย, best/worst + insight ภาษาคน
- ประวัติบันทึกลง DB กดดูรายละเอียดย้อนหลังได้
- 📄 รายละเอียด: [docs/MENU2_GACHA.md](docs/MENU2_GACHA.md)

### 3️⃣ Restaurant Finder
แนะนำร้านมื้อเย็นสำหรับทีม 8–12 คน จาก**ข้อมูลจริง+รีวิวจริง** (สยาม/อารีย์/ทองหล่อ/อโศก/พร้อมพงษ์)
- Pipeline อัตโนมัติ: Google Places API → raw → clean (dedupe/จัดประเภท/normalize ราคา) → score ตามน้ำหนักล็อก 100%
- Top 3 cards (รูปจริง, เหตุผล, รีวิว, เวลาเปิด-ปิด, ลิงก์หลักฐาน Google Maps) + ตาราง Top 10 กรอง/เรียงได้
- **Vercel Cron รีเฟรชข้อมูลวันละครั้ง** (18:00 ไทย) เก็บลง DB
- 📄 รายละเอียด: [docs/MENU3_RESTAURANT.md](docs/MENU3_RESTAURANT.md)

---

## 🛠 Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Nuxt 3, Vue 3, Chart.js (ธีม cozy pixel) |
| Backend | Nitro server routes (ในตัว Nuxt) |
| Database | Turso (libSQL) — local dev ใช้ไฟล์ SQLite อัตโนมัติ |
| AI | Claude (จัดหมวด feedback + แชตผู้ช่วยในแอป) |
| ข้อมูลร้าน | Google Places API (New) |
| Deploy | Vercel (region: Singapore) + Vercel Cron |
| Data pipeline | Python (openpyxl), Node.js scripts |

## 🚀 รันในเครื่อง

```bash
cd exam-app
npm install
cp .env.example .env        # แล้วใส่ค่า (อย่างน้อย GOOGLE_MAPS_API_KEY)
npm run db:seed             # seed feedback 300 รายการลง DB
npm run fetch:restaurants   # ดึงข้อมูลร้านจริงจาก Google
npm run dev                 # → http://localhost:5000
```

### Environment Variables (`exam-app/.env`)

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | ✅ (เมนู 3) | Places API (New) — มี free tier |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | ตอน deploy | DB บน cloud (local ไม่ใส่ = ใช้ไฟล์ `.data/app.db`) |
| `FOURSQUARE_API_KEY` | ❌ optional | แหล่งราคาที่ 2 (ปิดไว้) |
| `CRON_SECRET` | ❌ optional | ล็อก route cron |

## ☁️ Deploy (Vercel)

1. Import repo → **Root Directory = `exam-app`** → Framework: Nuxt
2. ใส่ env: `GOOGLE_MAPS_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. Deploy แล้วเปิด `/api/db-health` เช็ค DB และ `/api/cron/refresh-restaurants` เติมข้อมูลร้านครั้งแรก
4. รายละเอียด DB: [DB_SETUP.md](DB_SETUP.md)

## 📁 โครงสร้าง

```
├── exam-app/            ← เว็บแอป Nuxt (Root Directory ตอน deploy)
│   ├── pages/           dashboard / gacha / restaurant
│   ├── components/      AiChat, ChartCanvas
│   ├── server/api/      feedback, sim-history, restaurants, cron, db-health
│   ├── server/utils/    db.ts, restaurant-clean.mjs (pipeline)
│   └── scripts/         db-seed, fetch-restaurants
├── deliverables/        ไฟล์ส่งมอบเมนู 1 (sheet, prompt log, report, workflow, evidence)
├── docs/                เอกสารอธิบายแต่ละเมนู
├── scripts/enrich.py    AI classification pipeline (เมนู 1)
└── player_feedback_300_dataset.xlsx   dataset ตั้งต้น
```

---

*สอบ AI-Assisted Development · Taechaput · 2026*
