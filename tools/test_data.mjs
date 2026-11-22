#!/usr/bin/env node
/**
 * 校验生成的 data.js：词条数量、字段完整性、话题/难度分布、插图齐备情况。
 *   node tools/test_data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dataFile = path.join(root, 'web', 'js', 'data.js');
if (!fs.existsSync(dataFile)) {
  console.error('缺少 web/js/data.js，先运行 node tools/prepare_data.mjs');
  process.exit(1);
}

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataFile, 'utf8'), sandbox, { filename: 'data.js' });
const META = sandbox.window.ATLAS_META;
const WORDS = sandbox.window.WORDS;

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name + (extra ? '  [' + extra + ']' : ''));
  } else {
    fail++;
    console.error('  ✗ ' + name + (extra ? '  [' + extra + ']' : ''));
  }
}

console.log('DATA');
ok('ATLAS_META 存在', !!META);
ok('词条 7298', WORDS.length === 7298, String(WORDS.length));
ok('meta.count 与数组一致', META.count === WORDS.length);
ok('19 个话题', META.topics.length === 19);
ok('CEFR 六档', META.cefr.length === 6 && META.cefr[0] === 'A1' && META.cefr[5] === 'C2');

const ids = new Set();
let badField = 0;
let emptySense = 0;
let missingExample = 0;
let topicMiss = 0;
const byTopic = {};
const byCefr = {};
const fields = ['w', 'uk', 'us', 'senses', 'ex', 'col', 'fam', 'syn', 'ant', 'tip', 'cefr', 'topic', 'note', 'id'];
for (const w of WORDS) {
  for (const f of fields) if (!(f in w)) badField++;
  if (ids.has(w.id)) badField++;
  ids.add(w.id);
  if (!w.senses || !w.senses.length) emptySense++;
  if (!w.ex || w.ex.length < 2) missingExample++;
  if (!META.topics.some((t) => t.key === w.topic)) topicMiss++;
  byTopic[w.topic] = (byTopic[w.topic] || 0) + 1;
  byCefr[w.cefr] = (byCefr[w.cefr] || 0) + 1;
}
ok('字段齐全且 id 唯一', badField === 0, 'issues=' + badField);
ok('每个词都有释义', emptySense === 0);
ok('每个词都有 2 条例句', missingExample === 0);
ok('话题都在元数据里', topicMiss === 0);
ok('CEFR 分布与源数据一致', JSON.stringify(byCefr) === JSON.stringify({ A1: 785, A2: 1039, B1: 1465, B2: 2127, C1: 1608, C2: 274 }), JSON.stringify(byCefr));
ok('话题合计等于词数', Object.values(byTopic).reduce((a, b) => a + b, 0) === 7298);
ok('话题词数写入元数据', META.topics.every((t) => t.count === byTopic[t.key]), META.topics.map((t) => t.key + ':' + t.count).join(' '));

// 插图
const imgDir = path.join(root, 'web', 'assets', 'words');
const files = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).filter((f) => f.endsWith('.webp')) : [];
const missing = WORDS.filter((w) => !files.includes(w.id + '.webp'));
ok('插图数量', files.length === 7298, files.length + ' 张');
ok('每个词都有插图', missing.length === 0, missing.length ? '缺 ' + missing.length + ' 个，例如 ' + missing.slice(0, 3).map((w) => w.id).join(',') : '');
const tiny = files.filter((f) => fs.statSync(path.join(imgDir, f)).size < 500);
ok('插图文件非空', tiny.length === 0, '异常 ' + tiny.length + ' 张');

// 字体
for (const f of ['fraunces-latin.woff2', 'source-serif-4-latin.woff2', 'atkinson-latin.woff2']) {
  const p = path.join(root, 'web', 'assets', 'fonts', f);
  ok('字体 ' + f, fs.existsSync(p) && fs.statSync(p).size > 1000);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
