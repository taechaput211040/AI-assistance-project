<script setup>
const RARITIES = ['SSR', 'SR', 'R', 'N']
const RARITY_COLOR = { SSR: '#e0a92e', SR: '#9d6fb0', R: '#5b8fb0', N: '#8f8674' }
const rcls = r => 'r-' + r.toLowerCase()

// ---------- 1) Rate setting ----------
const rates = reactive({ SSR: 1, SR: 9, R: 30, N: 60 })
const rateSum = computed(() => RARITIES.reduce((s, r) => s + (Number(rates[r]) || 0), 0))
const rateOk = computed(() => Math.abs(rateSum.value - 100) < 0.001 && RARITIES.every(r => Number(rates[r]) >= 0))

// ---------- 2) Item pool ----------
let _id = 1
const seed = (name, rarity) => ({ id: _id++, name, rarity })
const items = ref([
  seed('เอวาเทพ ลิมิเต็ด', 'SSR'), seed('ดาบมังกรเพลิง', 'SSR'),
  seed('นักรบเงา', 'SR'), seed('คทาแห่งแสง', 'SR'), seed('เกราะอัศวิน', 'SR'),
  seed('ดาบเหล็ก', 'R'), seed('โล่ไม้', 'R'), seed('ธนูล่าสัตว์', 'R'), seed('หมวกหนัง', 'R'),
  seed('ยาฟื้นพลังเล็ก', 'N'), seed('ก้อนหินตีบวก', 'N'), seed('เศษโลหะ', 'N'), seed('ขนมปังแข็ง', 'N')
])
const newItem = reactive({ name: '', rarity: 'SSR' })
function addItem() {
  const n = newItem.name.trim()
  if (!n) return
  items.value.push(seed(n, newItem.rarity))
  newItem.name = ''
}
function removeItem(id) { items.value = items.value.filter(i => i.id !== id) }
const itemsByRarity = computed(() => {
  const m = { SSR: [], SR: [], R: [], N: [] }
  for (const it of items.value) if (m[it.rarity]) m[it.rarity].push(it)
  return m
})

// ---------- 3) Pity & free-roll settings ----------
const pity = reactive({ enabled: true, hard: 90, soft: true, softStart: 75, softStep: 6 })
const free = reactive({ every: 10, get: 1 })

// ---------- core roll logic ----------
function adjustedRates(sinceSSR) {
  let ssr = Number(rates.SSR)
  if (pity.enabled && pity.soft) {
    const n = sinceSSR + 1
    if (n >= pity.softStart) ssr = Math.min(100, ssr + (n - pity.softStart + 1) * Number(pity.softStep))
  }
  const rest = Math.max(0, 100 - ssr)
  const base = Number(rates.SR) + Number(rates.R) + Number(rates.N)
  if (base <= 0) return { SSR: ssr, SR: 0, R: 0, N: 0 }
  return { SSR: ssr, SR: rest * rates.SR / base, R: rest * rates.R / base, N: rest * rates.N / base }
}
function rollRarity(state) {
  if (pity.enabled && (state.sinceSSR + 1) >= Number(pity.hard)) { state.sinceSSR = 0; return 'SSR' }
  const ar = adjustedRates(state.sinceSSR)
  const x = Math.random() * 100
  let acc = 0, picked = 'N'
  for (const r of RARITIES) { acc += ar[r]; if (x < acc) { picked = r; break } }
  if (picked === 'SSR') state.sinceSSR = 0; else state.sinceSSR++
  return picked
}
function pickItem(rarity) {
  const pool = itemsByRarity.value[rarity] || []
  if (!pool.length) return '(ไม่มี item ใน pool)'
  return pool[Math.floor(Math.random() * pool.length)].name
}
function freeFromPaid(paid) {
  return Number(free.every) > 0 ? Math.floor(paid / Number(free.every)) * Number(free.get) : 0
}

