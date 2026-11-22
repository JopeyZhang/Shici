#!/usr/bin/env node
/**
 * 下载词光图鉴的插图（默认 256px 缩略图，CC BY 4.0）。
 *
 *   node tools/fetch_media.mjs                 # 256px -> web/assets/words/<id>.webp
 *   node tools/fetch_media.mjs --kind img      # 512px
 *   node tools/fetch_media.mjs --limit 50      # 只下前 50 个（调试）
 *   node tools/fetch_media.mjs --concurrency 16
 *
 * 已存在的非空文件会被跳过，可随时中断重跑（断点续传）。
 * 结束写 tools/.media-report.json 记录缺失词条。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function argOf(name, fallback) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const kind = argOf('kind', 'thumb');
const concurrency = Math.max(1, Math.min(32, Number(argOf('concurrency', '12'))));
const limit = Number(argOf('limit', '0')) || 0;
const base = argOf('base', 'https://0xlei.tech/words/atlas');
const dataPath = path.join(root, 'data', 'word-atlas.json');
const outDir = path.join(root, 'web', 'assets', 'words');
const reportPath = path.join(root, 'tools', '.media-report.json');

if (!fs.existsSync(dataPath)) {
  console.error('[media] 缺少 ' + dataPath);
  process.exit(1);
}
const words = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
let ids = words.map((w) => w.id);
if (limit) ids = ids.slice(0, limit);
fs.mkdirSync(outDir, { recursive: true });

const ext = 'webp';
const kindPath = kind === 'img' ? 'img' : 'thumb';
const magicOk = (b) =>
  b && b.length > 20 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';

const started = Date.now();
let done = 0;
let skipped = 0;
let failed = 0;
let bytes = 0;
const missing = [];
const failures = [];

function log(msg) {
  const elapsed = (Date.now() - started) / 1000;
  const rate = done / Math.max(1, elapsed);
  const eta = rate > 0 ? Math.round((ids.length - done - skipped - failed) / rate) : 0;
  console.log(`[media] ${msg} | ${done}/${ids.length} 新增=${done} 跳过=${skipped} 失败=${failed} ${(bytes / 1048576).toFixed(1)}MB ${rate.toFixed(1)}f/s ETA ${eta}s`);
}

async function downloadOne(id) {
  const file = path.join(outDir, id + '.' + ext);
  try {
    const st = fs.statSync(file);
    if (st.size > 100) {
      skipped++;
      return;
    }
  } catch {}

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${base}/${kindPath}/${encodeURIComponent(id)}.${ext}`, {
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 404) {
        missing.push(id);
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!magicOk(buf)) throw new Error('内容不是 WebP（' + buf.length + 'B）');
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
      done++;
      bytes += buf.length;
      if ((done + skipped) % 250 === 0) log('下载中');
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  failed++;
  failures.push({ id, error: String(lastErr && lastErr.message) });
  if (failures.length <= 10) console.warn('[media] 失败 ' + id + ': ' + (lastErr && lastErr.message));
}

async function worker(queue) {
  for (;;) {
    const id = queue.shift();
    if (id === undefined) return;
    await downloadOne(id);
  }
}

const queue = ids.slice();
log('开始，kind=' + kindPath + ' 并发=' + concurrency);
await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));

fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      kind: kindPath,
      total: ids.length,
      downloaded: done,
      skipped,
      failed,
      missing,
      failures,
      bytes,
      finishedAt: new Date().toISOString(),
    },
    null,
    2
  )
);

log('完成');
console.log(`[media] 新增 ${done}，跳过 ${skipped}，失败 ${failed}，缺失 ${missing.length}，共 ${(bytes / 1048576).toFixed(1)}MB，用时 ${Math.round((Date.now() - started) / 1000)}s`);
if (failed) process.exit(2);
