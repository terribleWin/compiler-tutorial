<script setup>
import { computed, onMounted, ref } from 'vue'

const expression = ref('2 + 3 * (4 - 1)')
const tokens = ref([])
const ast = ref(null)
const bytecode = ref([])
const pc = ref(0)
const stack = ref([])
const trace = ref([])
const compiled = ref(false)
const activeTab = ref('tokens')
const error = ref('')
const tabs = ref(null)
const tabNames = ['tokens', 'ast', 'bytecode']
const samples = [
  ['优先级', '2 + 3 * 4'],
  ['改变结合', '(2 + 3) * 4'],
  ['左结合', '20 - 5 - 3'],
  ['整数除法', '-7 / 2'],
  ['除零诊断', '1 / (3 - 3)'],
  ['溢出诊断', '2147483647 + 1']
]

const canExecute = computed(() => compiled.value && pc.value < bytecode.value.length)
const result = computed(() => compiled.value && pc.value === bytecode.value.length && stack.value.length === 1 ? stack.value[0] : '—')
const stackText = computed(() => '[' + stack.value.join(', ') + ']')
const visibleTrace = computed(() => trace.value.slice(-80))
const output = computed(() => {
  if (activeTab.value === 'tokens') return tokens.value.map(t => `${String(t.column).padStart(3)}  ${t.kind.padEnd(7)}  ${t.text}`).join('\n')
  if (activeTab.value === 'ast') return ast.value ? tree(ast.value) : ''
  return bytecode.value.map((x, i) => `${i === pc.value ? '→' : ' '} ${String(i).padStart(3, '0')}  ${x.op}${x.value !== undefined ? ' ' + x.value : ''}`).join('\n')
})

function bounds(n) {
  if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new Error('整数溢出：结果超出 int32 范围')
  return n
}

function lex(text) {
  if (text.length > 4096) throw new Error('表达式最多 4096 个字符')
  const result = []
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue }
    const start = i
    if (/[0-9]/.test(text[i])) {
      while (i < text.length && /[0-9]/.test(text[i])) i++
      const value = Number(text.slice(start, i))
      if (value > 2147483648) throw new Error(`第 ${start + 1} 个字符：整数太大`)
      result.push({ kind: 'NUMBER', text: text.slice(start, i), value, column: start + 1 })
      continue
    }
    if ('+-*/%()'.includes(text[i])) {
      result.push({ kind: text[i], text: text[i], column: i + 1 })
      i++
      continue
    }
    throw new Error(`第 ${i + 1} 个字符：不支持“${text[i]}”，本实验只接收整数算术表达式`)
  }
  result.push({ kind: 'EOF', text: '', column: i + 1 })
  return result
}

function parse(ts) {
  let i = 0
  let depth = 0
  const peek = () => ts[i]
  const take = () => ts[i++]
  function expr(min = 0) {
    if (++depth > 128) throw new Error('表达式嵌套过深（上限128）')
    let left
    const t = take()
    if (t.kind === 'NUMBER') left = { kind: 'Int', value: bounds(t.value) }
    else if (t.kind === '-' || t.kind === '+') {
      if (t.kind === '-' && peek().kind === 'NUMBER') left = { kind: 'Int', value: bounds(-take().value) }
      else left = { kind: 'Unary', op: t.kind, child: expr(30) }
    } else if (t.kind === '(') {
      left = expr()
      if (peek().kind !== ')') throw new Error(`第 ${peek().column} 个字符：缺少右括号 )`)
      take()
    } else throw new Error(`第 ${t.column} 个字符：需要整数、正负号或左括号`)
    const prec = { '+': 10, '-': 10, '*': 20, '/': 20, '%': 20 }
    while (prec[peek().kind] !== undefined && prec[peek().kind] >= min) {
      const op = take().kind
      left = { kind: 'Binary', op, left, right: expr(prec[op] + 1) }
    }
    depth--
    return left
  }
  const result = expr()
  if (peek().kind !== 'EOF') throw new Error(`第 ${peek().column} 个字符：多余的“${peek().text}”`)
  return result
}

