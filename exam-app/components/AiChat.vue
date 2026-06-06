<script setup>
const ctx = useAiContext()
const open = useState('chat-open', () => true)
const showSettings = ref(false)

// settings (เก็บใน localStorage ของ browser เท่านั้น)
const provider = ref('anthropic')
const apiKey = ref('')
const model = ref('claude-3-5-haiku-20241022')
const DEFAULT_MODEL = { anthropic: 'claude-3-5-haiku-20241022', openai: 'gpt-4o-mini' }
const MODELS = {
  anthropic: [
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6'
  ],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']
}

const fetchedModels = ref([])   // รายชื่อ model จริงที่ key ใช้ได้ (ดึงจาก API)
const loadingModels = ref(false)
const modelOptions = computed(() => fetchedModels.value.length ? fetchedModels.value : MODELS[provider.value])

const messages = ref([])   // { role: 'user'|'assistant', content }
const input = ref('')
const loading = ref(false)
const error = ref('')
const scroller = ref(null)

onMounted(() => {
  provider.value = localStorage.getItem('ai_provider') || 'anthropic'
  apiKey.value = localStorage.getItem('ai_key') || ''
  model.value = localStorage.getItem('ai_model') || DEFAULT_MODEL[provider.value]
  if (!apiKey.value) showSettings.value = true
})

function saveSettings() {
  localStorage.setItem('ai_provider', provider.value)
  localStorage.setItem('ai_key', apiKey.value.trim())
  localStorage.setItem('ai_model', model.value.trim())
  showSettings.value = false
  error.value = ''
}
function onProviderChange() {
  model.value = DEFAULT_MODEL[provider.value]
}
function clearChat() { messages.value = []; error.value = '' }

const hasKey = computed(() => !!apiKey.value.trim())

const DEFAULT_SUGGESTIONS = ['สรุปหน้านี้ให้หน่อย', 'มีอะไรน่าสนใจบ้าง', 'แนะนำสิ่งที่ควรทำต่อ']
const suggestions = computed(() => ctx.value?.suggestions?.length ? ctx.value.suggestions : DEFAULT_SUGGESTIONS)

async function send(text) {
  const q = (text ?? input.value).trim()
  if (!q || loading.value) return
  if (!hasKey.value) { showSettings.value = true; return }
  error.value = ''
  messages.value.push({ role: 'user', content: q })
  input.value = ''
  loading.value = true
  await nextTick(); scrollDown()

  const system =
`คุณคือผู้ช่วยวิเคราะห์ข้อมูลของหน้า "${ctx.value.page}" ในแอป Game Insight Suite
ตอบคำถามของผู้ใช้โดยอิง "ข้อมูล" ที่ให้ด้านล่างเท่านั้น

กฎ (สำคัญมาก):
1. ใช้เฉพาะตัวเลข/ข้อเท็จจริงที่ปรากฏในข้อมูลด้านล่าง ห้ามเดา ห้ามแต่งตัวเลขหรือชื่อที่ไม่มีในข้อมูลเด็ดขาด
2. ถ้าคำถามตอบไม่ได้จากข้อมูลที่มี ให้บอกตรง ๆ ว่าข้อมูลในหน้านี้ไม่พอจะตอบ แล้วบอกว่าต้องใช้ข้อมูลอะไรเพิ่ม — อย่าเดามั่ว
3. เวลาจัดอันดับ/เปรียบเทียบ ให้คำนวณจากตัวเลขจริงในข้อมูล และอ้างชื่อ+ตัวเลขให้ตรงเป๊ะ
4. ถ้าผู้ใช้ถามความเห็น/คำแนะนำ ให้สรุปจากข้อมูล พร้อมเหตุผลที่อ้างตัวเลขประกอบ
5. ตอบภาษาไทย กระชับ ตรงคำถาม ถ้ามีหลายข้อให้ใช้ bullet สั้น ๆ ไม่ต้องเกริ่นยาว

=== ข้อมูล: สรุปภาพรวม ===
${ctx.value.summary}` +
    (ctx.value.data ? `\n\n=== ข้อมูล: รายตัว (ใช้ตอบคำถามเฉพาะเจาะจง/จัดอันดับ) ===\n${ctx.value.data}` : '')

  try {
    const reply = provider.value === 'openai'
      ? await callOpenAI(system, messages.value)
      : await callAnthropic(system, messages.value)
    messages.value.push({ role: 'assistant', content: reply })
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
    await nextTick(); scrollDown()
  }
}

