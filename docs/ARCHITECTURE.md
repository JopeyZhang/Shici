# 技术说明 / Architecture

本文档说明「拾词」的技术选型、数据流与关键实现，便于二次开发。

## 1. 总体架构

```
┌────────────────────────── APK（零权限、离线） ──────────────────────────┐
│                                                                          │
│  MainActivity (Java)                                                     │
│   ├─ WebView  →  file:///android_asset/index.html                        │
│   ├─ AndroidStore（@JavascriptInterface）                                │
│   │    ├─ SharedPreferences 读写学习进度                                  │
│   │    ├─ TextToSpeech 英文发音（en-GB / en-US，多引擎回退）              │
│   │    ├─ SAF 导出/导入进度（ACTION_CREATE_DOCUMENT / OPEN_DOCUMENT）     │
│   │    └─ 主题/状态栏、Toast、返回键                                      │
│   └─ 返回键 → window.__appBack() → 关弹层 / 退子页 / 最小化               │
│                                                                          │
│  assets/                                                                 │
│   ├─ index.html、css/app.css、js/{app,fsrs,store}.js                     │
│   ├─ js/data.js（构建时由词库生成，6.4MB）                                │
│   ├─ assets/words/*.webp（7,298 张 256px 插画）                           │
│   ├─ assets/fonts/*.woff2（拉丁子集）                                     │
│   └─ licenses/（CC BY 4.0、OFL 1.1、第三方声明）                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- 前端是**零依赖原生 JS**（无 React/Vue、无构建步骤、无 npm 运行时依赖），
  直接 `<script>` 加载，兼容 `file://` 与旧版 WebView。
- 没有服务端、没有账号、没有网络请求；APK 不申请 `INTERNET` 权限。

## 2. 数据流

```
data/word-atlas.json (7,298 词, CC BY 4.0)
        │  tools/prepare_data.mjs（校验 + 生成）
        ▼
web/js/data.js  →  window.WORDS + window.ATLAS_META
        │  app.js 启动时建索引
        ▼
byId（按 id 查词）/ 话题表 / CEFR 顺序
        │
        ├─ 图鉴：19 话题过滤 + CEFR/状态筛选 + 中英文搜索 + 增量列表
        ├─ 词详情：插画 + 释义 + 例句 + 搭配 + 同反义 + 提示
        └─ 学习/复习/练习：生成卡片与题目，评分写回 FSRS
```

- 词库按 CEFR 由易到难排列（同级内打散话题）；`startCefr` 决定学习范围。
- 列表用滚动分页（每批 40 条），避免一次渲染 7,298 个节点。
- 插画按 `assets/words/<id>.webp` 惰性加载，缺失时显示首字母占位。

## 3. 本地存储

唯一存储键：`progress.v1`（JSON 字符串），由 `store.js` 统一读写：

- 优先走 `window.AndroidStore`（SharedPreferences）；
- 桌面浏览器预览时降级到 `localStorage`；
- 都不可用时退回内存（仅本次会话有效）。

```jsonc
{
  "v": 1,
  "updatedAt": 1795339611548,
  "cards": {                    // FSRS 卡片，按词条 id
    "library": {
      "id": "library",
      "state": "review",        // new | learning | review
      "due": 1795609791266,     // 下次到期时间戳(ms)
      "s": 3.1262,              // stability（天）
      "d": 5.0,                 // difficulty 1–10
      "reps": 1,
      "lapses": 0,
      "last": 1795339611548,
      "ivl": 3
    }
  },
  "seen": { "library": { "firstSeen": 0, "lastSeen": 0 } },
  "favorites": ["library"],
  "stats": {
    "streak": 1, "lastDay": "2026-11-22",
    "days": { "2026-11-22": 1 },
    "reviews": 43, "learned": 12,
    "reviewDay": "2026-11-22", "reviewsToday": 43
  },
  "settings": {
    "onboarded": true,
    "examDate": "2027-02-20",
    "targetBand": 6.5,
    "dailyNew": 20,
    "startCefr": "A1",
    "order": "level",           // level | topic
    "theme": "paper",           // paper | starlight | aurora
    "wordSize": "m",            // s | m | l
    "accent": "uk",             // uk | us
    "dailyReviewCap": 100
  }
}
```

