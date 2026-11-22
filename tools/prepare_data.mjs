#!/usr/bin/env node
/**
 * 把 word-atlas.json 生成前端可直接 <script> 加载的 data.js。
 *
 * 用法:
 *   node tools/prepare_data.mjs [--input data/word-atlas.json] [--out web/js/data.js]
 *
 * 产物:
 *   window.ATLAS_META = { count, version, license, source, cefr, topics:[{key,zh,count,color}] }
 *   window.WORDS      = 原始词条数组（字段完整保留）
 *
 * 校验失败会以非 0 退出，避免把坏数据打进 APK。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function argOf(name, fallback) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const input = path.resolve(argOf('input', path.join(root, 'data', 'word-atlas.json')));
const output = path.resolve(argOf('out', path.join(root, 'web', 'js', 'data.js')));

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// 19 个话题：中文名与配色取自线上词光 index.json + 同色系手调
const TOPICS = [
  ['education', '教育', '#c4573a'],
  ['work', '职场', '#a9713f'],
  ['technology', '科技', '#5f88a8'],
  ['science', '科学', '#4f7f8c'],
  ['environment', '环境', '#6a8c63'],
  ['health', '健康', '#b5535f'],
  ['society', '社会', '#8c6b4f'],
  ['government', '政法', '#6b6f8f'],
  ['economy', '经济', '#b8893a'],
  ['media', '媒体', '#9a6283'],
  ['arts', '艺术', '#b06a4e'],
  ['travel', '旅行', '#4f8a7d'],
  ['city', '城市', '#7a7f96'],
  ['nature', '自然', '#6f8f5a'],
  ['daily', '生活', '#9c7b4a'],
  ['emotion', '情感', '#a85f7a'],
  ['thinking', '思维', '#6d6f9c'],
  ['sport', '运动', '#c07a3c'],
  ['history', '历史', '#876a58'],
];

function fail(msg, extra) {
  console.error('[prepare_data] ✗ ' + msg);
  if (extra) console.error(extra);
  process.exit(1);
}

if (!fs.existsSync(input)) fail('找不到数据文件: ' + input);
let raw;
try {
  raw = fs.readFileSync(input, 'utf8');
} catch (e) {
  fail('读取失败: ' + e.message);
}
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

let words;
try {
  words = JSON.parse(raw);
} catch (e) {
  fail('JSON 解析失败: ' + e.message);
}
if (!Array.isArray(words)) fail('数据根节点必须是数组');
if (words.length < 7000) fail('词条数量异常: ' + words.length + '（预期 7298）');

const required = ['w', 'uk', 'us', 'senses', 'ex', 'col', 'fam', 'syn', 'ant', 'tip', 'cefr', 'topic', 'note', 'id'];
const topicKeys = new Set(TOPICS.map((t) => t[0]));
const ids = new Set();
const byTopic = {};
const byCefr = {};
const problems = [];
let noSense = 0;
let shortExamples = 0;
let unsafeId = 0;

for (let i = 0; i < words.length; i++) {
  const w = words[i];
  if (!w || typeof w !== 'object' || Array.isArray(w)) {
    problems.push(`#${i} 不是对象`);
    continue;
  }
  for (const k of required) {
    if (!(k in w)) problems.push(`#${i} 缺字段 ${k}`);
  }
  if (typeof w.id !== 'string' || !w.id) problems.push(`#${i} id 非法`);
  else {
    if (ids.has(w.id)) problems.push(`重复 id: ${w.id}`);
    ids.add(w.id);
    if (!/^[a-z0-9][a-z0-9'\-]*$/.test(w.id)) unsafeId++;
  }
  if (!CEFR.includes(w.cefr)) problems.push(`#${i} cefr 非法: ${w.cefr}`);
  if (!topicKeys.has(w.topic)) problems.push(`#${i} topic 非法: ${w.topic}`);
  if (!Array.isArray(w.senses) || w.senses.length === 0) noSense++;
  if (!Array.isArray(w.ex) || w.ex.length < 2) shortExamples++;
  for (const s of w.senses || []) {
    if (typeof s.zh !== 'string' || !s.zh) problems.push(`${w.id} 释义缺中文`);
  }
  byTopic[w.topic] = (byTopic[w.topic] || 0) + 1;
  byCefr[w.cefr] = (byCefr[w.cefr] || 0) + 1;
}

if (problems.length) {
  fail(`数据校验失败，共 ${problems.length} 个问题`, problems.slice(0, 20).join('\n'));
}

const meta = {
  count: words.length,
  version: 1,
  dataset: 'word-atlas-open',
  license: 'CC BY 4.0',
  attribution: 'Word Atlas contributors',
  source: 'https://github.com/designfuchen/word-atlas',
  generatedAt: new Date().toISOString(),
  cefr: CEFR,
  topics: TOPICS.map(([key, zh, color]) => ({ key, zh, color, count: byTopic[key] || 0 })),
};

fs.mkdirSync(path.dirname(output), { recursive: true });
const banner = [
  '/* 由 tools/prepare_data.mjs 自动生成，请勿手改。 */',
  '/* 数据来源：Word Atlas (CC BY 4.0, Word Atlas contributors) */',
].join('\n');
const body =
  banner +
  '\nwindow.ATLAS_META = ' +
  JSON.stringify(meta) +
  ';\nwindow.WORDS = ' +
  JSON.stringify(words) +
  ';\n';
fs.writeFileSync(output, body, 'utf8');

const sizeMb = (fs.statSync(output).size / 1048576).toFixed(2);
console.log('[prepare_data] ✓ 词条 ' + words.length + '，输出 ' + path.relative(root, output) + '（' + sizeMb + ' MB）');
console.log(
  '[prepare_data] CEFR: ' +
    CEFR.map((c) => c + '=' + (byCefr[c] || 0)).join(' ') +
    '，话题 ' +
    meta.topics.length +
    ' 个，无释义 ' +
    noSense +
    '，例句不足 2 条 ' +
    shortExamples +
    '，含特殊 id ' +
    unsafeId
);