async function callAnthropic(system, msgs) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey.value.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model.value.trim(),
      max_tokens: 1500,
      system,
      messages: msgs.map(m => ({ role: m.role, content: m.content }))
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic error ${res.status}`)
  return data.content?.map(c => c.text).join('') || '(ไม่มีคำตอบ)'
}

async function callOpenAI(system, msgs) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey.value.trim()}`
    },
    body: JSON.stringify({
      model: model.value.trim(),
      messages: [{ role: 'system', content: system }, ...msgs.map(m => ({ role: m.role, content: m.content }))]
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI error ${res.status}`)
  return data.choices?.[0]?.message?.content || '(ไม่มีคำตอบ)'
}

async function fetchModels() {
  if (!hasKey.value) { error.value = 'ใส่ API key ก่อน'; return }
  loadingModels.value = true; error.value = ''
  try {
    let ids = []
    if (provider.value === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'authorization': `Bearer ${apiKey.value.trim()}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || `OpenAI error ${res.status}`)
      ids = (data.data || []).map(m => m.id).filter(id => /^(gpt|o\d)/.test(id)).sort()
    } else {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey.value.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || `Anthropic error ${res.status}`)
      ids = (data.data || []).map(m => m.id)
    }
    if (ids.length) { fetchedModels.value = ids; if (!ids.includes(model.value)) model.value = ids[0] }
    else error.value = 'ไม่พบรายชื่อ model'
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loadingModels.value = false
  }
}

function scrollDown() { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight }
function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
</script>

<template>
  <!-- ปุ่มเปิดเมื่อพับอยู่ -->
  <button v-if="!open" class="chat-fab" @click="open = true" title="เปิดผู้ช่วย AI">💬</button>

  <aside v-show="open" class="chat">
    <div class="chat-head">
      <div class="chat-title">🤖 ผู้ช่วย AI <span class="chat-page">{{ ctx.page }}</span></div>
      <div class="chat-actions">
        <button class="icon" @click="showSettings = !showSettings" title="ตั้งค่า API key">⚙</button>
        <button class="icon" @click="clearChat" title="ล้างแชต">🧹</button>
        <button class="icon" @click="open = false" title="พับ">✕</button>
      </div>
    </div>

    <!-- settings -->
    <div v-if="showSettings" class="chat-settings">
      <label>ผู้ให้บริการ</label>
      <select v-model="provider" @change="onProviderChange">
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="openai">OpenAI</option>
      </select>
      <label>API Key <span class="hint">(เก็บในเบราว์เซอร์นี้เท่านั้น)</span></label>
      <input type="password" v-model="apiKey" :placeholder="provider === 'openai' ? 'sk-...' : 'sk-ant-...'" />
      <label>Model</label>
      <select v-model="model">
        <option v-for="mm in modelOptions" :key="mm" :value="mm">{{ mm }}</option>
      </select>
      <input type="text" v-model="model" placeholder="หรือพิมพ์ชื่อ model เอง" />
      <button class="icon load-models" :disabled="loadingModels" @click="fetchModels">
        {{ loadingModels ? 'กำลังโหลด…' : '↻ โหลด model ที่ key นี้ใช้ได้' }}
      </button>
      <button class="primary save" @click="saveSettings">บันทึก</button>
      <p class="hint small">คีย์ถูกใช้ยิงตรงจากเบราว์เซอร์ไปยัง {{ provider === 'openai' ? 'OpenAI' : 'Anthropic' }} เท่านั้น ไม่ถูกส่งไปเซิร์ฟเวอร์อื่น</p>
    </div>

    <!-- messages -->
    <div class="chat-body" ref="scroller">
      <div v-if="!messages.length" class="chat-empty">
        <p>ถามอะไรเกี่ยวกับหน้านี้ได้เลย เช่น</p>
        <button v-for="s in suggestions" :key="s" class="sug" @click="send(s)">{{ s }}</button>
      </div>
      <div v-for="(m,i) in messages" :key="i" :class="['msg', m.role]">
        <div class="bubble">{{ m.content }}</div>
      </div>
      <div v-if="loading" class="msg assistant"><div class="bubble typing">กำลังคิด…</div></div>
      <div v-if="error" class="chat-err">⚠ {{ error }}</div>
    </div>

    <!-- input -->
    <div class="chat-input">
      <textarea v-model="input" rows="2" :placeholder="hasKey ? 'พิมพ์คำถาม… (Enter ส่ง)' : 'ใส่ API key ก่อน (กดไอคอน ⚙)'" @keydown="onKey"></textarea>
      <button class="primary" :disabled="loading" @click="send()">ส่ง</button>
    </div>
  </aside>
</template>
<!-- end -->
