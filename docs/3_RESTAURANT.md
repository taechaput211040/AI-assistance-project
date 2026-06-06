# เมนู 3 — Restaurant Finder

> Workflow ค้นหา → วิเคราะห์ → ให้คะแนน → แนะนำร้านอาหารสำหรับทีม 8–12 คน มื้อเย็นหลังเลิกงาน จาก **ข้อมูลจริง รีวิวจริง พร้อมหลักฐานตรวจสอบได้** ใน 5 พื้นที่: สยาม, อารีย์, ทองหล่อ, อโศก, พร้อมพงษ์

## ทำยังไง (pipeline อัตโนมัติจริง ไม่ใช่ mockup)

```
Google Places API (New) ──► RAW ──► CLEAN ──► SCORE ──► หน้าเว็บ + DB
   searchText (5 พื้นที่)      แยกเก็บ    dedupe       น้ำหนักล็อก
   + place details (รีวิว)               จัดประเภท
   + photos                              normalize ราคา
                                          เช็ค field หาย
```

1. **ดึงข้อมูลจริง** — `searchText` พื้นที่ละ 1 ครั้ง (สูงสุด 20 ร้าน/พื้นที่ ≈ 100 ร้าน) + `place details` ดึง**รีวิวจริง** + **รูปร้าน** ของ top 30 → นับเป็น 2 แหล่ง (place data / review data) ตามเงื่อนไข ≥2 แหล่ง
2. **RAW vs CLEAN แยกชัด** — raw เก็บ response ดิบ (`restaurants_raw.json` / DB), clean ผ่าน: รวมร้านซ้ำด้วย place_id (เก็บโซนที่ใกล้ศูนย์กลางสุด), จัดประเภทอาหารจาก primaryType/types, normalize ราคา (priceLevel→฿ + ใช้ priceRange เป็นตัวสำรอง), ตรวจ field ที่หาย (ติด flag + ลดคะแนน)
3. **ให้คะแนน — น้ำหนักล็อก ห้ามเปลี่ยน (รวม 100%)**

| หมวด | น้ำหนัก | คิดจาก |
|---|---|---|
| เรตติ้งรีวิวเฉลี่ย | 30% | rating/5 |
| จำนวนรีวิว (ความน่าเชื่อ) | 15% | min(count/500, 1) |
| เหมาะกับกลุ่ม | 20% | goodForGroups + reservable + servesDinner |
| ความคุ้มราคา | 15% | ฿฿ เหมาะทีมสุด, แพง/ถูกเกินลดหลั่น |
| ใกล้ BTS | 10% | ระยะ haversine จากสถานีของพื้นที่ (≤3 กม.) |
| บรรยากาศคุยงาน | 10% | heuristic จากประเภท (บาร์/คาเฟ่โดนหัก) |

4. **เก็บลง DB + รีเฟรชอัตโนมัติ** — **Vercel Cron วันละครั้ง (18:00 ไทย)** ยิง `/api/cron/refresh-restaurants` → ดึงใหม่ → upsert ลง Turso (ตาราง `kv`) → หน้าเว็บอ่านจาก DB (fallback ไฟล์ static) → ไม่เรียก Google ทุก request, ~35 calls/วัน อยู่ในโควต้าฟรี

## ฟีเจอร์บนหน้า

- หัวเรื่องระบุ ทีม 8–12 คน / พื้นที่ / เป้าหมาย / จำนวน raw→clean / น้ำหนักคะแนน / แหล่งข้อมูล
- **การ์ดแนะนำ Top 3** — รูปร้านจริง, คะแนน/100, เหตุผลประกอบ, คะแนนแยก 6 หมวด (บาร์), รีวิวจริง 1 ข้อความ, เวลาเปิด-ปิดวันนี้ + badge เปิด/ปิดอยู่, **ลิงก์หลักฐาน Google Maps**
- **ตารางจัดอันดับ** — กรอง (พื้นที่/ประเภทอาหาร/ราคา/เรตติ้งขั้นต่ำ/ค้นชื่อ) + เรียงทุกคอลัมน์ คลิกแถวกางดูคะแนนแยกหมวด รีวิว รูป ที่อยู่ เวลาทำการครบสัปดาห์
- การ์ดอธิบายวิธีทำ (raw→clean→score→evidence) + เวลาอัปเดตล่าสุด
- แชต AI รับข้อมูลร้านครบทุกโซน (รวมเวลาทำการรายวัน) ตอบคำถามได้ เช่น "ร้านไหนปิดวันอาทิตย์"

## ใช้อะไร

| ส่วน | เทคโนโลยี |
|---|---|
| ข้อมูลร้าน/รีวิว/รูป/เวลาทำการ | Google Places API (New) — searchText + place details + photo media |
| (ตัวเลือก) ราคาเสริมแหล่งที่ 2 | Foursquare Places API (ปิดอยู่ ไม่ใส่ key ก็ทำงานปกติ) |
| Pipeline | `server/utils/restaurant-clean.mjs` (JS โมดูลเดียว ใช้ทั้ง CLI และ cron) |
| ตั้งเวลาอัตโนมัติ | Vercel Cron (`vercel.json`) |
| ฐานข้อมูล | Turso (libSQL) ตาราง `kv` |
| หน้าเว็บ | Nuxt 3, Vue 3 |

## ไฟล์หลัก + วิธีรัน

```
exam-app/pages/restaurant.vue                         หน้าเว็บ
exam-app/server/utils/restaurant-clean.mjs            fetch + clean + score (หัวใจ)
exam-app/server/api/restaurants.get.ts                API อ่าน (DB → fallback static)
exam-app/server/api/cron/refresh-restaurants.get.ts   cron รีเฟรชรายวัน
exam-app/scripts/fetch-restaurants.mjs                CLI ดึงแบบ manual → ไฟล์ static
exam-app/server/data/restaurants_{raw,clean}.json     raw / clean แยกไฟล์
```

```bash
# ดึงข้อมูล (ต้องมี GOOGLE_MAPS_API_KEY ใน .env)
npm run fetch:restaurants          # ลงไฟล์ static
# หรือเปิด /api/cron/refresh-restaurants  → ลง DB
```
