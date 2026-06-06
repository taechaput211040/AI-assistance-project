<script setup>
const { data: payload, pending } = useFetch('/api/feedback', { lazy: true })
const records = computed(() => payload.value?.records ?? [])
const meta = computed(() => payload.value?.meta ?? {})

const SENT_COLORS = { Positive: '#6a994e', Neutral: '#d99a3f', Negative: '#c1543b' }
const PRIO_COLORS = { P1: '#c1543b', P2: '#d99a3f', P3: '#8f7651' }

// ---------- filters ----------
const f = reactive({ category: '', sentiment: '', priority: '', owner: '', source: '', segment: '', platform: '', q: '' })
const sort = reactive({ key: 'priority', dir: 'asc' })

function uniq(key) { return [...new Set(records.value.map(r => r[key]).filter(Boolean))].sort() }
const opts = computed(() => ({
  category: uniq('category'), owner: uniq('owner'),
  source: uniq('source'), segment: uniq('segment'), platform: uniq('platform')
}))

const filtered = computed(() => {
  const q = f.q.trim().toLowerCase()
  return records.value.filter(r =>
    (!f.category || r.category === f.category) &&
    (!f.sentiment || r.sentiment === f.sentiment) &&
    (!f.priority || r.priority === f.priority) &&
    (!f.owner || r.owner === f.owner) &&
    (!f.source || r.source === f.source) &&
    (!f.segment || r.segment === f.segment) &&
    (!f.platform || r.platform === f.platform) &&
    (!q || (r.text || '').toLowerCase().includes(q) || (r.theme || '').toLowerCase().includes(q))
  )
})
function resetFilters() { Object.keys(f).forEach(k => f[k] = '') }
const fa = computed(() => filtered.value)

function countBy(arr, key) {
  const m = {}
  for (const r of arr) { const v = r[key] || '—'; m[v] = (m[v] || 0) + 1 }
  return m
}

const kpi = computed(() => {
  const a = fa.value, n = a.length || 1
  const neg = a.filter(r => r.sentiment === 'Negative').length
  const pos = a.filter(r => r.sentiment === 'Positive').length
  const p1 = a.filter(r => r.priority === 'P1').length
  return {
    total: a.length, neg, pos, p1,
    negRate: Math.round(neg / n * 100), posRate: Math.round(pos / n * 100),
    cats: new Set(a.map(r => r.category)).size
  }
})

// ---------- charts ----------
const sentChart = computed(() => ({
  labels: ['Positive', 'Neutral', 'Negative'],
  datasets: [{
    data: ['Positive', 'Neutral', 'Negative'].map(s => fa.value.filter(r => r.sentiment === s).length),
    backgroundColor: [SENT_COLORS.Positive, SENT_COLORS.Neutral, SENT_COLORS.Negative],
    borderColor: '#fbf4e1', borderWidth: 4
  }]
}))
const prioChart = computed(() => ({
  labels: ['P1', 'P2', 'P3'],
  datasets: [{
    data: ['P1', 'P2', 'P3'].map(p => fa.value.filter(r => r.priority === p).length),
    backgroundColor: [PRIO_COLORS.P1, PRIO_COLORS.P2, PRIO_COLORS.P3],
    borderColor: '#fbf4e1', borderWidth: 4
  }]
}))
const catChart = computed(() => {
  const cats = Object.entries(countBy(fa.value, 'category')).sort((a, b) => b[1] - a[1]).map(e => e[0])
  const mk = s => cats.map(c => fa.value.filter(r => r.category === c && r.sentiment === s).length)
  return {
    labels: cats,
    datasets: [
      { label: 'Negative', data: mk('Negative'), backgroundColor: SENT_COLORS.Negative, stack: 's' },
      { label: 'Neutral', data: mk('Neutral'), backgroundColor: SENT_COLORS.Neutral, stack: 's' },
      { label: 'Positive', data: mk('Positive'), backgroundColor: SENT_COLORS.Positive, stack: 's' }
    ]
  }
})
const stackedOpt = { scales: { x: { stacked: true }, y: { stacked: true } } }

