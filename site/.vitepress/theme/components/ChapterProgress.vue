<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const total = 25
const done = ref([])
const ready = ref(false)
const chapterId = computed(() => /^chapter(?:0[1-9]|1\d|2[0-5])$/.test(frontmatter.value.chapterId || '') ? frontmatter.value.chapterId : '')
const count = computed(() => done.value.length)
const complete = computed(() => done.value.includes(chapterId.value))
const percent = computed(() => count.value / total * 100)

function valid(list) {
  return Array.isArray(list) ? [...new Set(list.filter(id => /^chapter(?:0[1-9]|1\d|2[0-5])$/.test(id)))] : []
}
function load() {
  try { done.value = valid(JSON.parse(localStorage.getItem('sprout-progress') || '[]')) }
  catch { done.value = [] }
}
function update(event) {
  load()
  const next = done.value.filter(id => id !== chapterId.value)
  if (event.target.checked && chapterId.value) next.push(chapterId.value)
  done.value = next
  try { localStorage.setItem('sprout-progress', JSON.stringify(next)) } catch { /* Private browsing can deny storage. */ }
}
function storage(event) { if (event.key === 'sprout-progress' || event.key === null) load() }
watch(chapterId, () => { if (ready.value) load() })
onMounted(() => { load(); ready.value = true; window.addEventListener('storage', storage) })
onUnmounted(() => window.removeEventListener('storage', storage))
</script>

<template>
  <section v-if="chapterId" class="sprout-chapter-progress" aria-label="本章学习进度">
    <div class="sprout-progress-summary"><span>学习进度</span><span id="progress-count">{{ count }} / {{ total }}</span></div>
    <div class="sprout-progress-track" role="progressbar" :aria-valuenow="count" :aria-valuemin="0" :aria-valuemax="total" aria-label="已完成章节数"><i id="progress-bar" :style="{width: percent + '%'}"></i></div>
    <label class="sprout-progress-label"><input id="mark-complete" type="checkbox" :checked="complete" :disabled="!ready" :data-chapter="chapterId" @change="update"><span>本章已完成</span></label>
  </section>
</template>

<style scoped>
.sprout-chapter-progress { margin-top:40px; padding:22px 24px; border:1px solid var(--vp-c-divider); border-radius:10px; background:var(--vp-c-bg-soft); }
.sprout-progress-summary { display:flex; justify-content:space-between; gap:16px; margin-bottom:10px; color:var(--vp-c-text-2); font-size:13px; line-height:1.7; }
.sprout-progress-track { height:4px; overflow:hidden; margin-bottom:22px; border-radius:3px; background:var(--vp-c-divider); }
.sprout-progress-track i { display:block; height:100%; background:var(--vp-c-brand-1); transition:width .2s; }
.sprout-progress-label { display:flex; align-items:flex-start; gap:11px; color:var(--vp-c-text-1); font-size:15px; line-height:1.7; cursor:pointer; }
.sprout-progress-label input { flex-shrink:0; width:17px; height:17px; margin-top:4px; accent-color:var(--vp-c-brand-1); }
.sprout-chapter-progress p { margin:8px 0 0 28px; color:var(--vp-c-text-2); font-size:12px; line-height:1.8; }
@media(max-width:640px) { .sprout-chapter-progress { padding:18px; } .sprout-progress-label { font-size:14px; } }
</style>