// ---------- shared validation ----------
const poolErrors = computed(() => {
  const e = []
  for (const r of RARITIES) if (Number(rates[r]) > 0 && (itemsByRarity.value[r] || []).length === 0)
    e.push(`Rarity ${r} มีเรต ${rates[r]}% แต่ยังไม่มี item ใน pool`)
  return e
})
const baseErrors = computed(() => {
  const e = []
  if (!rateOk.value) e.push(`เรตรวมต้องเท่ากับ 100% (ตอนนี้ ${rateSum.value}%) และห้ามติดลบ`)
  return e.concat(poolErrors.value)
})

// ---------- 4) Single simulation ----------
const single = reactive({ pulls: 10, price: 30 })
const singleResult = ref(null)
const lastPulls = ref([])
const singleErr = ref('')
function runSingle() {
  singleErr.value = ''
  if (baseErrors.value.length) { singleErr.value = baseErrors.value[0]; return }
  const paid = Math.floor(Number(single.pulls))
  if (!(paid > 0)) { singleErr.value = 'จำนวนครั้งสุ่มต้องมากกว่า 0'; return }
  if (paid > 100000) { singleErr.value = 'จำกัดสูงสุด 100,000 ครั้งต่อรอบ (กัน browser ค้าง)'; return }
  if (Number(single.price) < 0) { singleErr.value = 'ราคาต่อครั้งต้องไม่ติดลบ'; return }
  const freeR = freeFromPaid(paid)
  const total = paid + freeR
  const state = { sinceSSR: 0 }
  const counts = { SSR: 0, SR: 0, R: 0, N: 0 }
  const itemCounts = {}
  const rolls = []
  for (let i = 0; i < total; i++) {
    const rarity = rollRarity(state)
    const item = pickItem(rarity)
    counts[rarity]++
    itemCounts[item] = (itemCounts[item] || 0) + 1
    const costType = i < paid ? 'paid' : 'free'
    rolls.push({ no: i + 1, rarity, item, costType, cost: costType === 'paid' ? Number(single.price) : 0 })
  }
  const cost = paid * Number(single.price)
  const most = RARITIES.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  const itemList = Object.entries(itemCounts).map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n)
  singleResult.value = { paid, freeR, total, counts, cost, most, itemList }
  lastPulls.value = rolls
  pushHistory('Single', `${total} rolls (${paid} paid + ${freeR} free) · SSR ${counts.SSR} · ${cost.toLocaleString()}฿`,
    { kind: 'single', paid, freeR, total, cost, counts: { ...counts }, most, itemList: itemList.slice(0, 30) })
}
const singleChart = computed(() => singleResult.value ? {
  labels: RARITIES,
  datasets: [{ data: RARITIES.map(r => singleResult.value.counts[r]),
    backgroundColor: RARITIES.map(r => RARITY_COLOR[r]), borderColor: '#fbf4e1', borderWidth: 4 }]
} : null)

