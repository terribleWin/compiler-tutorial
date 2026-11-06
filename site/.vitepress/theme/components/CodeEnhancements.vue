<script setup>
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const blocks = new Map()
let observer
let resizeObserver
let frame = 0
let alive = false
let unwatch

function schedule() {
  if (!alive || frame) return
  frame = requestAnimationFrame(() => { frame = 0; enhance() })
}

function syncNumbers(block, entry) {
  if (!entry.numbers) return
  const lineHeight = Number.parseFloat(getComputedStyle(entry.code).lineHeight) || 24
  const lines = [...entry.code.querySelectorAll('.line')]
  const labels = [...entry.numbers.querySelectorAll('.line-number')]
  const heights = lines.map(line => Math.max(1, Math.round(line.getBoundingClientRect().height / lineHeight)) * lineHeight)
  labels.forEach((label, index) => { label.style.height = `${heights[index] || lineHeight}px`; label.style.lineHeight = `${lineHeight}px` })
  entry.numbers.scrollTop = entry.pre.scrollTop
}

function exitFullscreen(block, focus = false) {
  if (!block.classList.contains('sprout-code-fullscreen')) return
  const entry = blocks.get(block)
  block.classList.remove('sprout-code-fullscreen')
  block.removeAttribute('role')
  block.removeAttribute('aria-modal')
  block.removeAttribute('aria-label')
  if (entry) {
    entry.fullscreen.textContent = '放大'
    entry.fullscreen.setAttribute('aria-pressed', 'false')
    if (focus && entry.fullscreen.isConnected) entry.fullscreen.focus()
  }
  if (!document.querySelector('.sprout-code-fullscreen')) document.documentElement.classList.remove('sprout-code-open')
}

