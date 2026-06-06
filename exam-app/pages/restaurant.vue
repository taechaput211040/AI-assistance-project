<script setup>
const { data: payload, pending } = useFetch('/api/restaurants', { lazy: true })
const meta = computed(() => payload.value?.meta ?? {})
const all = computed(() => payload.value?.restaurants ?? [])

const WLABEL = {
  rating: 'เรตติ้ง (รีวิวเฉลี่ย)', reviews: 'จำนวนรีวิว', group: 'เหมาะกับกลุ่ม',
  price: 'ความคุ้มราคา', distance: 'ใกล้ BTS', ambience: 'บรรยากาศคุยงาน'
}

const area = ref('')
const f = reactive({ cuisine: '', price: '', minRating: 0, q: '' })
const sort = reactive({ key: 'score', dir: 'desc' })
const hasData = computed(() => all.value.length > 0)
const cuisineOptions = computed(() => [...new Set(all.value.map(r => r.cuisine).filter(Boolean))].sort())
const PRICE_OPTS = [['1', '฿'], ['2', '฿฿'], ['3', '฿฿฿'], ['4', '฿฿฿฿']]

const baseFiltered = computed(() => {
  const q = f.q.trim().toLowerCase()
  return all.value.filter(r =>
    (!area.value || r.area === area.value) &&
    (!f.cuisine || r.cuisine === f.cuisine) &&
    (!f.price || String(r.price_level) === f.price) &&
    (!f.minRating || (r.rating || 0) >= f.minRating) &&
    (!q || (r.name || '').toLowerCase().includes(q))
  )
})
// ranking is always by score (assigns _rank); table display can be re-sorted
const ranked = computed(() => {
  const a = [...baseFiltered.value].sort((x, y) => y.score - x.score)
  a.forEach((r, i) => { r._rank = i + 1 })
  return a
})
const top3 = computed(() => ranked.value.slice(0, 3))
const sorted = computed(() => {
  const { key, dir } = sort
  const a = [...ranked.value]
  a.sort((x, y) => {
    let xv = x[key], yv = y[key]
    if (typeof xv === 'string' || typeof yv === 'string') {
      xv = xv || ''; yv = yv || ''
      return dir === 'asc' ? String(xv).localeCompare(String(yv)) : String(yv).localeCompare(String(xv))
    }
    xv = xv ?? -Infinity; yv = yv ?? -Infinity
    return dir === 'asc' ? xv - yv : yv - xv
  })
  return a
})
function setSort(key) {
  if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc'
  else { sort.key = key; sort.dir = (key === 'name' || key === 'cuisine' || key === 'area') ? 'asc' : 'desc' }
  expanded.value = -1
}
function arrow(key) { return sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '' }
function resetFilters() { area.value = ''; f.cuisine = ''; f.price = ''; f.minRating = 0; f.q = '' }

const expanded = ref(-1)
function toggleRow(i) { expanded.value = expanded.value === i ? -1 : i }
function stars(n) { return n ? '★ ' + n.toFixed(1) : '—' }
function todayHours(r) {
  if (!r.hours || !r.hours.length) return ''
  const idx = (new Date().getDay() + 6) % 7 // Google: Mon=0 … Sun=6
  return r.hours[idx] || ''
}