// ---------- 7) Player POV (Monte Carlo) ----------
const pov = reactive({ budget: 3000, price: 30, sims: 1000, target: '' })
const povResult = ref(null)
const povErr = ref('')
function runPOV() {
  povErr.value = ''
  if (baseErrors.value.length) { povErr.value = baseErrors.value[0]; return }
  const price = Number(pov.price)
  if (!(price > 0)) { povErr.value = 'ราคาต่อ roll ต้องมากกว่า 0'; return }
  if (Number(pov.budget) < 0) { povErr.value = 'งบต้องไม่ติดลบ'; return }
  let sims = Math.floor(Number(pov.sims))
  if (!(sims > 0)) { povErr.value = 'จำนวน simulation ต้องมากกว่า 0'; return }
  const paid = Math.floor(Number(pov.budget) / price)
  const freeR = freeFromPaid(paid)
  const total = paid + freeR
  if (!(total > 0)) { povErr.value = 'งบไม่พอสุ่มแม้แต่ครั้งเดียว'; return }
  if (total > 2000000) { povErr.value = `จำนวน rolls ต่อรอบสูงเกินไป (${total.toLocaleString()}) — ลดงบหรือเพิ่มราคาต่อ roll`; return }
  let capped = false
  if (total * sims > 20000000) { sims = Math.max(1, Math.floor(20000000 / total)); capped = true }
  const tItem = pov.target ? items.value.find(i => i.name === pov.target) : null
  const tRar = tItem ? tItem.rarity : null
  let atLeast1 = 0, zero = 0, sumSSR = 0, best = 0, worst = Infinity, targetHits = 0
  const dist = {}
  for (let t = 0; t < sims; t++) {
    const state = { sinceSSR: 0 }
    let ssr = 0, gotTarget = false
    for (let i = 0; i < total; i++) {
      const rarity = rollRarity(state)
      if (rarity === 'SSR') ssr++
      if (tRar && rarity === tRar && !gotTarget) { if (pickItem(rarity) === pov.target) gotTarget = true }
    }
    sumSSR += ssr
    if (ssr >= 1) atLeast1++; else zero++
    if (ssr > best) best = ssr
    if (ssr < worst) worst = ssr
    dist[ssr] = (dist[ssr] || 0) + 1
    if (gotTarget) targetHits++
  }
  povResult.value = {
    paid, freeR, total, sims, capped,
    probAtLeast1: atLeast1 / sims, probZero: zero / sims, avg: sumSSR / sims,
    best, worst: worst === Infinity ? 0 : worst, dist,
    target: pov.target, probTarget: tRar ? targetHits / sims : null,
    budget: Number(pov.budget), price
  }
  pushHistory('Player POV', `งบ ${Number(pov.budget).toLocaleString()}฿ · ${total} rolls · P(≥1 SSR) ${(atLeast1 / sims * 100).toFixed(0)}%`,
    { kind: 'pov', budget: Number(pov.budget), paid, freeR, total, sims,
      probAtLeast1: atLeast1 / sims, probZero: zero / sims, avg: sumSSR / sims,
      best, worst: worst === Infinity ? 0 : worst, target: pov.target, probTarget: tRar ? targetHits / sims : null })
}
const povChart = computed(() => {
  if (!povResult.value) return null
  const keys = Object.keys(povResult.value.dist).map(Number).sort((a, b) => a - b)
  return {
    labels: keys.map(k => k + ' SSR'),
    datasets: [{ label: 'จำนวน trial', data: keys.map(k => povResult.value.dist[k]),
      backgroundColor: '#7a9b56', borderColor: '#6b5132', borderWidth: 1.5 }]
  }
})
const noLegend = { plugins: { legend: { display: false } } }
const povInsight = computed(() => {
  const p = povResult.value
  if (!p) return ''
  let s = `เติม ${p.budget.toLocaleString()} บาท (≈ ${p.paid} paid + ${p.freeR} free = ${p.total} rolls) ` +
    `มีโอกาสได้ SSR อย่างน้อย 1 ตัว ประมาณ ${(p.probAtLeast1 * 100).toFixed(0)}% ` +
    `(เฉลี่ย ${p.avg.toFixed(2)} ตัวต่อรอบ, ได้มากสุด ${p.best}, น้อยสุด ${p.worst})`
  if (p.probZero > 0.25) s += ` — ระวัง: ยังมีโอกาส ~${(p.probZero * 100).toFixed(0)}% ที่จะไม่ได้ SSR เลย`
  if (p.probTarget != null) s += ` · โอกาสได้ "${p.target}" อย่างน้อย 1 ชิ้น ≈ ${(p.probTarget * 100).toFixed(1)}%`
  if (p.capped) s += ` (ลดจำนวน simulation ลงอัตโนมัติเพื่อความเร็ว)`
  return s
})