function barChart(key, color) {
  const entries = Object.entries(countBy(fa.value, key)).sort((a, b) => b[1] - a[1])
  return { labels: entries.map(e => e[0]), datasets: [{ label: key, data: entries.map(e => e[1]), backgroundColor: color, borderRadius: 0, borderColor: '#6b5132', borderWidth: 1.5 }] }
}
const ownerChart = computed(() => barChart('owner', '#7a9b56'))
const sourceChart = computed(() => barChart('source', '#b07fb0'))
const segmentChart = computed(() => barChart('segment', '#c97b43'))
const noLegend = { plugins: { legend: { display: false } } }
const horiz = { indexAxis: 'y', plugins: { legend: { display: false } } }

const trendChart = computed(() => {
  const days = {}
  for (const r of fa.value) {
    const d = (r.date || '').slice(0, 10)
    days[d] = days[d] || { Positive: 0, Neutral: 0, Negative: 0 }
    days[d][r.sentiment]++
  }
  const labels = Object.keys(days).sort()
  const mk = s => labels.map(d => days[d][s])
  return {
    labels,
    datasets: [
      { label: 'Negative', data: mk('Negative'), backgroundColor: SENT_COLORS.Negative, stack: 't' },
      { label: 'Neutral', data: mk('Neutral'), backgroundColor: SENT_COLORS.Neutral, stack: 't' },
      { label: 'Positive', data: mk('Positive'), backgroundColor: SENT_COLORS.Positive, stack: 't' }
    ]
  }
})

// ---------- pain points ----------
const topThemes = computed(() => {
  const m = {}
  for (const r of fa.value) {
    const t = r.theme
    m[t] = m[t] || { theme: t, category: r.category, owner: r.owner, count: 0, neg: 0, p1: 0, impact: 0 }
    m[t].count++
    if (r.sentiment === 'Negative') m[t].neg++
    if (r.priority === 'P1') m[t].p1++
    m[t].impact += (r.priority_score || 0)
  }
  const arr = Object.values(m).filter(t => t.category !== 'Positive Feedback')
  arr.forEach(t => t.negRate = Math.round(t.neg / t.count * 100))
  arr.sort((a, b) => b.impact - a.impact || b.count - a.count)
  const max = arr.length ? arr[0].impact : 1
  arr.forEach(t => t.pct = Math.round(t.impact / max * 100))
  return arr.slice(0, 8)
})

const catTable = computed(() => meta.value.category_summary ?? [])

const summary = computed(() => {
  const k = kpi.value, t = topThemes.value[0]
  if (!k.total) return 'ไม่มีข้อมูลตรงกับตัวกรองที่เลือก'
  return `จาก feedback ${k.total} รายการ เป็นเชิงลบ ${k.negRate}% และมีงานเร่งด่วน (P1) ${k.p1} รายการ` +
    (t ? ` — ปัญหาที่ควรแก้ก่อนที่สุดคือ “${t.theme}” (${t.count} เสียง, ลบ ${t.negRate}%, ทีม ${t.owner})` : '')
})

// ---------- table ----------
const PRIO_ORDER = { P1: 0, P2: 1, P3: 2 }
const tableRows = computed(() => {
  const arr = [...fa.value]
  const { key, dir } = sort
  arr.sort((a, b) => {
    let x = a[key], y = b[key]
    if (key === 'priority') { x = PRIO_ORDER[x]; y = PRIO_ORDER[y]; return dir === 'asc' ? x - y : y - x }
    if (typeof x === 'string') { x = x || ''; y = y || ''; return dir === 'asc' ? x.localeCompare(y) : y.localeCompare(x) }
    return dir === 'asc' ? (x - y) : (y - x)
  })
  return arr.slice(0, 250)
})
function setSort(key) {
  if (sort.key === key) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc'
  else { sort.key = key; sort.dir = key === 'priority' ? 'asc' : 'desc' }
}