function generate(n, target, depth = 0) {
  if (depth > 256) throw new Error('表达式结构过深，请拆分后再试')
  if (n.kind === 'Int') target.push({ op: 'PUSH', value: n.value })
  else if (n.kind === 'Unary') {
    generate(n.child, target, depth + 1)
    if (n.op === '-') target.push({ op: 'NEG' })
  } else {
    generate(n.left, target, depth + 1)
    generate(n.right, target, depth + 1)
    target.push({ op: { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '%': 'MOD' }[n.op] })
  }
}

function tree(n, indent = '') {
  if (n.kind === 'Int') return indent + 'Int(' + n.value + ')'
  if (n.kind === 'Unary') return indent + 'Unary(' + n.op + ')\n' + tree(n.child, indent + '  ')
  return indent + 'Binary(' + n.op + ')\n' + tree(n.left, indent + '  ') + '\n' + tree(n.right, indent + '  ')
}

function reset() {
  pc.value = 0
  stack.value = []
  trace.value = []
  error.value = ''
}

function compile() {
  tokens.value = []
  ast.value = null
  bytecode.value = []
  compiled.value = false
  reset()
  try {
    tokens.value = lex(expression.value)
    const parsed = parse(tokens.value)
    const code = []
    generate(parsed, code)
    ast.value = parsed
    bytecode.value = code
    compiled.value = true
  } catch (e) { error.value = e.message }
}

function step() {
  if (!canExecute.value) return
  const inst = bytecode.value[pc.value]
  const before = JSON.stringify(stack.value)
  const previous = stack.value.slice()
  try {
    if (inst.op === 'PUSH') stack.value.push(inst.value)
    else if (inst.op === 'NEG') stack.value.push(bounds(-stack.value.pop()))
    else {
      const b = stack.value.pop()
      const a = stack.value.pop()
      let value
      if (inst.op === 'ADD') value = a + b
      if (inst.op === 'SUB') value = a - b
      if (inst.op === 'MUL') value = a * b
      if (inst.op === 'DIV' || inst.op === 'MOD') {
        if (b === 0) throw new Error('除数不能为 0')
        if (inst.op === 'DIV' && a === -2147483648 && b === -1) throw new Error('整数溢出：INT_MIN / -1')
        value = inst.op === 'DIV' ? Math.trunc(a / b) : a % b
      }
      stack.value.push(bounds(value))
    }
    trace.value.push({ pc: pc.value, instruction: inst.op + (inst.value !== undefined ? ' ' + inst.value : ''), before, after: JSON.stringify(stack.value) })
    pc.value++
  } catch (e) {
    stack.value = previous
    compiled.value = false
    error.value = `指令 ${pc.value}（${inst.op}）：${e.message}`
  }
}

function run() { while (canExecute.value) step() }
function resetExecution() { if (ast.value) { compiled.value = true; reset() } }
function sample(text) { expression.value = text; compile() }
function edit(event) {
  expression.value = event.target.value
  compiled.value = false
  tokens.value = []
  ast.value = null
  bytecode.value = []
  reset()
}
function tabKey(event) {
  const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!offset) return
  event.preventDefault()
  activeTab.value = tabNames[(tabNames.indexOf(activeTab.value) + offset + tabNames.length) % tabNames.length]
  tabs.value?.querySelector(`[data-tab="${activeTab.value}"]`)?.focus()
}
onMounted(compile)
</script>

