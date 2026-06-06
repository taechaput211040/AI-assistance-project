# เมนู 1 — Dashboard: Player Feedback Insight Report

> เปลี่ยน feedback ผู้เล่น 300 รายการ (free-text ภาษาไทย) ให้เป็น report และ dashboard ที่ทีม Game / Marketing / QA / Community ใช้งานต่อได้

## ทำอะไร

- รับไฟล์ `player_feedback_300_dataset.xlsx` (300 แถว ไม่มี label) → ให้ **AI จัดหมวดทุกแถว**: Category (9 หมวด), Sentiment (Pos/Neu/Neg), Priority (P1–P3), Suggested Owner (ทีมรับผิดชอบ), Theme, AI Summary
- สรุปเป็น Insight: Top pain points, ภาระงานตามทีม, Risk, Recommended Action
- แสดงผลเป็น dashboard เชิงโต้ตอบ + ส่งออกไฟล์ deliverables ครบชุด

## ทำยังไง (Workflow: Data → AI → Clean → Insight → Report)

1. **Data** — ตรวจคุณภาพไฟล์ดิบ (300 แถว, ไม่มี id ซ้ำ, area_hint เป็นแค่ hint ไม่ใช้เป็น label)
2. **AI Classify** — ใช้ Claude อ่านและจัดป้ายตามแก่นความหมาย (ดู prompt จริงใน `deliverables/prompt_log.docx`) — ตัดสิน sentiment จากแก่นข้อความ ไม่ใช่คำลงท้ายสุภาพ
3. **Clean/Aggregate** — `scripts/enrich.py` merge ป้าย AI เข้าทุกแถว, คำนวณ priority score, aggregate ตามหมวด/ทีม/ธีม/เวลา → ออกเป็น `feedback.json` + `feedback_analysis.xlsx`
4. **Insight** — จัดอันดับปัญหาด้วยสูตร impact = ปริมาณ × ความรุนแรง(P) × ความลบ + action ที่แนะนำต่อหมวด
5. **Report** — dashboard (เมนูนี้) + `report.html` (1–3 หน้า) + เอกสารประกอบ

## ฟีเจอร์บนหน้า

- KPI cards (รวม / %ลบ / P1 เร่งด่วน / %บวก) + สรุปอัตโนมัติที่ปรับตามตัวกรอง
- กราฟ: Sentiment, Priority, หมวด×Sentiment (stacked), แหล่งที่มา, Segment, ภาระงานตามทีม, แนวโน้มรายวัน
- Top Pain Points เรียงตาม impact + ตารางหมวด+Action
- ตาราง drill-down 300 รายการ: **กรอง** (หมวด/sentiment/priority/ทีม/segment/ค้นข้อความ) + **เรียง** (คลิกหัวคอลัมน์)
- Export: Report (.md) + CSV ตามตัวกรอง
- ข้อมูลอ่านจาก **DB (Turso)** ผ่าน `GET /api/feedback` มี fallback เป็น static JSON

## ใช้อะไร

| ส่วน | เทคโนโลยี |
|---|---|
| AI classification + summarization | Claude (Anthropic) |
| Clean/aggregate pipeline | Python + openpyxl (`scripts/enrich.py`) |
| หน้าเว็บ | Nuxt 3, Vue 3, Chart.js |
| ฐานข้อมูล | Turso (libSQL) — ตาราง `feedback`, `dashboard_meta` (seed ด้วย `npm run db:seed`) |
| Deliverables | `deliverables/feedback_analysis.xlsx`, `prompt_log.docx`, `report.html`, `workflow_notes.docx`, `04_VALIDATION.md`, `EVIDENCE.docx` |

## ไฟล์หลัก

```
exam-app/pages/dashboard.vue          หน้า dashboard
exam-app/server/api/feedback.get.ts   API อ่านข้อมูล (DB → fallback static)
exam-app/server/data/feedback.json    ข้อมูลที่ AI จัดหมวดแล้ว
scripts/enrich.py                     pipeline จัดหมวด+aggregate
deliverables/                          ไฟล์ส่งมอบทั้งหมด
```
