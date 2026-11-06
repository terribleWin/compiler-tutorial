<script setup>
import { computed, onMounted, ref } from 'vue'

const n = ref(4)
const tile = ref(2)
const A = ref([])
const B = ref([])
const C = ref([])
const events = ref([])
const cursor = ref(0)
const current = ref(null)
const loads = ref(0)
const flops = ref(0)
const canExecute = computed(() => cursor.value < events.value.length)
const complete = computed(() => events.value.length > 0 && !canExecute.value)
const counter = computed(() => `${cursor.value} / ${events.value.length}`)
const reuse = computed(() => complete.value ? `${(2 * n.value ** 3 / loads.value).toFixed(1)} 倍` : '完成后显示')
const region = computed(() => {
  const e = current.value
  const t = tile.value
  return e ? `C[${e.i}:${e.i + t}, ${e.j}:${e.j + t}] += A[${e.i}:${e.i + t}, ${e.k}:${e.k + t}] × B[${e.k}:${e.k + t}, ${e.j}:${e.j + t}]` : '尚未执行，C 初始化为零'
})
const matrices = computed(() => [
  { id: 'matrix-a', label: 'A / 左输入', data: A.value, r: current.value?.i, c: current.value?.k },
  { id: 'matrix-b', label: 'B / 右输入', data: B.value, r: current.value?.k, c: current.value?.j },
  { id: 'matrix-c', label: 'C / 累加结果', data: C.value, r: current.value?.i, c: current.value?.j }
])
const verdict = computed(() => {
  if (!complete.value) return '每一步累加一个 k 方向的小块。结果在全部执行完成后核对。'
  const expected = make((r, c) => A.value[r].reduce((sum, value, k) => sum + value * B.value[k][c], 0))
  return JSON.stringify(expected) === JSON.stringify(C.value) ? '验证通过：与朴素矩阵乘逐元素相同。' : '验证失败。'
})

function make(f) { return Array.from({ length: n.value }, (_, r) => Array.from({ length: n.value }, (_, c) => f(r, c))) }
function reset() {
  A.value = make((r, c) => (r + c) % 5 - 2)
  B.value = make((r, c) => (r * 2 + c) % 5 - 2)
  C.value = make(() => 0)
  const order = []
  for (let i = 0; i < n.value; i += tile.value) {
    for (let j = 0; j < n.value; j += tile.value) {
      for (let k = 0; k < n.value; k += tile.value) order.push({ i, j, k })
    }
  }
  events.value = order
  cursor.value = 0
  current.value = null
  loads.value = 0
  flops.value = 0
}

function advance() {
  if (!canExecute.value) return
  const e = events.value[cursor.value++]
  const t = tile.value
  for (let i = e.i; i < e.i + t; i++) {
    for (let j = e.j; j < e.j + t; j++) {
      for (let k = e.k; k < e.k + t; k++) C.value[i][j] += A.value[i][k] * B.value[k][j]
    }
  }
  loads.value += 2 * t * t
  flops.value += 2 * t * t * t
  current.value = e
}

function selected(matrix, r, c) {
  return current.value && r >= matrix.r && r < matrix.r + tile.value && c >= matrix.c && c < matrix.c + tile.value
}
function run() { while (canExecute.value) advance() }
onMounted(reset)
</script>

