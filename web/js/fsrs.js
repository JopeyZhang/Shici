/* FSRS-4.5 间隔重复调度器
 * 纯函数，无 DOM 依赖，可在 Node 下直接单测（tools/test_fsrs.mjs）。
 * 权重采用 FSRS-4.5 公开默认值，注释里的公式与 fsrs 官方说明一致。
 */
(function (global) {
  'use strict';

  var W = [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813,
    0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567,
  ];

  var DAY = 86400000;
  var MIN10 = 600000;
  var DECAY = -0.5;
  var FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈0.2346
  var TARGET_R = 0.9;
  var MAX_IVL = 365 * 3;

  function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
  }

  function initDifficulty(g) {
    return clamp(W[4] - (g - 3) * W[5], 1, 10);
  }

  function initStability(g) {
    return Math.max(0.1, W[g - 1]);
  }

  // R(t,S) = (1 + FACTOR * t / S) ^ DECAY
  function retrievability(s, elapsedDays) {
    if (!s || s <= 0) return 0;
    return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / s, DECAY);
  }

  // 由目标留存反解间隔（天）
  function intervalFromStability(s) {
    var ivl = (s / FACTOR) * (Math.pow(TARGET_R, 1 / DECAY) - 1);
    return clamp(Math.round(ivl * 100) / 100, 1, MAX_IVL);
  }

  function newCard(id) {
    return {
      id: id,
      state: 'new', // new | learning | review
      due: 0,
      s: 0,
      d: 0,
      reps: 0,
      lapses: 0,
      last: 0,
      ivl: 0,
    };
  }

  function nextDifficulty(d, g) {
    var d2 = d - W[6] * (g - 3);
    // 均值回归到 D0(4)，避免难度漂移
    var d3 = W[7] * initDifficulty(4) + (1 - W[7]) * d2;
    return clamp(d3, 1, 10);
  }

  function nextStabilityOnSuccess(s, d, r, g) {
    var hardPenalty = g === 2 ? 0.8 : 1;
    var easyBonus = g === 4 ? 1.3 : 1;
    var inc =
      Math.exp(W[8]) *
      (11 - d) *
      Math.pow(s, -W[9]) *
      (Math.exp((1 - r) * W[10]) - 1) *
      hardPenalty *
      easyBonus;
    return Math.max(0.1, s * (1 + inc));
  }

  function nextStabilityOnFail(s, d, r) {
    return Math.max(
      0.1,
      W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14])
    );
  }

  /**
   * 复习一张卡并返回新卡（不修改入参）。
   * @param {object} card
   * @param {number} g 1 忘记 / 2 模糊 / 3 记得 / 4 简单
   * @param {number} now 时间戳(ms)
   */
  function review(card, g, now) {
    g = clamp(Math.round(g), 1, 4);
    now = now || Date.now();
    var c = {
      id: card.id,
      state: card.state,
      due: card.due,
      s: card.s,
      d: card.d,
      reps: card.reps || 0,
      lapses: card.lapses || 0,
      last: card.last || 0,
      ivl: card.ivl || 0,
    };
    c.reps += 1;

    if (c.state === 'new') {
      c.d = initDifficulty(g);
      c.s = initStability(g);
      c.last = now;
      if (g === 1) {
        c.state = 'learning';
        c.due = now + MIN10;
        c.ivl = MIN10 / DAY;
      } else if (g === 2) {
        c.state = 'learning';
        c.due = now + MIN10;
        c.ivl = MIN10 / DAY;
      } else if (g === 3) {
        c.state = 'review';
        c.ivl = intervalFromStability(c.s);
        c.due = now + c.ivl * DAY;
      } else {
        c.state = 'review';
        c.ivl = Math.max(4, intervalFromStability(c.s) * 1.5);
        c.due = now + c.ivl * DAY;
      }
      return c;
    }

    if (c.state === 'learning') {
      if (g === 1 || g === 2) {
        c.due = now + MIN10;
        c.ivl = MIN10 / DAY;
        c.last = now;
        return c;
      }
      c.s = Math.max(c.s || initStability(g), g === 3 ? W[2] : W[3]);
      c.d = c.d ? nextDifficulty(c.d, g) : initDifficulty(g);
      c.state = 'review';
      c.ivl = g === 3 ? 1 : 4;
      c.due = now + c.ivl * DAY;
      c.last = now;
      return c;
    }

    // review
    var elapsed = c.last ? Math.max(0, (now - c.last) / DAY) : 0;
    var r = retrievability(c.s, elapsed);
    if (g === 1) {
      c.lapses += 1;
      c.s = nextStabilityOnFail(c.s, c.d || 5, r);
      c.d = nextDifficulty(c.d || 5, g);
      // 重新学习：10 分钟后再说，同时保留（已缩短的）稳定度
      c.due = now + MIN10;
      c.ivl = MIN10 / DAY;
      c.last = now;
      return c;
    }
    c.s = nextStabilityOnSuccess(c.s, c.d || 5, r, g);
    c.d = nextDifficulty(c.d || 5, g);
    c.ivl = intervalFromStability(c.s);
    if (g === 2) c.ivl = Math.max(1, Math.round(c.ivl * 0.8 * 100) / 100);
    if (g === 4) c.ivl = Math.round(c.ivl * 1.3 * 100) / 100;
    c.ivl = clamp(c.ivl, 1 / 24, MAX_IVL);
    c.due = now + c.ivl * DAY;
    c.last = now;
    return c;
  }

  function isDue(card, now) {
    if (!card || card.state === 'new') return false;
    return card.due <= (now || Date.now());
  }

  /** 下次复习的可读文案 */
  function formatInterval(card, now) {
    if (!card) return '—';
    if (card.state === 'new') return '未学习';
    var ms = card.due - (now || Date.now());
    if (ms <= 0) return '现在';
    var min = Math.round(ms / 60000);
    if (min < 60) return min + ' 分钟';
    var h = Math.round(min / 60);
    if (h < 24) return h + ' 小时';
    var d = Math.round(h / 24);
    if (d < 31) return d + ' 天';
    var mo = Math.round(d / 30.4);
    if (mo < 12) return mo + ' 个月';
    return (Math.round((d / 365) * 10) / 10) + ' 年';
  }

  /** 评分按钮上的预告（例如「3 天」） */
  function previewInterval(card, g, now) {
    var c = review(card, g, now || Date.now());
    return formatInterval(c, now || Date.now());
  }

  /** 是否已掌握：稳定度 ≥ 21 天 */
  function isMastered(card) {
    return !!card && card.state === 'review' && (card.s || 0) >= 21;
  }

  global.FSRS = {
    W: W,
    newCard: newCard,
    review: review,
    isDue: isDue,
    isMastered: isMastered,
    retrievability: retrievability,
    intervalFromStability: intervalFromStability,
    formatInterval: formatInterval,
    previewInterval: previewInterval,
    initDifficulty: initDifficulty,
    initStability: initStability,
  };
})(typeof window !== 'undefined' ? window : globalThis);
