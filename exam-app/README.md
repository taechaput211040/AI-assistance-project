# Game Insight Suite

เว็บแอป 3 เมนู (Nuxt 3 + Vue 3 + Chart.js) สำหรับโจทย์ข้อสอบ

1. **Dashboard — Player Feedback Insight Report** ✅ เสร็จแล้ว
2. **Gacha Drop Rate Simulator** — (เมนูถัดไป)
3. **Restaurant Finder** — (เมนูถัดไป)

## รันในเครื่อง

```bash
cd exam-app
npm install
npm run dev      # เปิด http://localhost:3000
```

## Build / Preview

```bash
npm run build
npm run preview
```

## Deploy ขึ้น Vercel

1. push โฟลเดอร์นี้ขึ้น GitHub
2. ที่ Vercel → New Project → import repo
3. ตั้งค่า **Root Directory = `exam-app`** (เพราะโค้ดอยู่ในโฟลเดอร์ย่อย)
4. Framework จะถูกตรวจเป็น **Nuxt** อัตโนมัติ — กด Deploy ได้เลย (ไม่ต้องตั้ง env)

> Nuxt มี Vercel preset ในตัว ไม่ต้องตั้งค่า build เพิ่ม

## โครงสร้าง

```
exam-app/
├─ pages/            หน้าแต่ละเมนู (dashboard / gacha / restaurant)
├─ layouts/          เลย์เอาต์ + แถบเมนูด้านข้าง
├─ components/       ChartCanvas.vue (กราฟ Chart.js)
├─ server/
│  ├─ api/feedback.get.ts   API ส่งข้อมูล feedback
│  └─ data/feedback.json    ข้อมูลที่ AI จัดหมวดแล้ว (300 รายการ)
├─ assets/css/       ธีม/สไตล์
└─ nuxt.config.ts
```

## ข้อมูล Dashboard

`server/data/feedback.json` สร้างจากสคริปต์ `../scripts/enrich.py`
(อ่าน `player_feedback_300_dataset.xlsx` → apply ป้ายที่ AI จัด → aggregate → JSON)
รันใหม่ได้ด้วย: `python3 ../scripts/enrich.py`

ดูวิธีวิเคราะห์/prompt/validation ได้ที่โฟลเดอร์ `../deliverables/`