<template>
  <div class="lab-box sprout-lab sprout-expression-lab">
    <label for="expression">源表达式</label>
    <textarea id="expression" :value="expression" spellcheck="false" aria-describedby="lab-description" @input="edit"></textarea>
    <p id="lab-description" class="tiny">修改表达式后重新编译。整数除法向零截断，溢出与除零会停止执行。</p>
    <div class="lab-samples">
      <button v-for="[label, text] in samples" :key="text" type="button" :data-expression="text" @click="sample(text)">{{ label }}</button>
    </div>
    <div class="lab-controls">
      <button id="compile" type="button" @click="compile">编译</button>
      <button id="step" type="button" :disabled="!canExecute" @click="step">执行一步</button>
      <button id="run" type="button" :disabled="!canExecute" @click="run">运行到底</button>
      <button id="reset" type="button" :disabled="!ast" @click="resetExecution">重置执行</button>
    </div>
    <div id="lab-error" class="lab-error" role="alert">{{ error }}</div>
    <div ref="tabs" class="lab-tabs" role="tablist" aria-label="编译阶段" @keydown="tabKey">
      <button v-for="(tab, index) in tabNames" :id="`tab-${tab}`" :key="tab" type="button" role="tab" :aria-selected="activeTab === tab" :tabindex="activeTab === tab ? 0 : -1" aria-controls="lab-output" :data-tab="tab" @click="activeTab = tab">{{ ['Token', 'AST', '字节码'][index] }}</button>
    </div>
    <pre id="lab-output" class="lab-output" role="tabpanel" :aria-labelledby="`tab-${activeTab}`">{{ output || '点击“编译”，观察各阶段的结果。' }}</pre>
    <div class="lab-status" aria-live="polite">
      <span>PC <strong id="lab-pc">{{ pc }}</strong></span>
      <span>栈 <strong id="lab-stack">{{ stackText }}</strong></span>
      <span>结果 <strong id="lab-result">{{ result }}</strong></span>
    </div>
    <div class="table-scroll lab-trace">
      <table><thead><tr><th>PC</th><th>执行指令</th><th>执行前栈</th><th>执行后栈</th></tr></thead>
        <tbody id="trace-body"><tr v-for="row in visibleTrace" :key="row.pc"><td>{{ row.pc }}</td><td>{{ row.instruction }}</td><td>{{ row.before }}</td><td>{{ row.after }}</td></tr></tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.sprout-lab { --lab-border:var(--vp-c-divider); margin:28px 0; padding:24px; border:1px solid var(--lab-border); border-radius:12px; background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); font-size:15px; line-height:1.7; }
.sprout-lab label { display:block; margin-bottom:10px; font-size:15px; font-weight:650; }
.sprout-lab textarea { box-sizing:border-box; width:100%; min-height:100px; padding:16px; border:1px solid var(--lab-border); border-radius:8px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font:16px/1.8 var(--vp-font-family-mono); resize:vertical; }
.sprout-lab .tiny { margin:10px 0 16px; color:var(--vp-c-text-2); font-size:13px; line-height:1.7; }
.lab-samples,.lab-controls,.lab-tabs { display:flex; flex-wrap:wrap; gap:8px; }
.sprout-lab button { border:1px solid var(--lab-border); border-radius:6px; padding:7px 12px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font:inherit; font-size:13px; cursor:pointer; }
.sprout-lab button:hover:not(:disabled) { border-color:var(--vp-c-brand-1); color:var(--vp-c-brand-1); }
.sprout-lab button:focus-visible,.sprout-lab textarea:focus-visible { outline:3px solid var(--vp-c-brand-soft); outline-offset:3px; }
.lab-controls { margin:18px 0 8px; }
.lab-controls button:first-child { background:var(--vp-c-brand-1); color:var(--vp-c-white); border-color:var(--vp-c-brand-1); }
.sprout-lab button:disabled { opacity:.4; cursor:default; }
.lab-error { min-height:25px; color:var(--vp-c-danger-1); font-size:13px; }
.lab-tabs { margin:16px 0 10px; }
.lab-tabs [aria-selected=true] { color:var(--vp-c-brand-1); border-color:var(--vp-c-brand-1); background:var(--vp-c-brand-soft); }
.sprout-lab .lab-output { box-sizing:border-box; margin:0; padding:16px; border:1px solid var(--lab-border); border-radius:8px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font:14px/1.8 var(--vp-font-family-mono); white-space:pre; overflow:auto; max-height:430px; min-height:110px; }
.lab-status { display:flex; flex-wrap:wrap; gap:20px; margin:18px 0; font:13px/1.8 var(--vp-font-family-mono); }
.lab-status strong { color:var(--vp-c-brand-1); overflow-wrap:anywhere; }
.table-scroll { overflow:auto; }
.sprout-lab table { display:table; margin:0; width:100%; font:12px/1.8 var(--vp-font-family-mono); }
.sprout-lab th,.sprout-lab td { padding:9px 12px; white-space:nowrap; }
@media(max-width:640px) { .sprout-lab { margin:24px 0; padding:16px; } .sprout-lab button { padding:7px 10px; font-size:12px; } .lab-status { gap:12px; } }
</style>
