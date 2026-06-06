// Restaurant Finder data (read-only). Reads from DB (refreshed daily by cron);
// falls back to the bundled static snapshot if the DB is empty/unavailable.
import staticClean from '../data/restaurants_clean.json'
import staticRaw from '../data/restaurants_raw.json'
import { getDb, ensureTables } from '../utils/db'

export default defineEventHandler(async () => {
  try {
    await ensureTables()
    const rs = await getDb().execute("SELECT v, updated_at FROM kv WHERE k = 'restaurants'")
    if (rs.rows.length) {
      const p = JSON.parse(rs.rows[0].v as string)
      return {
        meta: {
          ...p.meta,
          refreshed_at: rs.rows[0].updated_at,
          raw_places: p.meta?.raw_places ?? p.meta?.raw_count ?? 0,
          raw_reviews: p.meta?.raw_reviews ?? 0,
          source: 'db'
        },
        restaurants: p.restaurants || []
      }
    }
  } catch (e) { /* fall through to static */ }
  return {
    meta: {
      ...(staticClean as any).meta,
      raw_places: (staticRaw as any).places?.length || 0,
      raw_reviews: (staticRaw as any).reviews?.length || 0,
      source: 'static'
    },
    restaurants: (staticClean as any).restaurants || []
  }
})
