/**
 * 生成 DSH 插件市场的索引文件（format 1）。
 *
 * 用法：
 *   DSH_INSTALL_DIR=<dsh 安装目录> node scripts/make-index.mjs [--out index.json]
 *
 * 这个仓库是 monorepo：根包没有 `dsh.bundle`，每个插件是 `packages/<name>` 下的
 * 独立子包。脚本遍历 `packages/*`，为每个声明了 `dsh.bundle` 的子包生成一条索引
 * 条目，`source` 用的是 git 类型并钉住当前 HEAD 的 40 位 commit——市场只认精确
 * commit，不接受分支或 tag，这样别人装到的就是这一份代码。
 *
 * 生成后会用宿主同一份校验器（@deepseek-ai/dsh-plugin-market-index）自检；
 * 名字或字段写错会直接报出 JSON 路径，而不是产出一个读者打不开的索引。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_DIR = join(ROOT, 'packages')

/** 仓库的 GitHub 地址；索引里的 git source 和 repository 都用它。 */
const REPO = 'https://github.com/szprob/dsh-plugins'

/** 分类声明：索引里 type 的 id → 显示名。 */
const CATEGORIES = {
  appearance: { title: { en: 'Appearance', zh: '外观' } },
}

/** 解析 `--key value` 形式的参数。 */
function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    if (!key?.startsWith('--')) throw new Error(`无法识别的参数：${key}`)
    args[key.slice(2)] = argv[i + 1]
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const outPath = resolve(ROOT, args.out ?? 'index.json')

/** git HEAD 的完整 commit；市场要求 40 位小写十六进制。 */
function headCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
}

/** HEAD 的提交时间（Unix 秒），用作 publishTimestamp。 */
function headTimestamp() {
  return Number(execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim())
}

/** 读一个子包的 locale 文件里的 meta，读不到返回 undefined。 */
function meta(pkgDir, language) {
  const file = join(pkgDir, 'locale', `${language}.json`)
  if (!existsSync(file)) return undefined
  return JSON.parse(readFileSync(file, 'utf8')).meta
}

/** 把图标内联成 data URL；超过市场 32 KiB 上限直接报错，避免生成装不上的索引。 */
function inlineIcon(pkgDir) {
  const file = join(pkgDir, 'icon.svg')
  if (!existsSync(file)) return undefined
  if (statSync(file).size > 32 * 1024) throw new Error(`${file} 超过市场 32 KiB 的内联图标上限，请先压缩`)
  return `data:image/svg+xml;base64,${readFileSync(file).toString('base64')}`
}

/** 中英双语文本；英文是市场的必备回退。 */
function localized(zhText, enText, fallback) {
  if (typeof zhText === 'string' && typeof enText === 'string') return { en: enText, zh: zhText }
  return enText ?? zhText ?? fallback
}

const commit = headCommit()
const timestamp = headTimestamp()
const plugins = []
const skipped = []

for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const pkgDir = join(PACKAGES_DIR, entry.name)
  const manifestPath = join(pkgDir, 'package.json')
  if (!existsSync(manifestPath)) continue

  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
  // 只收真正的插件：必须声明 dsh.bundle。
  if (pkg.dsh?.bundle === undefined) {
    skipped.push(`${entry.name}（没有 dsh.bundle）`)
    continue
  }
  if (pkg.private === true) {
    skipped.push(`${entry.name}（private: true，市场装不上）`)
    continue
  }

  const zh = meta(pkgDir, 'zh')
  const en = meta(pkgDir, 'en')
  const relativeDir = `packages/${entry.name}`

  const plugin = {
    name: pkg.name,
    title: localized(zh?.title, en?.title, pkg.name),
    description: localized(zh?.description, en?.description, pkg.description),
    author: pkg.author ?? 'songze',
    homepage: pkg.homepage ?? `${REPO}/tree/main/${relativeDir}`,
    repository: { url: REPO, directory: relativeDir },
    metadata: {
      category: pkg.dsh?.market?.category ?? 'appearance',
      keywords: Array.isArray(pkg.keywords) ? pkg.keywords : ['dsh-plugin'],
      labels: [],
      sortKeys: {},
    },
    versions: [{
      version: pkg.version,
      publishTimestamp: timestamp,
      source: { type: 'git', url: REPO, commit, path: relativeDir },
      engines: pkg.engines?.dsh === undefined ? {} : { dsh: pkg.engines.dsh },
    }],
  }
  const icon = inlineIcon(pkgDir)
  if (icon !== undefined) plugin.icon = icon
  plugins.push(plugin)
}

if (plugins.length === 0) throw new Error('packages/ 下没有可收录的插件（都没有声明 dsh.bundle）')

const index = {
  format: 1,
  title: { en: 'songze DSH plugins', zh: 'songze 的 DSH 插件' },
  description: { en: 'Plugins for DeepSeek Harness.', zh: '自用的 DeepSeek Harness 插件。' },
  metadata: { categories: CATEGORIES },
  plugins,
}

// 用宿主同一份校验器自检。校验器在 dsh 安装目录里；没设 DSH_INSTALL_DIR 时
// 跳过自检并提示，不要让「没装 dsh 的机器上跑一下生成脚本」变成硬失败。
const validatorPath = process.env.DSH_INSTALL_DIR === undefined
  ? undefined
  : createRequire(join(process.env.DSH_INSTALL_DIR, 'package.json'))
    .resolve('@deepseek-ai/dsh-plugin-market-index')

if (validatorPath === undefined) {
  writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`)
  console.log(`写入 ${outPath}（未设置 DSH_INSTALL_DIR，跳过校验器自检）`)
  process.exit(0)
}

const { parseMarketIndex, marketInstallTarget } = await import(validatorPath)
const validated = parseMarketIndex(index, `${REPO}/raw/main/index.json`)
writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`)

console.log(`写入 ${outPath}`)
console.log(`  commit：${commit}`)
for (const plugin of validated.plugins) {
  const version = plugin.versions[0]
  const target = marketInstallTarget(plugin.name, version)
  console.log(`  ${plugin.name}@${version.version}`)
  console.log(`    安装：${target.spec}`)
}
if (skipped.length > 0) {
  console.log(`  跳过：${skipped.join('、')}`)
}
