#!/usr/bin/env node
/**
 * 下载参考站点使用的开源拉丁字体（OFL），只取 latin 子集，控制体积。
 * 中文交给系统字体，避免打包数 MB 的 CJK 分片。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const outDir = path.join(root, 'web', 'assets', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

const files = [
  ['source-serif-4-latin-standard-normal-BpEBLj1O.woff2', 'source-serif-4-latin.woff2'],
  ['fraunces-latin-opsz-normal-DihXLNYH.woff2', 'fraunces-latin.woff2'],
  ['atkinson-hyperlegible-next-latin-wght-normal-BcXVPD7q.woff2', 'atkinson-latin.woff2'],
];

for (const [remote, local] of files) {
  const dest = path.join(outDir, local);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log('[fonts] 已存在 ' + local);
    continue;
  }
  const res = await fetch('https://0xlei.tech/words/assets/' + remote, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(remote + ' HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(remote + ' 不是 woff2');
  fs.writeFileSync(dest, buf);
  console.log('[fonts] ' + local + ' ' + Math.round(buf.length / 1024) + 'KB');
}
