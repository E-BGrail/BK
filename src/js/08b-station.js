  /* ---------- DID: 역 안내 화면 (서버 Station.js, 역 PC는 GitHub Pages의 station.html) ----------
   * 관리자: 보낼 역(기본 전체, [역 고르기]로 일부만)·환불 등록 QR 띄우기·내리기·안내 이미지 목록·역 코드
   * 근무자: 역 코드로 우리 역 안내 이미지 목록만. 서버가 GitHub에 올리고 역 PC는 10초마다 확인 (반영 약 1분) */
  var ST_MAX = 10;
  function stPageUrl() { return /sign\.html/.test(qrUrl) ? qrUrl.replace(/sign\.html.*$/, 'station.html') : 'https://e-bgrail.github.io/BK/station.html'; }
  function stImgBase() { try { return new URL('../BK-st/', stPageUrl()).href; } catch (x) { return 'https://e-bgrail.github.io/BK-st/'; } }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  /** 지금 보여 줄 이미지인지 (역 화면 station.html의 live와 같은 규칙: 기간은 끝 날 포함, 시간대는 끝 시각 전까지·밤 넘김 가능) */
  function stLive(it, d) {
    d = d || new Date();
    var day = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()), hm = p2(d.getHours()) + ':' + p2(d.getMinutes());
    if (it.from && day < it.from) return false;
    if (it.to && day > it.to) return false;
    if (it.h1 && it.h2 && it.h1 !== it.h2) return it.h1 < it.h2 ? hm >= it.h1 && hm < it.h2 : hm >= it.h1 || hm < it.h2;
    return true;
  }
  function stWhen(it) {             // 목록 줄에 작게: 11.10~11.30 · 07:00~09:00
    var md = function (x) { return x ? Number(x.slice(5, 7)) + '.' + Number(x.slice(8)) : ''; };
    var a = it.from || it.to ? md(it.from) + '~' + md(it.to) : '', b = it.h1 ? it.h1 + '~' + it.h2 : '';
    return [a, b].filter(Boolean).join(' · ');
  }
  function stEl(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /** 이미지를 긴 쪽 1920px 이하 JPEG로 줄여서 보냄 (작은 PNG·WEBP는 그대로) */
  function stShrink(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var W = im.naturalWidth, H = im.naturalHeight, s = Math.min(1, 1920 / Math.max(W, H));
        if (s === 1 && file.size < 1.5e6 && /^image\/(png|webp|jpeg)$/.test(file.type)) {
          URL.revokeObjectURL(url);
          var fr = new FileReader();
          fr.onload = function () { ok({ type: file.type, b64: String(fr.result).split(',')[1] }); };
          fr.onerror = function () { no(new Error(file.name + ': 읽지 못했습니다.')); };
          fr.readAsDataURL(file); return;
        }
        var cv = document.createElement('canvas'); cv.width = Math.round(W * s); cv.height = Math.round(H * s);
        var g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok({ type: 'image/jpeg', b64: cv.toDataURL('image/jpeg', 0.85).split(',')[1] });
      };
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error(file.name + ': 이미지를 읽지 못했습니다.')); };
      im.src = url;
    });
  }

  /**
   * 안내 이미지 목록 편집기 (관리자·근무자 같이 씀): 한 장씩 추가·삭제·순서, 누르면 세부(이름·초·게시 기간·시간대), 화면 맞춤
   * 바꾼 것은 [보내기] 전까지 이 화면에만 (dirty)
   */
  function stEditor(box, m, onChange) {
    var ed = { items: [], fit: 'contain', open: -1, dirty: false };
    var head = stEl('div', 'edHead'), cnt = stEl('small', 'edCnt'), list = stEl('div', 'edList');
    head.appendChild(stEl('b', '', '안내 이미지')); head.appendChild(cnt);
    var add = stEl('label', 'btn gray edAdd', '+ 이미지 추가'), inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp'; inp.multiple = true; inp.className = 'hidden'; add.appendChild(inp);
    var fitL = stEl('div', 'edFitL', '화면 맞춤 (모든 이미지 공통)'), seg = stEl('div', 'edSeg');
    [['contain', '전체 보이기'], ['cover', '꽉 채우기']].forEach(function (v) {
      var b = stEl('button', '', v[1]); b.type = 'button'; b.dataset.v = v[0];
      b.onclick = function () { if (ed.fit !== v[0]) { ed.fit = v[0]; touch(); draw(); } };
      seg.appendChild(b);
    });
    [head, list, add, fitL, seg].forEach(function (e) { box.appendChild(e); });
    function touch() { ed.dirty = true; if (onChange) onChange(); }
    function move(i, d) { var j = i + d; if (j < 0 || j >= ed.items.length) return; var t = ed.items[i]; ed.items[i] = ed.items[j]; ed.items[j] = t; if (ed.open === i) ed.open = j; else if (ed.open === j) ed.open = i; touch(); draw(); }
    function field(lab, type, val, set, attrs) {
      var f = stEl('div', 'field'), l = stEl('label', '', lab), x = document.createElement('input');
      x.type = type; x.value = val || ''; Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); });
      x.onchange = function () { set(x.value.trim()); touch(); draw(); };
      f.appendChild(l); f.appendChild(x); return f;
    }
    function pair(lab, a, b, type, it, hint) {
      var f = stEl('div', 'field'); f.appendChild(stEl('label', '', lab));
      var r = stEl('div', 'edPair');
      [a, b].forEach(function (k, n) {
        var x = document.createElement('input'); x.type = type; x.value = it[k] || ''; x.setAttribute('aria-label', lab + (n ? ' 끝' : ' 시작'));
        x.onchange = function () { it[k] = x.value; touch(); draw(); };
        r.appendChild(x); if (!n) r.appendChild(stEl('span', '', '~'));
      });
      f.appendChild(r); f.appendChild(stEl('div', 'hint', hint)); return f;
    }
    function draw() {
      cnt.textContent = ed.items.length + ' / ' + ST_MAX + '장';
      add.classList.toggle('hidden', ed.items.length >= ST_MAX);
      [].forEach.call(seg.children, function (b) { b.classList.toggle('on', b.dataset.v === ed.fit); b.setAttribute('aria-pressed', b.dataset.v === ed.fit); });
      list.innerHTML = '';
      if (!ed.items.length) list.appendChild(stEl('div', 'hint', '이미지가 없습니다. 역 화면에는 시계만 나옵니다.'));
      ed.items.forEach(function (it, i) {
        var row = stEl('div', 'edRow' + (ed.open === i ? ' open' : '') + (stLive(it) ? '' : ' off'));
        var th = stEl('img', 'edTh'); th.alt = ''; th.src = it.url; th.onerror = function () { th.classList.add('bad'); };
        var nm = stEl('div', 'edName'); nm.appendChild(stEl('b', '', (i + 1) + ' ' + (it.n || '이미지')));
        var w = stWhen(it); if (w) nm.appendChild(stEl('small', '', w + (stLive(it) ? '' : ' (지금은 안 나옴)')));
        row.appendChild(th); row.appendChild(nm); row.appendChild(stEl('span', 'edSec', it.s + '초'));
        [['▲', '위로', function () { move(i, -1); }], ['▼', '아래로', function () { move(i, 1); }],
          ['✕', '삭제', function () { if (confirm((it.n || (i + 1) + '번 이미지') + '를 목록에서 뺄까요? (보내야 역 화면에서 빠집니다)')) { ed.items.splice(i, 1); if (ed.open === i) ed.open = -1; else if (ed.open > i) ed.open--; touch(); draw(); } }]].forEach(function (b) {
          var x = stEl('button', 'edBtn', b[0]); x.type = 'button'; x.setAttribute('aria-label', b[1]);
          x.onclick = function (ev) { ev.stopPropagation(); b[2](); }; row.appendChild(x);
        });
        row.onclick = function () { ed.open = ed.open === i ? -1 : i; draw(); };
        list.appendChild(row);
        if (ed.open !== i) return;
        var det = stEl('div', 'edDet'), big = stEl('img', 'edBig' + (ed.fit === 'cover' ? ' cover' : '')); big.alt = ''; big.src = it.url;
        det.appendChild(big);
        det.appendChild(field('이름 (관리용)', 'text', it.n, function (v) { it.n = v.slice(0, 40); }, { maxlength: '40' }));
        det.appendChild(field('보여 주는 시간(초, 3~600)', 'tel', String(it.s), function (v) { var s = Math.round(Number(v)); it.s = isFinite(s) && s >= 3 ? Math.min(600, s) : 10; }, { inputmode: 'numeric', maxlength: '3' }));
        det.appendChild(pair('게시 기간', 'from', 'to', 'date', it, '비우면 계속 나옵니다. 끝 날까지 나옵니다.'));
        det.appendChild(pair('시간대', 'h1', 'h2', 'time', it, '비우면 하루 종일. 끝 시각 전까지 (예: 22:00~06:00은 밤사이).'));
        list.appendChild(det);
      });
    }
    inp.onchange = function () {
      var fs = [].slice.call(inp.files || []); inp.value = '';
      var room = ST_MAX - ed.items.length;
      if (fs.length > room) msg(m, '이미지는 ' + ST_MAX + '장까지 넣을 수 있습니다. 앞의 ' + room + '장만 넣었습니다.', '#c0392b');
      fs.slice(0, room).forEach(function (f) { ed.items.push({ file: f, url: URL.createObjectURL(f), n: f.name.replace(/\.[^.]+$/, '').slice(0, 40), s: 10, from: '', to: '', h1: '', h2: '' }); });
      if (fs.length) { touch(); draw(); }
    };
    /** 서버 목록으로 (sent: 방금 보낸 목록이면 새 이미지는 아직 GitHub에 없을 수 있어 고른 파일로 미리보기) */
    ed.set = function (items, fit, sent) {
      var base = stImgBase();
      ed.items = (items || []).map(function (x, i) {
        var o = Object.assign({}, x), old = sent && sent[i];
        o.url = old && old.file ? old.url : base + x.p;
        return o;
      });
      ed.fit = fit === 'cover' ? 'cover' : 'contain'; ed.open = -1; ed.dirty = false; draw();
    };
    /** 보낼 값: 새 파일은 줄여서 files로, 목록에는 { f: 번호 } */
    ed.payload = function () {
      for (var i = 0; i < ed.items.length; i++) {
        var it = ed.items[i], nm = it.n || (i + 1) + '번 이미지';
        if (it.from && it.to && it.from > it.to) return Promise.reject(new Error(nm + ': 게시 기간 끝이 시작보다 빠릅니다.'));
        if (!it.h1 !== !it.h2) return Promise.reject(new Error(nm + ': 시간대는 시작과 끝을 함께 넣으세요.'));
      }
      var news = ed.items.filter(function (it) { return it.file; });
      if (news.length) msg(m, '이미지 줄이는 중…', '#6b7686');
      return Promise.all(news.map(function (it) { return stShrink(it.file); })).then(function (files) {
        var items = ed.items.map(function (it) {
          var o = { n: it.n, s: it.s, from: it.from || '', to: it.to || '', h1: it.h1 || '', h2: it.h2 || '' };
          if (it.file) o.f = news.indexOf(it); else o.p = it.p;
          return o;
        });
        return { items: items, files: files, fit: ed.fit };
      });
    };
    ed.preview = function () { stPreview(ed.items, ed.fit); };
    draw();
    return ed;
  }

  /* ---------- 미리보기: 역 화면처럼 넘겨 봄 (누르면 다음) ---------- */
  var SPV = { list: [], i: 0, t: null };
  function stPreview(items, fit) {
    if (!items.length) { alert('미리 볼 이미지가 없습니다.'); return; }
    SPV.list = items; SPV.i = 0;
    $('stPrevImg').classList.toggle('cover', fit === 'cover');
    var was = $('stPrevOver').classList.contains('hidden');
    $('stPrevOver').classList.remove('hidden'); document.body.classList.add('skLock');
    if (was) popPush();                    // 휴대폰 뒤로가기 = 미리보기 닫기
    pvShow();
  }
  function pvShow() {
    clearTimeout(SPV.t);
    var it = SPV.list[SPV.i]; if (!it) return;
    $('stPrevImg').src = it.url;
    var w = stWhen(it);
    $('stPrevCap').textContent = (SPV.i + 1) + ' / ' + SPV.list.length + ' · ' + (it.n || '이미지') + ' · ' + it.s + '초' + (w ? ' · ' + w : '') + (stLive(it) ? '' : ' (지금은 안 나옴)');
    SPV.t = setTimeout(function () { SPV.i = (SPV.i + 1) % SPV.list.length; pvShow(); }, Math.max(3, it.s) * 1000);
  }
  function pvClose() { clearTimeout(SPV.t); $('stPrevOver').classList.add('hidden'); $('stPrevImg').removeAttribute('src'); document.body.classList.remove('skLock'); popSync(); }
  $('stPrevOver').onclick = function () { SPV.i = (SPV.i + 1) % SPV.list.length; pvShow(); };
  $('stPrevX').onclick = function (ev) { ev.stopPropagation(); pvClose(); };
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('stPrevOver').classList.contains('hidden')) pvClose(); });

  /* ---------- 관리자: 역 안내 화면 ---------- */
  var stSel = {}, stD = null, stPicked = false;
  var stEd = stEditor($('stEd'), $('stMsg'), function () { stSum(); });
  function stNames() { return Object.keys(stSel).filter(function (k) { return stSel[k]; }); }
  function stSelRows() { return stD ? stD.stations.filter(function (s) { return stSel[s.name]; }) : []; }
  function stKey(s) { return JSON.stringify([s.items, s.fit]); }
  /** 고른 역의 목록을 편집기로 (바꾸던 중이면 그대로 둠). 역마다 다르면 첫 역 목록 + 안내 */
  function stDraft(force) {
    var rows = stSelRows(), first = rows[0];
    var differ = rows.some(function (s) { return stKey(s) !== stKey(first); });
    if (first && (force || !stEd.dirty)) stEd.set(first.items, first.fit);
    else if (!first && (force || !stEd.dirty)) stEd.set([], 'contain');
    $('stDiff').classList.toggle('hidden', !differ);
    if (differ) $('stDiff').textContent = '고른 역의 이미지가 서로 다릅니다. 아래는 ' + first.name + ' 목록이고, 보내면 고른 역 모두 이 목록으로 바뀝니다.';
    stSum();
  }
  /** 맨 위 '지금 역 화면' 요약·보낼 역 표시·버튼 */
  function stSum() {
    var rows = stSelRows(), all = stD ? stD.stations.length : 0, n = rows.length;
    var names = rows.map(function (s) { return s.name; });
    $('stTo').textContent = !n ? '고른 역 없음' : n === all ? '전체 ' + all + '개 역' : n + '개 역: ' + names.slice(0, 3).join(', ') + (n > 3 ? ' 외 ' + (n - 3) + '곳' : '');
    $('stTo').classList.toggle('none', !n);
    $('stPickN').textContent = n + '개 역 선택';
    var live = stEd.items.filter(function (it) { return stLive(it); }).length;
    var qr = rows.filter(function (s) { return s.qr && s.qr.live; }).length, nc = rows.filter(function (s) { return !s.code; }).length;
    $('stNow').textContent = !stD ? '불러오는 중…' : !n ? '역을 고르세요' :
      (stEd.items.length ? '안내 이미지 ' + live + (live !== stEd.items.length ? ' / ' + stEd.items.length : '') + '장 재생' : '이미지 없음 (시계만)') +
      ' · ' + (qr ? 'QR 표시 중 ' + qr + '곳' : 'QR 없음') + (nc ? ' · 코드 없는 역 ' + nc + '곳' : '') + (stEd.dirty ? ' · 보내지 않은 변경 있음' : '');
    $('stQrOn').disabled = !n || !$('stRf').value; $('stQrOff').disabled = !n; $('stImgSave').disabled = !n;
    $('stCodeBox').classList.toggle('hidden', n !== 1);
    if (n === 1) $('stCodeName').textContent = names[0];
  }
  var ST_KEY = 'bglStInfo';           // 지난 역 정보 (이 기기, 로그아웃하면 지움): DID를 열면 이것부터 그림
  function stSave(d) { try { localStorage.setItem(ST_KEY, JSON.stringify(Object.assign({}, d, { note: '' }))); } catch (x) {} }
  function stSaved() { try { var d = JSON.parse(localStorage.getItem(ST_KEY) || 'null'); return d && Array.isArray(d.stations) && Array.isArray(d.refunds) ? d : null; } catch (x) { return null; } }
  function stRender(d) {
    stD = d; $('stPage').textContent = stPageUrl(); stSave(d);
    var names = d.stations.map(function (s) { return s.name; });
    Object.keys(stSel).forEach(function (k) { if (names.indexOf(k) < 0) delete stSel[k]; });
    if (!stPicked) { names.forEach(function (k) { stSel[k] = true; }); stPicked = true; }   // 처음엔 전체 역
    stList();
    var sel = $('stRf'), prev = sel.value; sel.innerHTML = '';
    if (!d.refunds.length) { var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '고객용 QR 접수 중인 환불 등록 없음'; sel.appendChild(o0); }
    d.refunds.forEach(function (e) { var o = document.createElement('option'); o.value = e.id; o.textContent = e.title; sel.appendChild(o); });
    if (prev && d.refunds.some(function (e) { return e.id === prev; })) sel.value = prev;
    stDraft();
    if (!d.ready) msg($('stMsg'), '역 화면 저장소 토큰이 아직 없습니다 (스크립트 속성 ST_GH_TOKEN). 넣기 전에는 올릴 수 없습니다.', '#c0392b');
    else if (d.note) msg($('stMsg'), d.note, '#12833b');
  }
  function stList() {
    var box = $('stList'); box.innerHTML = '';
    stD.stations.forEach(function (s) {
      var l = stEl('label', 'stRow' + (s.qr && s.qr.live ? ' on' : '') + (s.code ? '' : ' nocode'));
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!stSel[s.name];
      cb.onchange = function () { stSel[s.name] = cb.checked; stSum(); };
      var t = stEl('div'); t.appendChild(stEl('b', '', s.name));
      var sm = stEl('small', '', s.qr && s.qr.live ? 'QR 표시 중' : !s.code ? '코드 없음' : '이미지 ' + s.items.length + '장');   // 역 코드는 보이지 않음
      if (s.qr) sm.title = s.qr.title;
      t.appendChild(sm); l.appendChild(cb); l.appendChild(t); box.appendChild(l);
    });
  }
  /** 역 정보: 저장본이 있으면 먼저 그리고 최신은 로딩창 없이 받음. 직원 로그인 표시로 바로 받음 (관리자 로그인은 저장·QR 등 할 때만) */
  function stLoad() {
    var old = stD || stSaved(), same = function (d) { return old && JSON.stringify(Object.assign({}, d, { note: '' })) === JSON.stringify(Object.assign({}, old, { note: '' })); };
    if (old && !stD) stRender(old);
    BUSY_SKIP.staffStInfo = old ? 1 : 0;             // 저장본이 없을 때만 가운데 로딩 표시
    srv().withSuccessHandler(function (d) { if (same(d)) stSave(d); else stRender(d); })
      .withFailureHandler(function (e) { if (/로그인이 필요/.test(errText(e))) { logout(errText(e)); return; } msg($('stMsg'), (old ? '최신 정보를 받지 못해 지난 정보를 보여 줍니다: ' : '') + errText(e), '#c0392b'); })
      .staffStInfo(staff && staff.token || '');
  }
  function stNeed() { if (!stNames().length) { msg($('stMsg'), '보낼 역을 하나 이상 고르세요.', '#c0392b'); return false; } return true; }
  $('stHead').onclick = function () { if ($('stCard').classList.toggle('open')) stLoad(); };
  function stPickShow(on) { $('stPick').classList.toggle('hidden', !on); $('stPickBtn').setAttribute('aria-expanded', on); $('stPickBtn').textContent = on ? '역 고르기 ▴' : '역 고르기 ▸'; }
  $('stPickBtn').onclick = function () { stPickShow($('stPick').classList.contains('hidden')); };
  $('stPickOk').onclick = function () { stPickShow(false); stDraft(); };
  $('stAll').onclick = function () { if (!stD) return; stD.stations.forEach(function (s) { stSel[s.name] = true; }); stList(); stSum(); };
  $('stNone').onclick = function () { stSel = {}; if (stD) { stList(); stSum(); } };
  $('stRf').onchange = stSum;
  $('stPrev').onclick = function () { stEd.preview(); };
  $('stQrOn').onclick = function () {
    if (!stNeed() || !$('stRf').value) return;
    admCall('adminStQr', [stNames(), $('stRf').value, rfUrl('')], stRender, $('stMsg'));
  };
  $('stQrOff').onclick = function () { if (stNeed()) admCall('adminStQr', [stNames(), '', ''], stRender, $('stMsg')); };
  $('stCodeSave').onclick = function () {
    var n = stNames(); if (n.length !== 1) { msg($('stMsg'), '역 코드는 한 역만 골라서 정하세요.', '#c0392b'); return; }
    var c = $('stCode').value.trim();
    if (!c && !confirm(n[0] + ' 역 코드를 지우면 그 역 화면이 꺼집니다. 지울까요?')) return;
    admCall('adminStCode', [n[0], c], function (d) { $('stCode').value = ''; stRender(d); }, $('stMsg'));
  };
  $('stImgSave').onclick = function () {
    if (!stNeed()) return;
    var n = stNames().length;
    if (!stEd.items.length && !confirm('고른 역 ' + n + '곳의 안내 이미지를 모두 비울까요? (역 화면에는 시계만 나옵니다)')) return;
    if (n > 1 && !$('stDiff').classList.contains('hidden') && !confirm('고른 역 ' + n + '곳 모두 이 목록으로 바뀝니다. 보낼까요?')) return;
    var sent = stEd.items.slice();
    stEd.payload().then(function (p) {
      p.names = stNames();
      admCall('adminStImgs', [p], function (d) {
        stRender(d);
        var first = stSelRows()[0]; if (first) stEd.set(first.items, first.fit, sent);
        stSum();
      }, $('stMsg'));
    }).catch(function (e) { msg($('stMsg'), e.message, '#c0392b'); });
  };

  /* ---------- 역 근무자: 우리 역 안내 이미지 (역 코드로 그 역만, QR은 관리자만) ---------- */
  var smEd = stEditor($('smEd'), $('smMsg'), function () { smSum(); });
  function smSum() {
    var live = smEd.items.filter(function (it) { return stLive(it); }).length;
    $('smNow').textContent = (smEd.items.length ? '안내 이미지 ' + live + (live !== smEd.items.length ? ' / ' + smEd.items.length : '') + '장 재생' : '이미지 없음 (시계만)') + (smEd.dirty ? ' · 보내지 않은 변경 있음' : '');
  }
  function smGot(r, sent) { $('smName').textContent = r.name; $('smBody').classList.remove('hidden'); smEd.set(r.items, r.fit, sent); smSum(); if (r.note) msg($('smMsg'), r.note, '#12833b'); }
  function smFail(e) { if (/로그인이 필요/.test(errText(e))) { logout(errText(e)); return; } msg($('smMsg'), errText(e), '#c0392b'); }
  $('smHead').onclick = function () { $('smCard').classList.toggle('open'); };
  $('smLoad').onclick = function () {
    var code = $('smCode').value.trim();
    if (!code) { msg($('smMsg'), '역 코드를 넣으세요.', '#c0392b'); return; }
    if (smEd.dirty && !confirm('보내지 않은 변경이 있습니다. 버리고 다시 불러올까요?')) return;
    msg($('smMsg'), '');
    srv().withSuccessHandler(function (r) { smGot(r); }).withFailureHandler(smFail).staffStGet(staff && staff.token || '', code);
  };
  $('smCode').onkeydown = function (ev) { if (ev.key === 'Enter') $('smLoad').click(); };
  $('smPrev').onclick = function () { smEd.preview(); };
  $('smSave').onclick = function () {
    var code = $('smCode').value.trim();
    if (!code) { msg($('smMsg'), '역 코드를 넣으세요.', '#c0392b'); return; }
    if (!smEd.items.length && !confirm('우리 역 안내 이미지를 모두 비울까요? (역 화면에는 시계만 나옵니다)')) return;
    var sent = smEd.items.slice();
    smEd.payload().then(function (p) {
      msg($('smMsg'), '올리는 중…', '#6b7686');
      srv().withSuccessHandler(function (r) { smGot(r, sent); }).withFailureHandler(smFail).staffStImgs(staff && staff.token || '', code, p);
    }).catch(function (e) { msg($('smMsg'), e.message, '#c0392b'); });
  };

  /* ---------- DID 화면 (오른쪽 위 [DID]): 관리자 → [역 안내 화면], 근무자 → [우리 역 안내 이미지] ---------- */
  var KIOSK_WANT = false;                           // 차량관리의 [DID]를 로그인 전에 누름: 로그인 뒤 DID로
  function kioskOpen() {
    KIOSK_WANT = false;
    if (!staff || !staff.token || staff.guest) { enterList(); return; }
    enterList(); show('sq');
    var adm = isAdm();
    if (adm) { $('stCard').classList.add('open'); stLoad(); }   // 열 때마다 최신으로 (이미 그린 게 있으면 로딩창 없이)
    if (!adm) $('smCard').classList.add('open');
  }
  SWF.kiosk = kioskOpen;
  SWF.sign = function () { enterList(); };