// ---------- export ----------
function exportCSV() {
  const cols = ['id', 'date', 'source', 'segment', 'platform', 'version', 'area', 'category', 'sentiment', 'priority', 'owner', 'theme', 'text']
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [cols.join(',')]
  for (const r of filtered.value) lines.push(cols.map(c => esc(r[c])).join(','))
  download('player_feedback_filtered.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8;')
}
function exportReport() {
  const k = kpi.value
  let md = `# Player Feedback Insight Report\n\nช่วงข้อมูล: ${meta.value.date_min} – ${meta.value.date_max}\n\n`
  md += `## สรุปผู้บริหาร\n${summary.value}\n\n`
  md += `- รวม ${k.total} รายการ | เชิงลบ ${k.neg} (${k.negRate}%) | เชิงบวก ${k.pos} (${k.posRate}%) | P1 ${k.p1}\n\n`
  md += `## Top Pain Points (เรียงตาม impact)\n`
  topThemes.value.forEach((t, i) => { md += `${i + 1}. ${t.theme} — ${t.count} เสียง, ลบ ${t.negRate}%, P1 ${t.p1} [${t.category} · ${t.owner}]\n` })
  md += `\n## หมวด + Action ที่แนะนำ\n`
  catTable.value.forEach(c => { md += `- **${c.category}** (${c.count} รายการ, ลบ ${c.neg_rate}%): ${c.action}\n` })
  md += `\n_วิธีวิเคราะห์: ${meta.value.method}_\n`
  download('player_feedback_report.md', md, 'text/markdown;charset=utf-8;')
}
function download(name, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

// ---------- feed context to AI chat ----------
const aiCtx = useAiContext()
watchEffect(() => {
  const m = meta.value
  if (!m.total) return
  const cats = (m.category_summary || []).map(c => `- ${c.category}: ${c.count} รายการ, ลบ ${c.neg_rate}%`).join('\n')
  const owners = (m.owners || []).map(o => `- ${o.owner}: ${o.count} รายการ, ลบ ${o.neg_rate}%, P1 ${o.p1}`).join('\n')
  const themes = topThemes.value.map((t, i) => `${i + 1}. ${t.theme} — ${t.count} เสียง, ลบ ${t.negRate}%, P1 ${t.p1} [${t.category}/${t.owner}]`).join('\n')
  const af = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'ไม่มี'
  aiCtx.value = {
    page: 'Dashboard – Player Feedback Insight',
    summary:
`ชุดข้อมูล: player feedback ${m.total} รายการ ช่วง ${m.date_min} ถึง ${m.date_max} (จัดหมวดด้วย AI)
Sentiment รวม: บวก ${m.sentiment.Positive}, กลาง ${m.sentiment.Neutral}, ลบ ${m.sentiment.Negative} (ลบ ${m.neg_rate}%)
Priority: P1 ${m.priority.P1}, P2 ${m.priority.P2}, P3 ${m.priority.P3}

สรุปตามหมวด:
${cats}

ภาระงานตามทีม (owner):
${owners}

Top pain points (เรียงตาม impact):
${themes}

ตัวกรองที่ผู้ใช้เลือกอยู่ตอนนี้: ${af} (กำลังแสดง ${kpi.value.total} รายการ)`,
    suggestions: [
      'สรุปปัญหาเร่งด่วนที่สุด 3 อันดับ',
      'ทีมไหนมีงานเชิงลบเยอะสุด ควรโฟกัสอะไร',
      'มีความเสี่ยงอะไรบ้างถ้าไม่แก้'
    ]
  }
})

function sbadge(s) { return s === 'Positive' ? 'b-pos' : s === 'Negative' ? 'b-neg' : 'b-neu' }
function pbadge(p) { return p === 'P1' ? 'b-neg' : p === 'P2' ? 'b-neu' : 'b-pos' }
function fmtDate(d) { return (d || '').slice(0, 10) }
</script>

<template>
  <div>
    <div class="page-head">
      <h1>📊 Player Feedback Insight Report</h1>
      <p>เปลี่ยน feedback ผู้เล่น {{ meta.total }} รายการ ให้เป็นรายงานที่ใช้งานต่อได้ · {{ meta.date_min }} – {{ meta.date_max }} · จัดหมวดด้วย AI</p>
    </div>

    <div v-if="pending" class="card loading-wrap"><div class="pix-spinner"></div><div>กำลังโหลดข้อมูล…</div></div>
    <template v-else>
    <div class="card" style="margin-bottom:18px;border-left:3px solid var(--brand)">
      <h3 style="margin-bottom:6px">💡 สรุปอัตโนมัติ <span class="sub">(ปรับตามตัวกรอง)</span></h3>
      <div style="font-size:14px;line-height:1.6">{{ summary }}</div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="label">Feedback ที่กรองอยู่</div>
        <div class="value">{{ kpi.total }}</div>
        <div class="delta">จากทั้งหมด {{ meta.total }} รายการ</div>
      </div>
      <div class="kpi">
        <div class="label">เชิงลบ</div>
        <div class="value" style="color:var(--neg)">{{ kpi.negRate }}%</div>
        <div class="bar"><i :style="{width: kpi.negRate+'%', background:'var(--neg)'}"></i></div>
      </div>
      <div class="kpi">
        <div class="label">เร่งด่วน (P1)</div>
        <div class="value" style="color:var(--neg)">{{ kpi.p1 }}</div>
        <div class="delta">ต้องแก้ทันที</div>
      </div>
      <div class="kpi">
        <div class="label">เชิงบวก</div>
        <div class="value" style="color:var(--pos)">{{ kpi.posRate }}%</div>
        <div class="bar"><i :style="{width: kpi.posRate+'%', background:'var(--pos)'}"></i></div>
      </div>
    </div>

    <div class="controls">
      <input class="search" type="text" v-model="f.q" placeholder="🔎 ค้นหาข้อความ / ธีม..." />
      <select v-model="f.category"><option value="">ทุกหมวด</option><option v-for="c in opts.category" :key="c" :value="c">{{ c }}</option></select>
      <select v-model="f.sentiment"><option value="">ทุก sentiment</option><option>Positive</option><option>Neutral</option><option>Negative</option></select>
      <select v-model="f.priority"><option value="">ทุก priority</option><option>P1</option><option>P2</option><option>P3</option></select>
      <select v-model="f.owner"><option value="">ทุกทีม</option><option v-for="c in opts.owner" :key="c" :value="c">{{ c }}</option></select>
      <select v-model="f.segment"><option value="">ทุก segment</option><option v-for="c in opts.segment" :key="c" :value="c">{{ c }}</option></select>
      <button @click="resetFilters">ล้างตัวกรอง</button>
      <button class="primary" @click="exportReport">⬇ Report (.md)</button>
      <button @click="exportCSV">⬇ CSV</button>
    </div>

    <ClientOnly>
      <div class="grid" style="grid-template-columns: 1fr 1fr 2fr; margin-bottom:16px">
        <div class="card">
          <h3>Sentiment</h3>
          <div class="canvas-box"><ChartCanvas type="doughnut" :data="sentChart" /></div>
        </div>
        <div class="card">
          <h3>Priority</h3>
          <div class="canvas-box"><ChartCanvas type="doughnut" :data="prioChart" /></div>
        </div>
        <div class="card">
          <h3>แต่ละหมวด <span class="sub">แยกตาม sentiment</span></h3>
          <div class="canvas-box"><ChartCanvas type="bar" :data="catChart" :options="stackedOpt" /></div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; margin-bottom:16px">
        <div class="card">
          <h3>🔥 Top Pain Points <span class="sub">impact = ปริมาณ × ความรุนแรง(P) × ความลบ</span></h3>
          <div v-for="(t,i) in topThemes" :key="t.theme" class="prio-item">
            <div :class="['prio-rank', i===0 ? 'r1':'']">{{ i+1 }}</div>
            <div>
              <div style="font-size:13px;font-weight:500">{{ t.theme }}</div>
              <div class="muted" style="font-size:11px;margin-top:2px">{{ t.category }} · {{ t.owner }} · {{ t.count }} เสียง · ลบ {{ t.negRate }}%<span v-if="t.p1"> · P1×{{ t.p1 }}</span></div>
              <div class="prio-bar"><i :style="{width:t.pct+'%'}"></i></div>
            </div>
            <div class="badge b-neg">{{ t.impact }}</div>
          </div>
          <div v-if="!topThemes.length" class="muted">ไม่มีข้อมูล</div>
        </div>
        <div class="card">
          <h3>👥 ภาระงานตามทีม (Owner)</h3>
          <div class="canvas-box" style="height:300px"><ChartCanvas type="bar" :data="ownerChart" :options="horiz" /></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h3>🛠 หมวด + Action ที่แนะนำ</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>หมวด</th><th>จำนวน</th><th>เชิงลบ</th><th>ลบ%</th><th>Action ที่แนะนำ</th></tr></thead>
            <tbody>
              <tr v-for="c in catTable" :key="c.category">
                <td style="white-space:nowrap">{{ c.category }}</td>
                <td>{{ c.count }}</td>
                <td>{{ c.negative }}</td>
                <td><span :class="['badge', c.neg_rate>=60?'b-neg':c.neg_rate>=30?'b-neu':'b-pos']">{{ c.neg_rate }}%</span></td>
                <td class="muted" style="min-width:320px">{{ c.action }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; margin-bottom:16px">
        <div class="card"><h3>ตามแหล่งที่มา</h3><div class="canvas-box"><ChartCanvas type="bar" :data="sourceChart" :options="noLegend" /></div></div>
        <div class="card"><h3>ตาม Segment ผู้เล่น</h3><div class="canvas-box"><ChartCanvas type="bar" :data="segmentChart" :options="noLegend" /></div></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <h3>📈 แนวโน้มตามเวลา <span class="sub">จำนวน feedback รายวัน แยก sentiment</span></h3>
        <div class="canvas-box tall"><ChartCanvas type="bar" :data="trendChart" :options="stackedOpt" /></div>
      </div>

      <template #fallback>
        <div class="card" style="min-height:300px;display:grid;place-items:center;color:var(--muted)">กำลังโหลดกราฟ…</div>
      </template>
    </ClientOnly>

    <div class="card">
      <h3>รายการ Feedback <span class="sub">(สูงสุด 250 จาก {{ filtered.length }} รายการที่กรอง · คลิกหัวคอลัมน์เพื่อจัดเรียง)</span></h3>
      <div class="table-wrap" style="max-height:560px">
        <table>
          <thead>
            <tr>
              <th @click="setSort('priority')">Priority</th>
              <th @click="setSort('date')">วันที่</th>
              <th @click="setSort('category')">หมวด</th>
              <th @click="setSort('sentiment')">Sentiment</th>
              <th @click="setSort('owner')">Owner</th>
              <th @click="setSort('theme')">ธีม</th>
              <th>ข้อความ</th>
              <th @click="setSort('segment')">Segment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableRows" :key="r.id">
              <td><span :class="['badge', pbadge(r.priority)]">{{ r.priority }}</span></td>
              <td class="muted" style="white-space:nowrap">{{ fmtDate(r.date) }}</td>
              <td style="white-space:nowrap">{{ r.category }}</td>
              <td><span :class="['badge', sbadge(r.sentiment)]">{{ r.sentiment }}</span></td>
              <td class="muted" style="white-space:nowrap">{{ r.owner }}</td>
              <td class="muted" style="min-width:160px">{{ r.theme }}</td>
              <td class="text-cell">{{ r.text }}</td>
              <td class="muted" style="white-space:nowrap">{{ r.segment }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>
