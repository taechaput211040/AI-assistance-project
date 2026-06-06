// Save one simulation run to history (with full result snapshot)
import { getDb, ensureTables } from '../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const type = String(body?.type || '').slice(0, 40)
  const detail = String(body?.detail || '').slice(0, 300)
  const data = body?.data != null ? JSON.stringify(body.data).slice(0, 40000) : null
  if (!type) return { ok: false, error: 'missing type' }
  try {
    await ensureTables()
    const db = getDb()
    await db.execute({
      sql: 'INSERT INTO sim_history (type, detail, data, created_at) VALUES (?, ?, ?, ?)',
      args: [type, detail, data, new Date().toISOString()]
    })
    await db.execute('DELETE FROM sim_history WHERE id NOT IN (SELECT id FROM sim_history ORDER BY id DESC LIMIT 200)')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
