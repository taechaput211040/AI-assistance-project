# เมนู 2 — Gacha Drop Rate Simulator

> เครื่องมือจำลองการสุ่มกาชา: ตั้งเรตเอง จัด item pool สุ่มจริงตามความน่าจะเป็น และวิเคราะห์มุมผู้เล่น (Monte Carlo) ว่า "เติมเท่านี้ ลุ้น SSR ได้แค่ไหน"

## ทำอะไร / ทำยังไง ทีละส่วน

### ① Rate Setting
- ตั้งเรต SSR/SR/R/N ได้อิสระ (ดีฟอลต์ 1/9/30/60) มีบาร์แสดงสัดส่วน
- **Validation:** ผลรวมต้อง = 100% (pill เขียว/แดง), ห้ามติดลบ — ถ้าไม่ผ่าน ระบบบล็อกการสุ่มพร้อมบอกเหตุผล

### ② Pity & Free Roll
- **Hard pity**: การันตี SSR เมื่อสุ่มถึงครั้งที่กำหนด (ดีฟอลต์ 90)
- **Soft pity**: เรต SSR ไต่ขึ้นเรื่อย ๆ ตั้งแต่ครั้งที่กำหนด (+%/ครั้ง) — เรตที่เพิ่มถูกหักจาก rarity อื่นตามสัดส่วน
- **Free roll**: สุ่มครบ X paid ได้ฟรี Y — นับจาก paid เท่านั้น ฟรีไม่สร้างฟรีซ้ำ

### ③ Item Pool
- เพิ่ม item (ชื่อ + dropdown rarity), แสดงเป็นกริดแยกตาม rarity, แก้ชื่อ/ย้าย rarity inline, ลบได้
- **Validation:** rarity ที่มีเรต > 0 ต้องมี item อย่างน้อย 1 ชิ้น ไม่งั้นบล็อก

### ④ Single Simulation
- กรอกจำนวนครั้ง (paid) + ราคาต่อครั้ง → สุ่มจริงด้วย `Math.random()`: **สุ่ม rarity ตามเรตสะสม (รวม pity) ก่อน แล้วค่อยสุ่ม item ใน rarity นั้น** — ไม่ hardcode ผล
- แสดง: จำนวนแต่ละ rarity, ค่าใช้จ่ายรวม (จ่ายเฉพาะ paid), rarity ที่ออกมากสุด, **ตารางเรตที่ตั้ง vs สัดส่วนจริง**, ตาราง item ที่ได้, กราฟ doughnut
- **Export CSV**: roll_no, rarity, item_name, cost_type (paid/free), cost — ใส่ BOM เปิด Excel ภาษาไทยไม่เพี้ยน

### ⑤ Player POV Simulator (Monte Carlo)
- กรอกงบ + ราคา/roll + จำนวน simulation (+ เลือก target item ได้)
- คำนวณ: paid = งบ÷ราคา → free → total rolls แล้วรันจำลองหลายพันรอบ
- แสดง: **P(≥1 SSR), P(0 SSR), ค่าเฉลี่ย SSR/รอบ, best/worst**, โอกาสได้ target item, กราฟการกระจายจำนวน SSR, **insight ภาษาคน** เช่น "เติม 3,000 บาท (110 rolls) มีโอกาสได้ SSR อย่างน้อย 1 ตัว ~67%"
- ความถูกต้อง: ทดสอบเทียบทฤษฎีแล้ว (110 rolls @1% → 67.1% vs ทฤษฎี 66.8%)
- **Export POV CSV**: budget, paid/free/total rolls, sims, probabilities, averages

### ⑥ ประวัติ Simulation (เก็บลง DB)
- ทุกการสุ่ม/จำลองบันทึกลง **Turso** (ตาราง `sim_history` พร้อม snapshot ผลลัพธ์) → refresh แล้วไม่หาย
- คลิกแถวเพื่อกางดูว่ารอบนั้นได้อะไรบ้าง, ปุ่มล้างประวัติ, ถ้าบันทึกไม่สำเร็จมีกล่องแดงฟ้อง error จริง

### Validation รวม
ค่าติดลบ / เรตรวม≠100 / pool ว่าง / จำนวนครั้ง≤0 / **cap กันค้าง**: Single ≤ 100,000 ครั้ง, POV ≤ 2 ล้าน rolls/รอบ และ total×sims ≤ 20 ล้าน ops (ลด sims อัตโนมัติพร้อมแจ้ง)

## ใช้อะไร

| ส่วน | เทคโนโลยี |
|---|---|
| หน้าเว็บ + ตรรกะสุ่ม | Nuxt 3, Vue 3 (reactive), `Math.random()` cumulative weights |
| กราฟ | Chart.js |
| ประวัติ | Turso (libSQL) ผ่าน `POST/GET/DELETE /api/sim-history` |
| ผู้ช่วย | แชต AI ฝั่งขวา รับบริบทเรต/pool/ผลล่าสุดของหน้านี้ |

## ไฟล์หลัก

```
exam-app/pages/gacha.vue                      หน้า + ตรรกะสุ่มทั้งหมด
exam-app/server/api/sim-history.{get,post,delete}.ts   API ประวัติ
exam-app/server/utils/db.ts                   ตัวต่อ DB (Turso/local file)
```