写入做 220ms 防抖；`pagehide` 与清空/导入时立即落盘。清空进度会先取消未落盘的定时写入，
避免旧状态覆盖默认值。

## 4. FSRS 调度（`web/js/fsrs.js`）

- 采用 FSRS-4.5 公开默认权重（17 个常量），纯函数、无 DOM 依赖，可在 Node 下直接测试。
- 可提取度：`R(t,S) = (1 + FACTOR·t/S)^DECAY`，`DECAY=-0.5`，目标留存 0.9。
- 评分 1–4：忘记 / 模糊 / 记得 / 简单；新词首评决定 10 分钟、1 天或 3 天后的首次复习。
- 忘记会重置为短间隔（10 分钟）并累计 lapse；成功后稳定度增长，间隔上限 3 年。
- 到期判定：`state !== "new" && due <= now`；「已掌握」定义为稳定度 ≥ 21 天。

## 5. 练习出题

- 范围：已学词；不足 8 个时从当前 CEFR 范围抽 600 词。
- 4 选 1 干扰项优先同话题，其次同 CEFR，去重且排除同一 id；拼写题不生成选项。
- 答错不自动跳题；错题 4 题后重排，但同一词最多重排一次（避免题量膨胀）。
- 答题结果映射为 FSRS 评分：对 → 记得(3)，错 → 忘记(1)。

## 6. Android 壳要点

- WebView：JS、DOM Storage、file access 全开，禁缩放，`useWideViewPort=true`，
  `mediaPlaybackRequiresUserGesture=false`。
- **TTS**：Android 11+ 需要在 Manifest 声明
  `<queries><intent><action android:name="android.intent.action.TTS_SERVICE"/></intent></queries>`，
  否则 `TextToSpeech` 初始化会直接返回 `-1`。初始化按「默认引擎 → iFlytek → Google → Samsung」回退。
- **导入导出**：`ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`，无权限、无需 FileProvider；
  导入读取后在 UI 线程 `evaluateJavascript("window.__onImported(...)")`。
- **返回键**：JS 返回 `handled` 或 `exit`，根页面时 `moveTaskToBack(true)` 最小化。
- **主题**：JS 通过桥调用 `setTheme()`，原生同步状态栏/导航栏颜色与图标明暗。

## 7. 构建流水线

`build.ps1`（Windows）不依赖 Gradle，直接使用 SDK build-tools：

```
prepare_data.mjs  → 图标(Pillow) → aapt2 compile → aapt2 link -A web
                 → javac(JDK17)  → d8 → 追加 classes.dex → zipalign → apksigner
```

- 复用本机 SDK build-tools 34 与 JDK 17；路径可用 `ANDROID_SDK_ROOT` / `JAVA_HOME` 覆盖。
- 签名密码从 `$env:SHICI_KS_PASS` 读取，仓库不包含 keystore。
- APK 约 74MB（插画 69.8MB 占大头），产物不提交到 Git，Release 单独上传。

## 8. 取舍与限制

- **为什么用 WebView**：本机没有 Android Studio/Gradle，WebView + 原生 Java 壳可用
  aapt2/javac/d8 直接出签名 APK；同时能最大程度复刻参考站点的排版与主题。
- **为什么 256px 插画**：512px 全量约 200MB+，256px 把 APK 控制在 74MB。
- **为什么用系统 TTS**：打包英/美真人音频约 130MB；TTS 零素材成本，代价是依赖系统语音引擎。
- **为什么零依赖前端**：离线、可审计、不受 npm 供应链影响，旧 WebView 也能跑。
- 未实现：3D 星图、环境音、云同步、多设备合并、应用商店分发。
