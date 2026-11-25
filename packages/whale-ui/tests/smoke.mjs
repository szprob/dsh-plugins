/**
 * 本地冒烟测试：用假的模块加载器 + 假 ctx / DOM 跑 client.js，
 * 验证 bundle 声明正确、apply 会注册四个插槽、卸载会移除注入的 style。
 * 不是浏览器验证，只覆盖插件自身的可加载性与注册分支。
 */
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/** 极简 React 替身。 */
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useRef: () => ({ current: null }),
  useEffect: () => {},
}

const registered = []
const slots = {
  inject(slotName, cb) {
    const r = cb()
    if (r && typeof r.next === 'function') for (const _ of r) {}
    return () => {}
  },
  register(options, component) { registered.push({ slot: options.name, id: options.id, component }); return () => {} },
}

let insertedStyle = null
let removed = false
globalThis.document = {
  createElement(tag) { return { tag, textContent: '', remove() { removed = true } } },
  head: { appendChild(node) { insertedStyle = node } },
  body: { appendChild() {} },
}
globalThis.window = { __ModuleLoader__: { load(def) { bundle = def } } }
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}

const effects = []
const ctx = {
  slots,
  get() { return { startSession() {} } },
  effect(fn) { const d = fn(); effects.push(d); return d },
}

// 执行浏览器 bundle 注册（factory 里再实例化模块）
const loadCall = {}
globalThis.window.__ModuleLoader__.load = def => { loadCall.def = def }
new Function(source)()

const def = loadCall.def
if (def === undefined) throw new Error('client.js 没有调用 window.__ModuleLoader__.load')
if (def.id !== 'dsh-whale-ui') throw new Error(`module id 错误: ${def.id}`)
if (typeof def.factory !== 'function') throw new Error('bundle 没有 factory')

const mod = def.factory(name => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})
if (typeof mod.apply !== 'function') throw new Error('模块没有 apply')

mod.apply(ctx)

const expected = ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark', 'conversation.input.right']
for (const slot of expected) {
  if (!registered.some(r => r.slot === slot)) throw new Error(`没有注册插槽: ${slot}`)
}
if (insertedStyle === null) throw new Error('没有注入 style')

for (const d of effects) if (typeof d === 'function') await d()
if (!removed) throw new Error('卸载时没有移除 style')

console.log('whale-ui smoke ok: 4 slots registered, style cleaned up')
