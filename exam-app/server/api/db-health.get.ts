// DB diagnostic — เปิด /api/db-health เพื่อดูว่า DB ใช้งานได้จริงไหม
import { getDb, ensureTables } from '../utils/db'

export default defineEventHandler(async () => {
  let url = process.env.TURSO_DATABASE_URL || ''
  if (!url || url.includes('your-db')) url = 'file:.data/app.db'
  const driver = url.startsWith('file:') ? 'local file (.data/app.db)' : 'Turso: ' + url
  try {
    await ensureTables()
    const db = getDb()
    // ทดสอบเขียน + อ่านจริง
    await db.execute({
      sql: `INSERT INTO kv (k, v, updated_at) VALUES ('health', ?, ?)
            ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`,
      args: ['ok', new Date().toISOString()]
    })
    const sim = await db.execute('SELECT COUNT(*) AS n FROM sim_history')
    const fb = await db.execute('SELECT COUNT(*) AS n FROM feedback')
    return {
      ok: true, driver,
      sim_history_rows: Number(sim.rows[0].n),
      feedback_rows: Number(fb.rows[0].n),
      note: 'DB เขียน/อ่านได้ปกติ'
    }
  } catch (e) {
    return { ok: false, driver, error: String(e) }
  }
})
