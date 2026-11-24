/**
 * 护眼模式 · 浏览器半边。
 *
 * 做法：不新建主题，而是往 `ctx.theme.overrideTokens()` 叠一层 token 覆盖。
 * 覆盖分两类：
 *  1. `--dsw-static-*` 原始色阶（neutral / neutral-bluish / blue / deepseek / red）
 *     —— 设计系统里所有 `--dsw-alias-*` 都是对这些原始色的 `var()` 引用，
 *     换掉色阶就等于整体换肤，且不会漏掉某个别名。
 *  2. 值写成字面量的别名（边框透明度、遮罩、菜单表面、代码高亮、JSON 树、
 *     diff 底色）—— 它们不引用色阶，必须逐个给。
 *
 * 每个 token 都带 { light, dark } 一对：`--dsw-static-*` 只定义一次、两套
 * 配色共用同一条亮度阶梯，所以那一对填相同值；字面量别名两套配色不同，
 * 各给各的。切换浅色/深色时覆盖层自动跟随，不需要重挂。
 *
 * 开关状态按浏览器存在 localStorage，与宿主保存「对话宽度」等界面偏好的方式一致。
 */

window.__ModuleLoader__.load({
  id: 'dsh-eye-care',
  factory(require) {
    // 所有常量都放在工厂内：bundle 作为全局脚本执行，顶层 const 重复声明会抛错。
    /** 开关在 localStorage 里的键。 */
    const STORAGE_KEY = 'dsh.eye-care.enabled'

    /** 设置行的文案命名空间。 */
    const NS = 'settings.eyeCare'

    /** token 覆盖层的来源标识，同时用于撤层。 */
    const SOURCE = 'dsh-eye-care'

    /** 同值一对：`--dsw-static-*` 这类两套配色共用的色阶。 */
    const pair = value => ({ light: value, dark: value })

/**
 * 中性色阶：把宿主的 00→1000 阶梯整条换成暖纸色阶梯。
 * 索引越小越亮、越大越暗，与宿主一致，所以浅色配色取亮端当背景、
 * 深色配色取暗端当背景，两端都落在合适的位置。
 *
 * 两套前缀的档位并不相同（宿主 `neutral-*` 没有 55/60/75/90/310，
 * `neutral-bluish-*` 没有 250/550），所以按前缀各给一份，避免写出不存在的名字。
 */

/** `--dsw-static-neutral-*` 的档位（与宿主定义一致）。 */
const NEUTRAL_RAMP = {
  '00': '#f8f2e3',
  '50': '#f4ecda',
  '100': '#e4dbc2',
  '150': '#e0d6bc',
  '200': '#d9ceb4',
  '250': '#d4c8ad',
  '300': '#cabda2',
  '400': '#a99d86',
  '500': '#93876f',
  '550': '#776b57',
  '600': '#6a6051',
  '700': '#5c5243',
  '800': '#332e26',
  '850': '#2a261e',
  '900': '#191611',
  '1000': '#0c0a06',
}

/** `--dsw-static-neutral-bluish-*` 的档位（与宿主定义一致）。 */
const BLUISH_RAMP = {
  '00': '#f8f2e3',
  '50': '#f4ecda',
  '55': '#f2ead6',
  '60': '#efe7d2',
  '75': '#ebe3cd',
  '90': '#e8dfc8',
  '100': '#e4dbc2',
  '150': '#e0d6bc',
  '200': '#d9ceb4',
  '300': '#cabda2',
  '310': '#c5b89d',
  '400': '#a99d86',
  '500': '#93876f',
  '600': '#877a64',
  '700': '#5c5243',
  '750': '#40392d',
  '800': '#332e26',
  '850': '#2a261e',
  '875': '#211e17',
  '900': '#191611',
  '950': '#13100b',
  '1000': '#0c0a06',
}

/** 蓝色阶：把蓝换成琥珀，链接、轨迹强调色、图表色随之变暖。 */
const BLUE_RAMP = {
  '50': '#fcf4e6',
  '50p': '#fbf2e2',
  '75': '#f7ebd7',
  '100': '#f3e3c9',
  '300': '#e0c08c',
  '400': '#d6a25e',
  '450': '#cb9038',
  '500': '#b0741c',
  '600': '#8f5412',
  '800': '#6a3e0a',
  '900': '#3c2b13',
  '950': '#2a2010',
}

/** DeepSeek 强调色阶：用户气泡、发送按钮、主色。 */
const DEEPSEEK_RAMP = {
  '50': '#f6e5c4',
  '100': '#f0dcb2',
  '200': '#e8cd96',
  '300': '#dcb877',
  '400': '#dca862',
  '450': '#cc9140',
  '500': '#8f5412',
  '600': '#7a4a12',
  '700-delete': '#6b4315',
  '800': '#4a3a22',
  '900': '#33291b',
}

/**
 * 语义红色阶：只把浅色配色用的 red-600 压深一档。
 * 纸色背景比纯白暗，原值在纸面上只有 4.0:1，压深后回到 4.7:1（宿主白底 4.5:1），
 * 错误文字和删除行标记不至于变糊。深色配色用的 red-400 原值已经够亮，不动。
 */
const RED_RAMP = {
  '600': '#d80a0a',
}

/** 由色阶表生成 `--dsw-static-*` 覆盖项。 */
function rampTokens(prefixes, ramp) {
  const tokens = {}
  for (const prefix of prefixes) {
    for (const [index, value] of Object.entries(ramp)) {
      tokens[`--dsw-static-${prefix}-${index}`] = pair(value)
    }
  }
  return tokens
}

/** 字面量别名：两套配色分别取值。 */
const LITERAL_TOKENS = {
  // 色阶只定义一次、两套配色共用，但下面两个别名在深浅配色里需要相反的明度：
  // 警示文字在浅色纸面上要深、在深色纸面上要亮；按钮上的文字要压在填充色上。
  // 因此不靠色阶，直接按配色给别名。
  '--dsw-alias-state-warn-label': { light: '#8a5a10', dark: '#e0a35c' },
  '--dsw-alias-label-on-color': { light: '#f8f2e3', dark: '#13100b' },

  // 边框：冷黑透明改成暖褐透明，纸面上不出现灰蓝的边。
  '--dsw-alias-border-l1': { light: 'rgba(92, 74, 46, 0.06)', dark: 'rgba(255, 244, 224, 0.07)' },
  '--dsw-alias-border-l2': { light: 'rgba(92, 74, 46, 0.12)', dark: 'rgba(255, 244, 224, 0.13)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(92, 74, 46, 0.12)', dark: 'rgba(255, 244, 224, 0.07)' },
  '--dsw-alias-border-l3': { light: 'rgba(92, 74, 46, 0.16)', dark: 'rgba(255, 244, 224, 0.17)' },
  '--dsw-alias-border-l4': { light: 'rgba(92, 74, 46, 0.22)', dark: 'rgba(255, 244, 224, 0.21)' },
  '--dsw-alias-border-inverted': { light: 'rgba(92, 74, 46, 0)', dark: 'rgba(255, 244, 224, 0.06)' },
  '--dsw-alias-border-inverted2': { light: 'rgba(92, 74, 46, 0)', dark: 'rgba(255, 244, 224, 0.08)' },

  // 遮罩与骨架屏：暖黑，弹窗压暗后不发青。
  '--dsw-alias-bg-mask-1': { light: 'rgba(58, 47, 30, 0.24)', dark: 'rgba(0, 0, 0, 0.5)' },
  '--dsw-alias-bg-mask-2': { light: 'rgba(58, 47, 30, 0.12)', dark: 'rgba(0, 0, 0, 0.2)' },
  '--dsw-alias-bg-mask-3': { light: 'rgba(58, 47, 30, 0.48)', dark: 'rgba(0, 0, 0, 0.48)' },
  '--dsw-alias-bg-mask-drop': { light: 'rgba(255, 252, 243, 0.7)', dark: 'rgba(38, 32, 22, 0.7)' },
  '--dsw-alias-bg-skeleton': { light: 'rgba(92, 74, 46, 0.05)', dark: 'rgba(255, 244, 224, 0.07)' },

  // 交互态洗色：冷蓝灰 → 暖褐。
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(92, 74, 46, 0.07)', dark: 'rgba(255, 244, 224, 0.08)' },
  '--dsw-alias-interactive-bg-active': { light: 'rgba(92, 74, 46, 0.11)', dark: 'rgba(255, 244, 224, 0.14)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(92, 74, 46, 0.15)', dark: 'rgba(255, 244, 224, 0.22)' },

  // 菜单表面（半透明）与分组标题；macOS 上另有几乎不透明的 `--dsw-specific-menu`。
  '--dsw-menu-surface-fill': { light: 'rgba(252, 247, 236, 0.72)', dark: 'rgba(48, 42, 34, 0.66)' },
  '--dsw-specific-menu': { light: 'rgba(248, 243, 232, 0.94)', dark: 'rgba(48, 42, 34, 0.94)' },
  '--dsw-alias-menu-group-header-fill': { light: 'rgba(247, 241, 226, 0.94)', dark: 'rgba(53, 48, 42, 0.94)' },

  // 工具条浮层压在图片/预览上，保持深色中性，只把色相拉暖。
  '--dsw-alias-button-tool-bar-fill': { light: 'rgba(84, 74, 58, 0.5)', dark: 'rgba(84, 74, 58, 0.5)' },
  '--dsw-alias-button-tool-bar-hover': { light: 'rgba(84, 74, 58, 0.6)', dark: 'rgba(84, 74, 58, 0.6)' },
  '--dsw-alias-button-tool-bar-fill-invisible': { light: 'rgba(31, 27, 20, 0.36)', dark: 'rgba(31, 27, 20, 0.36)' },

  // 右栏高亮闪色。
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: '#b0741c', dark: '#cc9140' },

  // JSON 树。
  '--dsw-alias-json-tree-icon': { light: '#5c5243', dark: '#9a8f7c' },
  '--dsw-alias-json-tree-keyword': { light: '#6b4315', dark: '#e0b273' },
  '--dsw-alias-json-tree-number': { light: '#6b4315', dark: '#e0b273' },
  '--dsw-alias-json-tree-property': { light: '#7a3560', dark: '#d9a0bd' },
  '--dsw-alias-json-tree-string': { light: '#a8321f', dark: '#f0a08d' },
  '--dsw-alias-json-tree-punctuation': { light: '#332e26', dark: '#cfc3ad' },
  '--dsw-alias-json-tree-hover': { light: 'rgba(92, 74, 46, 0.05)', dark: 'rgba(255, 244, 224, 0.06)' },

  // 文件对比：红绿语义保留，底色与标记去蓝。
  '--dsw-alias-file-diff-added-bg': { light: '#e6f0de', dark: '#23301f' },
  '--dsw-alias-file-diff-added-gutter': { light: '#edf5e7', dark: '#1a2517' },
  '--dsw-alias-file-diff-added-marker': { light: '#2e7d3a', dark: '#57b96b' },
  '--dsw-alias-file-diff-deleted-bg': { light: '#f7e3dc', dark: '#3a2620' },
  '--dsw-alias-file-diff-deleted-gutter': { light: '#fbeee8', dark: '#2a1a15' },
  '--dsw-alias-file-diff-deleted-marker': { light: '#a33a2e', dark: '#e2665a' },

  // 代码高亮（shiki 的 css-variables 主题读这组变量）。
  '--shiki-token-constant': { light: '#8a5a18', dark: '#e0b273' },
  '--shiki-token-string': { light: '#4e7a32', dark: '#a8c97e' },
  '--shiki-token-comment': { light: '#8a7d68', dark: '#9a8f7c' },
  '--shiki-token-keyword': { light: '#a63a57', dark: '#e3a0a6' },
  '--shiki-token-parameter': { light: '#b4561a', dark: '#e5a45e' },
  '--shiki-token-function': { light: '#6d4a8f', dark: '#c0a8dc' },
  '--shiki-token-string-expression': { light: '#46702c', dark: '#b4d494' },
  '--shiki-token-punctuation': { light: '#574d3e', dark: '#cfc3ad' },
  '--shiki-token-link': { light: '#2f6f52', dark: '#7fc2a6' },
}

/** 完整覆盖层：色阶 + 字面量别名。 */
const TOKENS = {
  ...rampTokens(['neutral'], NEUTRAL_RAMP),
  ...rampTokens(['neutral-bluish'], BLUISH_RAMP),
  ...rampTokens(['blue'], BLUE_RAMP),
  ...rampTokens(['deepseek'], DEEPSEEK_RAMP),
  ...rampTokens(['red'], RED_RAMP),
  ...LITERAL_TOKENS,
}

/** 设置行样式；只消费 `--dsw-*` / `--dsh-*` token，跟随宿主主题。 */
const CSS = `
.eyecare-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.eyecare-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 48px;
}
@media (max-width: 767px) {
  html:not([data-windows-titlebar]):not([data-platform='darwin']) .eyecare-text {
    padding-right: 16px;
  }
}
.eyecare-title {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.eyecare-desc {
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.eyecare-switch {
  box-sizing: border-box;
  position: relative;
  flex: 0 0 auto;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--dsw-alias-border-l3);
  cursor: pointer;
}
.eyecare-switch[aria-checked='true'] {
  background: var(--dsw-alias-brand-primary);
}
.eyecare-switch:disabled {
  opacity: 0.5;
  cursor: default;
}
.eyecare-switch:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.eyecare-thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-label-primary-foreground);
  transition: transform 0.12s var(--ds-ease-in-out, ease);
}
.eyecare-switch[aria-checked='false'] .eyecare-thumb {
  background: var(--dsw-alias-switch-thumb);
}
.eyecare-switch[aria-checked='true'] .eyecare-thumb {
  transform: translate(16px);
}
@media (prefers-reduced-motion: reduce) {
  .eyecare-switch,
  .eyecare-thumb {
    transition: none;
  }
}
`

/** 中英文案；其余语言回落到英语。 */
const ZH = {
  title: '护眼模式',
  description: '暖色纸感配色，降低蓝光观感；叠加在当前外观之上，开关状态按浏览器保存',
  pending: '正在应用配色…',
}

const EN = {
  title: 'Eye-care mode',
  description: 'Warm paper palette with less blue light; layered over the current appearance, saved per browser',
  pending: 'Applying the palette…',
}

/** 读取本浏览器的开关状态。 */
function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** 保存本浏览器的开关状态。 */
function writeEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // 隐私模式下 localStorage 可能抛错，开关在本页仍然生效。
  }
}

