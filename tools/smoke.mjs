#!/usr/bin/env node
/**
 * 静态冒烟检查：读取 headless Edge 生成的 DOM 快照（out/preview/dom-*.html），
 * 检查每页关键内容是否渲染，以及是否有渲染错误卡片。
 *   node tools/smoke.mjs            # 先运行 tools/preview.ps1
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = path.join(root, 'out', 'preview');

const CASES = [
  {
    file: 'dom-today.html',
    must: ['今日', '图鉴', '复习', '练习', '我的', '个新词待学', '开始学习', '复习到期', '今日任务', '连续天数', '先定一个小目标'],
  },
  {
    file: 'dom-atlas.html',
    must: ['图鉴', '19 个话题', '搜单词或中文释义', '教育', '职场', '科技', '历史', 'education'],
  },
  {
    file: 'dom-atlas-topic-education.html',
    must: ['教育', '全部难度', '未学', '已学', '收藏', 'A1', 'word-row'],
  },
  {
    file: 'dom-word-library.html',
    must: ['library', '图书馆；藏书室', '日常例句', '雅思例句', '常用搭配', '新词', 'detail-hero'],
  },
  {
    file: 'dom-word-strong.html',
    must: ['strong', '强壮的', '同义 / 反义', 'powerful', 'weak', '词族', 'strength'],
  },
  {
    file: 'dom-study.html',
    must: ['显示释义', 'library', '1/20', 'study-card', 'A1'],
  },
  {
    file: 'dom-review.html',
    must: ['复习', '张等待复习', '累计复习', '开始复习'],
  },
  {
    file: 'dom-practice.html',
    must: ['练习', '看中文选英文', '看英文选中文', '听音选词', '看图选词', '拼写'],
  },
  {
    file: 'dom-practice-zh2en.html',
    must: ['选出对应的英文单词', 'option', '1/10'],
  },
  {
    file: 'dom-me.html',
    must: ['我的', '学习计划', '考试日期', '每日新词', '学习起点', '主题', '导出学习进度', '清空全部进度', 'CC BY 4.0', '没有账号'],
  },
];

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

if (!fs.existsSync(dir)) {
  console.error('缺少 out/preview，先运行 tools/preview.ps1');
  process.exit(1);
}

console.log('SMOKE');
for (const c of CASES) {
  const p = path.join(dir, c.file);
  if (!fs.existsSync(p)) {
    ok(c.file, false, 'missing');
    continue;
  }
  const html = fs.readFileSync(p, 'utf8');
  const missing = c.must.filter((m) => !html.includes(m));
  ok(c.file + ' 关键内容', missing.length === 0, missing.length ? '缺: ' + missing.join(',') : 'ok');
  ok(c.file + ' 无渲染错误', !html.includes('页面渲染出错'));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