function keyboard(event) {
  const block = document.querySelector('.sprout-code-fullscreen')
  if (!block) return
  if (event.key === 'Escape') { event.preventDefault(); exitFullscreen(block, true); return }
  if (event.key !== 'Tab') return
  const buttons = [...block.querySelectorAll('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length)
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  if (!first) return
  if (event.shiftKey && (document.activeElement === first || !block.contains(document.activeElement))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || !block.contains(document.activeElement))) { event.preventDefault(); first.focus() }
}

function remove(block, entry) {
  exitFullscreen(block)
  entry.cleanup.forEach(fn => fn())
  resizeObserver?.unobserve(entry.pre)
  entry.toolbar.remove()
  block.classList.remove('sprout-code-enhanced', 'sprout-code-wrap', 'sprout-code-folded', 'sprout-code-no-lines')
  if (entry.numbers) entry.numbers.querySelectorAll('.line-number').forEach(label => { label.style.removeProperty('height'); label.style.removeProperty('line-height') })
  blocks.delete(block)
}

function enhance() {
  if (!alive) return
  for (const [block, entry] of blocks) if (!block.isConnected) remove(block, entry)
  document.querySelectorAll('.vp-doc div[class*="language-"]').forEach(block => {
    if (blocks.has(block) || block.closest('.sprout-lab')) return
    const pre = block.querySelector(':scope > pre')
    const code = pre?.querySelector('code')
    if (!pre || !code) return
    const language = block.querySelector(':scope > span.lang')?.textContent || [...block.classList].find(c => c.startsWith('language-'))?.slice(9) || 'text'
    const count = code.textContent.replace(/\n$/, '').split('\n').length
    const toolbar = document.createElement('div')
    toolbar.className = 'sprout-code-toolbar'
    toolbar.setAttribute('role', 'group')
    toolbar.setAttribute('aria-label', `${language} 代码阅读工具`)
    const label = document.createElement('span')
    label.className = 'sprout-code-language'
    label.textContent = language
    toolbar.append(label)
    const counter = document.createElement('span')
    counter.className = 'sprout-code-count'
    counter.textContent = `${count} 行`
    toolbar.append(counter)
    const entry = { toolbar, pre, code, count, numbers: block.querySelector(':scope > .line-numbers-wrapper'), cleanup: [], fullscreen: null }
    const button = (action, text, description, callback, pressed = false) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'sprout-code-button'
      b.dataset.action = action
      b.textContent = text
      b.title = description
      b.setAttribute('aria-label', description)
      b.setAttribute('aria-pressed', String(pressed))
      b.addEventListener('click', callback)
      entry.cleanup.push(() => b.removeEventListener('click', callback))
      toolbar.append(b)
      return b
    }
    if (entry.numbers) button('lines', '行号', '显示或隐藏代码行号', event => {
      const hidden = block.classList.toggle('sprout-code-no-lines')
      event.currentTarget.setAttribute('aria-pressed', String(!hidden))
    }, true)
    button('wrap', '换行', '切换代码自动换行', event => {
      const wrapped = block.classList.toggle('sprout-code-wrap')
      event.currentTarget.setAttribute('aria-pressed', String(wrapped))
      requestAnimationFrame(() => { if (alive && block.isConnected) syncNumbers(block, entry) })
    })
    if (count > 20) button('fold', '折叠', '折叠或展开长代码', event => {
      const folded = block.classList.toggle('sprout-code-folded')
      event.currentTarget.setAttribute('aria-pressed', String(folded))
      event.currentTarget.textContent = folded ? '展开' : '折叠'
      pre.scrollTop = 0
    })
    entry.fullscreen = button('fullscreen', '放大', '放大代码块，按 Escape 退出', () => {
      if (block.classList.contains('sprout-code-fullscreen')) { exitFullscreen(block, true); return }
      for (const other of blocks.keys()) exitFullscreen(other)
      block.classList.add('sprout-code-fullscreen')
      block.setAttribute('role', 'dialog')
      block.setAttribute('aria-modal', 'true')
      block.setAttribute('aria-label', `${language} 代码块；按 Escape 退出放大`)
      document.documentElement.classList.add('sprout-code-open')
      entry.fullscreen.textContent = '还原'
      entry.fullscreen.setAttribute('aria-pressed', 'true')
      entry.fullscreen.focus()
      requestAnimationFrame(() => { if (alive && block.isConnected) syncNumbers(block, entry) })
    })
    const scroll = () => { if (entry.numbers) entry.numbers.scrollTop = pre.scrollTop }
    pre.addEventListener('scroll', scroll, { passive: true })
    entry.cleanup.push(() => pre.removeEventListener('scroll', scroll))
    // Keep the native copy → lang → pre sibling sequence intact. VitePress
    // 1.6 uses these siblings to read exactly the highlighted source text.
    block.prepend(toolbar)
    block.classList.add('sprout-code-enhanced')
    blocks.set(block, entry)
    resizeObserver?.observe(pre)
    syncNumbers(block, entry)
  })
}

onMounted(() => {
  alive = true
  document.addEventListener('keydown', keyboard)
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(entries => {
    for (const item of entries) {
      const block = item.target.parentElement
      const entry = blocks.get(block)
      if (entry && block.classList.contains('sprout-code-wrap')) syncNumbers(block, entry)
    }
  })
  observer = new MutationObserver(schedule)
  observer.observe(document.querySelector('.VPContent') || document.body, { childList: true, subtree: true })
  unwatch = watch(() => route.path, async () => {
    for (const block of blocks.keys()) exitFullscreen(block)
    await nextTick()
    schedule()
  }, { flush: 'post' })
  enhance()
})

onUnmounted(() => {
  alive = false
  unwatch?.()
  observer?.disconnect()
  resizeObserver?.disconnect()
  if (frame) cancelAnimationFrame(frame)
  document.removeEventListener('keydown', keyboard)
  for (const [block, entry] of blocks) remove(block, entry)
  document.documentElement.classList.remove('sprout-code-open')
})
</script>

<template><span class="sprout-code-enhancements" hidden aria-hidden="true"></span></template>