/** 把样式表挂进文档，返回移除函数。 */
function installStyles() {
  const tagId = `${SOURCE}/row.css`
  const selector = `style[data-plugin-css="${tagId}"]`
  if (document.querySelector(selector) !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = SOURCE
  tag.dataset.pluginCss = tagId
  tag.textContent = CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

    const React = require('react')

    /** 设置行：标题 + 说明 + 开关。 */
    function EyeCareRow({ t, getEnabled, getReady, subscribe, setEnabled }) {
      const enabled = React.useSyncExternalStore(subscribe, getEnabled, getEnabled)
      const ready = React.useSyncExternalStore(subscribe, getReady, getReady)
      return React.createElement('div', { className: 'eyecare-row' },
        React.createElement('div', { className: 'eyecare-text' },
          React.createElement('div', { className: 'eyecare-title' }, t('title')),
          React.createElement('div', { className: 'eyecare-desc' }, t('description'))),
        React.createElement('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': enabled,
          'aria-label': t('title'),
          'aria-busy': !ready,
          title: ready ? undefined : t('pending'),
          className: 'eyecare-switch',
          disabled: !ready,
          onClick: () => { setEnabled(!enabled) },
        }, React.createElement('span', { className: 'eyecare-thumb', 'aria-hidden': 'true' })))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'eye-care: dictionaries')
        ctx.effect(() => installStyles(), 'eye-care: row styles')

        let enabled = readEnabled()
        /** 已挂上的覆盖层撤除函数；未开启或主题服务未就绪时为 null。 */
        let removeLayer = null
        /** 主题服务到位后填入；到位前开关只改状态，不改颜色。 */
        let theme = null
        const listeners = new Set()
        const notify = () => { for (const listener of listeners) listener() }

        const syncLayer = () => {
          if (theme === null) return
          if (enabled && removeLayer === null) {
            removeLayer = theme.overrideTokens(SOURCE, TOKENS)
          } else if (!enabled && removeLayer !== null) {
            removeLayer()
            removeLayer = null
          }
        }

        // 设置行独立于主题服务注册：即使主题插件缺席，开关也看得见、点得动。
        const face = {
          getEnabled: () => enabled,
          getReady: () => theme !== null,
          subscribe: (listener) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
          },
          setEnabled: (next) => {
            const value = next === true
            if (value === enabled) return
            enabled = value
            writeEnabled(value)
            syncLayer()
            notify()
          },
        }

        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: 'eye-care',
          order: 13,
          locale: NS,
          inject: () => face,
        }, EyeCareRow))

        // theme 由 ui-theme 提供；等它就绪再挂色层，并跟随它的生命周期。
        ctx.inject(['theme'], (scope) => {
          theme = scope.theme
          syncLayer()
          notify()
          scope.effect(() => () => {
            if (removeLayer !== null) removeLayer()
            removeLayer = null
            theme = null
            notify()
          }, 'eye-care: token layer')
        })
      },
    }
  },
})