<template>
  <div id="tensor-lab" class="lab-box sprout-lab sprout-tensor-lab">
    <div class="tensor-selectors">
      <label for="matrix-size">矩阵尺寸 <select id="matrix-size" v-model.number="n" @change="reset"><option :value="4">4 × 4</option><option :value="8">8 × 8</option></select></label>
      <label for="tile-size">分块尺寸 <select id="tile-size" v-model.number="tile" @change="reset"><option :value="1">1 × 1</option><option :value="2">2 × 2</option><option :value="4">4 × 4</option></select></label>
    </div>
    <div class="lab-controls">
      <button id="tensor-step" type="button" :disabled="!canExecute" @click="advance">累加一个小块</button>
      <button id="tensor-run" type="button" :disabled="!canExecute" @click="run">运行到底</button>
      <button id="tensor-reset" type="button" @click="reset">重置</button>
    </div>
    <p id="tensor-region" class="tiny" aria-live="polite">{{ region }}</p>
    <div class="matrix-group">
      <section v-for="matrix in matrices" :key="matrix.id">
        <h3>{{ matrix.label }}</h3>
        <div class="matrix-scroll">
          <div :id="matrix.id" class="matrix-grid" :style="{gridTemplateColumns: `repeat(${n}, minmax(32px, 1fr))`}">
            <template v-for="(row, r) in matrix.data" :key="r">
              <span v-for="(value, c) in row" :key="`${r}-${c}`" class="matrix-cell" :class="{selected: selected(matrix, r, c)}" :title="`[${r}, ${c}] = ${value}`">{{ value }}</span>
            </template>
          </div>
        </div>
      </section>
    </div>
    <div class="tensor-statistics">
      <div>块步骤<strong id="tensor-counter">{{ counter }}</strong></div>
      <div>理想输入元素加载<strong id="tensor-loads">{{ loads }}</strong></div>
      <div>标量算术操作<strong id="tensor-flops">{{ flops }}</strong></div>
      <div>输入复用对比<strong id="tensor-reuse">{{ reuse }}</strong></div>
    </div>
    <p id="tensor-verdict" class="note" aria-live="polite">{{ verdict }}</p>
  </div>
</template>

<style scoped>
.sprout-lab { --lab-border:var(--vp-c-divider); margin:28px 0; padding:24px; border:1px solid var(--lab-border); border-radius:12px; background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); font-size:15px; line-height:1.7; }
.tensor-selectors { display:flex; flex-wrap:wrap; gap:14px 24px; }
.tensor-selectors label { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; }
.tensor-selectors select { min-width:95px; padding:7px 11px; border:1px solid var(--lab-border); border-radius:6px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font:inherit; }
.lab-controls { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0 12px; }
.lab-controls button { padding:8px 12px; border:1px solid var(--lab-border); border-radius:6px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font:inherit; font-size:13px; cursor:pointer; }
.lab-controls button:first-child { border-color:var(--vp-c-brand-1); background:var(--vp-c-brand-1); color:var(--vp-c-white); }
.lab-controls button:hover:not(:disabled) { border-color:var(--vp-c-brand-1); }
.lab-controls button:disabled { opacity:.4; cursor:default; }
.lab-controls button:focus-visible,.tensor-selectors select:focus-visible { outline:3px solid var(--vp-c-brand-soft); outline-offset:3px; }
.sprout-lab .tiny { margin:12px 0; color:var(--vp-c-text-2); font:12px/1.8 var(--vp-font-family-mono); overflow-wrap:anywhere; }
.matrix-group { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:16px; }
.matrix-group section { min-width:0; }
.matrix-group h3 { margin:12px 0 9px; border:0; padding:0; font-size:13px; font-weight:650; }
.matrix-scroll { overflow:auto; }
.matrix-grid { display:grid; gap:3px; min-width:130px; }
.matrix-cell { display:flex; align-items:center; justify-content:center; min-width:32px; aspect-ratio:1; border:1px solid var(--lab-border); border-radius:4px; background:var(--vp-c-bg); font:12px var(--vp-font-family-mono); }
.matrix-cell.selected { border-color:var(--vp-c-brand-1); background:var(--vp-c-brand-soft); color:var(--vp-c-brand-1); font-weight:700; }
.tensor-statistics { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:15px; margin:24px 0 0; padding-top:18px; border-top:1px solid var(--lab-border); color:var(--vp-c-text-2); font-size:11px; }
.tensor-statistics strong { display:block; margin-top:4px; color:var(--vp-c-brand-1); font:17px/1.8 var(--vp-font-family-mono); overflow-wrap:anywhere; }
.sprout-lab .note { margin:20px 0 0; border-left:3px solid var(--vp-c-brand-1); padding:10px 13px; background:var(--vp-c-brand-soft); font-size:13px; }
@media(max-width:1100px) { .matrix-group { grid-template-columns:1fr; } .matrix-grid { max-width:400px; } .matrix-group h3 { margin-top:18px; } }
@media(max-width:640px) { .sprout-lab { padding:16px; } .tensor-statistics { grid-template-columns:repeat(2, minmax(0, 1fr)); } .lab-controls button { font-size:12px; padding:8px 10px; } }
</style>