// ---- AI context ----
const aiCtx = useAiContext()
watchEffect(() => {
  let s = `หน้า Restaurant Finder — ทีม ${meta.value.team || '8–12 คน'} หามื้อเย็นหลังเลิกงาน\n` +
    `พื้นที่: ${(meta.value.areas || []).join(', ')}\n` +
    `น้ำหนักคะแนน: ${Object.entries(meta.value.weights || {}).map(([k, v]) => `${WLABEL[k] || k} ${v}%`).join(', ')}`
  if (hasData.value) {
    const byArea = (meta.value.areas || []).map(a => `${a} ${all.value.filter(r => r.area === a).length} ร้าน`).join(', ')
    const flt = [area.value && `พื้นที่=${area.value}`, f.cuisine && `อาหาร=${f.cuisine}`, f.price && `ราคา=${f.price}`, f.minRating && `เรตติ้ง≥${f.minRating}`, f.q && `ค้น="${f.q}"`].filter(Boolean).join(', ') || 'ไม่มี'
    s += `\nข้อมูลจริงจาก Google Places: clean ${meta.value.count} ร้าน (จาก raw ${meta.value.raw_count})\n` +
      `จำนวนร้านต่อพื้นที่: ${byArea}\n` +
      `ตัวกรองบนจอตอนนี้: ${flt} — แต่ "ข้อมูลรายตัว" ด้านล่างคือร้านครบทุกพื้นที่ ใช้ตอบได้ทุกโซน ไม่ต้องสนใจตัวกรองบนจอ`
  } else {
    s += `\n(ยังไม่ได้รัน pipeline ดึงข้อมูลร้าน)`
  }
  // ส่งร้านครบทุกพื้นที่ให้ AI (ไม่ผูกกับตัวกรองบนจอ) เรียงตามคะแนน
  const data = [...all.value].sort((a, b) => b.score - a.score).slice(0, 60).map(r =>
    `${r.name} | โซน ${r.area} | ${r.cuisine} | ราคา ${r.price_label}${r.price_range ? '(' + r.price_range + ')' : ''}`
    + ` | เรตติ้ง ${r.rating ?? '-'} (${(r.reviews_count ?? 0).toLocaleString()} รีวิว) | คะแนน ${r.score}`
    + ` | สถานะตอนนี้:${r.open_now === true ? 'เปิด' : r.open_now === false ? 'ปิด' : 'ไม่ทราบ'}`
    + ` | เวลาทำการรายวัน: ${(r.hours && r.hours.length) ? r.hours.join(' / ') : 'ไม่มีข้อมูล'}`
    + ` | ${r.maps_url}`
  ).join('\n')
  aiCtx.value = {
    page: 'Restaurant Finder', summary: s, data,
    suggestions: [
      'แนะนำ 3 ร้านสำหรับทีม 8–12 คน',
      'ร้านไหนเหมาะคุยงาน บรรยากาศดี',
      'เปรียบเทียบ Top 3 ให้หน่อย'
    ]
  }
})
</script>

