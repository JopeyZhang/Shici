/* 本地存储适配层
 * 优先级：Android 原生桥 (SharedPreferences) → localStorage → 内存。
 * 全程不联网、不需要账号；进度只落在本机。
 */
(function (global) {
  'use strict';

  var KEY = 'progress.v1';
  var DEFAULTS = {
    v: 1,
    updatedAt: 0,
    cards: {},
    seen: {},
    favorites: [],
    stats: { streak: 0, lastDay: '', days: {}, reviews: 0, learned: 0, reviewDay: '', reviewsToday: 0 },
    settings: {
      onboarded: false,
      examDate: '',
      targetBand: 6.5,
      dailyNew: 20,
      startCefr: 'A1',
      order: 'level',
      theme: 'paper',
      wordSize: 'm',
      accent: 'uk',
      dailyReviewCap: 100,
    },
  };

  function detectBackend() {
    try {
      if (global.AndroidStore && typeof global.AndroidStore.getItem === 'function') return 'bridge';
    } catch (e) {}
    try {
      var k = '__wa_probe__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return 'local';
    } catch (e) {}
    return 'memory';
  }

  var backend = detectBackend();
  var memory = {};

  function rawRead(key) {
    try {
      if (backend === 'bridge') return global.AndroidStore.getItem(key);
      if (backend === 'local') return global.localStorage.getItem(key);
    } catch (e) {}
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function rawWrite(key, value) {
    try {
      if (backend === 'bridge') {
        global.AndroidStore.setItem(key, value);
        return true;
      }
      if (backend === 'local') {
        global.localStorage.setItem(key, value);
        return true;
      }
    } catch (e) {}
    memory[key] = value;
    return backend === 'memory';
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeDefaults(state) {
    var out = clone(DEFAULTS);
    if (!state || typeof state !== 'object') return out;
    out.updatedAt = state.updatedAt || 0;
    out.cards = state.cards && typeof state.cards === 'object' ? state.cards : {};
    out.seen = state.seen && typeof state.seen === 'object' ? state.seen : {};
    out.favorites = Array.isArray(state.favorites) ? state.favorites.filter(function (x) { return typeof x === 'string'; }) : [];
    if (state.stats) {
      out.stats.streak = Number(state.stats.streak) || 0;
      out.stats.lastDay = state.stats.lastDay || '';
      out.stats.days = state.stats.days && typeof state.stats.days === 'object' ? state.stats.days : {};
      out.stats.reviews = Number(state.stats.reviews) || 0;
      out.stats.learned = Number(state.stats.learned) || 0;
      out.stats.reviewDay = state.stats.reviewDay || '';
      out.stats.reviewsToday = Number(state.stats.reviewsToday) || 0;
    }
    if (state.settings) {
      for (var k in DEFAULTS.settings) {
        if (Object.prototype.hasOwnProperty.call(state.settings, k)) out.settings[k] = state.settings[k];
      }
    }
    return out;
  }

  function load() {
    var raw = rawRead(KEY);
    if (!raw) return clone(DEFAULTS);
    try {
      var parsed = JSON.parse(raw);
      return mergeDefaults(parsed);
    } catch (e) {
      console.warn('[store] 进度解析失败，使用默认值');
      return clone(DEFAULTS);
    }
  }

  var timer = 0;
  function save(state, immediate) {
    state.updatedAt = Date.now();
    var payload = JSON.stringify(state);
    if (immediate) {
      clearTimeout(timer);
      return rawWrite(KEY, payload);
    }
    clearTimeout(timer);
    timer = setTimeout(function () {
      rawWrite(KEY, payload);
    }, 220);
    return true;
  }

  function reset() {
    clearTimeout(timer);
    rawWrite(KEY, JSON.stringify(DEFAULTS));
    return clone(DEFAULTS);
  }

  function todayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function dayDiff(a, b) {
    var pa = a.split('-').map(Number);
    var pb = b.split('-').map(Number);
    var ta = new Date(pa[0], pa[1] - 1, pa[2]).getTime();
    var tb = new Date(pb[0], pb[1] - 1, pb[2]).getTime();
    return Math.round((tb - ta) / 86400000);
  }

  /** 完成一次学习后刷新连续天数与当日计数 */
  function touchStudy(state, count) {
    count = Math.max(1, count || 1);
    var key = todayKey();
    var stats = state.stats;
    stats.days[key] = (stats.days[key] || 0) + count;
    stats.learned = (stats.learned || 0) + count;
    if (stats.lastDay !== key) {
      if (!stats.lastDay) stats.streak = 1;
      else {
        var diff = dayDiff(stats.lastDay, key);
        stats.streak = diff === 1 ? stats.streak + 1 : diff === 0 ? stats.streak : 1;
      }
      stats.lastDay = key;
    }
    return stats;
  }

  function exportJson(state) {
    return JSON.stringify(
      {
        app: 'shici-word-atlas',
        version: 1,
        exportedAt: new Date().toISOString(),
        progress: state,
      },
      null,
      2
    );
  }

  function importJson(text) {
    var data;
    try {
      data = typeof text === 'string' ? JSON.parse(text) : text;
    } catch (e) {
      return { ok: false, error: '文件不是有效的 JSON' };
    }
    if (!data || data.app !== 'shici-word-atlas' || !data.progress) {
      return { ok: false, error: '这不是拾词的学习进度备份' };
    }
    var state = mergeDefaults(data.progress);
    if (!state.cards || typeof state.cards !== 'object') return { ok: false, error: '备份内容损坏' };
    save(state, true);
    return { ok: true, state: state };
  }

  global.Store = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    backend: backend,
    load: load,
    save: save,
    reset: reset,
    mergeDefaults: mergeDefaults,
    todayKey: todayKey,
    touchStudy: touchStudy,
    exportJson: exportJson,
    importJson: importJson,
    clone: clone,
  };
})(typeof window !== 'undefined' ? window : globalThis);
