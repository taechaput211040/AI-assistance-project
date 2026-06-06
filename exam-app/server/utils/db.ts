// libSQL / Turso client (works with Turso in prod, local SQLite file in dev).
// Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to use Turso; otherwise falls back
// to a local file at .data/app.db (zero setup for local development).
import { createClient, type Client } from '@libsql/client'
import { mkdirSync } from 'node:fs'

let _client: Client | null = null

export function getDb(): Client {
  if (_client) return _client
  let url = process.env.TURSO_DATABASE_URL || ''
  // กันค่า placeholder จาก .env.example — ถ้าไม่ใช่ URL จริงให้ใช้ไฟล์ local
  if (!url || url.includes('your-db')) url = 'file:.data/app.db'
  const authToken = url.startsWith('file:') ? undefined : process.env.TURSO_AUTH_TOKEN
  if (url.startsWith('file:')) {
    try { mkdirSync('.data', { recursive: true }) } catch {}
  }
  _client = createClient(authToken ? { url, authToken } : { url })
  return _client
}

let _ready = false
export async function ensureTables() {
  if (_ready) return
  const db = getDb()
  await db.execute(`CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY, date TEXT, source TEXT, segment TEXT, platform TEXT,
    version TEXT, area TEXT, text TEXT, category TEXT, sentiment TEXT,
    priority TEXT, owner TEXT, theme TEXT, ai_summary TEXT, priority_score REAL)`)
  await db.execute(`CREATE TABLE IF NOT EXISTS dashboard_meta (id INTEGER PRIMARY KEY, json TEXT)`)
  await db.execute(`CREATE TABLE IF NOT EXISTS sim_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, detail TEXT, data TEXT, created_at TEXT)`)
  // migration for tables created before the data column existed
  try { await db.execute('ALTER TABLE sim_history ADD COLUMN data TEXT') } catch {}
  // key-value cache (e.g. restaurants refreshed daily by cron)
  await db.execute(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT)`)
  _ready = true
}
