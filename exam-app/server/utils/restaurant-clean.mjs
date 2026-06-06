// Restaurant pipeline core — fetch (Google Places New + Foursquare) + clean + score.
// Pure JS (no node:fs) so it can be imported by both the Nitro server (cron route)
// and the CLI script. Network uses global fetch (Node 18+ / Nitro).

// ----- fixed config (DO NOT change weights) -----
export const WEIGHTS = { rating: 30, reviews: 15, group: 20, price: 15, distance: 10, ambience: 10 }

export const AREAS = [
  { key: 'siam', th: 'สยาม', lat: 13.7457, lng: 100.5331 },
  { key: 'ari', th: 'อารีย์', lat: 13.7797, lng: 100.5446 },
  { key: 'thonglor', th: 'ทองหล่อ', lat: 13.7240, lng: 100.5790 },
  { key: 'asok', th: 'อโศก', lat: 13.7373, lng: 100.5601 },
  { key: 'phrompong', th: 'พร้อมพงษ์', lat: 13.7305, lng: 100.5697 }
]
export const AREA_TH = AREAS.map(a => a.th)
export const DECISION_GOAL = 'เลือกร้านมื้อเย็นหลังเลิกงาน 1–3 ร้าน จากพื้นที่ที่กำหนด'

const PRICE_NUM = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4
}
const PRICE_LABEL = { 0: 'ฟรี', 1: '฿', 2: '฿฿', 3: '฿฿฿', 4: '฿฿฿฿' }
const PRICE_VALUE = { 0: 0.6, 1: 0.8, 2: 1.0, 3: 0.7, 4: 0.45 }

