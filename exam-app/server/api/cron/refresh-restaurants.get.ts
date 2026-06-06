// Daily refresh of restaurant data: fetch from Google Places -> clean/score -> store in DB.
// Triggered by Vercel Cron (see vercel.json). Can also be hit manually once to populate.
// Protected by CRON_SECRET if that env var is set (Vercel sends it automatically).
import { buildPayload } from '../../utils/restaurant-clean.mjs'
import { getDb, ensureTables } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = getHeader(event, 'authorization')
    if (auth !== `Bearer ${secret}`) { setResponseStatus(event, 401); return { ok: false, error: 'unauthorized' } }
  }
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) { setResponseStatus(event, 400); return { ok: false, error: 'missing GOOGLE_MAPS_API_KEY' } }
  try {
    const payload = await buildPayload(key, process.env.FOURSQUARE_API_KEY)
    await ensureTables()
    await getDb().execute({
      sql: `INSERT INTO kv (k, v, updated_at) VALUES ('restaurants', ?, ?)
            ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`,
      args: [JSON.stringify({ meta: payload.meta, restaurants: payload.restaurants }), new Date().toISOString()]
    })
    return { ok: true, count: payload.restaurants.length, raw: payload.meta.raw_count, at: payload.meta.generated_at }
  } catch (e) {
    setResponseStatus(event, 500)
    return { ok: false, error: String(e) }
  }
})
