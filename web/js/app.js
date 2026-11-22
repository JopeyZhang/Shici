/* 拾词 · 应用主逻辑（零依赖，离线运行）
 * 五页：今日 / 图鉴 / 复习 / 练习 / 我的
 * 进度只存本机（Android SharedPreferences 或 localStorage），无账号、无网络请求。
 */
(function () {
  'use strict';

  /* ============ 基础数据 ============ */
  var META = window.ATLAS_META || { count: 0, cefr: [], topics: [] };
  var WORDS = window.WORDS || [];
  var CEFR = META.cefr || ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var cefrIdx = {};
  CEFR.forEach(function (c, i) { cefrIdx[c] = i; });
  var topicMeta = {};
  META.topics.forEach(function (t) { topicMeta[t.key] = t; });
  var byId = {};
  WORDS.forEach(function (w) { byId[w.id] = w; });

  var state = Store.load();
  var S = function () { return state.settings; };

  /* ============ 小工具 ============ */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return Number(n || 0).toLocaleString('en-US'); }
  function weekday(d) { return '周' + '日一二三四五六'.charAt(d.getDay()); }
  function dateLabel() {
    var d = new Date();
    return d.getMonth() + 1 + '月' + d.getDate() + '日 · ' + weekday(d);
  }
  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 11) return '早安';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function daysUntil(iso) {
    var t = new Date(iso + 'T00:00:00');
    if (isNaN(t.getTime())) return null;
    var now = new Date();
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((t - a) / 86400000);
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function firstSense(w) {
    return (w.senses && w.senses[0] && w.senses[0].zh) || '';
  }
  function posOf(w) {
    return (w.senses && w.senses[0] && w.senses[0].pos) || '';
  }
  function topicZh(key) { return (topicMeta[key] && topicMeta[key].zh) || key; }
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove('is-show');
      setTimeout(function () { el.hidden = true; }, 260);
    }, 2000);
  }

  /* ============ 图标 ============ */
  var SVG = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var ICON = {
    today: '<svg ' + SVG + '><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/><circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none"/></svg>',
    atlas: '<svg ' + SVG + '><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
    review: '<svg ' + SVG + '><path d="M20.5 11.5a8.5 8.5 0 1 1-2.4-5.6"/><path d="M20.5 3.5v7h-7"/></svg>',
    practice: '<svg ' + SVG + '><path d="M4 20h4.2L20 8.2 16.2 4.4 4.4 16.2V20z"/><path d="M14.2 6.4l3.8 3.8"/></svg>',
    me: '<svg ' + SVG + '><circle cx="12" cy="8" r="3.7"/><path d="M4.6 20.2c.9-3.7 4-5.6 7.4-5.6s6.5 1.9 7.4 5.6"/></svg>',
    back: '<svg ' + SVG + '><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg ' + SVG + '><path d="M9 5l7 7-7 7"/></svg>',
    search: '<svg ' + SVG + '><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    star: '<svg ' + SVG + '><path d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 4z"/></svg>',
    starOn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 4l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 4z"/></svg>',
    speak: '<svg ' + SVG + '><path d="M4 10v4h3l4 3.5v-11L7 10H4z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path d="M17.5 7a7 7 0 0 1 0 10"/></svg>',
    close: '<svg ' + SVG + '><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg ' + SVG + '><path d="M4.5 12.5l5 5 10-11"/></svg>',
    flame: '<svg ' + SVG + '><path d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-2 1-3.5 2.5-5 .5 1.5 1.5 2.5 2.5 2.5C12.5 8 12 5.5 12 3z"/></svg>',
    gear: '<svg ' + SVG + '><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.2M12 18.3v2.2M4.6 7.8l1.9 1.1M17.5 15.1l1.9 1.1M4.6 16.2l1.9-1.1M17.5 8.9l1.9-1.1"/></svg>',
    book: '<svg ' + SVG + '><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/></svg>',
    image: '<svg ' + SVG + '><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.8-4.6 3.4 3.2 2.8-2.3 4 3.7"/></svg>',
    spark: '<svg ' + SVG + '><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></svg>',
  };

  /* ============ 音频（TTS） ============ */
  var Audio2 = {
    speak: function (text, accent) {
      if (!text) return;
      accent = accent || S().accent;
      try {
        if (window.AndroidStore && typeof AndroidStore.speak === 'function') {
          AndroidStore.speak(String(text), accent === 'us' ? 'us' : 'uk');
          return;
        }
      } catch (e) {}
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        try {
          window.speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance(String(text));
          u.lang = accent === 'us' ? 'en-US' : 'en-GB';
          u.rate = 0.96;
          window.speechSynthesis.speak(u);
          return;
        } catch (e2) {}
      }
      toast('当前设备没有可用的英文语音');
    },
    stop: function () {
      try { if (window.AndroidStore && AndroidStore.stopSpeaking) AndroidStore.stopSpeaking(); } catch (e) {}
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    },
  };

  /* ============ 范围 / 统计 ============ */
  var scopeCache = { key: null, list: null };
  function scopeWords() {
    var key = S().startCefr;
    if (scopeCache.key === key && scopeCache.list) return scopeCache.list;
    var from = cefrIdx[key] || 0;
    var list = [];
    for (var i = 0; i < WORDS.length; i++) {
      if ((cefrIdx[WORDS[i].cefr] || 0) >= from) list.push(WORDS[i]);
    }
    scopeCache = { key: key, list: list };
    return list;
  }
  function orderedScope() {
    var list = scopeWords().slice();
    if (S().order === 'topic') {
      var rank = {};
      META.topics.forEach(function (t, i) { rank[t.key] = i; });
      list.sort(function (a, b) {
        return (rank[a.topic] - rank[b.topic]) || ((cefrIdx[a.cefr] || 0) - (cefrIdx[b.cefr] || 0));
      });
    }
    return list;
  }
  function cardOf(id) { return state.cards[id] || null; }
  function dueList() {
    var now = Date.now(), out = [];
    for (var id in state.cards) {
      if (FSRS.isDue(state.cards[id], now)) out.push(state.cards[id]);
    }
    out.sort(function (a, b) { return a.due - b.due; });
    return out;
  }
  function dueIds(limit) {
    return dueList().slice(0, limit || S().dailyReviewCap || 100).map(function (c) { return c.id; });
  }
  function scopeStats() {
    var list = scopeWords(), learned = 0, mastered = 0;
    for (var i = 0; i < list.length; i++) {
      var card = state.cards[list[i].id];
      if (card && card.reps > 0) {
        learned++;
        if (FSRS.isMastered(card)) mastered++;
      }
    }
    return { total: list.length, learned: learned, mastered: mastered };
  }
  function todayCount() { return state.stats.days[Store.todayKey()] || 0; }
  function newIds(n) {
    var list = orderedScope(), out = [];
    for (var i = 0; i < list.length && out.length < n; i++) {
      var id = list[i].id;
      if (!state.cards[id] || state.cards[id].state === 'new') out.push(id);
    }
    return out;
  }
  function learnedIds() {
    var out = [];
    for (var id in state.cards) if (state.cards[id].reps > 0) out.push(id);
    return out;
  }
  function topicProgress() {
    var stat = {};
    META.topics.forEach(function (t) { stat[t.key] = { total: 0, learned: 0 }; });
    for (var i = 0; i < WORDS.length; i++) {
      var w = WORDS[i], s = stat[w.topic];
      if (!s) continue;
      s.total++;
      var c = state.cards[w.id];
      if (c && c.reps > 0) s.learned++;
    }
    return stat;
  }

  /* ============ 会话 ============ */
  var session = null; // {kind:'learn'|'review', ids:[], idx, revealed, total}
  var quiz = null;
  var quizTimer = 0;
  var navIds = [];
  var scrollPos = {};
  var listView = null; // {ids, shown, containerId}
  var sheetOpen = false;
  var searchQuery = '';
  var topicFilter = { cefr: '', status: '' };

  function startLearn() {
    var remain = Math.max(0, Number(S().dailyNew) - todayCount());
    if (!remain) {
      toast('今天的 ' + S().dailyNew + ' 个新词已经学完，明天继续；想加量可在「我的」里调高每日新词');
      return;
    }
    var ids = newIds(remain);
    if (!ids.length) { toast('这个范围里的新词都学过了，可以调低学习起点或换学习顺序'); return; }
    session = { kind: 'learn', ids: ids, idx: 0, revealed: false };
    go('#/study');
  }
  function startReview() {
    var ids = dueIds();
    if (!ids.length) { toast('现在没有到期的复习'); return; }
    session = { kind: 'review', ids: ids, idx: 0, revealed: false };
    go('#/study');
  }
  function bumpReview() {
    var st = state.stats, key = Store.todayKey();
    if (st.reviewDay !== key) { st.reviewDay = key; st.reviewsToday = 0; }
    st.reviewsToday++;
    st.reviews = (st.reviews || 0) + 1;
  }
  function rate(g) {
    if (!session) return;
    var id = session.ids[session.idx];
    if (!id) return;
    var now = Date.now();
    var card = state.cards[id] || FSRS.newCard(id);
    state.cards[id] = FSRS.review(card, g, now);
    if (!state.seen[id]) state.seen[id] = { firstSeen: now, lastSeen: now };
    else state.seen[id].lastSeen = now;
    if (session.kind === 'learn') Store.touchStudy(state, 1);
    else bumpReview();
    Store.save(state);
    session.idx++;
    session.revealed = false;
    if (session.idx >= session.ids.length) {
      session.done = true;
      if (session.kind === 'review') statsRefresh();
    }
    render();
  }

  /* ============ 练习 ============ */
  var MODES = {
    zh2en: { label: '看中文选英文', desc: '给中文释义，挑出对应单词', icon: 'book' },
    en2zh: { label: '看英文选中文', desc: '看单词，选出正确释义', icon: 'spark' },
    listen: { label: '听音选词', desc: '听发音，选出听到的单词', icon: 'speak' },
    picture: { label: '看图选词', desc: '看插画，选出对应单词', icon: 'image' },
    spell: { label: '拼写', desc: '看释义，把单词拼出来', icon: 'practice' },
  };

  function makeOptions(word) {
    var pool = scopeWords();
    var sameTopic = [], sameCefr = [];
    for (var i = 0; i < pool.length; i++) {
      var x = pool[i];
      if (x.id === word.id) continue;
      if (x.topic === word.topic) sameTopic.push(x);
      else if (x.cefr === word.cefr) sameCefr.push(x);
    }
    var picks = [], seen = {};
    seen[firstSense(word)] = 1;
    function take(arr) {
      var guard = 0;
      while (arr.length && picks.length < 3 && guard++ < 400) {
        var xi = Math.floor(Math.random() * arr.length);
        var cand = arr.splice(xi, 1)[0];
        var zh = firstSense(cand);
        if (!zh || seen[zh]) continue;
        seen[zh] = 1;
        picks.push(cand);
      }
    }
    take(sameTopic);
    take(sameCefr);
    var guard2 = 0;
    while (picks.length < 3 && guard2++ < 600) {
      var cand2 = pool[Math.floor(Math.random() * pool.length)];
      var zh2 = firstSense(cand2);
      if (!cand2 || cand2.id === word.id || !zh2 || seen[zh2]) continue;
      seen[zh2] = 1;
      picks.push(cand2);
    }
    return shuffle([word].concat(picks));
  }

  function makeQuestion(mode, id) {
    var w = byId[id];
    if (!w) return null;
    var q = { id: id, mode: mode, word: w, answered: false, choice: null, spoken: false };
    if (mode !== 'spell') {
      q.options = makeOptions(w).map(function (x) {
        return { id: x.id, word: x.w, zh: firstSense(x), ipa: x.uk };
      });
    }
    return q;
  }

  function startQuiz(mode) {
    quiz = null;
    if (!ensureQuiz(mode)) { toast('还没有足够的词来练习，先学几个新词'); return; }
    go('#/practice/' + mode);
  }
  function ensureQuiz(mode) {
    if (quiz && quiz.mode === mode) return true;
    var pool = learnedIds();
    if (pool.length < 8) pool = scopeWords().slice(0, 600).map(function (w) { return w.id; });
    var ids = shuffle(pool).slice(0, 10);
    if (ids.length < 4) return false;
    quiz = { mode: mode || 'zh2en', queue: ids, pos: 0, current: makeQuestion(mode || 'zh2en', ids[0]), correct: 0, attempts: 0, finished: false, retries: {} };
    return true;
  }
  function quizAnswer(choiceId) {
    var q = quiz && quiz.current;
    if (!q || q.answered) return;
    q.answered = true;
    q.choice = choiceId;
    var ok = choiceId === q.id;
    quiz.attempts++;
    if (ok) quiz.correct++;
    var card = state.cards[q.id] || FSRS.newCard(q.id);
    state.cards[q.id] = FSRS.review(card, ok ? 3 : 1, Date.now());
    if (!state.seen[q.id]) state.seen[q.id] = { firstSeen: Date.now(), lastSeen: Date.now() };
    bumpReview();
    Store.save(state);
    if (!ok && !quiz.retries[q.id] && quiz.queue.length < 24) {
      quiz.retries[q.id] = 1;
      var at = Math.min(quiz.pos + 5, quiz.queue.length);
      quiz.queue.splice(at, 0, q.id);
    }
    render();
    clearTimeout(quizTimer);
    if (ok) quizTimer = setTimeout(quizAdvance, 900);
  }
  function quizAdvance() {
    if (!quiz) return;
    clearTimeout(quizTimer);
    quiz.pos++;
    if (quiz.pos >= quiz.queue.length) {
      quiz.finished = true;
      quiz.current = null;
    } else {
      quiz.current = makeQuestion(quiz.mode, quiz.queue[quiz.pos]);
      if (quiz.current) quiz.current.spoken = false;
    }
    render();
  }
  function spellSubmit() {
    var input = $('#spellInput');
    if (!input) return;
    var val = String(input.value || '').trim().toLowerCase();
    if (!val) { toast('先把单词拼出来'); return; }
    if (val === String(quiz.current.word.w).toLowerCase()) quizAnswer(quiz.current.id);
    else quizAnswer('__wrong__');
  }

  /* ============ 渲染工具 ============ */
  function thumbHtml(id, cls) {
    var ch = String(id || '?').charAt(0).toUpperCase();
    return (
      '<span class="thumb ' + (cls || '') + '">' +
      '<span class="ph">' + esc(ch) + '</span>' +
      '<img src="assets/words/' + esc(id) + '.webp" alt="" loading="lazy" decoding="async">' +
      '</span>'
    );
  }
  function rowHtml(id) {
    var w = byId[id];
    if (!w) return '';
    var fav = state.favorites.indexOf(id) >= 0;
    var st = '';
    var c = state.cards[id];
    if (c && FSRS.isMastered(c)) st = '已掌握';
    else if (c && c.reps > 0) st = '学习中';
    return (
      '<button class="word-row" data-act="open-word" data-id="' + esc(id) + '">' +
      thumbHtml(id) +
      '<span class="grow">' +
      '<span class="w">' + esc(w.w) + '<span class="ipa">' + esc(w.uk || '') + '</span></span>' +
      '<span class="zh clamp2">' + esc(firstSense(w)) + '</span>' +
      '</span>' +
      '<span class="right">' +
      (st ? '<span class="tiny">' + st + '</span>' : '') +
      (fav ? '<span class="star-on">' + ICON.starOn + '</span>' : '') +
      '<span class="badge cefr-' + esc(w.cefr) + '">' + esc(w.cefr) + '</span>' +
      '</span>' +
      '</button>'
    );
  }
  function setupList(containerId, ids) {
    listView = { ids: ids, shown: 40, containerId: containerId };
    return ids.slice(0, 40).map(rowHtml).join('');
  }
  function appendList() {
    if (!listView) return;
    var el = document.getElementById(listView.containerId);
    if (!el) return;
    var next = listView.ids.slice(listView.shown, listView.shown + 40);
    if (!next.length) { listView = null; return; }
    el.insertAdjacentHTML('beforeend', next.map(rowHtml).join(''));
    listView.shown += next.length;
  }
  function emptyHtml(glyph, title, sub, action) {
    return (
      '<div class="empty"><div class="glyph">' + esc(glyph) + '</div>' +
      '<div class="muted">' + esc(title) + '</div>' +
      (sub ? '<div class="tiny" style="margin-top:6px">' + esc(sub) + '</div>' : '') +
      (action || '') + '</div>'
    );
  }
  function go(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  }
  var statsCache = null;
  function statsRefresh() { statsCache = null; }

  /* ============ 今日 ============ */
  function examStatus() {
    var s = S();
    if (!s.examDate) return { main: '还没有设定考试日期', sub: '设一个日期，帮你估算每天学几个新词' };
    var d = daysUntil(s.examDate);
    if (d === null) return { main: '考试日期无效', sub: '去「我的」重新设置' };
    if (d > 0) return { main: '距考试 ' + d + ' 天', sub: '目标 ' + Number(s.targetBand).toFixed(1) + ' 分 · 每天 ' + s.dailyNew + ' 个新词' };
    if (d === 0) return { main: '今天考试', sub: '深呼吸，相信这些天的积累' };
    return { main: '考试已过 ' + -d + ' 天', sub: '继续把词学扎实' };
  }
  function goalCard() {
    if (S().onboarded) return '';
    return (
      '<div class="card" style="margin-top:12px">' +
      '<div class="row"><b class="grow">先定一个小目标</b><span class="tiny">不用注册</span></div>' +
      '<p class="tiny" style="margin:6px 0 2px">学习进度只保存在这台手机里，卸载前可导出备份。</p>' +
      '<div class="setting-row" style="padding-left:0;padding-right:0"><span class="label">每天新词</span>' +
      '<span class="value"><select data-set="dailyNew">' +
      [5, 10, 15, 20, 30, 40, 60].map(function (n) {
        return '<option value="' + n + '"' + (Number(S().dailyNew) === n ? ' selected' : '') + '>' + n + ' 个</option>';
      }).join('') +
      '</select></span></div>' +
      '<div class="setting-row" style="padding-left:0;padding-right:0"><span class="label">学习起点</span>' +
      '<span class="value"><select data-set="startCefr">' +
      CEFR.map(function (c) {
        return '<option value="' + c + '"' + (S().startCefr === c ? ' selected' : '') + '>' + c + ' 起</option>';
      }).join('') +
      '</select></span></div>' +
      '<button class="btn btn-line btn-block" data-act="dismiss-onboard" style="margin-top:10px">开始使用</button>' +
      '</div>'
    );
  }
  function viewToday() {
    var st = scopeStats();
    var due = dueList();
    var remainNew = Math.max(0, Number(S().dailyNew) - todayCount());
    var newOnes = newIds(remainNew);
    var exam = examStatus();
    var pct = st.total ? Math.round((st.learned / st.total) * 100) : 0;
    var todayN = todayCount();
    return (
      '<div class="page">' +
      '<div class="today-top">' +
      '<div class="grow"><h1>' + greeting() + '</h1><div class="date">' + dateLabel() + '</div></div>' +
      '<button class="iconbtn" data-act="go" data-to="#/me" aria-label="设置">' + ICON.gear + '</button>' +
      '</div>' +
      '<div class="plan-card">' +
      '<div class="plan-head"><span>' + esc(exam.main) + '</span>' +
      '<span class="grow"></span><span class="tiny">' + (Store.backend === 'bridge' ? '本机保存' : Store.backend === 'local' ? '浏览器保存' : '临时内存') + '</span></div>' +
      '<div class="tiny" style="margin-top:2px">' + esc(exam.sub) + '</div>' +
      '<div class="plan-count">' + num(remainNew) + '<small>个新词待学</small></div>' +
      '<div class="progress-line"><i style="width:' + pct + '%"></i></div>' +
      '<div class="tiny" style="margin-top:6px">参考范围 ' + num(st.total) + ' 词 · 已学 ' + num(st.learned) + ' · ' + pct + '%</div>' +
      '<div class="plan-actions">' +
      '<button class="btn btn-primary btn-block" data-act="start-learn"' + (newOnes.length ? '' : ' disabled') + '>' +
      '<span>' + (newOnes.length ? '开始学习' : '今天的新词已完成') + '</span><span class="num">' + newOnes.length + ' 词</span></button>' +
      '<button class="btn btn-ghost btn-block" data-act="start-review"' + (due.length ? '' : ' disabled') + '>' +
      '<span>复习到期</span><span class="num">' + due.length + ' 张</span></button>' +
      '</div>' +
      '</div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><b>' + num(state.stats.streak) + '</b><span>连续天数</span></div>' +
      '<div class="stat"><b>' + num(todayN) + '</b><span>今日已学</span></div>' +
      '<div class="stat"><b>' + num(st.mastered) + '</b><span>已掌握</span></div>' +
      '</div>' +
      '<div class="section-title">今日任务<span class="more">' + (due.length + newOnes.length) + ' 项</span></div>' +
      '<div class="card" style="padding:2px 14px">' +
      '<button class="task-row" data-act="start-learn">' +
      '<span class="task-ico new">' + ICON.book + '</span>' +
      '<span class="grow"><b>学新词</b><div class="tiny">' + (newOnes.length ? '还有 ' + newOnes.length + ' 个等你' : '今天的量已完成') + '</div></span>' +
      '<span class="num">' + newOnes.length + '</span></button>' +
      '<button class="task-row" data-act="start-review">' +
      '<span class="task-ico rev">' + ICON.review + '</span>' +
      '<span class="grow"><b>复习到期</b><div class="tiny">' + (due.length ? '按遗忘曲线安排' : '暂时没有到期') + '</div></span>' +
      '<span class="num">' + due.length + '</span></button>' +
      '</div>' +
      goalCard() +
      '<div class="section-title">继续浏览<span class="more"><button data-act="go" data-to="#/atlas">全部词库 ' + ICON.right + '</button></span></div>' +
      recentStrip() +
      '</div>'
    );
  }
  function recentStrip() {
    var ids = Object.keys(state.seen || {}).slice(-8).reverse();
    if (!ids.length) {
      return '<div class="card"><div class="row"><span class="task-ico">' + ICON.spark + '</span><div class="grow"><b>从第一个词开始</b><div class="tiny">图鉴按 19 个话题整理，一词一画</div></div><button class="btn btn-ghost" data-act="go" data-to="#/atlas">去看看</button></div></div>';
    }
    return '<div class="card" style="padding:6px 14px">' + ids.slice(0, 4).map(function (id) {
      var w = byId[id];
      if (!w) return '';
      return '<button class="task-row" data-act="open-word" data-id="' + esc(id) + '">' +
        '<span class="task-ico">' + esc(String(w.w).charAt(0).toUpperCase()) + '</span>' +
        '<span class="grow"><b style="font-family:var(--font-word)">' + esc(w.w) + '</b><div class="tiny clamp2">' + esc(firstSense(w)) + '</div></span>' +
        '<span class="tiny">' + esc(w.cefr) + '</span></button>';
    }).join('') + '</div>';
  }

  /* ============ 图鉴 ============ */
  function topicGridHtml() {
    var prog = topicProgress();
    return '<div class="topic-grid">' + META.topics.map(function (t) {
      var p = prog[t.key] || { total: 0, learned: 0 };
      var pct = p.total ? Math.round((p.learned / p.total) * 100) : 0;
      return '<button class="topic-tile" data-act="open-topic" data-id="' + esc(t.key) + '" style="--dot:' + esc(t.color) + ';--p:' + pct + '">' +
        '<span class="ring"></span>' +
        '<span><span class="zh"><i class="dot" style="background:' + esc(t.color) + '"></i>' + esc(t.zh) + '</span>' +
        '<div class="en">' + esc(t.key) + '</div></span>' +
        '<span class="cn">' + p.total + ' 词 · 已学 ' + pct + '%</span></button>';
    }).join('') + '</div>';
  }
  function searchIds(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    var out = [];
    for (var i = 0; i < WORDS.length && out.length < 400; i++) {
      var w = WORDS[i];
      if (String(w.w).toLowerCase().indexOf(q) >= 0 || w.id.indexOf(q) >= 0) { out.push(w.id); continue; }
      for (var j = 0; j < w.senses.length; j++) {
        if (String(w.senses[j].zh).indexOf(q) >= 0 || String(w.senses[j].en).toLowerCase().indexOf(q) >= 0) { out.push(w.id); break; }
      }
    }
    return out;
  }
  function atlasBodyHtml() {
    if (!searchQuery.trim()) return topicGridHtml();
    var ids = searchIds(searchQuery);
    if (!ids.length) return emptyHtml('∅', '没有找到匹配的词', '换个拼写或中文关键词试试');
    return '<div class="section-title" style="margin-top:4px">搜索结果 ' + ids.length + ' 个</div>' +
      '<div class="word-list"><div id="atlasResultsList">' + setupList('atlasResultsList', ids) + '</div></div>';
  }
  function viewAtlas() {
    return '<div class="page">' +
      '<div class="page-head"><div class="grow"><h1>图鉴</h1><p class="sub">' + num(META.count) + ' 个词 · ' + META.topics.length + ' 个话题 · 按话题与难度浏览</p></div></div>' +
      '<div class="searchbar">' + ICON.search +
      '<input id="atlasSearch" type="search" placeholder="搜单词或中文释义" autocomplete="off" value="' + esc(searchQuery) + '"></div>' +
      '<div id="atlasBody">' + atlasBodyHtml() + '</div>' +
      '</div>';
  }
  function viewTopic(key) {
    var t = topicMeta[key];
    if (!t) return viewAtlas();
    var list = [];
    for (var i = 0; i < WORDS.length; i++) {
      var w = WORDS[i];
      if (w.topic !== key) continue;
      if (topicFilter.cefr && w.cefr !== topicFilter.cefr) continue;
      var c = state.cards[w.id];
      if (topicFilter.status === 'new' && c && c.reps > 0) continue;
      if (topicFilter.status === 'learned' && (!c || c.reps === 0)) continue;
      if (topicFilter.status === 'fav' && state.favorites.indexOf(w.id) < 0) continue;
      list.push(w.id);
    }
    var learned = 0;
    for (var j = 0; j < list.length; j++) {
      var cc = state.cards[list[j]];
      if (cc && cc.reps > 0) learned++;
    }
    return '<div class="page">' +
      '<div class="page-head"><button class="iconbtn" data-act="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div class="grow"><h1>' + esc(t.zh) + '</h1><p class="sub">' + list.length + ' 词 · 已学 ' + learned + '</p></div></div>' +
      '<div class="chip-row flat" style="margin-bottom:8px">' +
      '<button class="chip' + (topicFilter.cefr === '' ? ' is-on' : '') + '" data-act="filter-cefr" data-id="">全部难度</button>' +
      CEFR.map(function (c) {
        return '<button class="chip' + (topicFilter.cefr === c ? ' is-on' : '') + '" data-act="filter-cefr" data-id="' + c + '">' + c + '</button>';
      }).join('') + '</div>' +
      '<div class="chip-row flat" style="margin-bottom:10px">' +
      [['', '全部'], ['new', '未学'], ['learned', '已学'], ['fav', '收藏']].map(function (p) {
        return '<button class="chip' + (topicFilter.status === p[0] ? ' is-on' : '') + '" data-act="filter-status" data-id="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      (list.length
        ? '<div class="word-list"><div id="wordList">' + setupList('wordList', list) + '</div></div>'
        : emptyHtml('空', '这里还没有词', '换个筛选条件看看')) +
      '</div>';
  }

  /* ============ 词详情 ============ */
  function highlight(text, word) {
    var html = esc(text);
    if (!word) return html;
    try {
      var safe = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(^|[^A-Za-z])(' + safe + ')(?=[^A-Za-z]|$)', 'gi');
      html = html.replace(re, function (m, p1, p2) { return p1 + '<mark>' + p2 + '</mark>'; });
    } catch (e) {}
    return html;
  }
  function jumpId(label) {
    var base = String(label).replace(/\s*\(.*\)\s*$/, '').replace(/^(the|a|an)\s+/i, '').trim().toLowerCase();
    return byId[base] ? base : '';
  }
  function exBlock(ex, i, word) {
    var isIelts = i === 1;
    return '<div class="ex-block">' +
      '<span class="ex-tag' + (isIelts ? ' is-ielts' : '') + '">' + (isIelts ? '雅思例句' : '日常例句') + '</span>' +
      '<p class="ex-en">' + highlight(ex.en, word) + '</p>' +
      '<p class="ex-zh">' + esc(ex.zh) + '</p>' +
      '<button class="ex-speak" data-act="speak-text" data-text="' + esc(ex.en) + '">' + ICON.speak + ' 朗读这句</button>' +
      '</div>';
  }
  function viewWord(id) {
    var w = byId[id];
    if (!w) return '<div class="page">' + emptyHtml('?', '没有找到这个单词', '', '<button class="btn btn-ghost" data-act="go" data-to="#/atlas">回到图鉴</button>') + '</div>';
    var card = state.cards[id];
    var fav = state.favorites.indexOf(id) >= 0;
    if (navIds.indexOf(id) < 0) {
      navIds = WORDS.filter(function (x) { return x.topic === w.topic; }).map(function (x) { return x.id; });
    }
    var pos = navIds.indexOf(id);
    var prev = pos > 0 ? navIds[pos - 1] : null;
    var next = pos >= 0 && pos < navIds.length - 1 ? navIds[pos + 1] : null;
    var status = !card || card.reps === 0 ? '新词 · 还没学过' : (FSRS.isMastered(card) ? '已掌握' : '学习中') + ' · 下次 ' + FSRS.formatInterval(card);
    var col = (w.col || []).map(function (s) {
      var parts = String(s).split(/\s*[｜|]\s*/);
      return '<div class="col-row"><b>' + esc(parts[0] || '') + '</b>' + (parts[1] ? '<span>' + esc(parts.slice(1).join(' ')) + '</span>' : '') + '</div>';
    }).join('');
    var fam = (w.fam || []).map(function (s) {
      return '<span class="tag">' + esc(s) + '</span>';
    }).join('');
    var syn = (w.syn || []).map(function (s) {
      var j = jumpId(s);
      return j ? '<button class="tag syn" data-act="open-word" data-id="' + esc(j) + '">' + esc(s) + '</button>' : '<span class="tag syn">' + esc(s) + '</span>';
    }).join('');
    var ant = (w.ant || []).map(function (s) {
      var j = jumpId(s);
      return j ? '<button class="tag ant" data-act="open-word" data-id="' + esc(j) + '">' + esc(s) + '</button>' : '<span class="tag ant">' + esc(s) + '</span>';
    }).join('');
    var senses = (w.senses || []).map(function (s) {
      return '<div class="sense"><span class="pos">' + esc(s.pos) + '</span><span class="grow"><div class="zh">' + esc(s.zh) + '</div><div class="en">' + esc(s.en) + '</div></span></div>';
    }).join('');
    var ch = String(w.w || '?').charAt(0).toUpperCase();

    return '<div class="detail-hero">' +
      '<div class="ph">' + esc(ch) + '</div>' +
      '<img src="assets/words/' + esc(id) + '.webp" alt="">' +
      '<div class="float">' +
      '<button class="iconbtn" data-act="back" aria-label="返回">' + ICON.back + '</button>' +
      '<div class="right">' +
      '<button class="iconbtn' + (fav ? ' is-on' : '') + '" data-act="fav" data-id="' + esc(id) + '" aria-label="收藏">' + (fav ? ICON.starOn : ICON.star) + '</button>' +
      '<button class="iconbtn" data-act="speak-word" data-id="' + esc(id) + '" aria-label="朗读">' + ICON.speak + '</button>' +
      '</div></div>' +
      '<div class="grad"></div>' +
      '</div>' +
      '<div class="page" style="padding-top:0">' +
      '<div class="word-head"><h1>' + esc(w.w) + '</h1>' +
      '<div class="ipa-line">' +
      '<button class="ipa-pill" data-act="speak-word" data-id="' + esc(id) + '" data-accent="uk"><b>UK</b>' + esc(w.uk || '—') + ICON.speak + '</button>' +
      '<button class="ipa-pill" data-act="speak-word" data-id="' + esc(id) + '" data-accent="us"><b>US</b>' + esc(w.us || '—') + ICON.speak + '</button>' +
      '<span class="badge cefr-' + esc(w.cefr) + '">' + esc(w.cefr) + '</span>' +
      '<span class="tag">' + esc(topicZh(w.topic)) + '</span>' +
      '</div></div>' +
      '<div class="senses">' + senses + '</div>' +
      '<div class="card" style="margin-top:14px;padding:4px 16px 10px">' +
      (w.ex || []).map(function (ex, i) { return exBlock(ex, i, w.w); }).join('') +
      '</div>' +
      (col ? '<div class="section-title">常用搭配</div><div class="card" style="padding:6px 16px">' + col + '</div>' : '') +
      (fam ? '<div class="section-title">词族</div><div class="card"><div class="tagline">' + fam + '</div></div>' : '') +
      ((syn || ant) ? '<div class="section-title">同义 / 反义</div><div class="card"><div class="tagline">' + syn + ant + '</div></div>' : '') +
      (w.tip ? '<div class="tipbox">' + ICON.spark + '<span>' + esc(w.tip) + '</span></div>' : '') +
      (w.note ? '<p class="tiny" style="margin-top:10px">' + esc(w.note) + '</p>' : '') +
      '<div class="detail-foot">' +
      '<div class="meta grow">' + esc(status) + '<br><span>' + (w.fam && w.fam.length ? esc(w.fam[0]) : '') + '</span></div>' +
      '<button class="iconbtn" data-act="prev-word" data-id="' + esc(prev || '') + '"' + (prev ? '' : ' disabled') + '>' + ICON.back + '</button>' +
      '<button class="iconbtn" data-act="next-word" data-id="' + esc(next || '') + '"' + (next ? '' : ' disabled') + '>' + ICON.right + '</button>' +
      '</div>' +
      '</div>';
  }

  /* ============ 学习 / 复习会话 ============ */
  function ensureSession() {
    if (session) return true;
    var ids = newIds(Math.max(1, Math.max(0, Number(S().dailyNew) - todayCount())));
    if (ids.length) { session = { kind: 'learn', ids: ids, idx: 0, revealed: false }; return true; }
    ids = dueIds();
    if (ids.length) { session = { kind: 'review', ids: ids, idx: 0, revealed: false }; return true; }
    return false;
  }
  function viewStudy() {
    if (!session && !ensureSession()) {
      return '<div class="page">' + emptyHtml('✦', '没有要学的词了', '今天的量已完成，或者调整学习起点', '<button class="btn btn-ghost" data-act="go" data-to="#/today" style="margin-top:14px">回到今日</button>') + '</div>';
    }
    if (!session) return viewToday();
    if (session.done || session.idx >= session.ids.length) return viewSessionDone();
    var id = session.ids[session.idx];
    var w = byId[id];
    if (!w) { session.idx++; return viewStudy(); }
    var card = state.cards[id] || FSRS.newCard(id);
    var isReview = session.kind === 'review';
    var pct = Math.round((session.idx / session.ids.length) * 100);
    var senses = (w.senses || []).slice(0, 4).map(function (s) {
      return '<div class="sense"><span class="pos">' + esc(s.pos) + '</span><span class="grow"><div class="zh">' + esc(s.zh) + '</div></span></div>';
    }).join('');
    var examples = (w.ex || []).slice(0, 2).map(function (ex, i) {
      return '<div class="ex-block"><span class="ex-tag' + (i === 1 ? ' is-ielts' : '') + '">' + (i === 1 ? '雅思例句' : '日常例句') + '</span>' +
        '<p class="ex-en">' + highlight(ex.en, w.w) + '</p><p class="ex-zh">' + esc(ex.zh) + '</p></div>';
    }).join('');
    var ch = String(w.w || '?').charAt(0).toUpperCase();
    var previews = [1, 2, 3, 4].map(function (g) {
      return FSRS.previewInterval(card, g);
    });

    return '<div class="page study-wrap">' +
      '<div class="study-top">' +
      '<button class="iconbtn" data-act="exit-study" aria-label="退出">' + ICON.close + '</button>' +
      '<div class="study-progress"><i style="width:' + pct + '%"></i></div>' +
      '<span class="tiny" style="font-variant-numeric:tabular-nums">' + (session.idx + 1) + '/' + session.ids.length + '</span>' +
      '</div>' +
      '<div class="study-card">' +
      '<div class="study-img"><div class="ph">' + esc(ch) + '</div><img src="assets/words/' + esc(id) + '.webp" alt=""></div>' +
      '<div class="study-body">' +
      '<h2>' + esc(w.w) + '</h2>' +
      '<div class="ipa-line">' +
      '<button class="ipa-pill" data-act="speak-word" data-id="' + esc(id) + '"><b>UK</b>' + esc(w.uk || '—') + ICON.speak + '</button>' +
      '<span class="badge cefr-' + esc(w.cefr) + '">' + esc(w.cefr) + '</span>' +
      '<span class="tag">' + esc(topicZh(w.topic)) + '</span>' +
      '</div>' +
      (session.revealed
        ? '<div class="senses">' + senses + '</div>' + examples
        : '<p class="muted" style="margin-top:18px">' + (isReview ? '先回想它的意思，再揭晓答案。' : '看着插画记一下这个词，准备好再揭晓。') + '</p>') +
      '</div></div>' +
      '<div class="study-aside">' +
      (session.revealed
        ? '<div class="rating-row">' +
          [1, 2, 3, 4].map(function (g) {
            var labels = ['忘记', '模糊', '记得', '简单'];
            return '<button class="rating r' + g + '" data-act="rate" data-id="' + g + '">' + labels[g - 1] +
              '<small>' + esc(previews[g - 1]) + '</small></button>';
          }).join('') + '</div>'
        : '<button class="btn btn-primary btn-block" data-act="reveal">显示释义</button>' +
          '<div class="reveal-hint">' + (isReview ? '先自己回想，效果更好' : '记住画面，再看中文意思') + '</div>') +
      '</div></div>';
  }
  function viewSessionDone() {
    var n = session ? session.ids.length : 0;
    var isReview = session && session.kind === 'review';
    return '<div class="page">' +
      '<div class="card result-card">' +
      '<div class="big">' + n + '<small> 张卡</small></div>' +
      '<p class="muted">' + (isReview ? '到期复习已经清空' : '今天的新词学完了') + '</p>' +
      '<div class="stat-grid">' +
      '<div class="stat"><b>' + num(state.stats.streak) + '</b><span>连续天数</span></div>' +
      '<div class="stat"><b>' + num(todayCount()) + '</b><span>今日已学</span></div>' +
      '<div class="stat"><b>' + num(dueList().length) + '</b><span>仍待复习</span></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block" data-act="session-done">回到今日</button>' +
      (isReview && dueList().length ? '<button class="btn btn-ghost btn-block" data-act="start-review">继续复习</button>' : '') +
      (isReview ? '' : '<button class="btn btn-line btn-block" data-act="go-practice">练一练刚学的词</button>') +
      '</div></div>';
  }

  /* ============ 复习入口 ============ */
  function viewReviewIntro() {
    var due = dueList();
    var todayReviews = state.stats.reviewDay === Store.todayKey() ? state.stats.reviewsToday : 0;
    var learned = learnedIds().length;
    return '<div class="page">' +
      '<div class="page-head"><div class="grow"><h1>复习</h1><p class="sub">按遗忘曲线安排，快忘的时候再见面</p></div></div>' +
      '<div class="plan-card">' +
      '<div class="plan-head"><span>' + (due.length ? '有 ' + due.length + ' 张卡到期' : '暂时没有到期') + '</span><span class="grow"></span><span class="tiny">上限 ' + S().dailyReviewCap + '/天</span></div>' +
      '<div class="plan-count">' + due.length + '<small>张等待复习</small></div>' +
      '<div class="tiny">已学 ' + num(learned) + ' 词 · 累计复习 ' + num(state.stats.reviews) + ' 次</div>' +
      '<div class="plan-actions">' +
      '<button class="btn btn-primary btn-block" data-act="start-review"' + (due.length ? '' : ' disabled') + '>' +
      '<span>开始复习</span><span class="num">' + Math.min(due.length, S().dailyReviewCap) + ' 张</span></button>' +
      '</div></div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><b>' + num(todayReviews) + '</b><span>今日复习</span></div>' +
      '<div class="stat"><b>' + num(state.stats.streak) + '</b><span>连续天数</span></div>' +
      '<div class="stat"><b>' + num(learned) + '</b><span>已学词汇</span></div>' +
      '</div>' +
      (due.length ? '' : emptyHtml('✦', '到期清空', '去学几个新词，或者做一组练习', '<button class="btn btn-ghost" data-act="go" data-to="#/practice" style="margin-top:14px">去练习</button>')) +
      '</div>';
  }

  /* ============ 练习 ============ */
  function viewPractice() {
    var learned = learnedIds().length;
    return '<div class="page">' +
      '<div class="page-head"><div class="grow"><h1>练习</h1><p class="sub">' + (learned >= 8 ? '从已学的 ' + num(learned) + ' 个词里出题' : '已学不足 8 个，先从词库里抽题') + '，一组 10 题</p></div></div>' +
      '<div class="mode-grid">' +
      Object.keys(MODES).map(function (m) {
        var d = MODES[m];
        return '<button class="mode-card" data-act="start-practice" data-id="' + m + '">' +
          '<span class="mode-ico">' + ICON[d.icon] + '</span>' +
          '<span class="grow"><b>' + d.label + '</b><span>' + d.desc + '</span></span>' +
          '<span class="muted">' + ICON.right + '</span></button>';
      }).join('') +
      '</div>' +
      '<p class="tiny" style="margin-top:14px">练习结果会按「记得 / 忘记」写回复习计划。</p>' +
      '</div>';
  }
  function viewQuiz(mode) {
    if (mode && quiz && quiz.mode !== mode) quiz = null;
    if (!quiz && !ensureQuiz(mode)) {
      return '<div class="page">' + emptyHtml('✦', '词量还不够练习', '先学几个新词，至少 4 个', '<button class="btn btn-ghost" data-act="go" data-to="#/today" style="margin-top:14px">去学习</button>') + '</div>';
    }
    if (!quiz) return viewPractice();
    if (quiz.finished) return viewQuizResult();
    var q = quiz.current;
    if (!q) return viewQuizResult();
    var w = q.word;
    var prompt = '';
    if (q.mode === 'zh2en') {
      prompt = '<div class="quiz-prompt"><div class="quiz-hint">选出对应的英文单词</div><div class="q-zh">' + esc(firstSense(w)) + '</div>' +
        '<div class="tiny" style="margin-top:6px">' + esc(posOf(w)) + '</div></div>';
    } else if (q.mode === 'en2zh') {
      prompt = '<div class="quiz-prompt"><div class="quiz-hint">选出对应的中文释义</div><div class="q-word">' + esc(w.w) + '</div>' +
        '<div class="ipa-pill" style="margin-top:8px">' + esc(w.uk || '') + '</div></div>';
    } else if (q.mode === 'listen') {
      prompt = '<div class="quiz-prompt"><div class="quiz-hint">听发音，选出单词</div>' +
        '<button class="btn btn-ghost" data-act="speak-quiz" style="min-height:64px;padding:0 26px;font-size:22px">' + ICON.speak + ' 再听一次</button></div>';
    } else if (q.mode === 'picture') {
      prompt = '<div class="quiz-prompt"><div class="quiz-hint">看图，选出对应单词</div>' +
        '<img class="q-img" src="assets/words/' + esc(q.id) + '.webp" alt=""></div>';
    } else {
      prompt = '<div class="quiz-prompt"><div class="quiz-hint">根据释义拼写单词（' + String(w.w).length + ' 个字母，开头 ' + esc(String(w.w).charAt(0).toUpperCase()) + '）</div>' +
        '<div class="q-zh">' + esc(firstSense(w)) + '</div>' +
        '<div class="tiny" style="margin-top:6px">' + esc(w.uk || '') + '</div></div>';
    }
    var body = '';
    if (q.mode === 'spell') {
      body = (q.answered
        ? '<div class="quiz-feedback">' + (q.choice === q.id ? ICON.check + ' 拼对了：' : ICON.close + ' 正确拼写：') +
          '<b style="font-family:var(--font-word);font-size:20px">' + esc(w.w) + '</b>' +
          '<button class="btn btn-ghost" style="min-height:34px;margin-left:auto" data-act="quiz-next">继续</button></div>'
        : '<input id="spellInput" class="spell-input" type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="' + esc(String(w.w).charAt(0)) + '…">' +
          '<button class="btn btn-primary btn-block" data-act="spell-submit" style="margin-top:10px">提交</button>') +
        '<div class="options"></div>';
    } else {
      body = '<div class="options">' + q.options.map(function (o, i) {
        var cls = 'option';
        if (q.answered) {
          if (o.id === q.id) cls += ' is-correct';
          else if (o.id === q.choice) cls += ' is-wrong';
          else cls += ' is-dim';
        }
        return '<button class="' + cls + '" data-act="quiz-option" data-id="' + esc(o.id) + '"' + (q.answered ? ' disabled' : '') + '>' +
          '<span class="idx">' + 'ABCD'.charAt(i) + '</span>' +
          '<span class="txt">' +
          (q.mode === 'en2zh' ? '<span class="zh">' + esc(o.zh) + '</span>' : '<span class="en">' + esc(o.word) + '</span><span class="zh">' + esc(firstSense(byId[o.id])) + '</span>') +
          '</span></button>';
      }).join('') + '</div>';
      if (q.answered) {
        var ok = q.choice === q.id;
        body += '<div class="quiz-feedback">' + (ok ? ICON.check + '<span style="color:var(--sage-ink)">答对了</span>' : ICON.close + '<span style="color:var(--terra-ink)">正确答案：' + esc(w.w) + ' · ' + esc(firstSense(w)) + '</span>') +
          '<button class="btn btn-ghost" style="min-height:34px;margin-left:auto" data-act="quiz-next">继续</button></div>';
      }
    }
    var pct = quiz.queue.length ? Math.round((quiz.pos / quiz.queue.length) * 100) : 0;
    return '<div class="page">' +
      '<div class="study-top">' +
      '<button class="iconbtn" data-act="exit-quiz" aria-label="退出">' + ICON.close + '</button>' +
      '<div class="study-progress"><i style="width:' + Math.max(3, pct) + '%"></i></div>' +
      '<span class="tiny" style="font-variant-numeric:tabular-nums">' + (quiz.pos + 1) + '/' + quiz.queue.length + '</span>' +
      '</div>' +
      prompt + body + '</div>';
  }
  function viewQuizResult() {
    var total = quiz ? quiz.attempts : 0;
    var right = quiz ? quiz.correct : 0;
    var pct = total ? Math.round((right / total) * 100) : 0;
    return '<div class="page"><div class="card result-card">' +
      '<div class="big">' + pct + '<small>%</small></div>' +
      '<p class="muted">答对 ' + right + ' / ' + total + ' 题</p>' +
      '<div class="stat-grid"><div class="stat"><b>' + right + '</b><span>答对</span></div>' +
      '<div class="stat"><b>' + Math.max(0, total - right) + '</b><span>答错</span></div>' +
      '<div class="stat"><b>' + num(learnedIds().length) + '</b><span>已学词汇</span></div></div>' +
      '<button class="btn btn-primary btn-block" data-act="again-quiz">再来一组</button>' +
      '<button class="btn btn-ghost btn-block" data-act="exit-quiz">返回练习</button>' +
      '</div></div>';
  }

  /* ============ 我的 ============ */
  function swatch(theme, cls) {
    return '<button class="swatch ' + cls + (S().theme === theme ? ' is-on' : '') + '" data-act="set" data-key="theme" data-val="' + theme + '" aria-label="' + theme + '"></button>';
  }
  function seg(key, options, current) {
    return '<span class="segmented">' + options.map(function (o) {
      return '<button class="' + (String(current) === String(o[0]) ? 'is-on' : '') + '" data-act="set" data-key="' + key + '" data-val="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</span>';
  }
  function select(key, options, current) {
    return '<select data-set="' + key + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(current) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateRowValue() {
    var iso = S().examDate;
    if (!iso) return '未设置';
    var d = daysUntil(iso);
    if (d === null) return '日期无效';
    if (d > 0) return iso + ' · 还有 ' + d + ' 天';
    if (d === 0) return iso + ' · 今天考试';
    return iso + ' · 已过 ' + -d + ' 天';
  }
  function dateSelect(id, label, options, value) {
    return '<div class="setting-row"><span class="label">' + label + '</span><span class="value"><select id="' + id + '">' +
      options.map(function (o) {
        return '<option value="' + o.v + '"' + (String(o.v) === String(value) ? ' selected' : '') + '>' + o.t + '</option>';
      }).join('') + '</select></span></div>';
  }
  function pickDate() {
    var base = S().examDate ? new Date(S().examDate + 'T00:00:00') : new Date(Date.now() + 90 * 86400000);
    if (isNaN(base.getTime())) base = new Date(Date.now() + 90 * 86400000);
    var y = base.getFullYear(), m = base.getMonth() + 1, d = base.getDate();
    var years = [], months = [], days = [];
    var nowY = new Date().getFullYear();
    for (var yy = nowY; yy <= nowY + 6; yy++) years.push({ v: yy, t: yy + ' 年' });
    for (var mm = 1; mm <= 12; mm++) months.push({ v: mm, t: mm + ' 月' });
    for (var dd = 1; dd <= 31; dd++) days.push({ v: dd, t: dd + ' 日' });
    openSheet('<h3>设置考试日期</h3><p>设好后「今日」会显示倒计时，并按日期估算每天的新词量。</p>' +
      '<div class="setting-group" style="margin-top:10px">' +
      dateSelect('dateY', '年份', years, y) +
      dateSelect('dateM', '月份', months, m) +
      dateSelect('dateD', '日期', days, d) +
      '</div>' +
      '<button class="btn btn-primary btn-block" data-act="save-date">保存</button>' +
      '<button class="btn btn-ghost btn-block" data-act="clear-date">清除日期</button>');
  }
  function ttsLabel() {
    try {
      if (window.AndroidStore && typeof AndroidStore.ttsAvailable === 'function') {
        if (AndroidStore.ttsAvailable()) return '<span style="color:var(--sage-ink)">可用</span><button class="btn btn-ghost" style="min-height:32px" data-act="tts-settings">设置</button>';
        return '<span style="color:var(--terra-ink)">不可用</span><button class="btn btn-ghost" style="min-height:32px" data-act="tts-settings">去开启</button>';
      }
    } catch (e) {}
    return '浏览器预览';
  }

  function viewMe() {
    var learned = learnedIds().length, mastered = 0;
    for (var i = 0; i < WORDS.length; i++) {
      var c = state.cards[WORDS[i].id];
      if (c && FSRS.isMastered(c)) mastered++;
    }
    var bands = [];
    for (var b = 5; b <= 8.5; b += 0.5) bands.push([b, b.toFixed(1) + ' 分']);
    return '<div class="page">' +
      '<div class="page-head"><div class="grow"><h1>我的</h1><p class="sub">所有数据保存在本机，没有账号也不需要联网</p></div></div>' +
      '<div class="section-title">学习计划</div>' +
      '<div class="setting-group">' +
      '<button class="setting-row" style="width:100%" data-act="pick-date"><span class="label">考试日期</span><span class="value">' + esc(dateRowValue()) + ICON.right + '</span></button>' +
      '<div class="setting-row"><span class="label">目标分数</span><span class="value">' + select('targetBand', bands, S().targetBand) + '</span></div>' +
      '<div class="setting-row"><span class="label">每日新词</span><span class="value">' + select('dailyNew', [5, 10, 15, 20, 30, 40, 60].map(function (n) { return [n, n + ' 个']; }), S().dailyNew) + '</span></div>' +
      '<div class="setting-row"><span class="label">学习起点</span><span class="value">' + select('startCefr', CEFR.map(function (c) { return [c, c + ' 起']; }), S().startCefr) + '</span></div>' +
      '<div class="setting-row"><span class="label">学习顺序</span><span class="value">' + seg('order', [['level', '按难度'], ['topic', '按话题']], S().order) + '</span></div>' +
      '</div>' +
      '<div class="section-title">外观</div>' +
      '<div class="setting-group">' +
      '<div class="setting-row"><span class="label">主题</span><span class="value"><span class="swatches">' +
      swatch('paper', 'paper') + swatch('starlight', 'starlight') + swatch('aurora', 'aurora') + '</span></span></div>' +
      '<div class="setting-row"><span class="label">字号</span><span class="value">' + seg('wordSize', [['s', '小'], ['m', '中'], ['l', '大']], S().wordSize) + '</span></div>' +
      '</div>' +
      '<div class="section-title">发音</div>' +
      '<div class="setting-group">' +
      '<div class="setting-row"><span class="label">口音</span><span class="value">' + seg('accent', [['uk', '英音'], ['us', '美音']], S().accent) + '</span></div>' +
      '<div class="setting-row"><span class="label">系统语音</span><span class="value">' + ttsLabel() + '</span></div>' +
      '<div class="setting-row"><span class="label">试听</span><span class="value"><button class="btn btn-ghost" style="min-height:34px" data-act="speak-text" data-text="An atlas of words, one picture at a time.">播放示例</button></span></div>' +
      '</div>' +
      '<div class="section-title">学习数据</div>' +
      '<div class="data-grid">' +
      '<div class="stat"><b>' + num(learned) + '</b><span>已学词汇</span></div>' +
      '<div class="stat"><b>' + num(mastered) + '</b><span>已掌握</span></div>' +
      '<div class="stat"><b>' + num(state.favorites.length) + '</b><span>收藏</span></div>' +
      '<div class="stat"><b>' + num(state.stats.reviews) + '</b><span>累计复习</span></div>' +
      '</div>' +
      '<div class="setting-group">' +
      '<button class="setting-row" data-act="export" style="width:100%"><span class="label">导出学习进度</span><span class="value">' + ICON.right + '</span></button>' +
      '<button class="setting-row" data-act="import" style="width:100%"><span class="label">导入学习进度</span><span class="value">' + ICON.right + '</span></button>' +
      '<button class="setting-row" data-act="reset" style="width:100%"><span class="label" style="color:var(--terra-ink)">清空全部进度</span><span class="value">' + ICON.right + '</span></button>' +
      '</div>' +
      '<div class="section-title">关于</div>' +
      '<div class="card">' +
      '<p class="tiny" style="margin:0 0 6px"><b>拾词 · 雅思词汇图鉴 v1.0</b> · 代码 MIT 许可</p>' +
      '<p class="tiny" style="margin:0">词库与插画来自开源项目 <b>Word Atlas</b>（designfuchen/word-atlas），以 <b>CC BY 4.0</b> 授权，署名 <b>Word Atlas contributors</b>。词库原样使用，插画为上游发布的 256px 缩略图。</p>' +
      '<p class="tiny" style="margin:8px 0 0">字体 Fraunces / Source Serif 4 / Atkinson Hyperlegible Next 采用 SIL OFL 1.1；许可全文随安装包提供（assets/licenses）。</p>' +
      '<p class="tiny" style="margin:8px 0 0">本应用是第三方客户端，<b>与 Word Atlas 维护者及雅思考试主办方均无关联、未获其背书</b>；非官方雅思词表。</p>' +
      '<p class="tiny" style="margin:8px 0 0">词条、例句与插画由 AI 生成，未经逐条人工审校，仅供学习参考。</p>' +
      '<p class="tiny" style="margin:8px 0 0">存储方式：' + (Store.backend === 'bridge' ? 'Android 本机存储（SharedPreferences）' : Store.backend === 'local' ? '浏览器本地存储' : '临时内存（关闭即丢失）') + '</p>' +
      '<p class="tiny" style="margin:6px 0 0">词汇范围仅作学习建议，不代表雅思分数要求。</p>' +
      '</div>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '<div style="height:20px"></div>' +
      '</div>';
  }

  /* ============ 弹层 ============ */
  function openSheet(html) {
    $('#sheet-body').innerHTML = html;
    $('#sheet').hidden = false;
    sheetOpen = true;
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    sheetOpen = false;
  }
  function confirmSheet(title, text, okLabel, onOk) {
    openSheet('<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      '<button class="btn btn-primary btn-block" data-act="sheet-ok">' + esc(okLabel) + '</button>' +
      '<button class="btn btn-ghost btn-block" data-act="sheet-close">取消</button>');
    $('#sheet-body').querySelector('[data-act="sheet-ok"]').addEventListener('click', function () {
      closeSheet();
      onOk();
    });
  }

  /* ============ 设置 ============ */
  var NUM_KEYS = { dailyNew: 1, targetBand: 1, dailyReviewCap: 1 };
  function setSetting(key, value) {
    if (NUM_KEYS[key]) value = Number(value);
    S()[key] = value;
    if (key === 'theme' || key === 'wordSize') applySettings();
    if (key === 'startCefr') { scopeCache = { key: null, list: null }; statsRefresh(); }
    Store.save(state);
    render();
  }
  function applySettings() {
    var s = S();
    document.documentElement.setAttribute('data-theme', s.theme || 'paper');
    document.documentElement.setAttribute('data-size', s.wordSize || 'm');
    try {
      if (window.AndroidStore && typeof AndroidStore.setTheme === 'function') AndroidStore.setTheme(s.theme || 'paper');
    } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', s.theme === 'paper' ? '#f6f1e7' : '#0d1120');
  }

  /* ============ 路由 ============ */
  var routeName = 'today';
  function parseRoute() {
    var hash = (location.hash || '#/today').replace(/^#\/?/, '');
    var parts = hash.split('/').filter(Boolean);
    return { name: parts[0] || 'today', parts: parts };
  }
  function renderTabbar() {
    var tabs = [
      ['today', '今日'],
      ['atlas', '图鉴'],
      ['review', '复习'],
      ['practice', '练习'],
      ['me', '我的'],
    ];
    var active = routeName === 'word' ? 'atlas' : routeName;
    var el = $('#tabbar');
    el.innerHTML = tabs.map(function (t) {
      return '<button class="' + (active === t[0] ? 'is-on' : '') + '" data-act="go" data-to="#/' + t[0] + '">' +
        ICON[t[0]] + '<span>' + t[1] + '</span></button>';
    }).join('');
  }
  function hideTabbar(hide) {
    $('#tabbar').hidden = !!hide;
    $('#view').classList.toggle('no-tab', !!hide);
  }
  function render() {
    var r = parseRoute();
    routeName = r.name;
    var html = '';
    var hideTabs = false;
    try {
      if (r.name === 'today') html = viewToday();
      else if (r.name === 'atlas') html = r.parts[1] === 'topic' ? viewTopic(r.parts[2]) : viewAtlas();
      else if (r.name === 'word') { html = viewWord(r.parts[1]); hideTabs = true; }
      else if (r.name === 'study') { html = viewStudy(); hideTabs = !!session; }
      else if (r.name === 'review') html = viewReviewIntro();
      else if (r.name === 'practice') { html = r.parts[1] ? viewQuiz(r.parts[1]) : viewPractice(); hideTabs = !!r.parts[1]; }
      else if (r.name === 'me') html = viewMe();
      else html = viewToday();
    } catch (err) {
      console.error('[render]', err);
      html = '<div class="page"><div class="card"><b>页面渲染出错</b><p class="tiny">' + esc(err && err.message) + '</p>' +
        '<button class="btn btn-ghost btn-block" data-act="go" data-to="#/today">回到今日</button></div></div>';
    }

    var scroll = scrollPos[location.hash || '#/today'] || 0;
    var viewEl = $('#view');
    viewEl.innerHTML = html;
    hideTabbar(hideTabs);
    renderTabbar();
    viewEl.scrollTop = scroll;
    if (r.name === 'atlas' && r.parts[1] !== 'topic') {
      var input = $('#atlasSearch');
      if (input && !searchQuery.trim()) input.value = '';
    }
    postRender(r);
  }
  function postRender(r) {
    if (r.name === 'practice' && quiz && quiz.current && quiz.mode === 'listen' && !quiz.current.spoken) {
      quiz.current.spoken = true;
      var w = quiz.current.word;
      setTimeout(function () { Audio2.speak(w.w); }, 280);
    }
    if (r.name === 'practice' && quiz && quiz.current && quiz.mode === 'spell' && !quiz.current.answered) {
      var si = $('#spellInput');
      if (si) si.focus();
    }
  }

  /* ============ 导航 ============ */
  function openWord(id) {
    if (!id || !byId[id]) return;
    if (!navIds.length || navIds.indexOf(id) < 0) {
      var topicList = WORDS.filter(function (w) { return w.topic === byId[id].topic; }).map(function (w) { return w.id; });
      navIds = topicList.length ? topicList : [id];
    }
    go('#/word/' + id);
  }
  function backPage() {
    if (sheetOpen) { closeSheet(); return; }
    if (session && routeName === 'study') { confirmExitStudy(); return; }
    if (quiz && routeName === 'practice') { confirmExitQuiz(); return; }
    if (history.length > 1) history.back();
    else go('#/today');
  }
  function confirmExitStudy() {
    confirmSheet('要离开学习吗？', '已经评分的词会保留，没评分的下次还会出现。', '离开', function () {
      session = null;
      go('#/today');
    });
  }
  function confirmExitQuiz() {
    confirmSheet('结束这一组练习？', '这一组的答题结果已经写入复习计划。', '结束', function () {
      quiz = null;
      go('#/practice');
    });
  }

  /* ============ 事件 ============ */
  function onAction(act, el) {
    var id = el.getAttribute('data-id') || '';
    switch (act) {
      case 'go': go(el.getAttribute('data-to') || '#/today'); break;
      case 'back': backPage(); break;
      case 'open-topic': topicFilter = { cefr: '', status: '' }; go('#/atlas/topic/' + id); break;
      case 'open-word': openWord(id); break;
      case 'start-learn': startLearn(); break;
      case 'start-review': session = null; startReview(); break;
      case 'exit-study': confirmExitStudy(); break;
      case 'reveal': if (session) { session.revealed = true; render(); } break;
      case 'rate': rate(Number(id)); break;
      case 'session-done': session = null; go('#/today'); break;
      case 'go-practice': session = null; go('#/practice'); break;
      case 'fav': {
        var i = state.favorites.indexOf(id);
        if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
        Store.save(state);
        render();
        toast(i >= 0 ? '已取消收藏' : '已收藏');
        break;
      }
      case 'featured': break;
      case 'speak-word': {
        var w = byId[id];
        if (w) Audio2.speak(w.w, el.getAttribute('data-accent') || S().accent);
        break;
      }
      case 'speak-text': Audio2.speak(el.getAttribute('data-text'), S().accent); break;
      case 'speak-quiz': if (quiz && quiz.current) Audio2.speak(quiz.current.word.w); break;
      case 'filter-cefr': topicFilter.cefr = id; render(); break;
      case 'filter-status': topicFilter.status = id; render(); break;
      case 'set': setSetting(el.getAttribute('data-key'), el.getAttribute('data-val')); break;
      case 'dismiss-onboard': S().onboarded = true; Store.save(state); render(); break;
      case 'pick-date': pickDate(); break;
      case 'save-date': {
        var yy = Number($('#dateY').value), mm = Number($('#dateM').value), dd = Number($('#dateD').value);
        var dt = new Date(yy, mm - 1, dd);
        if (dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) { toast('这个日期不存在，换一天试试'); break; }
        setSetting('examDate', yy + '-' + pad2(mm) + '-' + pad2(dd));
        closeSheet();
        break;
      }
      case 'clear-date': setSetting('examDate', ''); closeSheet(); break;
      case 'tts-settings':
        try { if (window.AndroidStore && AndroidStore.openTtsSettings) AndroidStore.openTtsSettings(); else toast('当前环境不支持打开系统语音设置'); } catch (e) {}
        break;
      case 'export': doExport(); break;
      case 'import': doImport(); break;
      case 'reset': confirmSheet('清空全部学习进度？', '卡片调度、收藏与统计都会删除，且无法撤销。建议先导出备份。', '确认清空', function () {
        state = Store.reset();
        scopeCache = { key: null, list: null };
        statsRefresh();
        applySettings();
        render();
        toast('进度已清空');
      }); break;
      case 'start-practice': startQuiz(id); break;
      case 'quiz-option': quizAnswer(id); break;
      case 'quiz-next': quizAdvance(); break;
      case 'spell-submit': spellSubmit(); break;
      case 'again-quiz': startQuiz(quiz ? quiz.mode : 'zh2en'); break;
      case 'exit-quiz': confirmExitQuiz(); break;
      case 'prev-word': if (id) go('#/word/' + id); break;
      case 'next-word': if (id) go('#/word/' + id); break;
      case 'sheet-ok': closeSheet(); break;
      case 'sheet-close': closeSheet(); break;
      default: break;
    }
  }

  function doExport() {
    var json = Store.exportJson(state);
    try {
      if (window.AndroidStore && typeof AndroidStore.exportProgress === 'function') {
        AndroidStore.exportProgress(json);
        toast('已导出到所选位置');
        return;
      }
    } catch (e) {}
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shici-progress.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('已导出进度文件');
    } catch (e2) {
      toast('导出失败：' + (e2.message || '当前环境不支持'));
    }
  }
  function doImport() {
    try {
      if (window.AndroidStore && typeof AndroidStore.importProgress === 'function') {
        AndroidStore.importProgress();
        return;
      }
    } catch (e) {}
    var f = $('#importFile');
    if (f) f.click();
  }
  window.__onImported = function (text) {
    var r = Store.importJson(text);
    if (!r.ok) { toast(r.error); return; }
    state = r.state;
    scopeCache = { key: null, list: null };
    statsRefresh();
    applySettings();
    render();
    toast('进度已导入');
  };

  function init() {
    var appEl = $('#app');
    if (appEl) appEl.hidden = false;
    applySettings();
    renderTabbar();
    if (!location.hash) {
      try { location.replace('#/today'); } catch (e) {}
    }
    render();

    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) return;
      var act = el.getAttribute('data-act');
      e.preventDefault();
      onAction(act, el);
    });

    document.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG') {
        t.style.display = 'none';
        if (t.parentNode) t.parentNode.classList.add('is-missing');
      }
    }, true);

    var searchTimer = 0;
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t && t.id === 'atlasSearch') {
        searchQuery = t.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          var body = $('#atlasBody');
          if (body) {
            body.innerHTML = atlasBodyHtml();
            listView = searchQuery.trim() ? listView : null;
          }
        }, 180);
      }
    });

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.hasAttribute('data-set')) {
        setSetting(t.getAttribute('data-set'), t.value);
      }
      if (t && t.id === 'importFile' && t.files && t.files[0]) {
        var reader = new FileReader();
        reader.onload = function () { window.__onImported(String(reader.result)); };
        reader.readAsText(t.files[0]);
        t.value = '';
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'spellInput') {
        e.preventDefault();
        spellSubmit();
      }
    });

    var sheet = $('#sheet');
    sheet.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute('data-close')) closeSheet();
    });

    window.addEventListener('pagehide', function () {
      try { Store.save(state, true); Audio2.stop(); } catch (e) {}
    });

    window.addEventListener('hashchange', function () {
      Audio2.stop();
      render();
    });

    $('#view').addEventListener('scroll', function () {
      scrollPos[location.hash || '#/today'] = $('#view').scrollTop;
      if (listView && $('#view').scrollTop + $('#view').clientHeight > $('#view').scrollHeight - 480) appendList();
    }, { passive: true });

    var touchX = 0, touchY = 0, touching = false;
    $('#view').addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { touching = false; return; }
      touching = true;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    $('#view').addEventListener('touchend', function (e) {
      if (!touching || routeName !== 'word') return;
      touching = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - touchX;
      var dy = t.clientY - touchY;
      if (Math.abs(dx) < 60 || Math.abs(dy) > 60) return;
      var r = parseRoute();
      var pos = navIds.indexOf(r.parts[1]);
      if (pos < 0) return;
      var target = dx < 0 ? navIds[pos + 1] : navIds[pos - 1];
      if (target) go('#/word/' + target);
    }, { passive: true });

    window.__appBack = function () {
      if (sheetOpen) { closeSheet(); return 'handled'; }
      if (routeName === 'study') { confirmExitStudy(); return 'handled'; }
      if (routeName === 'practice' && parseRoute().parts[1]) { confirmExitQuiz(); return 'handled'; }
      if (routeName === 'word') { backPage(); return 'handled'; }
      if (routeName !== 'today') { backPage(); return 'handled'; }
      return 'exit';
    };

    var splash = $('#splash');
    if (splash) {
      splash.classList.add('is-hidden');
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 500);
    }


    window.__APP_READY = true;
    window.__APP = { state: state, render: render, go: go, meta: META };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
