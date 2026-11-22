# Shici · IELTS Vocabulary Atlas (Android)

An **offline** Android vocabulary app built on the open **Word Atlas** dataset:
7,298 IELTS-oriented words, 19 topics, 256px illustrations, bilingual examples,
FSRS spaced repetition and five practice modes. **No account, no login, no network,
no permissions.**

> [!IMPORTANT]
> This is a **third-party client**, based on the open dataset and illustrations of
> [designfuchen/word-atlas](https://github.com/designfuchen/word-atlas). It is **not**
> an official project of Word Atlas and is **not affiliated with or endorsed by** its
> maintainers. Vocabulary and illustrations are licensed **CC BY 4.0**, attribution
> **Word Atlas contributors**. The interface is inspired by the public upstream site;
> all code here is an independent implementation.

## Features

- 7,298 words / 19 topics / CEFR A1–C2, 14 fields per entry.
- Five tabs: Today, Atlas, Review, Practice, Me.
- Word detail: illustration, UK/US IPA + system TTS, senses, daily & IELTS examples,
  collocations, word family, synonyms/antonyms, exam tips, favourites, swipe navigation.
- FSRS-4.5 scheduling with four ratings and interval previews.
- Five quiz modes; wrong answers are retried after four questions (once per word).
- Themes (paper / starlight / aurora), font size, UK/US accent, progress export/import.

## Install

Download `shici-1.0.0.apk` (~74MB) from
[Releases](https://github.com/JopeyZhang/Shici/releases/latest), transfer it to your
phone and install (allow "install unknown apps"). Or:

```bash
adb install -r shici-1.0.0.apk
```

Android 6.0+ (minSdk 23), portrait, **zero permissions** — the APK does not even request
`INTERNET`. The official release is signed with a private key that is **not** in this
repository; builds you make yourself will have a different signature.

## Attribution & licenses

- Dataset: [`data/word-atlas.json`](data/word-atlas.json) — byte-identical to upstream
  (`git blob 2b3ee14…`, SHA-256 `e4e34108…`), **CC BY 4.0**, © **Word Atlas contributors**.
- Illustrations: `web/assets/words/*.webp` — 256px thumbnails published upstream,
  **CC BY 4.0**, same attribution. No audio or upstream brand assets are included.
- Modification note: dataset used as-is; no image edits; `data.js` is a format conversion.
- Code: **MIT** (see [LICENSE](LICENSE)); content is licensed separately in
  [CONTENT_LICENSE.md](CONTENT_LICENSE.md).
- Fonts: Fraunces, Source Serif 4, Atkinson Hyperlegible Next — **SIL OFL 1.1**
  (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).

> [!NOTE]
> Not an official IELTS word list; not affiliated with the IELTS partners.
> Content was generated with AI models upstream, is not proofread entry by entry,
> and is provided as-is without warranty.

## Privacy

No accounts, no telemetry, no network. Learning progress is stored only in the device's
`SharedPreferences`; export/import uses the Android system file picker.

## Build

Requires JDK 17 and Android SDK build-tools 34 / platform 34 (no Gradle):

```powershell
node tools/prepare_data.mjs
$env:SHICI_KS_PASS = "your-keystore-password"
powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

## Tests

```powershell
node tools/test_fsrs.mjs
node tools/test_data.mjs
```

## Credits

[designfuchen/word-atlas](https://github.com/designfuchen/word-atlas) for the dataset,
illustrations and design inspiration; the font authors; Android SDK Build-Tools,
OpenJDK, Pillow and Node.js for the toolchain.

中文说明：[README.md](README.md)