<style>
.vp-doc div[class*='language-'].sprout-code-enhanced { overflow:hidden; }
.sprout-code-toolbar { position:relative; z-index:5; display:flex; align-items:center; gap:8px; height:44px; min-height:44px; padding:0 54px 0 14px; border-bottom:1px solid var(--vp-c-divider); background:var(--vp-code-block-bg); color:var(--vp-c-text-2); font:12px/1.4 var(--vp-font-family-base); user-select:none; }
.line-numbers-mode > .sprout-code-toolbar { margin-left:-32px; }
.sprout-code-language { max-width:90px; overflow:hidden; text-overflow:ellipsis; font:11px/1.5 var(--vp-font-family-mono); text-transform:uppercase; letter-spacing:.4px; }
.sprout-code-count { margin-right:auto; font-size:11px; white-space:nowrap; }
.sprout-code-button { flex-shrink:0; padding:4px 5px; border:0; border-radius:4px; background:transparent; color:var(--vp-c-text-2); font:12px/1.4 var(--vp-font-family-base); cursor:pointer; }
.sprout-code-button:hover,.sprout-code-button[aria-pressed='true'] { background:var(--vp-c-brand-soft); color:var(--vp-c-brand-1); }
.sprout-code-button:focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:2px; }
.vp-doc .sprout-code-enhanced > span.lang { display:none; }
.vp-doc .sprout-code-enhanced > button.copy { z-index:6; top:5px; right:8px; width:34px; height:34px; opacity:1; }
.vp-doc .sprout-code-enhanced > pre { margin:0; }
.vp-doc .sprout-code-enhanced > .line-numbers-wrapper { top:44px; bottom:0; height:auto; overflow:hidden; }
.vp-doc .sprout-code-enhanced > .line-numbers-wrapper br { display:none; }
.vp-doc .sprout-code-enhanced > .line-numbers-wrapper .line-number { display:block; }
.vp-doc div.sprout-code-no-lines { padding-left:0 !important; }
.vp-doc .sprout-code-no-lines > .line-numbers-wrapper { display:none; }
.sprout-code-no-lines > .sprout-code-toolbar { margin-left:0; }
.vp-doc .sprout-code-wrap > pre { white-space:pre-wrap; }
.vp-doc .sprout-code-wrap > pre code { width:100%; white-space:pre-wrap; overflow-wrap:anywhere; }
.vp-doc .sprout-code-folded:not(.sprout-code-fullscreen) > pre { max-height:266px; overflow:hidden; }
.vp-doc .sprout-code-folded:not(.sprout-code-fullscreen)::after { content:''; position:absolute; z-index:2; right:0; bottom:0; left:0; height:24px; pointer-events:none; background:linear-gradient(transparent,var(--vp-code-block-bg)); }
html.sprout-code-open { overflow:hidden; }
.vp-doc div[class*='language-'].sprout-code-fullscreen { position:fixed !important; z-index:1000; inset:18px; display:flex; flex-direction:column; margin:0 !important; max-width:none; border:1px solid var(--vp-c-divider); border-radius:10px; box-shadow:0 0 0 100vmax rgb(0 0 0 / 45%); }
.vp-doc .sprout-code-fullscreen > pre { flex:1; min-height:0; max-height:none !important; overflow:auto !important; }
.vp-doc .sprout-code-fullscreen > .line-numbers-wrapper { height:calc(100% - 44px); }
@media(max-width:640px) {
  .sprout-code-toolbar { gap:5px; padding-left:10px; padding-right:46px; }
  .sprout-code-language { max-width:70px; margin-right:auto; font-size:10px; }
  .sprout-code-count { display:none; }
  .sprout-code-button { padding:4px; font-size:11px; }
  .vp-doc .sprout-code-enhanced > button.copy { right:6px; }
  .vp-doc div[class*='language-'].sprout-code-fullscreen { inset:8px; }
}
@media print {
  .sprout-code-toolbar,.sprout-code-enhanced > button.copy { display:none !important; }
  .vp-doc .sprout-code-folded > pre { max-height:none !important; }
  .vp-doc .sprout-code-enhanced > .line-numbers-wrapper { top:0; }
}
</style>
