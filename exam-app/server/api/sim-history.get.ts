// Recent simulation history (Gacha page), with result snapshot
import { getDb, ensureTables } from '../utils/db'

export default defineEventHandler(async () => {
  try {
    await ensureTables()
    const rs = await getDb().execute('SELECT type, detail, data, created_at FROM sim_history ORDER BY id DESC LIMIT 10')
    return rs.rows.map((r: any) => {
      let data = null
      try { data = r.data ? JSON.parse(r.data) : null } catch {}
      return { type: r.type, detail: r.detail, time: (r.created_at || '').slice(11, 19), data }
    })
  } catch (e) {
    return []
  }
})
