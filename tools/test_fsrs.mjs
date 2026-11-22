#!/usr/bin/env node
/**
 * FSRS 调度器单元测试（不依赖浏览器）。
 *   node tools/test_fsrs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
vm.runInThisContext(fs.readFileSync(path.join(root, 'web', 'js', 'fsrs.js'), 'utf8'));
const FSRS = globalThis.FSRS;
const DAY = 86400000;
const now = Date.UTC(2026, 0, 10, 8, 0, 0);

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

console.log('FSRS');
const fresh = FSRS.newCard('library');
ok('新卡初始状态为 new', fresh.state === 'new' && fresh.reps === 0);

const good = FSRS.review(fresh, 3, now);
ok('新卡「记得」进入 review', good.state === 'review' && good.reps === 1);
ok('新卡「记得」约 3 天后到期', Math.abs(good.due - (now + 3 * DAY)) < DAY, FSRS.formatInterval(good, now));
ok('新卡「记得」稳定度 = w[2]', Math.abs(good.s - FSRS.W[2]) < 1e-6);

const easy = FSRS.review(fresh, 4, now);
ok('新卡「简单」间隔长于「记得」', easy.ivl > good.ivl, easy.ivl + ' vs ' + good.ivl);

const lapse = FSRS.review(fresh, 1, now);
ok('新卡「忘记」进入 learning', lapse.state === 'learning');
ok('新卡「忘记」10 分钟后到期', Math.abs(lapse.due - (now + 600000)) < 1000);

// 已复习卡：四档间隔单调
const mature = { id: 'x', state: 'review', due: now, s: 20, d: 5, reps: 5, lapses: 0, last: now - 10 * DAY, ivl: 10 };
const intervals = [1, 2, 3, 4].map((g) => {
  const c = FSRS.review(mature, g, now);
  return c.ivl;
});
ok('四档间隔顺序 忘记 < 模糊 < 记得 < 简单', intervals[0] < intervals[1] && intervals[1] < intervals[2] && intervals[2] < intervals[3], intervals.join(' / '));
ok('「忘记」10 分钟内再来', FSRS.review(mature, 1, now).due <= now + 11 * 60000);

// 稳定度：失败下降、成功上升
const failed = FSRS.review(mature, 1, now);
ok('「忘记」降低稳定度', failed.s < mature.s, failed.s.toFixed(2) + ' < ' + mature.s);
ok('「忘记」累计 lapse', failed.lapses === 1);
const okCard = FSRS.review(mature, 3, now);
ok('「记得」提高稳定度', okCard.s > mature.s, okCard.s.toFixed(2) + ' > ' + mature.s);

// 到期判定
ok('到期卡 isDue', FSRS.isDue({ state: 'review', due: now - 1 }, now) === true);
ok('未到期卡 !isDue', FSRS.isDue({ state: 'review', due: now + DAY }, now) === false);
ok('新卡 !isDue', FSRS.isDue(FSRS.newCard('a'), now) === false);

// 可提取度随时间衰减
const r0 = FSRS.retrievability(10, 0);
const r5 = FSRS.retrievability(10, 5);
const r30 = FSRS.retrievability(10, 30);
ok('可提取度随时间单调下降', r0 > r5 && r5 > r30, [r0, r5, r30].map((x) => x.toFixed(3)).join(' > '));
ok('目标留存 0.9 时 S=10 的间隔约 10 天', Math.abs(FSRS.intervalFromStability(10) - 10) < 0.5, FSRS.intervalFromStability(10));

// 长期模拟：间隔增长且不超上限
let card = FSRS.newCard('sim');
let t = now;
let grew = true;
let prev = 0;
for (let i = 0; i < 40; i++) {
  card = FSRS.review(card, 4, t);
  if (i > 2 && card.ivl < prev) grew = false;
  prev = card.ivl;
  t = card.due;
}
ok('连续「简单」40 次间隔不下降', grew, '最终 ' + card.ivl + ' 天');
ok('间隔不超过 3 年上限', card.ivl <= 365 * 3 + 1);
ok('长期卡被判定已掌握', FSRS.isMastered(card));

// 同一天重复评分不产生负数或 NaN
let same = FSRS.newCard('same');
same = FSRS.review(same, 3, now);
same = FSRS.review(same, 3, now);
ok('同日重复评分数据有效', isFinite(same.s) && same.s > 0 && same.due > now);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
