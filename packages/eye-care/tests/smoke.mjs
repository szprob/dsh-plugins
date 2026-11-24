/**
 * 本地冒烟测试：在 Node 里用一个假的模块加载器 + 假 ctx 跑 client.js，
 * 验证 apply 会注册设置行、开关能挂/撤 token 覆盖层、卸载会清理。
 * 不是浏览器验证，只覆盖插件自身的逻辑分支。
 */
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/** 极简 React 替身，够 useSyncExternalStore 的组件树用。 */
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useSyncExternalStore: (subscribe, get) => get(),
}

const store = new Map()
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
}

let registered = null
let localeDict = null
let layer = null
let layerApplied = 0
let layerRemoved = 0
const effects = []

const theme = {
  overrideTokens(source, tokens) {
    layer = { source, tokens }
    layerApplied += 1
    return () => { layerRemoved += 1; layer = null }
  },
}

const slots = {
  inject(slotName, cb) { return cb() },
  register(options, component) { registered = { options, component }; return () => {} },
}

const ctx = {
  effect(fn, label) {
    const dispose = fn()
    effects.push({ label, dispose })
    return dispose
  },
  locale: { register(ns, dicts) { localeDict = { ns, dicts } } },
  slots,
  inject(deps, callback) {
    callback({ theme, effect: ctx.effect, slots })
  },
}

let bundle = null
globalThis.window = {
  __ModuleLoader__: { load(def) { bundle = def } },
}

/** 极简 DOM 替身：只够 installStyles 记录它插/拔了哪个 style 节点。 */
const head = {
  children: [],
  appendChild(node) { head.children.push(node); node.isConnected = true },
}
globalThis.document = {
  head,
  createElement: tag => ({
    tagName: tag,
    dataset: {},
    textContent: '',
    remove() { head.children = head.children.filter(child => child !== this) },
  }),
  querySelector: selector => head.children.find(child => `style[data-plugin-css="${child.dataset.pluginCss}"]` === selector) ?? null,
}

// eslint-disable-next-line no-new-func
new Function('window', 'localStorage', source)(globalThis.window, globalThis.localStorage)

const exported = bundle.factory(() => React)
console.log('bundle id:', bundle.id)
console.log('inject:', exported.inject)

exported.apply(ctx)

console.log('locale ns:', localeDict?.ns, 'langs:', Object.keys(localeDict?.dicts ?? {}))
console.log('slot:', registered?.options.name, '| id:', registered?.options.id, '| order:', registered?.options.order)
console.log('layer applied at start:', layerApplied)

const face = registered.options.inject()
console.log('initial enabled:', face.getEnabled())

let notified = 0
const unsubscribe = face.subscribe(() => { notified += 1 })

face.setEnabled(true)
console.log('after on → enabled:', face.getEnabled(), '| layer:', layer?.source, '| tokens:', Object.keys(layer?.tokens ?? {}).length, '| stored:', store.get('dsh.eye-care.enabled'))
face.setEnabled(true)
console.log('idempotent on → applied count:', layerApplied, '| notified:', notified)

face.setEnabled(false)
console.log('after off → enabled:', face.getEnabled(), '| layer removed:', layerRemoved, '| stored:', store.get('dsh.eye-care.enabled'))

unsubscribe()
face.setEnabled(true)
console.log('after unsubscribe → notified:', notified)

// 检查每个 token 都是 {light, dark} 对，且没有裸字符串
const capturedTokens = layer.tokens
const bad = Object.entries(layer.tokens).filter(([, v]) => typeof v !== 'object' || typeof v.light !== 'string' || typeof v.dark !== 'string')
console.log('malformed tokens:', bad.length)
const shiki = Object.keys(layer.tokens).filter(k => k.startsWith('--shiki-')).length
const statics = Object.keys(layer.tokens).filter(k => k.startsWith('--dsw-static-')).length
const aliases = Object.keys(layer.tokens).filter(k => k.startsWith('--dsw-alias-') || k.startsWith('--dsw-specific-') || k.startsWith('--dsw-menu-')).length
console.log('token mix — static:', statics, '| alias:', aliases, '| shiki:', shiki, '| total:', Object.keys(layer.tokens).length)

for (const { dispose } of effects.reverse()) if (typeof dispose === 'function') dispose()
console.log('after dispose → layer removed:', layerRemoved)

// ── token 名校验 ────────────────────────────────────────────────────────────
// 这层覆盖是按名字写进宿主的 CSS 变量的，名字写错不会报错、只会静默失效。
// 所以拿宿主真实定义的 token 名做一次交集校验：每个覆盖名都必须存在。
const hostCss = readFileSync(new URL('./host-tokens.css', import.meta.url), 'utf8')
const known = new Set([...hostCss.matchAll(/(--(?:dsw|dsh|shiki)-[a-z0-9-]+)\s*:/g)].map(m => m[1]))
const unknown = Object.keys(capturedTokens).filter(name => !known.has(name))
console.log('host tokens known:', known.size)
console.log('unknown token names:', unknown.length, unknown.slice(0, 5))
if (unknown.length > 0) process.exitCode = 1
