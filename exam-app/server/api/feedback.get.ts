// Dashboard data (read-only). Reads enriched feedback from the DB;
// falls back to the bundled static JSON if the DB is empty or unavailable,
// so the dashboard always works even before seeding.
import staticData from '../data/feedback.json'
import { getDb, ensureTables } from '../utils/db'

export default defineEventHandler(async () => {
  try {
    await ensureTables()
    const db = getDb()
    const rs = await db.execute('SELECT * FROM feedback')
    if (!rs.rows.length) return staticData
    const records = rs.rows.map((r: any) => ({
      id: r.id, date: r.date, source: r.source, segment: r.segment,
      platform: r.platform, version: r.version, area: r.area, text: r.text,
      category: r.category, sentiment: r.sentiment, priority: r.priority,
      owner: r.owner, theme: r.theme, ai_summary: r.ai_summary,
      priority_score: r.priority_score
    }))
    const mr = await db.execute('SELECT json FROM dashboard_meta WHERE id = 1')
    const meta = mr.rows.length ? JSON.parse(mr.rows[0].json as string) : (staticData as any).meta
    return { meta, records, source: 'db' }
  } catch (e) {
    return staticData
  }
})
