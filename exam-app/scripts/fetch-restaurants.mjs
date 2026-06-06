// Restaurant Finder pipeline (CLI) — Google Places API (New)
// Usage (from exam-app/):  GOOGLE_MAPS_API_KEY=xxx npm run fetch:restaurants
// Writes static snapshots used as fallback:
//   server/data/restaurants_raw.json  (raw: place data + review data)
//   server/data/restaurants_clean.json (deduped, categorised, normalised, scored)
// In production the same data is refreshed into the DB daily via the cron route.
import { writeFileSync, readFileSync } from 'node:fs'
import { buildPayload, AREA_TH } from '../server/utils/restaurant-clean.mjs'

// load .env (node ไม่อ่านให้อัตโนมัติเหมือน Nuxt)
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const KEY = process.env.GOOGLE_MAPS_API_KEY
if (!KEY) {
  console.error('❌ ไม่พบ GOOGLE_MAPS_API_KEY — ตั้งใน .env หรือ env ก่อนรัน')
  process.exit(1)
}

const { meta, restaurants, raw } = await buildPayload(KEY, process.env.FOURSQUARE_API_KEY)

writeFileSync(new URL('../server/data/restaurants_raw.json', import.meta.url), JSON.stringify({
  meta: { fetched_at: meta.generated_at, areas: AREA_TH, sources: ['places.searchText', 'places.details.reviews', 'foursquare.places.search'] },
  places: raw.places, reviews: raw.reviews, foursquare: raw.foursquare || []
}, null, 1))

writeFileSync(new URL('../server/data/restaurants_clean.json', import.meta.url),
  JSON.stringify({ meta, restaurants }, null, 1))

console.log(`✅ raw ${raw.places.length} → clean ${restaurants.length} ร้าน`)
console.log('Top 3:', restaurants.slice(0, 3).map(r => `${r.name} (${r.score})`).join(' | '))