const CUISINE = [
  ['thai', 'ไทย'], ['japanese', 'ญี่ปุ่น'], ['sushi', 'ญี่ปุ่น'], ['ramen', 'ญี่ปุ่น'],
  ['korean', 'เกาหลี'], ['chinese', 'จีน'], ['dim_sum', 'จีน'], ['italian', 'อิตาเลียน'],
  ['pizza', 'อิตาเลียน'], ['french', 'ฝรั่งเศส'], ['indian', 'อินเดีย'], ['mexican', 'เม็กซิกัน'],
  ['american', 'อเมริกัน'], ['hamburger', 'อเมริกัน'], ['steak', 'สเต๊ก'], ['seafood', 'ซีฟู้ด'],
  ['barbecue', 'ปิ้งย่าง/บุฟเฟต์'], ['buffet', 'บุฟเฟต์'], ['vegetarian', 'มังสวิรัติ'],
  ['vegan', 'มังสวิรัติ'], ['cafe', 'คาเฟ่'], ['coffee', 'คาเฟ่'], ['bakery', 'เบเกอรี'],
  ['bar', 'บาร์'], ['pub', 'บาร์'], ['fast_food', 'ฟาสต์ฟู้ด']
]
function cuisineOf(primaryType, types, name) {
  const pri = ((primaryType || '') + ' ' + (name || '')).toLowerCase()
  for (const [kw, label] of CUISINE) if (pri.includes(kw)) return label
  const hay = (types || []).join(' ').toLowerCase()
  for (const [kw, label] of CUISINE) if (hay.includes(kw)) return label
  return 'อื่น ๆ'
}
function haversineKm(a, b) {
  const R = 6371, toR = d => d * Math.PI / 180
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
const clamp01 = x => Math.max(0, Math.min(1, x))
function norm(s) {
  return (s || '').toLowerCase().replace(/[\s\-_.,'"()]+/g, '').replace(/restaurant|ร้าน|bangkok|กรุงเทพ/g, '')
}
// match a cleaned record to a Foursquare entry by name + proximity
function matchFsq(rec, fsqList) {
  if (rec.lat == null) return null
  const rn = norm(rec.name)
  let best = null, bestD = 0.3
  for (const f of fsqList) {
    if (f.lat == null) continue
    const d = haversineKm({ lat: rec.lat, lng: rec.lng }, { lat: f.lat, lng: f.lng })
    if (d > 0.3) continue
    const fn = norm(f.name)
    const nameMatch = rn && fn && (rn.includes(fn) || fn.includes(rn))
    if ((nameMatch || d < 0.05) && d < bestD) { best = f; bestD = d }
  }
  return best
}

function scoreOne(r) {
  const sub = {}
  sub.rating = clamp01((r.rating || 0) / 5)
  sub.reviews = clamp01((r.reviews_count || 0) / 500)
  const gf = r.good_for_groups === true ? 1 : r.good_for_groups === false ? 0.3 : 0.5
  const rv = r.reservable === true ? 1 : r.reservable === false ? 0.4 : 0.6
  const dn = r.serves_dinner === true ? 1 : r.serves_dinner === false ? 0.3 : 0.6
  sub.group = clamp01(gf * 0.6 + rv * 0.2 + dn * 0.2)
  sub.price = r.price_level == null ? 0.6 : (PRICE_VALUE[r.price_level] ?? 0.6)
  sub.distance = clamp01(1 - (r.distance_km ?? 3) / 3)
  let amb = 0.7
  const t = (r.primary_type || '') + ' ' + (r.cuisine || '')
  if (/bar|pub|night_club|บาร์/i.test(t)) amb = 0.3
  if (/cafe|fast_food|คาเฟ่|ฟาสต์/i.test(t)) amb = 0.5
  if (r.serves_dinner === true && r.dine_in === true) amb += 0.15
  sub.ambience = clamp01(amb)
  let total = 0
  for (const k of Object.keys(WEIGHTS)) total += (WEIGHTS[k] / 100) * sub[k]
  for (const k of Object.keys(sub)) sub[k] = Math.round(sub[k] * 100)
  return { subscores: sub, score: Math.round(total * 1000) / 10 }
}
function reasonOf(r) {
  const bits = []
  if (r.rating) bits.push(`เรตติ้ง ${r.rating} จาก ${(r.reviews_count || 0).toLocaleString()} รีวิว`)
  if (r.good_for_groups) bits.push('รองรับกลุ่ม (goodForGroups)')
  else if (r.reservable) bits.push('จองโต๊ะได้')
  if (r.price_label && r.price_label !== '—') bits.push(`ราคา ${r.price_label}${r.price_source === 'foursquare' ? ' (FSQ)' : ''}`)
  if (r.distance_km != null) bits.push(`ห่าง ${r.area} ~${r.distance_km} กม.`)
  if (r.cuisine && r.cuisine !== 'อื่น ๆ') bits.push(`อาหาร${r.cuisine}`)
  return bits.join(' · ')
}

export function cleanAndScore(rawPlaces, reviewsById = {}, fsqList = []) {
  const byId = new Map()
  for (const { area, place } of rawPlaces) {
    if (!place || !place.id) continue
    const areaDef = AREAS.find(a => a.th === area) || AREAS[0]
    const loc = place.location || {}
    const lat = loc.latitude ?? null, lng = loc.longitude ?? null
    const dist = (lat != null) ? Math.round(haversineKm(areaDef, { lat, lng }) * 100) / 100 : null
    let priceLevel = place.priceLevel != null ? (PRICE_NUM[place.priceLevel] ?? null) : null
    let priceSource = priceLevel != null ? 'google' : null
    let priceRange = ''
    if (place.priceRange) {
      const s = Number(place.priceRange.startPrice?.units)
      const e = Number(place.priceRange.endPrice?.units)
      const cur = place.priceRange.startPrice?.currencyCode || place.priceRange.endPrice?.currencyCode || 'THB'
      const sym = cur === 'THB' ? '฿' : cur + ' '
      if (isFinite(s) && isFinite(e)) priceRange = `${sym}${s}–${e}`
      else if (isFinite(s)) priceRange = `${sym}${s}+`
      else if (isFinite(e)) priceRange = `≤${sym}${e}`
      if (priceLevel == null) {
        const mid = (isFinite(s) && isFinite(e)) ? (s + e) / 2 : (isFinite(s) ? s : e)
        if (isFinite(mid)) { priceLevel = mid < 150 ? 1 : mid < 400 ? 2 : mid < 800 ? 3 : 4; priceSource = 'google' }
      }
    }
    const rec = {
      id: place.id,
      name: place.displayName?.text || place.displayName || '(ไม่มีชื่อ)',
      area, area_key: areaDef.key, lat, lng,
      cuisine: cuisineOf(place.primaryType, place.types, place.displayName?.text),
      primary_type: place.primaryType || '',
      address: place.formattedAddress || '',
      rating: place.rating ?? null,
      reviews_count: place.userRatingCount ?? null,
      price_level: priceLevel, price_source: priceSource, price_range: priceRange,
      good_for_groups: place.goodForGroups ?? null,
      reservable: place.reservable ?? null,
      serves_dinner: place.servesDinner ?? null,
      dine_in: place.dineIn ?? null,
      distance_km: dist,
      hours: place.regularOpeningHours?.weekdayDescriptions || [],
      open_now: place.currentOpeningHours?.openNow ?? place.regularOpeningHours?.openNow ?? null,
      maps_url: place.googleMapsUri || (place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : ''),
      fsq_url: '',
      top_reviews: (reviewsById[place.id] || []).slice(0, 2)
    }
    // ---- Foursquare cross-source enrichment (price + 2nd evidence link) ----
    const m = matchFsq(rec, fsqList)
    if (m) {
      rec.fsq_url = m.url || ''
      if (rec.price_level == null && m.price != null) { rec.price_level = m.price; rec.price_source = 'foursquare' }
    }
    rec.price_label = rec.price_level == null ? '—' : PRICE_LABEL[rec.price_level]
    rec.missing = ['rating', 'reviews_count', 'price_level'].filter(f => rec[f] == null)
    const prev = byId.get(rec.id)
    if (!prev || (rec.distance_km ?? 99) < (prev.distance_km ?? 99)) byId.set(rec.id, rec)
  }
  let list = [...byId.values()]
  for (const r of list) {
    const s = scoreOne(r)
    r.subscores = s.subscores
    r.score = (r.rating == null || r.reviews_count == null) ? Math.round(s.score * 0.6 * 10) / 10 : s.score
    r.reason = reasonOf(r)
    delete r.lat; delete r.lng
  }
  list.sort((a, b) => b.score - a.score)
  list.forEach((r, i) => { r.rank = i + 1 })
  return list
}

// ===== Google Places API (New) =====
const SEARCH_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
  'places.userRatingCount', 'places.priceLevel', 'places.priceRange', 'places.types', 'places.primaryType',
  'places.location', 'places.googleMapsUri', 'places.goodForGroups', 'places.reservable',
  'places.servesDinner', 'places.dineIn', 'places.businessStatus',
  'places.regularOpeningHours', 'places.currentOpeningHours'
].join(',')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function searchArea(apiKey, area) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': SEARCH_FIELDS },
    body: JSON.stringify({
      textQuery: `ร้านอาหาร ${area.th} กรุงเทพ`, languageCode: 'th', maxResultCount: 20,
      locationBias: { circle: { center: { latitude: area.lat, longitude: area.lng }, radius: 1500 } }
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`searchText ${area.th}: ${data?.error?.message || res.status}`)
  return data.places || []
}
async function getReviews(apiKey, id) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=th`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,reviews' }
  })
  const data = await res.json()
  if (!res.ok) return []
  return (data.reviews || []).map(rv => ({
    author: rv.authorAttribution?.displayName || 'ผู้ใช้ Google',
    uri: rv.authorAttribution?.uri || '',
    rating: rv.rating ?? null,
    when: rv.relativePublishTimeDescription || '',
    text: (rv.text?.text || '').slice(0, 280)
  }))
}
export async function fetchFromGoogle(apiKey) {
  const rawPlaces = []
  for (const area of AREAS) {
    const places = await searchArea(apiKey, area)
    for (const p of places) {
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue
      rawPlaces.push({ area: area.th, place: p })
    }
    await sleep(250)
  }
  const uniq = new Map()
  for (const { place } of rawPlaces) if (place?.id && !uniq.has(place.id)) uniq.set(place.id, place)
  const top = [...uniq.values()].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 30)
  const reviewsById = {}, reviewsFlat = []
  for (const p of top) {
    const rv = await getReviews(apiKey, p.id)
    if (rv.length) { reviewsById[p.id] = rv; reviewsFlat.push({ place_id: p.id, reviews: rv }) }
    await sleep(150)
  }
  return { rawPlaces, reviewsById, reviewsFlat }
}

// ===== Foursquare Places API (New) — 2nd source for price/validation =====
export async function fetchFoursquare(apiKey) {
  if (!apiKey) return []
  const out = []
  for (const area of AREAS) {
    try {
      const url = `https://places-api.foursquare.com/places/search?ll=${area.lat},${area.lng}&radius=1500`
        + `&query=restaurant&limit=50&fields=fsq_place_id,name,latitude,longitude,location,price,rating,categories`
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Places-Api-Version': '2025-06-17',
          'accept': 'application/json'
        }
      })
      const data = await res.json()
      if (!res.ok) { console.error('FSQ', area.th, data?.message || res.status); continue }
      for (const f of (data.results || [])) {
        const lat = f.latitude ?? f.geocodes?.main?.latitude ?? f.location?.latitude ?? null
        const lng = f.longitude ?? f.geocodes?.main?.longitude ?? f.location?.longitude ?? null
        const id = f.fsq_place_id || f.fsq_id
        out.push({ name: f.name, lat, lng, price: f.price ?? null, rating: f.rating ?? null,
          url: id ? `https://foursquare.com/v/${id}` : '' })
      }
    } catch (e) { console.error('FSQ', area.th, String(e)) }
    await sleep(200)
  }
  return out
}

export async function buildPayload(googleKey, fsqKey) {
  const { rawPlaces, reviewsById, reviewsFlat } = await fetchFromGoogle(googleKey)
  const fsqList = await fetchFoursquare(fsqKey)
  const restaurants = cleanAndScore(rawPlaces, reviewsById, fsqList)
  const fsqMatched = restaurants.filter(r => r.fsq_url).length
  const now = new Date().toISOString()
  const sources = [
    'Google Places API (New) — searchText (place data)',
    'Google Places API (New) — place details (reviews)'
  ]
  if (fsqList.length) sources.push('Foursquare Places API (New) — price / cross-validation')
  const meta = {
    team: '8–12 คน', decision_goal: DECISION_GOAL, areas: AREA_TH, weights: WEIGHTS, sources,
    generated_at: now, count: restaurants.length, raw_count: rawPlaces.length,
    raw_places: rawPlaces.length, raw_reviews: reviewsFlat.length, fsq_count: fsqList.length, fsq_matched: fsqMatched
  }
  return { meta, restaurants, raw: { places: rawPlaces, reviews: reviewsFlat, foursquare: fsqList } }
}
