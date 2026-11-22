# 词库说明 / Dataset

本目录保存「拾词」使用的雅思词汇数据。

## 文件

| 文件 | 大小 | 说明 |
|---|---|---|
| `word-atlas.json` | 8,099,728 字节 | 7,298 个词条的结构化数据 |

## 来源与授权

- 来源项目：[designfuchen/word-atlas](https://github.com/designfuchen/word-atlas)（词光 Word Atlas）
- 内容许可：**CC BY 4.0**，署名 **Word Atlas contributors**
  （<https://creativecommons.org/licenses/by/4.0/>）
- 本文件与上游 `data/word-atlas.json` **逐字节一致**，未做任何修改：
  - git blob SHA-1：`2b3ee149764b183d9b05a65f1594af557fb5899f`
  - SHA-256：`e4e3410809047711cd2a25fccafcebb46124ce1eeb98829dc12de0335de71234`
  - 核对时间：2026-11-22
- 修改说明与免责声明见仓库根目录 `CONTENT_LICENSE.md`。

## 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 词条唯一 id（小写，用于插画/音频文件名） |
| `w` | string | 单词拼写 |
| `uk` / `us` | string | 英音 / 美音音标（IPA） |
| `senses` | array | 义项：`{ pos, zh, en }`（词性、中文释义、英文释义） |
| `ex` | array | 两条例句：`{ en, zh }`；第 1 条为日常句，第 2 条为雅思语境长句 |
| `col` | string[] | 常用搭配，格式 `英文｜中文` |
| `fam` | string[] | 词族（派生词） |
| `syn` / `ant` | string[] | 同义词 / 反义词 |
| `tip` | string | 考点或用法提示 |
| `cefr` | string | CEFR 等级 `A1`–`C2` |
| `topic` | string | 19 个话题之一（education、work、technology…） |
| `note` | string | 备注（多数为空） |

统计：A1 785 / A2 1,039 / B1 1,465 / B2 2,127 / C1 1,608 / C2 274；
19 个话题合计 7,298 词。

## 重新生成运行时数据

前端不直接读取 JSON，而是由脚本生成 `web/js/data.js`（仓库中忽略，构建时自动生成）：

```powershell
node tools/prepare_data.mjs
# 可选：node tools/prepare_data.mjs --input data/word-atlas.json --out web/js/data.js
```

插画需要单独获取（已随仓库提交在 `web/assets/words/`；若缺失可重新抓取）：

```powershell
node tools/fetch_media.mjs --concurrency 12
```

插画同样来自上游（CC BY 4.0），详见 `CONTENT_LICENSE.md`。
