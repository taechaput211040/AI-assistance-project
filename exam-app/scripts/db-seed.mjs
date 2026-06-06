// Seed the DB with the enriched feedback data (Dashboard, read-only).
// Usage (from exam-app/):  node scripts/db-seed.mjs
//   - uses Turso if TURSO_DATABASE_URL is set, else local file .data/app.db
import { createClient } from '@libsql/client'
import { readFileSync, mkdirSync } from 'node:fs'

const url = process.env.TURSO_DATABASE_URL || 'file:.data/app.db'
const authToken = process.env.TURSO_AUTH_TOKEN
if (url.startsWith('file:')) { try { mkdirSync('.data', { recursive: true }) } catch {} }
const db = createClient(authToken ? { url, authToken } : { url })

const data = JSON.parse(readFileSync(new URL('../server/data/feedback.json', import.meta.url), 'utf8'))

await db.execute(`CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY, date TEXT, source TEXT, segment TEXT, platform TEXT,
  version TEXT, area TEXT, text TEXT, category TEXT, sentiment TEXT,
  priority TEXT, owner TEXT, theme TEXT, ai_summary TEXT, priority_score REAL)`)
await db.execute(`CREATE TABLE IF NOT EXISTS dashboard_meta (id INTEGER PRIMARY KEY, json TEXT)`)
await db.execute(`CREATE TABLE IF NOT EXISTS sim_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, detail TEXT, created_at TEXT)`)

await db.execute('DELETE FROM feedback')
await db.execute('DELETE FROM dashboard_meta')

const stmts = data.records.map((r) => ({
  sql: `INSERT INTO feedback
    (id,date,source,segment,platform,version,area,text,category,sentiment,priority,owner,theme,ai_summary,priority_score)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  args: [r.id, r.date, r.source, r.segment, r.platform, r.version, r.area, r.text,
         r.category, r.sentiment, r.priority, r.owner, r.theme, r.ai_summary, r.priority_score ?? 0]
}))
// insert in chunks to stay within batch limits
for (let i = 0; i < stmts.length; i += 100) {
  await db.batch(stmts.slice(i, i + 100), 'write')
}
await db.execute({ sql: 'INSERT INTO dashboard_meta (id, json) VALUES (1, ?)', args: [JSON.stringify(data.meta)] })

console.log(`seeded ${data.records.length} feedback records + meta into ${url}`)
