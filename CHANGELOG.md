# 更新日志 / Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [1.0.0] - 2026-11-22

首个公开版本。

### 新增

- 7,298 个雅思词汇 / 19 个话题 / 6 级 CEFR 的离线词库与 256px 插画。
- 五个页面：今日、图鉴、复习、练习、我的。
- 词详情：UK/US 音标与系统 TTS 发音、全部释义、日常 + 雅思例句（关键词高亮）、
  搭配、词族、同反义词跳转、考点提示、收藏、左右滑动切词。
- FSRS-4.5 间隔复习：四档评分、下次间隔预览、到期队列。
- 五类练习：看中文选英文、看英文选中文、听音选词、看图选词、拼写；
  错题不自动跳题、同一词最多重排一次。
- 备考日期选择器、每日新词量、学习起点、学习顺序。
- 纸感 / 星光 / 极光三套主题，字号切换。
- 本地进度导出 / 导入（SAF）、清空进度。
- 原生 Android 壳：无权限、离线、返回键处理、TTS、状态栏配色。

### 真机验证

- OPPO PCLM10 / Android 12 / 1080×2400：安装、五页、学习评分、练习、
  导出导入、主题切换、清空进度、杀进程后进度保留、系统 TTS 均通过。

### 合规

- 词库与插画来自 [Word Atlas](https://github.com/designfuchen/word-atlas)，
  CC BY 4.0，署名 Word Atlas contributors，详见 `CONTENT_LICENSE.md`。
- 字体 Fraunces / Source Serif 4 / Atkinson Hyperlegible Next 为 SIL OFL 1.1，
  详见 `THIRD_PARTY_NOTICES.md`。
- 未打包上游音频与品牌素材。
