# 第三方组件与素材声明 / Third-Party Notices

本项目的代码以 MIT 许可发布（见 `LICENSE`）。以下第三方内容按其各自许可证使用。

## 1. Word Atlas（词光）

- 项目：<https://github.com/designfuchen/word-atlas>
- 在线站点：<https://0xlei.tech/words/>
- 使用内容：`data/word-atlas.json`（7,298 词条）、`web/assets/words/*.webp`（256px 插画）
- 内容许可：**CC BY 4.0**，署名 **Word Atlas contributors**
  - 许可证：<https://creativecommons.org/licenses/by/4.0/>
  - 全文：`licenses/CC-BY-4.0.txt`
- 上游代码许可：**MIT License**（Copyright (c) 2026 Word Atlas contributors）
  - 本项目未复制上游源代码，仅参考其公开界面设计；上游代码许可在此列出以说明来源。
- 修改说明与免责声明：见 `CONTENT_LICENSE.md`。
- 未使用：上游音频、品牌 logo、og-card 等品牌素材。

## 2. 字体 / Fonts

本项目打包了以下字体的 **latin 子集 WOFF2**（取自上游构建产物），均以
**SIL Open Font License 1.1** 授权。许可证全文见 `licenses/OFL-1.1.txt`。

| 字体 | 用途 | 版权/项目 |
|---|---|---|
| Fraunces | 英文词头、标题衬线 | Copyright Undercase Type；<https://github.com/undercasetype/Fraunces> |
| Source Serif 4 | 英文例句衬线 | Copyright Adobe；<https://github.com/adobe-fonts/source-serif> |
| Atkinson Hyperlegible Next | 界面西文与数字 | Copyright Braille Institute of America；<https://github.com/googlefonts/atkinson-hyperlegible-next> |

OFL 1.1 要求：再分发字体时须附带本许可证与版权声明；字体不得单独售卖。
本项目未对字体字形做修改，仅使用上游发布的 Web 子集文件。

中文字体使用操作系统自带字体（Noto Sans CJK / 厂商字体），不随本项目分发。

## 3. 构建工具（不随仓库/APK 分发）

- Android SDK Build-Tools 34（aapt2、d8、zipalign、apksigner）— Apache License 2.0
- OpenJDK 17（构建时使用）
- Pillow、Node.js（仅构建与测试脚本使用）

这些工具不包含在本仓库的发布物中。

## 4. 运行时依赖

Android App 与网页端均无第三方运行时依赖（无 npm 包、无 JS 框架、无网络请求）。

如有遗漏或版权异议，请通过仓库 Issue 联系，我们会及时更正。
