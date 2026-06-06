# Workflow — Data → AI → Clean → Insight → Report

อธิบายขั้นตอนทั้งหมดตั้งแต่ข้อมูลดิบจนถึง report ที่ใช้งานได้ พร้อมไฟล์/เครื่องมือที่เกี่ยวข้องในแต่ละขั้น

```
[1] DATA            [2] AI CLASSIFY        [3] CLEAN/AGGREGATE     [4] INSIGHT            [5] REPORT
player_feedback  →  Claude จัด           →  enrich.py รวมป้าย    →  สรุป Top Issues,   →  - Dashboard (Nuxt)
_300_dataset.xlsx   Sentiment/Category/      + นับ aggregate         Patterns, Risk,        - Short Report (HTML/PDF)
(300 แถว, free text) Priority/Owner/Theme    + สร้าง JSON/Sheet      Recommended Action     - Sheet (xlsx)
```

---

## [1] Data — เตรียมข้อมูล
- **Input:** `player_feedback_300_dataset.xlsx` (sheet `Feedback_Raw`, 300 แถว) และ `Category_Guide` (นิยาม 9 หมวด)
- **คอลัมน์ตั้งต้น:** feedback_id, date, source, player_id, player_segment, platform, game_version, game_area_hint, player_feedback
- **ตรวจคุณภาพ:** ข้อมูลครบ 300 แถว, ไม่มี id ซ้ำ, ข้อความเป็นภาษาไทยทั้งหมด, คอลัมน์ `game_area_hint` ว่าง 100 แถว (เป็น hint ไม่ใช่ป้าย) → ไม่นำมาใช้เป็น label

## [2] AI Classify — ให้ AI จัดหมวด
- ใช้ **Prompt 1** (ดู `01_PROMPT_LOG.md`) ให้ Claude วิเคราะห์แต่ละแก่นข้อความ แล้วให้ค่า: `category`, `sentiment`, `priority` (P1–P3), `owner` (ทีม), `theme`
- ตัดสิน sentiment จากแก่นความหมาย ไม่ใช่คำลงท้ายสุภาพ; ตัดสิน priority จากผลกระทบต่อการเล่น/รายได้

## [3] Clean / Aggregate — รวมและทำความสะอาด
- สคริปต์ `scripts/enrich.py`:
  - merge ป้ายของ AI กลับเข้ากับข้อมูลดิบทุกแถว (ตาม feedback_id / แก่นข้อความ)
  - คำนวณ `priority_score` (P1=3, P2=2, P3=1 ถ่วงด้วยความลบ) เพื่อจัดอันดับ
  - aggregate: นับตาม category, sentiment, priority, owner, source, segment, platform, version, theme, และ trend รายวัน
  - export ผลเป็น 2 รูปแบบ:
    - `exam-app/server/data/feedback.json` → ป้อน dashboard
    - `deliverables/feedback_enriched.xlsx` → sheet พร้อมวิเคราะห์ต่อ (4 ชีต: ข้อมูล enrich, สรุปหมวด, top issues, ภาระงานทีม)

## [4] Insight — สรุปประเด็น
- ใช้ **Prompt 2** สรุปจากตัวเลขที่ aggregate แล้ว เป็น: ภาพรวม, Top Issues (เรียงตาม impact), Patterns, Risk, Recommended Action
- จัดอันดับปัญหาด้วยสูตร **impact = ปริมาณเสียง × ความรุนแรง (priority) × ความเป็นลบ** เพื่อให้ "สิ่งที่ควรแก้ก่อน" อิงข้อมูล

## [5] Report — ส่งมอบ
- **Dashboard (Nuxt + Vue + Chart.js):** กราฟ Category / Sentiment / Priority / Owner / Trend, ตัวกรองหลายชั้น, ตาราง drill-down, ปุ่ม export — deploy บน Vercel
- **Short Report (`03_INSIGHT_REPORT.html`):** 1–3 หน้า อ่านรู้เรื่อง พิมพ์เป็น PDF ได้
- **Sheet (`feedback_enriched.xlsx`):** สำหรับทีมที่อยากกรอง/ทำ pivot ต่อเอง

---

## เครื่องมือที่ใช้
| ขั้น | เครื่องมือ |
|---|---|
| Data / Clean / Aggregate | Python (openpyxl) |
| AI Classify / Summarize | Claude (LLM) |
| Dashboard | Nuxt 3, Vue 3, Chart.js |
| Deploy | Vercel |
| Report | HTML (พิมพ์เป็น PDF), Excel |