// ---------- 8) History ----------
const history = ref([])
const expanded = ref(-1)
const saveWarn = ref('')
function toggleRow(i) { expanded.value = expanded.value === i ? -1 : i }
async function pushHistory(type, detail, data = null) {
  history.value.unshift({ type, detail, data, time: new Date().toLocaleTimeString('th-TH') })
  if (history.value.length > 10) history.value.pop()
  expanded.value = -1
  try {
    const res = await $fetch('/api/sim-history', { method: 'POST', body: { type, detail, data } })
    saveWarn.value = (res && res.ok === false) ? 'บันทึกประวัติลง DB ไม่สำเร็จ: ' + (res.error || 'unknown') : ''
  } catch (e) {
    saveWarn.value = 'บันทึกประวัติลง DB ไม่สำเร็จ: ' + String(e)
  }
}
async function resetHistory() {
  history.value = []; expanded.value = -1
  try { await $fetch('/api/sim-history', { method: 'DELETE' }) } catch (e) {}
}
onMounted(async () => {
  try {
    const rows = await $fetch('/api/sim-history')
    if (Array.isArray(rows) && rows.length) history.value = rows
  } catch (e) {}
})

// ---------- CSV export ----------
function dl(name, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
function exportPulls() {
  if (!lastPulls.value.length) return
  const lines = ['roll_no,rarity,item_name,cost_type,cost']
  for (const r of lastPulls.value) lines.push(`${r.no},${r.rarity},"${r.item}",${r.costType},${r.cost}`)
  dl('latest_pull_result.csv', lines.join('\n'))
}
function exportPOV() {
  const p = povResult.value
  if (!p) return
  const rows = [
    ['budget', p.budget], ['price_per_roll', p.price], ['paid_rolls', p.paid],
    ['free_rolls', p.freeR], ['total_rolls', p.total], ['simulation_count', p.sims],
    ['prob_at_least_1_SSR', (p.probAtLeast1 * 100).toFixed(2) + '%'],
    ['prob_zero_SSR', (p.probZero * 100).toFixed(2) + '%'],
    ['avg_SSR', p.avg.toFixed(3)], ['best_SSR', p.best], ['worst_SSR', p.worst]
  ]
  if (p.probTarget != null) rows.push(['target_item', p.target], ['prob_target', (p.probTarget * 100).toFixed(2) + '%'])
  dl('player_pov_summary.csv', rows.map(r => `${r[0]},${r[1]}`).join('\n'))
}

const pct = x => (x).toFixed(1)

// ---------- feed AI chat ----------
const aiCtx = useAiContext()
watchEffect(() => {
  const pool = RARITIES.map(r => `${r}:${(itemsByRarity.value[r] || []).length} item (เรต ${rates[r]}%)`).join(', ')
  let s = `หน้า Gacha Drop Rate Simulator\nเรตปัจจุบัน: ${pool} · รวม ${rateSum.value}%\n` +
    `Pity: ${pity.enabled ? `เปิด (hard ${pity.hard}, soft เริ่ม ${pity.softStart} +${pity.softStep}%/ครั้ง)` : 'ปิด'} · ` +
    `Free roll: สุ่มครบ ${free.every} paid ได้ฟรี ${free.get}`
  if (singleResult.value) {
    const c = singleResult.value
    s += `\nผลสุ่มล่าสุด: ${c.total} rolls — SSR ${c.counts.SSR}, SR ${c.counts.SR}, R ${c.counts.R}, N ${c.counts.N}, ค่าใช้จ่าย ${c.cost}฿`
  }
  if (povResult.value) {
    const p = povResult.value
    s += `\nPlayer POV: งบ ${p.budget}฿ → ${p.total} rolls, P(≥1 SSR) ${(p.probAtLeast1 * 100).toFixed(0)}%, เฉลี่ย ${p.avg.toFixed(2)} SSR`
  }
  aiCtx.value = {
    page: 'Gacha Drop Rate Simulator', summary: s,
    suggestions: [
      'งบ 3,000 บาท มีโอกาสได้ SSR ไหม',
      'อธิบายระบบ pity ให้หน่อย',
      'ตั้งเรตยังไงให้ผู้เล่นไม่ท้อ'
    ]
  }
})
</script>

<template>
  <div>
    <div class="page-head">
      <h1>🎰 Gacha Drop Rate Simulator</h1>
      <p>ตั้งเรต จัด item pool จำลองการสุ่ม และวิเคราะห์โอกาสแบบ Player POV (Monte Carlo)</p>
    </div>

    <div v-if="baseErrors.length" class="err-box">
      ⚠ ต้องแก้ก่อนเริ่มสุ่ม:
      <ul><li v-for="e in baseErrors" :key="e">{{ e }}</li></ul>
    </div>

    <div class="gacha-grid" style="margin-bottom:16px">
      <!-- Rate setting -->
      <div class="card">
        <h3>① ตั้งค่า Rate <span class="sub">รวมต้อง = 100%</span></h3>
        <div v-for="r in RARITIES" :key="r" class="rate-row">
          <span class="badge" :class="rcls(r)">{{ r }}</span>
          <div class="cmp-bar"><i :style="{ width: Math.min(100, Number(rates[r])) + '%', background: RARITY_COLOR[r] }"></i></div>
          <input type="number" min="0" step="0.1" v-model.number="rates[r]" />
        </div>
        <div style="margin-top:10px">
          <span class="sum-pill" :class="rateOk ? 'sum-ok' : 'sum-bad'">รวม {{ rateSum }}%</span>
        </div>
      </div>

      <!-- Pity & free roll -->
      <div class="card">
        <h3>② Pity & Free Roll</h3>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px">
          <input type="checkbox" v-model="pity.enabled" style="width:auto;box-shadow:none" /> เปิดระบบ Pity (การันตี SSR)
        </label>
        <div class="row" style="gap:10px">
          <div class="field"><label>Hard pity (ครั้งที่การันตี)</label><input type="number" min="1" v-model.number="pity.hard" :disabled="!pity.enabled" /></div>
          <div class="field"><label>Soft pity เริ่มที่</label><input type="number" min="1" v-model.number="pity.softStart" :disabled="!pity.enabled || !pity.soft" /></div>
          <div class="field"><label>Soft +%/ครั้ง</label><input type="number" min="0" step="0.5" v-model.number="pity.softStep" :disabled="!pity.enabled || !pity.soft" /></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:10px 0">
          <input type="checkbox" v-model="pity.soft" :disabled="!pity.enabled" style="width:auto;box-shadow:none" /> เปิด Soft pity (เรตค่อย ๆ เพิ่ม)
        </label>
        <hr style="border:none;border-top:2px dashed var(--border);margin:12px 0" />
        <div class="row" style="gap:10px">
          <div class="field"><label>สุ่มครบ (paid) ทุก ๆ</label><input type="number" min="0" v-model.number="free.every" /></div>
          <div class="field"><label>ได้สุ่มฟรี (ครั้ง)</label><input type="number" min="0" v-model.number="free.get" /></div>
        </div>
        <p class="muted-note" style="margin:8px 0 0">free roll นับจาก paid rolls เท่านั้น และไม่สร้าง free roll ซ้ำ</p>
      </div>
    </div>

    <!-- Item pool -->
    <div class="card" style="margin-bottom:16px">
      <h3>③ Item Pool <span class="sub">ทุก rarity ที่มีเรต > 0 ต้องมีอย่างน้อย 1 item</span></h3>
      <div class="controls" style="margin-bottom:12px">
        <input class="search" type="text" v-model="newItem.name" placeholder="ชื่อ item / ตัวละคร" @keydown.enter="addItem" />
        <select v-model="newItem.rarity"><option v-for="r in RARITIES" :key="r" :value="r">{{ r }}</option></select>
        <button class="primary" @click="addItem">+ Add Item</button>
      </div>
      <div v-if="poolErrors.length" class="err-box"><ul><li v-for="e in poolErrors" :key="e">{{ e }}</li></ul></div>
      <div class="pool-grid">
        <div v-for="r in RARITIES" :key="r" class="pool-col">
          <div class="pool-head">
            <span class="badge" :class="rcls(r)">{{ r }}</span>
            <span class="muted-note">{{ (itemsByRarity[r]||[]).length }} item · เรต {{ rates[r] }}%</span>
          </div>
          <div v-for="it in itemsByRarity[r]" :key="it.id" class="pool-item">
            <input type="text" v-model="it.name" />
            <select v-model="it.rarity"><option v-for="rr in RARITIES" :key="rr" :value="rr">{{ rr }}</option></select>
            <button @click="removeItem(it.id)" title="ลบ">✕</button>
          </div>
          <div v-if="!(itemsByRarity[r]||[]).length" class="muted-note" style="padding:6px 0">— ยังไม่มี item —</div>
        </div>
      </div>
    </div>

    <!-- Single simulation -->
    <div class="card" style="margin-bottom:16px">
      <h3>④ Single Simulation <span class="sub">สุ่มจริงตามเรต (rarity ก่อน แล้วสุ่ม item)</span></h3>
      <div class="controls">
        <div class="field"><label>จำนวนครั้งสุ่ม (paid)</label><input type="number" min="1" v-model.number="single.pulls" /></div>
        <div class="field"><label>ราคาต่อครั้ง (฿)</label><input type="number" min="0" v-model.number="single.price" /></div>
        <button class="primary" style="align-self:flex-end" @click="runSingle">🎲 สุ่มเลย</button>
        <button style="align-self:flex-end" :disabled="!lastPulls.length" @click="exportPulls">⬇ Export Pull CSV</button>
      </div>
      <div v-if="singleErr" class="err-box">⚠ {{ singleErr }}</div>

      <template v-if="singleResult">
        <div class="stat-grid" style="margin:8px 0 16px">
          <div class="stat"><div class="l">รวมที่สุ่ม</div><div class="v">{{ singleResult.total }}</div><div class="muted-note">{{ singleResult.paid }} paid + {{ singleResult.freeR }} free</div></div>
          <div class="stat"><div class="l">ค่าใช้จ่าย</div><div class="v">{{ singleResult.cost.toLocaleString() }}฿</div></div>
          <div class="stat"><div class="l">SSR / SR</div><div class="v">{{ singleResult.counts.SSR }} / {{ singleResult.counts.SR }}</div></div>
          <div class="stat"><div class="l">R / N</div><div class="v">{{ singleResult.counts.R }} / {{ singleResult.counts.N }}</div></div>
          <div class="stat"><div class="l">Rarity ที่ออกมากสุด</div><div class="v"><span class="badge" :class="rcls(singleResult.most)">{{ singleResult.most }}</span></div></div>
        </div>

        <div class="gacha-grid">
          <div>
            <h3 style="font-size:13px">เรตที่ตั้งไว้ vs สัดส่วนจริง</h3>
            <table>
              <thead><tr><th>Rarity</th><th>เรตที่ตั้ง</th><th>ออกจริง</th><th>% จริง</th></tr></thead>
              <tbody>
                <tr v-for="r in RARITIES" :key="r">
                  <td><span class="badge" :class="rcls(r)">{{ r }}</span></td>
                  <td>{{ rates[r] }}%</td>
                  <td>{{ singleResult.counts[r] }}</td>
                  <td>{{ pct(singleResult.counts[r] / singleResult.total * 100) }}%</td>
                </tr>
              </tbody>
            </table>
            <p class="muted-note" style="margin-top:6px">หมายเหตุ: ถ้าเปิด Pity สัดส่วน SSR จริงจะสูงกว่าเรตฐาน</p>
          </div>
          <ClientOnly>
            <div>
              <h3 style="font-size:13px">สัดส่วน rarity ที่สุ่มได้</h3>
              <div class="canvas-box"><ChartCanvas v-if="singleChart" type="doughnut" :data="singleChart" /></div>
            </div>
          </ClientOnly>
        </div>

        <h3 style="font-size:13px;margin-top:14px">Item ที่สุ่มได้ ({{ singleResult.itemList.length }} แบบ)</h3>
        <div class="table-wrap" style="max-height:240px">
          <table>
            <thead><tr><th>Item</th><th style="width:90px">จำนวน</th></tr></thead>
            <tbody><tr v-for="it in singleResult.itemList" :key="it.name"><td>{{ it.name }}</td><td>{{ it.n }}</td></tr></tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- Player POV -->
    <div class="card" style="margin-bottom:16px">
      <h3>⑤ Player POV Simulator <span class="sub">Monte Carlo — งบเท่านี้ มีโอกาสได้ SSR แค่ไหน</span></h3>
      <div class="controls">
        <div class="field"><label>งบเติมเงิน (฿)</label><input type="number" min="0" v-model.number="pov.budget" /></div>
        <div class="field"><label>ราคาต่อ roll (฿)</label><input type="number" min="1" v-model.number="pov.price" /></div>
        <div class="field"><label>จำนวน simulation</label><input type="number" min="1" v-model.number="pov.sims" /></div>
        <div class="field"><label>เป้าหมาย item (ไม่บังคับ)</label>
          <select v-model="pov.target"><option value="">— ไม่เจาะจง —</option><option v-for="it in items" :key="it.id" :value="it.name">{{ it.name }} ({{ it.rarity }})</option></select>
        </div>
        <button class="primary" style="align-self:flex-end" @click="runPOV">📈 จำลอง</button>
        <button style="align-self:flex-end" :disabled="!povResult" @click="exportPOV">⬇ Export POV CSV</button>
      </div>
      <div v-if="povErr" class="err-box">⚠ {{ povErr }}</div>

      <template v-if="povResult">
        <div class="insight" style="margin:8px 0 16px">💡 {{ povInsight }}</div>
        <div class="stat-grid" style="margin-bottom:16px">
          <div class="stat"><div class="l">paid / free / รวม</div><div class="v">{{ povResult.paid }}/{{ povResult.freeR }}/{{ povResult.total }}</div></div>
          <div class="stat"><div class="l">โอกาสได้ ≥1 SSR</div><div class="v" style="color:var(--pos)">{{ (povResult.probAtLeast1*100).toFixed(0) }}%</div></div>
          <div class="stat"><div class="l">โอกาสได้ 0 SSR</div><div class="v" style="color:var(--neg)">{{ (povResult.probZero*100).toFixed(0) }}%</div></div>
          <div class="stat"><div class="l">เฉลี่ย SSR/รอบ</div><div class="v">{{ povResult.avg.toFixed(2) }}</div></div>
          <div class="stat"><div class="l">best / worst</div><div class="v">{{ povResult.best }} / {{ povResult.worst }}</div></div>
          <div v-if="povResult.probTarget != null" class="stat"><div class="l">ได้ "{{ povResult.target }}"</div><div class="v" style="color:var(--brand-2)">{{ (povResult.probTarget*100).toFixed(1) }}%</div></div>
        </div>
        <ClientOnly>
          <h3 style="font-size:13px">การกระจายจำนวน SSR ต่อรอบ ({{ povResult.sims }} simulations)</h3>
          <div class="canvas-box"><ChartCanvas v-if="povChart" type="bar" :data="povChart" :options="noLegend" /></div>
        </ClientOnly>
      </template>
    </div>

    <!-- History -->
    <div class="card">
      <h3>⑥ ประวัติ Simulation ล่าสุد <span class="sub">(เก็บ 10 รอบล่าสุด)</span></h3>
      <div class="controls"><button @click="resetHistory" :disabled="!history.length">🧹 ล้างประวัติ</button><span class="muted-note" style="align-self:center">คลิกแถวเพื่อดูว่ารอบนั้นได้อะไรบ้าง</span></div>
      <div v-if="saveWarn" class="err-box">⚠ {{ saveWarn }} — เปิด <code>/api/db-health</code> เพื่อดูรายละเอียด</div>
      <div class="table-wrap" style="max-height:440px">
        <table>
          <thead><tr><th style="width:40px"></th><th style="width:110px">ประเภท</th><th>รายละเอียด</th><th style="width:80px">เวลา</th></tr></thead>
          <tbody>
            <template v-for="(h,i) in history" :key="i">
              <tr @click="toggleRow(i)" style="cursor:pointer">
                <td style="text-align:center">{{ expanded===i ? '▾' : '▸' }}</td>
                <td>{{ h.type }}</td>
                <td>{{ h.detail }}</td>
                <td class="muted">{{ h.time }}</td>
              </tr>
              <tr v-if="expanded===i">
                <td colspan="4" style="background:var(--panel-2)">
                  <div v-if="h.data && h.data.kind==='single'">
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                      <span v-for="r in RARITIES" :key="r" class="badge" :class="rcls(r)">{{ r }} × {{ h.data.counts[r] }}</span>
                      <span class="badge" style="background:var(--ink-border)">รวม {{ h.data.total }} ({{ h.data.paid }}p+{{ h.data.freeR }}f)</span>
                      <span class="badge" style="background:var(--brand)">{{ h.data.cost.toLocaleString() }}฿</span>
                      <span class="badge" style="background:var(--brand-2)">มากสุด {{ h.data.most }}</span>
                    </div>
                    <div class="table-wrap" style="max-height:200px">
                      <table>
                        <thead><tr><th>Item ที่สุ่มได้</th><th style="width:80px">จำนวน</th></tr></thead>
                        <tbody><tr v-for="it in h.data.itemList" :key="it.name"><td>{{ it.name }}</td><td>{{ it.n }}</td></tr></tbody>
                      </table>
                    </div>
                  </div>
                  <div v-else-if="h.data && h.data.kind==='pov'" class="stat-grid">
                    <div class="stat"><div class="l">งบ → rolls</div><div class="v">{{ h.data.budget.toLocaleString() }}฿</div><div class="muted-note">{{ h.data.total }} ({{ h.data.paid }}p+{{ h.data.freeR }}f) · {{ h.data.sims }} sims</div></div>
                    <div class="stat"><div class="l">P(≥1 SSR)</div><div class="v" style="color:var(--pos)">{{ (h.data.probAtLeast1*100).toFixed(0) }}%</div></div>
                    <div class="stat"><div class="l">P(0 SSR)</div><div class="v" style="color:var(--neg)">{{ (h.data.probZero*100).toFixed(0) }}%</div></div>
                    <div class="stat"><div class="l">เฉลี่ย SSR</div><div class="v">{{ h.data.avg.toFixed(2) }}</div></div>
                    <div class="stat"><div class="l">best / worst</div><div class="v">{{ h.data.best }} / {{ h.data.worst }}</div></div>
                    <div v-if="h.data.probTarget!=null" class="stat"><div class="l">ได้ "{{ h.data.target }}"</div><div class="v" style="color:var(--brand-2)">{{ (h.data.probTarget*100).toFixed(1) }}%</div></div>
                  </div>
                  <div v-else class="muted">รอบนี้ไม่มีรายละเอียดเก็บไว้ (ประวัติเก่าก่อนเพิ่มฟีเจอร์นี้)</div>
                </td>
              </tr>
            </template>
            <tr v-if="!history.length"><td colspan="4" class="muted">ยังไม่มีประวัติ — ลองสุ่มดู</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
<!-- end -->
