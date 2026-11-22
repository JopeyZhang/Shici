# 内容授权 / Content License

本仓库中的**学习内容**（词库、插画）来自开源项目
[designfuchen/word-atlas](https://github.com/designfuchen/word-atlas)（词光 Word Atlas），
按其内容授权以 **Creative Commons Attribution 4.0 International（CC BY 4.0）** 提供。

- 许可证全文：[`licenses/CC-BY-4.0.txt`](licenses/CC-BY-4.0.txt)
- 许可证官方地址：<https://creativecommons.org/licenses/by/4.0/>

## 1. 署名 / Attribution

词库与插画：**Word Atlas contributors — CC BY 4.0**
（<https://creativecommons.org/licenses/by/4.0/>，来源 <https://github.com/designfuchen/word-atlas>）

## 2. 覆盖范围 / Covered material

| 路径 | 内容 | 说明 |
|---|---|---|
| `data/word-atlas.json` | 7,298 个词条的结构化词库 | 与上游仓库中的同名文件**逐字节一致**（git blob `2b3ee149764b183d9b05a65f1594af557fb5899f`，8,099,728 字节；SHA-256 `e4e3410809047711cd2a25fccafcebb46124ce1eeb98829dc12de0335de71234`） |
| `web/assets/words/*.webp` | 7,298 张 256×256 插画缩略图 | 取自上游公开发布的 `atlas/thumb/<id>.webp` |
| `web/js/data.js` | 由上述词库生成的运行时数据 | 仅做 JSON → JavaScript 的格式转换，字段内容未改动（生成物，未提交到仓库） |

**未包含**：上游的发音/例句音频、品牌素材（logo、og-card 等）、源代码。本项目的代码由
JopeyZhang 独立实现，仅参考上游的公开界面设计，未复制其源码。

## 3. 修改说明 / Indication of modifications

依 CC BY 4.0 第 3(a)(1)(B) 条，说明对本授权材料的修改：

- 词库 JSON：**原样使用，未修改**；构建时转换为 `data.js` 属于格式转换，字段与内容不变。
- 插画：使用上游已发布的 256px WebP 缩略图，**未做裁剪、调色或再生成**。
- 未使用上游音频，因此不涉及声音模型、声音身份或人格权。

## 4. 免责声明 / Disclaimer

- 词库、例句、译文与插画由上游使用 AI 模型按项目规范生成，经自动校验但**未逐条人工审校**，
  按“现状”提供，不对准确性、完整性或适用性作任何担保。
- 本项目仅用于个人语言学习；因使用本内容造成的任何损失，作者不承担责任。
- 本项目**不是**官方雅思（IELTS）词表，与雅思考试主办方（British Council、IDP、Cambridge
  University Press & Assessment）无任何关联，也未获其授权或背书。

## 5. 商标 / Trademarks

CC BY 4.0 与 MIT 许可均**不授予商标权**。

- “Word Atlas”“词光”是其维护者的名称/标识，本项目仅在说明数据来源时作事实性引用，
  **与上游维护者无隶属关系，未获其背书**。
- “IELTS”“雅思”是相关考试机构的商标，本项目仅作描述性使用。
- 本项目的名称“拾词”、图标与界面实现归本项目作者所有。

## 6. 再分发要求 / If you redistribute

如果你分发本项目的 APK 或素材，请保留：

1. 上述署名（Word Atlas contributors）、许可证名称与链接；
2. 本文件的修改说明与免责声明；
3. 字体许可说明（见 `THIRD_PARTY_NOTICES.md`）。

不得对本授权内容附加额外法律限制或技术措施（CC BY 4.0 第 2(a)(5)(B) 条）。
