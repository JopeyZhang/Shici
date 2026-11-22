# 贡献指南 / Contributing

感谢关注「拾词」。这是一个**纯离线**的安卓背词 App：原生 WebView 壳 + 零依赖前端，
词库与插画来自 [Word Atlas](https://github.com/designfuchen/word-atlas)（CC BY 4.0）。

## 提交 Issue 前

- 请先搜索已有 Issue，避免重复。
- Bug 请附：手机型号、Android 版本、App 版本、复现步骤、截图（如有）。
- 内容纠错请附：词条 id（如 `library`）、错误点、建议改法、来源依据。

## 开发环境

| 依赖 | 版本 |
|---|---|
| Node.js | ≥ 18（CI 用 20） |
| Python | ≥ 3.9 + Pillow（生成图标） |
| JDK | 17（构建 APK） |
| Android SDK | build-tools 34、platform 34（构建 APK） |

## 本地运行

```powershell
# 1. 生成运行时词库（生成物，不入库）
node tools/prepare_data.mjs

# 2. 直接用浏览器打开 web/index.html 预览（无需服务器）
# 3. 跑测试
node tools/test_fsrs.mjs
node tools/test_data.mjs
```

插画已随仓库提交在 `web/assets/words/`。如果缺失，可重新获取（需要网络）：

```powershell
node tools/fetch_media.mjs --concurrency 12
```

## 构建 APK

```powershell
$env:SHICI_KS_PASS = "你的 keystore 密码"   # 仓库不包含 keystore
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

SDK/JDK 会依次查找 `$env:ANDROID_SDK_ROOT`、`../jetwar-android/tools/sdk`、
`$env:JAVA_HOME`、PyCharm 自带 JBR。

## 代码约定

- 前端不使用框架、不引入 npm 运行时依赖，保持可离线、可直接 `file://` 打开。
- 兼容 Android 6+ 的旧 WebView：不使用 `?.`、`??`、ES module、`fetch` 加载数据。
- CSS 变量统一在 `web/css/app.css` 顶部；新增颜色请同时补暗色主题。
- 内联 SVG 必须显式设置宽高（旧 WebView 默认 300×150 会撑破布局）。
- 数据/FSRS 逻辑改动必须同步更新 `tools/test_*.mjs`。

## 提交 PR

1. Fork 后从 `main` 切分支，提交信息用中文或英文均可，建议 `feat:` / `fix:` / `docs:` 前缀。
2. 确保 `node tools/test_fsrs.mjs`、`node tools/test_data.mjs` 全绿。
3. 不要提交 `build/`、`out/`、`web/js/data.js`、keystore、任何 token 或密码。
4. 涉及第三方素材的改动，请同步更新 `THIRD_PARTY_NOTICES.md` 与 `CONTENT_LICENSE.md`。

## 许可

- 代码：MIT（见 `LICENSE`）
- 词库/插画：CC BY 4.0（Word Atlas contributors，见 `CONTENT_LICENSE.md`）
- 字体：SIL OFL 1.1（见 `THIRD_PARTY_NOTICES.md`）

提交 PR 即表示你同意以 MIT 许可贡献代码，并确认不会引入无授权的内容。
