  /* ---------- 본인 확인 없는 서명지: 양식에 있는 칸 직접 입력 ---------- */
  function goSign(r, cred) {
    person = { name: cred.name, guest: cred.guest || null, disp: r.disp, already: r.already, r: r };
    fillSign(r);
    show('s2'); setupCanvas(); clearPad();
    msg($('msg2'), '');
  }
  /** 서명 화면 [뒤로]: 본인 확인 없는 서명지는 입력 화면, 직원은 서명지 목록 */
  function signBack() { if (edu && edu.guest) show('sp'); else resetAll(); }
  /* 본인 확인 없는 교육: 양식에 있는 칸만 보여 줌 (성명은 항상, 임무·역할·비고는 선택) */
  function gf() { return (edu && edu.guest && edu.fields) || {}; }
  function firstGuestField() {
    if (!(edu && edu.guest)) return 'name';
    var f = gf(); return f.dept ? 'gDept' : f.rank ? 'gRank' : 'name';
  }
  function guestMode() {
    var g = !!(edu && edu.guest), f = gf();
    $('gDeptRow').classList.toggle('hidden', !(g && f.dept));
    $('gRankRow').classList.toggle('hidden', !(g && f.rank));
    $('gRoleRow').classList.toggle('hidden', !(g && f.role));
    $('gNoteRow').classList.toggle('hidden', !(g && f.note));
    $('gRoleLabel').textContent = f.roleLabel || '임무·역할';
    $('gNote').classList.toggle('hidden', !g);
    $('nameLabel').textContent = g ? '성명' : '이름';
    $('name').placeholder = g ? '성명' : '이름';
    $('name').setAttribute('enterkeyhint', g && !f.role && !f.note ? 'go' : 'next');
  }
  function submitPerson() {
    var g = !!(edu && edu.guest), n = $('name').value.trim();
    var bad = function (t) { msg($('msgp'), t, '#c0392b'); };
    var busy = function () { $('pok').disabled = true; msg($('msgp'), '확인 중…', '#6b7686'); };
    if (g) {
      var f = gf(), gd = $('gDept').value.trim(), gr = $('gRank').value.trim();
      if (f.dept && !gd) return bad('소속을 입력하세요.');
      if (f.rank && !gr) return bad('직위를 입력하세요.');
      if (!n) return bad('성명을 입력하세요.');
      var guest = { dept: f.dept ? gd : '', rank: f.rank ? gr : '', name: n,
        role: f.role ? $('gRole').value.trim() : '', note: f.note ? $('gNoteIn').value.trim() : '' };
      busy();
      google.script.run.withSuccessHandler(function (r) {
        $('pok').disabled = false; msg($('msgp'), '');
        goSign(r, { name: n, guest: guest });
      }).withFailureHandler(function (e) {
        $('pok').disabled = false; bad(errText(e));
      }).verifyPerson({ eduId: edu.id, code: code, token: staff && staff.token || '', guest: guest });
      return;
    }
  }
  function fillSign(r) {
    $('who').textContent = ((r.disp ? r.disp + ' ' : '') + (r.name || '')).trim();
    $('eduT').textContent = edu.title + (edu.date ? ' · ' + edu.date : '');
    $('warn').classList.toggle('hidden', !r.already);
    $('roleT').textContent = r.role ? '임무·역할: ' + r.role : '';
    $('roleT').classList.toggle('hidden', !r.role);
    $('submit').textContent = r.already ? '재서명 제출' : '서명 제출';
  }
  $('pok').onclick = submitPerson;
  $('name').addEventListener('input', saveState);
  var onEnter = function (id, fn) { $(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); };
  onEnter('name', function () { gNext('name'); });
  // 본인 확인 없는 교육: Enter → 보이는 다음 칸 (마지막 칸이면 확인)
  var gOrder = [['gDept', 'gDeptRow'], ['gRank', 'gRankRow'], ['name', null], ['gRole', 'gRoleRow'], ['gNoteIn', 'gNoteRow']];
  var gNext = function (id) {
    var i = gOrder.map(function (x) { return x[0]; }).indexOf(id);
    for (var k = i + 1; k < gOrder.length; k++) if (!gOrder[k][1] || !$(gOrder[k][1]).classList.contains('hidden')) return $(gOrder[k][0]).focus();
    submitPerson();
  };
  ['gDept', 'gRank', 'gRole', 'gNoteIn'].forEach(function (id) {
    onEnter(id, function () { gNext(id); });
    $(id).addEventListener('input', saveState);
  });
  $('pback').onclick = function () { resetAll(); };

  function resetAll() {
    code = ''; edu = null; person = null; rfEdu = null; rfDirect = false;
    $('code').value = ''; $('name').value = ''; msg($('msg1'), ''); msg($('lgMsg'), ''); $('codeOver').classList.add('hidden'); popSync(); selId = '';
    if (!staff) { show('sl'); return; }
    enterList(); refreshInit();
  }

  /* ---------- 가로로 크게 서명: 버튼을 누르면 전체 화면 + 가로 고정 (안드로이드 크롬). 서명 화면을 떠나면 풀림 ----------
     아이폰 등 화면 방향을 바꿀 수 없는 곳은 버튼을 숨기고 '가로로 돌리면' 안내만. 구글 웹 앱 화면 안에서는 막힐 수 있음 */
  var LAND_OK = !!(document.documentElement.requestFullscreen && window.screen && screen.orientation && screen.orientation.lock) && !/iPhone|iPad|iPod/.test(navigator.userAgent);
  function landOn(m) {
    var fail = function () { landOff(); msg(m, '이 휴대폰은 자동으로 돌릴 수 없습니다. 휴대폰을 직접 가로로 돌려 주세요.', '#c0392b'); };
    try {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        .then(function () { return screen.orientation.lock('landscape'); }).catch(fail);
    } catch (x) { fail(); }
  }
  function landOff() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (x) {}
    try { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (x) {}
  }
  [].forEach.call(document.querySelectorAll('.lsTag'), function (t) {
    if (!LAND_OK) { t.textContent = '가로 화면으로 서명 가능'; return; }   // 아이폰 등: 휴대폰을 직접 돌리면 됨
    var b = document.createElement('button'); b.type = 'button';   // 누르면 화면이 가로로 돌아감 (회전 화살표 + 글자)
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>가로로 돌리기';
    b.onclick = function () { landOn(t.closest('#s2') ? $('msg2') : $('skMsg')); };
    t.appendChild(b);
  });

  /* ---------- 서명 패드 ---------- */
  // 획(stroke)을 '가상 좌표'로 저장해 두었다가, 화면 크기가 바뀌면(가로/세로 전환 등) 비율을 유지한 채 다시 그린다.
  var cv = $('pad'), ctx = cv.getContext('2d');
  var strokes = [], cur = null, vw = 0, vh = 0, resizeTimer = null;

  /* 세로 화면: 서명 칸 높이를 남은 화면에 맞춤 (160~280px) → 아래 버튼까지 한 화면에 보이게 */
  function fitPad() {
    if (!window.matchMedia || !window.matchMedia('(orientation: portrait)').matches) { cv.style.height = ''; return; }
    var top = cv.getBoundingClientRect().top + (window.scrollY || 0);
    var acts = document.querySelector('#s2 .actions');
    var below = (acts ? acts.offsetHeight : 60) + 12 + 14;          // 버튼 줄 + 여백 + 카드 아래 여백
    var h = Math.round(window.innerHeight - top - below);
    cv.style.height = Math.max(160, Math.min(280, h)) + 'px';
  }
  function setupCanvas() {
    fitPad();
    var r = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * r; cv.height = h * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.fillStyle = '#000';
  }
  function xf() {
    var w = cv.clientWidth, h = cv.clientHeight, s = Math.min(w / vw, h / vh);
    return { s: s, ox: (w - vw * s) / 2, oy: (h - vh * s) / 2 };
  }
  function toV(p) { var t = xf(); return { x: (p.x - t.ox) / t.s, y: (p.y - t.oy) / t.s }; }
  function toC(p) { var t = xf(); return { x: p.x * t.s + t.ox, y: p.y * t.s + t.oy }; }
  function pos(e) { var b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }

  function redraw() {
    ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    if (!vw) return;
    strokes.forEach(function (st) {
      var f = toC(st[0]);
      if (st.length === 1) { ctx.beginPath(); ctx.arc(f.x, f.y, 1.2, 0, 6.283); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      for (var i = 1; i < st.length; i++) { var q = toC(st[i]); ctx.lineTo(q.x, q.y); }
      ctx.stroke();
    });
  }

  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (submitting) return;                                       // 제출 중에는 서명 칸에 더 그려지지 않게
    if (e.pointerType === 'mouse') {                              // 마우스·터치패드로는 서명 안 됨 (손가락·펜만)
      msg($('msg2'), '서명은 휴대폰이나 태블릿 화면에 손가락(또는 펜)으로 해 주세요.', '#c0392b');
      return;
    }
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    if (!vw) { vw = cv.clientWidth; vh = cv.clientHeight; }
    drawing = true; last = pos(e);
    cur = [toV(last)]; strokes.push(cur);
    ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, 6.283); ctx.fill(); drawn += 1;
    $('submit').disabled = drawn < 6; $('msg2').textContent = '';   // 충분히 서명해야 제출 버튼 켜짐 ('서명이 너무 짧습니다' 기준)
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drawing || submitting) return; e.preventDefault();
    var p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    cur.push(toV(p));
    drawn += Math.abs(p.x - last.x) + Math.abs(p.y - last.y) > 1 ? 1 : 0;
    if (drawn >= 6) $('submit').disabled = false;
    last = p;
  });
  ['pointerup','pointercancel','pointerleave'].forEach(function (ev) {
    cv.addEventListener(ev, function () { if (drawing) { drawing = false; saveState(); } });
  });

  function clearPad() {
    strokes = []; cur = null; vw = 0; vh = 0; drawn = 0;
    ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    $('submit').disabled = true; $('msg2').textContent = '';
    saveState();
  }
  $('clear').onclick = function () { if (!submitting) clearPad(); };
  $('back').onclick = function () { if (!submitting) signBack(); };

  // 화면 회전/크기 변경: 캔버스를 다시 만들고 저장해 둔 획을 다시 그림 (서명 유지)
  function onResize() {
    if ($('s2').classList.contains('hidden')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!cv.clientWidth) return;
      setupCanvas(); redraw();
    }, 150);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  /* 서명이 있는 영역만 잘라 비율을 유지한 채 PNG로 저장.
     로그 셀 한 칸(5만 자)에 들어가도록, 너무 크면 크기를 줄여 다시 만든다 */
  var MAX_LEN = 48000;
  function exportPng() {
    var pad = 12, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    strokes.forEach(function (st) {
      st.forEach(function (pt) {
        var c = toC(pt);
        minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
        minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
      });
    });
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(cv.clientWidth, maxX + pad); maxY = Math.min(cv.clientHeight, maxY + pad);
    var r = cv.width / cv.clientWidth;
    var sw = Math.max(1, (maxX - minX) * r), sh = Math.max(1, (maxY - minY) * r);

    var sizes = [[480, 192], [360, 144], [270, 108], [200, 80]], url = '';
    for (var i = 0; i < sizes.length; i++) {
      var t = document.createElement('canvas'); t.width = sizes[i][0]; t.height = sizes[i][1];
      var c2 = t.getContext('2d');
      var sc = Math.min(t.width / sw, t.height / sh, 1.5);
      c2.drawImage(cv, minX * r, minY * r, sw, sh, (t.width - sw * sc) / 2, (t.height - sh * sc) / 2, sw * sc, sh * sc);
      url = t.toDataURL('image/png');
      if (url.length <= MAX_LEN) break;
    }
    return url;
  }

  /* ---------- 접속 기기 정보 (서명 제출 시 함께 보냄) ---------- */
  var devInfo = { ua: navigator.userAgent || '', scr: screen.width + 'x' + screen.height, touch: navigator.maxTouchPoints || 0, model: '' };
  try {   // 일부 안드로이드 크롬만 정확한 기종을 알려 줌
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['model']).then(function (v) { if (v && v.model) devInfo.model = v.model; }).catch(function () {});
    }
  } catch (e) {}

  /* ---------- 서명 제출 ---------- */
  /* 서명 제출: 손을 떼는 순간(pointerup) 바로 실행 → 휴대폰에서 한 번에 눌리게. click이 뒤따라 와도 두 번 제출되지 않게 막음 */
  function doSubmit() {
    if (submitting || $('submit').disabled) return;
    if (!strokes.length) return;
    if (drawn < 6) { msg($('msg2'), '서명이 너무 짧습니다. 조금 더 크게 서명해 주세요.', '#c0392b'); return; }
    submitting = true; drawing = false;
    $('submit').disabled = true; $('clear').disabled = true; $('back').disabled = true; $('pad').classList.add('locked');
    msg($('msg2'), '제출 중…', '#6b7686');
    var run = google.script.run.withSuccessHandler(function (res) {
      $('doneWho').textContent = ((res.disp ? res.disp + ' ' : '') + res.name).trim();
      $('doneMsg').textContent = res.title + (res.role ? ' · ' + res.role : '') + ' — ' + (res.resigned ? '재서명이 정상적으로 제출되었습니다.' : '서명이 정상적으로 제출되었습니다.') + (res.done ? ' 모든 서명자가 서명을 마쳤습니다.' : '');
      person = null; unlockPad();
      show('s3');
    }).withFailureHandler(function (e) {
      unlockPad();
      msg($('msg2'), errText(e), '#c0392b');
      $('submit').disabled = false;
    });
    if (edu && edu.pdf) { run.pdfSign(staff && staff.token || '', edu.id, exportPng(), devInfo); return; }   // PDF 서명지
    run.submitSignature({ eduId: edu.id, code: code, token: staff && staff.token || '', guest: person.guest || null, dataUrl: exportPng(), device: devInfo });
  }
  function unlockPad() { submitting = false; $('clear').disabled = false; $('back').disabled = false; $('pad').classList.remove('locked'); }
  $('submit').addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') { e.preventDefault(); doSubmit(); } });
  $('submit').onclick = doSubmit;
  $('nextPerson').onclick = function () {
    if (rfEdu) { nextRefund(); return; }
    if (!(edu && edu.guest)) { logout(); return; }   // 직원: 다음 사람은 자기 사번으로 로그인
    $('name').value = ''; ['gRank', 'gRole', 'gNoteIn'].forEach(function (id) { $(id).value = ''; }); msg($('msgp'), '');   // 본인 확인 없음: 소속은 남겨 둠(같은 소속이 이어서 서명하기 편하게)
    guestMode(); show('sp');
    setTimeout(function () { var f = gf(); $(f.dept && !$('gDept').value ? 'gDept' : f.rank ? 'gRank' : 'name').focus(); }, 50);
  };
  $('again').onclick = resetAll;

