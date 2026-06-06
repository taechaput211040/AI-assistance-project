// Clear simulation history
import { getDb, ensureTables } from '../utils/db'

export default defineEventHandler(async () => {
  try {
    await ensureTables()
    await getDb().execute('DELETE FROM sim_history')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
