# 发布到 DSH 插件市场

DSH 没有「中央官方市场」。插件市场上架 = **把插件发布成一个可被索引的源**，两条路可以同时走：

| 路径 | 谁看得见 | 需要什么 |
|---|---|---|
| A. 自建索引（format 1） | 任何知道 URL 的人：插件 → 发现 → 索引源 | 一个公开仓库 + 一个 `index.json` |
| B. 收录进社区精选列表 | dsh-market、dshopen、awesome 站点等所有读该列表的客户端 | 一个 PR 到 awesome-dsh-plugin |

两条路不冲突：先进 A 立刻能用，再进 B 拿到自然流量。

---

## A. 自建索引（5 分钟）

### 1. 建公开仓库并推上去

```sh
cd ~/projects/dsh-eye-care
git remote add origin git@github.com:szprob/dsh-eye-care.git
git push -u origin main
```

仓库根必须有 `package.json` 的 `dsh.bundle` 声明和同级的 `cordis.patch.yml` —— 这两样已经有了。

### 2. 给仓库加 `dsh-plugin` topic

GitHub 仓库页 → About 右侧齿轮 → Topics 填 `dsh-plugin`。社区列表的 CI 和多数市场靠这个 topic 发现插件。

### 3. 生成索引

```sh
npm run index -- --repo https://github.com/szprob/dsh-eye-care
```

产出 `index.json`，里面钉住当前 HEAD 的 40 位 commit。脚本会用宿主同一份校验器（`@deepseek-ai/dsh-plugin-market-index`）自检，字段写错会直接报 JSON 路径。

**每次发版都要重跑**：commit 变了，索引里的 `source.commit` 必须跟着变，否则别人装到的还是旧代码。

### 4. 让索引能被公网读到

三个选项，按推荐顺序：

| 方式 | URL 形态 | 说明 |
|---|---|---|
| jsDelivr 读 GitHub | `https://cdn.jsdelivr.net/gh/szprob/dsh-eye-care@main/index.json` | 推荐。国内可达，走 CDN。首次发布后约 10 分钟生效 |
| raw.githubusercontent | `https://raw.githubusercontent.com/szprob/dsh-eye-care/main/index.json` | 备选，国内不稳 |
| 发到 npm | `https://cdn.jsdelivr.net/npm/dsh-eye-care/index.json` | 需要把 index.json 一起发布 |

DSH 给索引源的时间是 15 秒，GitHub Pages 在国内经常超时，所以优先用 jsDelivr。

### 5. 在 DSH 里添加

**插件 → 发现（Discover）→ 索引源（Index sources）→ 添加**，粘贴上面的 URL。缓存 10 分钟，刚推上去要等一会儿。

> 当前这台机器上 `plugin-market` 已挂载但 `indexes` 是空的，所以「发现」页现在是空状态——添加索引源之后才会有内容。

---

## B. 收录进社区精选列表

这是拿到自然流量的唯一途径：**dsh-market**（12,000+ 插件那个市场）、dshopen、awesome-dsh-plugin.com 都读同一份数据。

### 提交方式

一个 PR，只加一个文件：`data/plugins/<owner>__<repo>.yml`

```yaml
url: https://github.com/szprob/dsh-eye-care
name: szprob/dsh-eye-care
category: theme
description:
  en: 'Warm paper palette for the Web UI: one switch in Settings → General, with separate warm tones for light and dark themes.'
  zh: 'Web 界面的暖色纸感配色：设置 → 通用设置里一个开关，浅色与深色各一套暖色板。'
```

注意：
- `description.en` 里的 `: ` 必须给整个值加引号，否则 YAML 会解析失败。
- `category: theme` 会把插件放进 dsh-market 的 **主题 Tab**，用户可一键安装、切换、卸载。不要放 `ui`。
- 一个 PR 最多 3 条。

### 会被检查的硬条件

| 条件 | 当前状态 |
|---|---|
| `package.json` 声明 `dsh.bundle` | ✅ 已有 |
| 仓库有真实可用代码 | ✅ |
| 仓库创建满 1 天 | ⚠️ 新仓库要等，CI 自动检查 |
| 加了 `dsh-plugin` topic | ⚠️ 待加 |
| 描述属实、无营销词 | ✅ 已按实际功能写 |
| 依赖指向原作者 | ✅ 无第三方依赖 |

### 建议先补的两样

**截图**（可选但推荐）：在 `package.json` 旁边放 `screenshots.json`，列 1–8 张图：

```json
["assets/screenshot-1.png"]
```

路径相对该文件，不能跳出插件目录。不写的话市场会从 README 抽图。

**npm 发布**（可选）：发到 npm 后市场能显示下载量，且安装免构建授权。包的 `repository` 字段必须指回同一个仓库。

```sh
npm publish --access public
```

发布后按 awesome 文档的提醒核对：`registry.npmjs.org/dsh-eye-care` 里 `dist-tags.latest` 等于你的版本，**并且** `dist.tarball` 能下载，再提交——新包名在 publish 返回那一刻不一定真能装。

---

## 发新版的完整流程

```sh
cd ~/projects/dsh-eye-care
# 1. 改代码，跑测试
npm test

# 2. 升版本
npm version patch          # 或 minor / major

# 3. 提交并推送
git push && git push --tags

# 4. 重新生成索引（commit 变了）
npm run index -- --repo https://github.com/szprob/dsh-eye-care

# 5. 提交索引
git add index.json && git commit -m "chore: 索引指向 v$(node -p 'require("./package.json").version')" && git push

# 6.（可选）发 npm
npm publish --access public
```

索引更新后，等 jsDelivr 缓存（约 10 分钟）+ DSH 的 `cacheTtlMs`（10 分钟），「发现」页会显示「可更新」。

---

## 本机现状

- 插件以 **link 方式**装在 desktop profile（`dsh-eye-care` → `~/projects/dsh-eye-care`），改代码即时生效，**不需要**走上面的发布流程。
- 走发布流程是为了让别人能装，以及让自己换机器时能用索引装回来。
- 市场索引源当前为空；发布完成后按 A.5 添加即可。
