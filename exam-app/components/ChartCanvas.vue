<script setup>
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const props = defineProps({
  type: { type: String, default: 'bar' },
  data: { type: Object, required: true },
  options: { type: Object, default: () => ({}) }
})

const el = ref(null)
let chart = null

const baseOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#8f7651', font: { family: 'IBM Plex Sans Thai', size: 12 }, boxWidth: 12, boxHeight: 12 }
    },
    tooltip: {
      backgroundColor: '#fbf4e1', borderColor: '#6b5132', borderWidth: 2,
      titleColor: '#4a3826', bodyColor: '#4a3826', padding: 10, cornerRadius: 0
    }
  },
  scales: props.type === 'doughnut' || props.type === 'pie' ? {} : {
    x: { ticks: { color: '#8f7651', font: { family: 'IBM Plex Sans Thai', size: 11 } }, grid: { color: 'rgba(183,155,110,.35)' } },
    y: { ticks: { color: '#8f7651', font: { size: 11 } }, grid: { color: 'rgba(183,155,110,.35)' }, beginAtZero: true }
  },
  ...props.options
}))

function render() {
  if (!el.value) return
  if (chart) chart.destroy()
  chart = new Chart(el.value, { type: props.type, data: props.data, options: baseOptions.value })
}

onMounted(render)
watch(() => props.data, render, { deep: true })
onBeforeUnmount(() => chart && chart.destroy())
</script>

<template>
  <canvas ref="el"></canvas>
</template>
<!-- end -->