<template>
  <div>
    <div class="page-head">
      <h1>🍜 Restaurant Finder</h1>
      <p>{{ meta.decision_goal || 'เลือกร้านมื้อเย็นหลังเลิกงาน 1–3 ร้าน จากพื้นที่ที่กำหนด' }}</p>
    </div>

    <div v-if="pending" class="card loading-wrap"><div class="pix-spinner"></div><div>กำลังโหลดข้อมูลร้าน…</div></div>

    <!-- decision context -->
    <div v-if="!pending" class="card" style="margin-bottom:16px;border-left:3px solid var(--brand)">
      <div class="stat-grid">
        <div class="stat"><div class="l">ทีม</div><div class="v">{{ meta.team || '8–12 คน' }}</div></div>
        <div class="stat"><div class="l">เป้าหมาย</div><div class="v" style="font-size:14px;line-height:1.4">เลือกร้าน 1–3 ร้านที่เหมาะที่สุด</div></div>
        <div class="stat"><div class="l">พื้นที่ที่พิจารณา</div><div class="v" style="font-size:14px">{{ (meta.areas || []).join(' · ') }}</div></div>
        <div class="stat"><div class="l">ข้อมูล (raw → clean)</div><div class="v">{{ meta.raw_count || 0 }} → {{ meta.count || 0 }}</div><div class="muted-note">place {{ meta.raw_places || 0 }} + review {{ meta.raw_reviews || 0 }}</div></div>
      </div>
      <div style="margin-top:12px">
        <div class="muted-note" style="margin-bottom:6px">น้ำหนักคะแนน (ล็อก ห้ามเปลี่ยน) · แหล่งข้อมูล: {{ (meta.sources || []).join(' + ') }}</div>
        <div class="chips">
          <span v-for="(v,k) in meta.weights" :key="k" class="badge" style="background:var(--panel-2);color:var(--text)">{{ WLABEL[k] || k }} {{ v }}%</span>
        </div>
      </div>
    </div>

    <!-- empty state -->
    <div v-if="!pending && !hasData" class="card">
      <div class="err-box" style="margin:0">
        ⚠ ยังไม่มีข้อมูลร้าน — ตั้ง <code>GOOGLE_MAPS_API_KEY</code> ใน <code>exam-app/.env</code> (เปิด "Places API (New)" + billing) แล้วเติมข้อมูลด้วยวิธีใดวิธีหนึ่ง:
        <ol style="margin:8px 0 0;padding-left:20px;line-height:1.8">
          <li><b>ลง DB (แนะนำ):</b> เปิด <code>/api/cron/refresh-restaurants</code> 1 ครั้ง (หรือรอ Vercel Cron วันละครั้ง) → ดึง+เก็บลง DB</li>
          <li><b>หรือ snapshot ไฟล์:</b> รัน <code>npm run fetch:restaurants</code> → เขียนลงไฟล์ static</li>
          <li>รีโหลดหน้านี้</li>
        </ol>
      </div>
    </div>

    <template v-else-if="hasData">
      <!-- area filter -->
      <div class="chips" style="margin-bottom:16px">
        <span class="chip" :class="{ active: area === '' }" @click="area = ''">ทั้งหมด ({{ all.length }})</span>
        <span v-for="a in meta.areas" :key="a" class="chip" :class="{ active: area === a }" @click="area = a">
          {{ a }} ({{ all.filter(r => r.area === a).length }})
        </span>
      </div>

      <!-- filters -->
      <div class="controls" style="margin-bottom:16px">
        <input class="search" type="text" v-model="f.q" placeholder="🔎 ค้นชื่อร้าน..." />
        <select v-model="f.cuisine"><option value="">ทุกประเภทอาหาร</option><option v-for="c in cuisineOptions" :key="c" :value="c">{{ c }}</option></select>
        <select v-model="f.price"><option value="">ทุกราคา</option><option v-for="[v,l] in PRICE_OPTS" :key="v" :value="v">{{ l }}</option></select>
        <select v-model.number="f.minRating"><option :value="0">เรตติ้งขั้นต่ำ: ทั้งหมด</option><option :value="4">≥ 4.0</option><option :value="4.3">≥ 4.3</option><option :value="4.5">≥ 4.5</option></select>
        <button @click="resetFilters">ล้างตัวกรอง</button>
        <span class="muted-note" style="align-self:center">พบ {{ baseFiltered.length }} ร้าน</span>
      </div>

      <!-- Top 3 cards -->
      <h3 style="margin:0 0 10px">🏆 แนะนำ Top 3 {{ area ? '· ' + area : '' }}</h3>
      <div class="rec-grid" style="margin-bottom:20px">
        <div v-for="(r,i) in top3" :key="r.id" class="rec-card" :class="{ gold: i === 0 }">
          <div class="rec-top">
            <div>
              <div class="rec-name">{{ r.name }}</div>
              <div class="muted-note" style="margin-top:3px">{{ r.cuisine }} · {{ r.area }} · {{ r.price_label }}<template v-if="r.price_range"> · {{ r.price_range }}</template></div>
            </div>
            <div class="rec-rank" :class="{ r1: i === 0 }">{{ i + 1 }}</div>
          </div>
          <div style="display:flex;align-items:flex-end;gap:14px;margin:8px 0">
            <div class="score-big">{{ r.score }}<small>/100</small></div>
            <div style="font-size:13px"><span class="badge b-neu">{{ stars(r.rating) }}</span><div class="muted-note" style="margin-top:4px">{{ (r.reviews_count || 0).toLocaleString() }} รีวิว</div></div>
          </div>
          <div style="font-size:13px;line-height:1.55;margin-bottom:8px">{{ r.reason }}</div>
          <div v-if="r.open_now != null || todayHours(r)" style="margin-bottom:8px">
            <span v-if="r.open_now === true" class="badge b-pos">เปิดอยู่</span>
            <span v-else-if="r.open_now === false" class="badge b-neg">ปิดอยู่</span>
            <span v-if="todayHours(r)" class="muted-note"> 🕒 {{ todayHours(r) }}</span>
          </div>
          <div v-for="k in Object.keys(meta.weights || {})" :key="k" class="sub-row">
            <span class="muted">{{ WLABEL[k] }}</span>
            <span class="cmp-bar"><i :style="{ width: (r.subscores[k]||0) + '%', background: 'var(--brand)' }"></i></span>
            <span class="muted-note">{{ r.subscores[k] }}·w{{ meta.weights[k] }}</span>
          </div>
          <div v-if="r.top_reviews && r.top_reviews.length" class="rev-quote">
            “{{ r.top_reviews[0].text }}” <span class="muted-note">— {{ r.top_reviews[0].author }}</span>
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <a class="link-btn" :href="r.maps_url" target="_blank" rel="noopener">🔗 Google Maps</a>
            <a v-if="r.fsq_url" class="link-btn" style="background:var(--accent)" :href="r.fsq_url" target="_blank" rel="noopener">🔗 Foursquare</a>
          </div>
        </div>
      </div>

      <!-- Top 10 table -->
      <div class="card">
        <h3>📋 จัดอันดับร้าน ({{ sorted.length }}) <span class="sub">คลิกหัวคอลัมน์เพื่อเรียง · คลิกแถวเพื่อดูรายละเอียด</span></h3>
        <div class="table-wrap" style="max-height:600px">
          <table>
            <thead>
              <tr>
                <th style="width:36px">#</th>
                <th @click="setSort('name')">ร้าน{{ arrow('name') }}</th>
                <th @click="setSort('area')">พื้นที่{{ arrow('area') }}</th>
                <th @click="setSort('cuisine')">อาหาร{{ arrow('cuisine') }}</th>
                <th @click="setSort('price_level')">ราคา{{ arrow('price_level') }}</th>
                <th @click="setSort('rating')">เรตติ้ง{{ arrow('rating') }}</th>
                <th @click="setSort('score')">คะแนน{{ arrow('score') }}</th>
                <th>หลักฐาน</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(r,i) in sorted" :key="r.id">
                <tr @click="toggleRow(i)" style="cursor:pointer">
                  <td>{{ r._rank }}</td>
                  <td>{{ r.name }}
                    <span v-if="r.open_now === true" class="badge b-pos" style="margin-left:6px">เปิด</span>
                    <span v-else-if="r.open_now === false" class="badge b-neg" style="margin-left:6px">ปิด</span>
                    <span v-if="r.missing && r.missing.length" class="badge b-neu" style="margin-left:6px">field หาย</span>
                  </td>
                  <td>{{ r.area }}</td>
                  <td class="muted">{{ r.cuisine }}</td>
                  <td>{{ r.price_label }}<div v-if="r.price_range" class="muted-note">{{ r.price_range }}</div></td>
                  <td>{{ stars(r.rating) }} <span class="muted-note">({{ (r.reviews_count || 0).toLocaleString() }})</span></td>
                  <td><b>{{ r.score }}</b></td>
                  <td><a class="link-btn" :href="r.maps_url" target="_blank" rel="noopener" @click.stop>🔗 Maps</a></td>
                </tr>
                <tr v-if="expanded === i">
                  <td colspan="8" style="background:var(--panel-2)">
                    <div style="margin-bottom:8px;font-size:13px">{{ r.reason }}</div>
                    <div class="gacha-grid">
                      <div>
                        <div v-for="k in Object.keys(meta.weights || {})" :key="k" class="sub-row">
                          <span class="muted">{{ WLABEL[k] }} ({{ meta.weights[k] }}%)</span>
                          <span class="cmp-bar"><i :style="{ width: (r.subscores[k]||0) + '%', background: 'var(--brand)' }"></i></span>
                          <span class="muted-note">{{ r.subscores[k] }}</span>
                        </div>
                      </div>
                      <div>
                        <div v-if="r.top_reviews && r.top_reviews.length">
                          <div v-for="(rv,ri) in r.top_reviews" :key="ri" class="rev-quote">
                            <b>{{ stars(rv.rating) }}</b> “{{ rv.text }}”
                            <span class="muted-note">— {{ rv.author }} · {{ rv.when }}</span>
                          </div>
                        </div>
                        <div v-else class="muted-note">ไม่มีรีวิวที่ดึงมา</div>
                        <div style="margin-top:8px" class="muted-note">ที่อยู่: {{ r.address }}</div>
                        <div v-if="r.price_source" class="muted-note">ราคา: {{ r.price_label }} <template v-if="r.price_range">({{ r.price_range }})</template> · จาก {{ r.price_source === 'foursquare' ? 'Foursquare' : 'Google' }}</div>
                        <div v-if="r.hours && r.hours.length" style="margin-top:8px">
                          <div class="muted-note" style="margin-bottom:2px">🕒 เวลาทำการ<span v-if="r.open_now === true" class="badge b-pos" style="margin-left:6px">เปิดอยู่</span><span v-else-if="r.open_now === false" class="badge b-neg" style="margin-left:6px">ปิดอยู่</span></div>
                          <div v-for="(h,hi) in r.hours" :key="hi" class="muted-note">{{ h }}</div>
                        </div>
                        <div v-else class="muted-note" style="margin-top:8px">🕒 ไม่มีข้อมูลเวลาทำการ</div>
                        <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
                          <a class="link-btn" :href="r.maps_url" target="_blank" rel="noopener" @click.stop>🔗 Google Maps</a>
                          <a v-if="r.fsq_url" class="link-btn" style="background:var(--accent)" :href="r.fsq_url" target="_blank" rel="noopener" @click.stop>🔗 Foursquare</a>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- methodology -->
      <div class="card" style="margin-top:16px">
        <h3>🔧 วิธีทำ (raw → clean → score)</h3>
        <ol style="margin:0;padding-left:20px;line-height:1.9;font-size:13.5px">
          <li><b>Raw</b> — ดึงจาก Google Places API (New): <i>searchText</i> (ข้อมูลร้าน) + <i>place details</i> (รีวิว) นับเป็น 2 แหล่ง รวม {{ meta.raw_count }} รายการ เก็บใน <code>restaurants_raw.json</code></li>
          <li><b>Clean</b> — รวมร้านซ้ำด้วย place_id, จัดประเภทอาหาร, normalize ราคา (price level → ฿), เช็ค field ที่หาย → เหลือ {{ meta.count }} ร้าน</li>
          <li><b>Score</b> — ให้คะแนนตามน้ำหนักที่ล็อกไว้ (รวม 100%) แล้วจัดอันดับ; ร้านที่ field สำคัญหายถูกลดคะแนน</li>
          <li><b>หลักฐาน</b> — ทุกร้านมีลิงก์ Google Maps ตรวจสอบได้</li>
        </ol>
        <p class="muted-note" style="margin-top:10px">
          แหล่งข้อมูล: {{ meta.source === 'db' ? 'DB (รีเฟรชอัตโนมัติวันละครั้งผ่าน Vercel Cron)' : 'ไฟล์ static snapshot' }}
          <span v-if="meta.refreshed_at"> · อัปเดตล่าสุด {{ meta.refreshed_at.slice(0,16).replace('T',' ') }}</span>
          <span v-else-if="meta.generated_at"> · สร้างเมื่อ {{ meta.generated_at.slice(0,16).replace('T',' ') }}</span>
        </p>
      </div>
    </template>
  </div>
</template>
<!-- end -->
