# dsh-plugins

songze 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件集合。

这个仓库是一个 monorepo：根包不声明 `dsh.bundle`，每个插件是 `packages/` 下的独立子包，各自声明自己的 manifest，可以单独安装。

## 插件

| 包 | 在哪 | 说明 |
|---|---|---|
| [`dsh-eye-care`](packages/eye-care) | 设置 → 通用设置 → 护眼模式 | 暖色纸感配色，降低蓝光观感；浅色与深色各一套暖色板 |

## 安装

每个插件单独装，用 `path:` 指到子包：

```sh
# 护眼模式
dsh plugin --profile desktop add "github:szprob/dsh-plugins#path:/packages/eye-care"
```

装完刷新页面（多数情况下不用重启）即可在设置里看到它。

## 通过插件市场安装

这个仓库也提供一份 format 1 的插件索引。在 DSH 里打开 **插件 → 发现（Discover）→ 索引源（Index sources）**，添加：

```
https://cdn.jsdelivr.net/gh/szprob/dsh-plugins@main/index.json
```

索引由 `npm run index` 生成，里面每个版本都钉住了对应的 commit。

## 开发

```sh
npm run index    # 重新生成 index.json（发版后必须重跑）
npm test         # 跑所有插件的测试
```

新增一个插件：在 `packages/` 下建目录、声明 `dsh.bundle`、写 `cordis.patch.yml`，然后在 `scripts/make-index.mjs` 里登记它的索引条目。

发布流程见 [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## License

MIT
