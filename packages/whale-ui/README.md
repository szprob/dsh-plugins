# dsh-whale-ui · 鲸鱼娘界面

把 DeepSeek Harness Web 界面里几个显眼的 DSH 元素换成会动的鲸鱼娘：

| 位置 | 效果 |
|---|---|
| 左上角侧栏品牌 / 新会话 | 鲸鱼娘（点它就是新建会话）＋「探索未至之境」标题 |
| 新会话首页 | 两只不同动作的鲸鱼娘夹着标题 |
| 右下角发送 / 停止按钮 | 鲸鱼娘；空闲待机，生成中变成「认真工作」动作 |

四处用的是**不同的透明 WebM 序列帧动画**（浏览器原生解码，角色本身在动，不是整张图平移）。所有素材内联在 `client.js` 里，所以该文件较大（约 3 MB）；不依赖外部网络资源。发送、停止、新建会话仍是 DSH 原来的功能，本插件只做外观替换，不替换按钮本体。

## 安装

加入本仓库的索引源后，在插件市场搜「鲸鱼娘」安装；或：

```sh
dsh plugin --profile desktop add "github:szprob/dsh-plugins#path:/packages/whale-ui"
```

装完重启 DSH 并刷新页面（Cmd/Ctrl + Shift + R 强刷清缓存）。

## 配置

无须配置。遵循 `prefers-reduced-motion`：系统开启「减少动态效果」时，品牌位的动画会停止。

## 素材署名

插件代码：MIT。

鲸鱼娘立绘与透明动画来自以下社区开源项目，均为**非商用**素材，引用时保留原署名：

- 立绘原图：[fornarwhal/deepseek-whale-girl-icon](https://github.com/fornarwhal/deepseek-whale-girl-icon)，CC BY-NC-SA 4.0
  - 角色形象：上善无形（原创 OC「溟月」）
  - DeepSeek 元素二创：ZipZipPipe
  - 去伪影修复：QYQCAMIAO
- 透明动画序列：[yanzwzz/dsh-whale-girl-pet](https://github.com/yanzwzz/dsh-whale-girl-pet)，MIT（代码）/ 素材见其仓库说明

本插件仅作个人非商业用途，保留上述署名与许可声明。
