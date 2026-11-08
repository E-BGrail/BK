/* ▼▼▼ 여기만 고치세요: 서버(Apps Script 웹 앱) 배포 주소 (…/exec 로 끝남) ▼▼▼ */
var API = 'https://script.google.com/macros/s/AKfycbwjudREVuPqSxXknvG5XClW_tQKbD-4wkCJkyeZt0KKY-spuDCymTt9O5j_6L28Z9QK/exec';
/* ▲▲▲ */
/* e-싸인 화면 (GitHub Pages). 화면은 여기, 저장·조회는 Apps Script(Api.js의 doPost {fn, args})가 처리.
   아래 api()·errText()·busyOn()은 차량 화면(src/car/car.js)도 같이 씀 */
var SIGN_HOME = location.origin + location.pathname;
/** 서버 함수 호출 → Promise (text/plain POST: 다른 주소에서도 사전 요청 없이) */
function api(name, args) {
  return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: name, args: args || [] }) })
    .then(function (r) { if (!r.ok) throw new Error('서버 응답 오류 (' + r.status + ')'); return r.json(); },
          function () { throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.'); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || '오류가 났습니다.'); return j.data; });
}
function errText(e) { return String(e && e.message ? e.message : e || '오류가 났습니다.').replace(/^(Error|Exception):s*/, ''); }
/** 가운데 로딩 표시: 도는 동그라미 + 문구 (0.3초 넘게 걸릴 때만). 돌려준 함수를 부르면 끔 (여러 개가 겹치면 마지막에 끔) */
var BUSY = { n: 0, t: null, el: null };
function busyOn(text) {
  if (!BUSY.el) {
    BUSY.el = document.createElement('div'); BUSY.el.className = 'busyOver hidden'; BUSY.el.setAttribute('role', 'status'); BUSY.el.setAttribute('aria-live', 'polite');
    BUSY.el.innerHTML = '<div class="busyBox"><span class="busySpin"></span><b></b></div>'; document.body.appendChild(BUSY.el);
  }
  BUSY.n++; BUSY.el.querySelector('b').textContent = text;
  if (!BUSY.t && BUSY.el.classList.contains('hidden')) BUSY.t = setTimeout(function () { BUSY.t = null; if (BUSY.n > 0) BUSY.el.classList.remove('hidden'); }, 300);
  var done = false;
  return function () {
    if (done) return; done = true;
    if (--BUSY.n > 0) return;
    BUSY.n = 0; clearTimeout(BUSY.t); BUSY.t = null; BUSY.el.classList.add('hidden');
  };
}
/** Promise가 끝나면(성공·실패 모두) 로딩 표시 끔 */
function busyWrap(pr, text) {
  var off = busyOn(text);
  return pr.then(function (d) { off(); return d; }, function (e) { off(); throw e; });
}

function START(INIT) {
/** 오른쪽 위 전환 버튼 [e-싸인][차량관리][DID]: 누른 쪽에 불이 들어오며 그 화면으로 이동
 *  DID는 이 화면 안의 DID 화면(sq), e-싸인은 서명지 목록 (urls 값이 함수면 이동 없이 그 함수) */
var swAllowed = false, swHere = 'sign', SWF = {};
function swLight(k) {
  swHere = k;
  [].forEach.call(document.querySelectorAll('#appSw .sw'), function (x) { var on = x.dataset.k === k; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
}
function appSwitch(sw, urls) {
  var gone = false;
  [].forEach.call(sw.querySelectorAll('.sw'), function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var k = b.dataset.k, here = swHere;
      if (!swAllowed || gone || k === here || !urls[k]) return;   // 로그인 전·배포용 아이디는 눌러도 반응 없음
      if (typeof urls[k] === 'function') { urls[k](); return; }
      gone = true; sw.classList.add('go');
      [].forEach.call(sw.querySelectorAll('.sw'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      setTimeout(function () { window.open(urls[k], '_top'); }, 220);
      setTimeout(function () {                               // 이동이 안 됐을 때(뒤로 오기 등) 원래대로
        gone = false; sw.classList.remove('go');
        swLight(here);
      }, 4000);
    });
  });
}
appSwitch(document.getElementById('appSw'), { car: function () { CARAPP.go('?car'); }, sign: function () { SWF.sign(); }, kiosk: function () { SWF.kiosk(); } });   // 차량관리: 같은 페이지 안 차량 화면
(function () {
  var $ = function (id) { return document.getElementById(id); };
  /* ---------- 서버 호출: srv().withSuccessHandler(f).withFailureHandler(g).함수(값…) (예전 google.script.run 모양, 속은 api())
   * 0.3초 넘게 걸리면 가운데 로딩 표시. 자동으로 도는 호출(BUSY_SKIP)은 표시 안 함 */
  var BUSY_SKIP = { staffPing: 1, staffLogout: 1, staffRfLeft: 1 };
  var BUSY_TEXT = {
    staffLogin: '로그인하는 중',
    enterCode: '확인하는 중', verifyPerson: '확인하는 중', empMailVerify: '확인하는 중', empChangeVerify: '확인하는 중', adminPcLookup: '확인하는 중',
    empMailSend: '메일 보내는 중', empChangeSend: '메일 보내는 중',
    submitSignature: '서명 저장 중', pdfSign: '서명 저장 중', safetySubmit: '데이터 저장 중', safetyLeaderSubmit: '서명 저장 중', submitRefund: '데이터 저장 중',
    adminCreateEdu: '서명지 만드는 중', pdfCreate: '서명지 만드는 중',
    staffDeleteEdu: '삭제하는 중', pdfDelete: '삭제하는 중', adminPcReset: '초기화하는 중',
    adminGradeSet: '데이터 저장 중', adminExportPdf: '파일 만드는 중', adminExportLog: '파일 만드는 중', eduPdf: '파일 만드는 중', safetyPdf: '파일 만드는 중'
  };
  function busyText(k) { return BUSY_TEXT[k] || (/^(admin(Edit|Set|Reorder|Sort|Unlock|St(Code|Imgs|Qr))|staffStImgs|staff(SetOpen|RfExtend)|emp(Change|Register)$|safetyLeaderCancel)/.test(k) ? '데이터 저장 중' : '데이터 불러오는 중'); }
  function srv() { return runner(null, null); }
  function runner(ok, fail) {
      return new Proxy({}, { get: function (_, k) {
        if (k === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (k === 'withFailureHandler') return function (f) { return runner(ok, f); };
        if (typeof k !== 'string') return undefined;
        return function () {
          var off = BUSY_SKIP[k] ? function () {} : busyOn(busyText(k));
          api(k, [].slice.call(arguments)).then(function (d) { try { if (ok) ok(d); } finally { off(); } }, function (e) { try { if (fail) fail(e); } finally { off(); } });   // 처리 뒤에 끔: 이어서 부르는 호출이 있으면 로딩창이 꺼지지 않고 한 번만
        };
      } });
  }
  var drawn = 0, drawing = false, last = null, submitting = false;   // submitting: 서명 제출 중 (서명 칸·지우기·뒤로 막음)
  var edus = [], selId = '', code = '', edu = null, person = null;
  var staff = null;                      // 로그인: { token, name, disp, admin } 또는 배포용 아이디 { token, guest: true } (이 탭에서만 기억, 개인 코드는 저장 안 함)
  try { staff = JSON.parse(sessionStorage.getItem('bglStaff') || 'null'); } catch (x) {}
  var ACT_KEY = 'bglAct', lastAct = 0, lastPing = 0, lastSave = 0;   // 마지막 동작 시각 (이 탭에서만), 서버에 '사용 중' 알린 시각
  try { lastAct = Number(sessionStorage.getItem(ACT_KEY)) || 0; } catch (x) {}
  if (staff && (!staff.token || !staff.ttl || Date.now() - lastAct > staff.ttl * 1000)) staff = null;   // 예전 표시·마지막 동작 후 20분 지난 로그인

  function show(id) {
    ['sl', 's1', 'sq', 'sp', 's2', 's3', 'sf', 'sx', 'so', 'sr', 'sk', 'su', 'sv'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    var flow = ['s1', 's2', 's3'], at = id === 'sp' ? 1 : flow.indexOf(id), adminScr = ['so', 'sr'].indexOf(id) > -1;
    document.body.setAttribute('data-s', id);
    $('hero').classList.toggle('hidden', id !== 's1' && id !== 'sl');
    $('heroText').textContent = id === 'sl' ? '사번과 개인 코드로 로그인하세요.' : '서명지를 고르고 현장에서 안내받은 접속 코드를 입력하세요.';
    $('steps').classList.toggle('hidden', at < 0 || (!!rfEdu && id === 's3'));   // 환불 등록은 단계 표시 없음
    $('foot').classList.toggle('hidden', adminScr);
    if (id === 's3') {
      $('nextPerson').textContent = rfEdu ? '다음 승객 등록' : edu && edu.guest ? '같은 서명지 · 다음 사람 서명' : '로그아웃';
      var fin = !!(rfEdu && rfDirect);            // QR로 들어온 승객: 등록 후 끝 화면 (버튼 없이 '창을 닫으셔도 됩니다')
      $('doneClose').classList.toggle('hidden', !fin);
      $('nextRow').classList.toggle('hidden', fin); $('againRow').classList.toggle('hidden', fin);
    }
    [].forEach.call(document.querySelectorAll('#steps .st1'), function (el, i) {
      el.classList.toggle('on', i === at); el.classList.toggle('done', i < at);
      el.querySelector('b').textContent = (i < at || id === 's3') ? '✓' : String(i + 1);
    });
    document.querySelector('header h1').textContent = adminScr ? '관리자' : DIRECT || NOQR ? '환불 등록' : 'e-싸인';
    var swOn = !!(!DIRECT && !NOQR && (id === 's1' || id === 'sl' || id === 'sq') && !adminScr);   // 로그인·서명지 목록·DID에서 전환 버튼
    swAllowed = !!(swOn && (id === 's1' || id === 'sq') && staff && staff.token && !staff.guest);
    swLight(id === 'sq' ? 'kiosk' : 'sign');
    $('appSw').classList.toggle('hidden', !swOn); document.querySelector('header h1').classList.toggle('hidden', swOn);
    document.documentElement.classList.toggle('noPull', id === 'sk');
    if (id !== 'sk') document.body.classList.remove('skSig');
    if (id !== 's2' && id !== 'sk') landOff();
    window.scrollTo(0, 0);
    if (id !== 'sq') DID_CAR = false;              // 차량관리에서 온 DID를 벗어나면 뒤로가기는 보통대로
    curScreen = id; saveState();
    navSync();
  }

  /* ---------- 새로고침해도 지금 화면 유지 ----------
     이 탭(창)에서만 기억 (sessionStorage): 탭을 닫으면 지워짐. 처음으로·나가기·서명 완료 시 필요한 것만 남김 */
  var curScreen = 'sl', KEEP = 'bglSign.v2';
  function saveState() {
    try {
      var st = { s: curScreen, edTab: edTab };
      if (edu && code && ['sp', 's2', 's3'].indexOf(curScreen) > -1) { st.edu = edu; st.code = code; st.name = $('name').value; st.gd = $('gDept').value; st.gr = $('gRank').value; st.go = $('gRole').value; st.gn = $('gNoteIn').value; }
      if (curScreen === 's2' && person) { st.person = JSON.parse(JSON.stringify(person));
        st.strokes = strokes; st.vw = vw; st.vh = vh; st.drawn = drawn; }
      if (curScreen === 's3') st.done = { who: $('doneWho').textContent, msg: $('doneMsg').textContent };
      if (curScreen === 'sk' && sk) { st.sk = sk.id; st.skSt = skStep !== 'pick' && skSigMode !== 'lead' && skSt ? skSt.st : ''; }
      if (skL && !$('skView').classList.contains('hidden')) { st.skL = skL.id; st.skLi = skL.idx; }
      if (rfEdu && (curScreen === 'sf' || curScreen === 's3')) { st.rf = rfEdu.id; st.rfd = rfDirect; st.re = rfEnter; st.rz = rfEnd; }          // 환불 등록: 어느 등록인지만 (입력값·연락처는 저장 안 함)
      if (isAdm()) {                 // 관리자: 고치던 순서·임무역할 화면 (새로고침해도 이어서)
        st.admTok = 1; st.admOrder = admOrder; st.admMe = admMe;
        if (curScreen === 'so') st.ordId = ordId;
        if (curScreen === 'sr' && rData) st.r = { id: rData.id, assign: rAssign, head: $('rHead').value };
      }
      sessionStorage.setItem(KEEP, JSON.stringify(st));
    } catch (x) {}
  }
  function loadState() { try { return JSON.parse(sessionStorage.getItem(KEEP) || 'null'); } catch (x) { return null; } }
  function restoreState() {
    var st = loadState() || {};
    edTab = st.edTab === 'closed' ? 'closed' : 'open';
    if (st.admTok && isAdm()) {      // 관리자: 직원 로그인 토큰을 그대로 씀
      admTok = staff.token; admOrder = st.admOrder || {}; admMe = st.admMe || null;
      if ((st.s === 'so' && st.ordId) || (st.s === 'sr' && st.r)) {   // 순서·임무역할 화면이었으면 그 화면으로
        enterList(); refreshInit();
        admEnsure(function () {
          if (st.s === 'so') { if (ordEduById(st.ordId)) openOrder(st.ordId); return; }
          admCall('adminRoleData', [st.r.id], function (rd) {
            loadRoleData(rd);
            rAssign = st.r.assign || rAssign; $('rHead').value = st.r.head != null ? st.r.head : $('rHead').value;
            drawRoles(); show('sr');
          });
        });
        return;
      }
    }
    if (st.rf) {                     // 환불 등록 화면이었으면 그 등록 화면으로 (입력값은 다시)
      var rfe = edus.filter(function (x) { return x.id === st.rf && x.refund; })[0];
      rfDirect = !!st.rfd; rfEnter = st.re || ''; rfEnd = Number(st.rz) || 0;
      if (rfe && st.s === 's3' && st.done) { rfEdu = rfe; $('doneWho').textContent = st.done.who; $('doneMsg').textContent = st.done.msg; show('s3'); return; }
      if (rfe && rfe.open !== false) { openRefund(rfe); return; }
      rfDirect = false; resetAll();                  // 직원 대리 등록 화면은 목록을 다시 받아 처음부터
      return;
    }
    if (!staff) { show('sl'); return; }              // 로그인 전
    refreshInit(st.s === 'sq' || window.APP_CAR);   // DID·차량 화면으로 열었으면 목록은 뒤에서 조용히
    if (st.skL) { enterList(); skOpen(st.skL); skLeadOpen(st.skL, st.skLi); return; }   // 팀장 내용 보기 중이었으면 그 역
    if (st.s === 'sk' && st.sk) { enterList(); skOpen(st.sk, false, st.skSt); return; }
    if (st.s === 'sq') { kioskOpen(); return; }   // DID 화면이었으면
    if (!st.edu || !st.code) { enterList(); return; }
    edu = st.edu; code = st.code; selId = edu.id; renderEdus();
    $('eduName').textContent = edu.title; $('eduDate').textContent = [edu.dept, edu.date].filter(Boolean).join(' · ');
    $('name').value = st.name || ''; $('gDept').value = st.gd || ''; $('gRank').value = st.gr || ''; $('gRole').value = st.go || ''; $('gNoteIn').value = st.gn || ''; guestMode();
    if (st.s === 's2' && st.person) {
      person = st.person; fillSign(person.r || {});
      show('s2'); setupCanvas();
      strokes = st.strokes || []; vw = st.vw || 0; vh = st.vh || 0; drawn = st.drawn || 0;
      redraw(); $('submit').disabled = drawn < 6;
      return;
    }
    if (st.s === 's3' && st.done) { $('doneWho').textContent = st.done.who; $('doneMsg').textContent = st.done.msg; show('s3'); return; }
    if (edu.guest) show('sp'); else enterList();
  }
  function msg(el, text, color) { el.style.color = color || ''; el.textContent = text || ''; }

  /* ---------- 1단계: 교육 목록 + 접속 코드 ---------- */
  /** 환불 등록 QR 주소: 이 화면 주소?e=건 */
  function rfUrl(id) {
    var u = qrUrl;
    return u ? u + (u.indexOf('?') > -1 ? '&' : '?') + 'e=' + encodeURIComponent(id) : '';
  }
  /* ---------- 고객용 환불 QR (20초마다 바뀜) ----------
   * 주소 ?e=건&k=시각(초).서명. 서명 = HMAC-SHA256(서버가 직원에게만 준 건별 열쇠, 시각) 앞 16자리
   * 서버는 만든 지 30초 안의 QR만 받음. 시각은 서버 기준 (RQ.off = 서버 시각 - 이 기기 시각) */
  var RQ = { STEP: 20, off: 0, slot: 0, items: [], keys: {}, big: null, t: null,
    ok: !!(window.crypto && crypto.subtle && window.TextEncoder) };
  function rqNow() { return Date.now() + RQ.off; }
  function rqSig(key, t) {
    var enc = new TextEncoder();
    var kp = RQ.keys[key] || (RQ.keys[key] = crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
    return kp.then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(String(t))); }).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('').slice(0, 16);
    });
  }
  function rqUrl(e, t) { return rqSig(e.qrKey, t).then(function (s) { return rfUrl(e.id) + '&k=' + t + '.' + s; }); }
  function rqDraw(it, t) {
    rqUrl(it.e, t).then(function (u) {
      if (RQ.slot !== t) return;               // 그사이 다음 QR로 바뀜
      var svg = qrSvg(u, '#1b2333'); if (svg) it.el.innerHTML = svg;
    }).catch(function () {});
  }
  function rqAdd(e, el, end) { var it = { e: e, el: el, end: end }; RQ.items.push(it); if (RQ.slot) rqDraw(it, RQ.slot); setTimeout(rqStart, 0); }   // 카드가 화면에 붙은 뒤 시작
  function rqTick() {
    var ms = Date.now();
    RQ.items = RQ.items.filter(function (it) {
      if (!document.body.contains(it.el)) return false;          // 목록을 다시 그리면 예전 카드는 빠짐
      if (curScreen !== 'sf' && it.el.closest('.rfQrMini')) return false;   // 대리 등록 화면을 나감
      var end = it.e.qrEnd || it.end;                             // 연장되면 rfLeftApply가 e.qrEnd를 늘림
      if (ms < end) { it.asked = 0; return true; }
      if (!it.asked) { it.asked = ms; rfLeftAsk(); return true; } // 끝나는 순간: 숨기기 전에 서버에 다시 확인 (그사이 연장됐을 수 있음)
      if (ms - it.asked < 8000) return true;                      // 답을 기다림 (최대 8초)
      var b = it.el.closest('.rfQr'); if (b) b.remove();          // QR 접수 시간이 끝남 → QR 숨김 (직원 등록은 그대로)
      var mb = it.el.closest('.rfQrMini'); if (mb) mb.classList.add('hidden');   // 직원 대리 등록 화면의 [고객용 QR]
      if (RQ.big && RQ.big.e.id === it.e.id) closeQr();
      return false;
    });
    var big = RQ.big && !$('qrOver').classList.contains('hidden') ? RQ.big : null;
    if (!big) RQ.big = null;
    if (!RQ.items.length && !big) { clearInterval(RQ.t); RQ.t = null; RQ.slot = 0; return; }
    var now = rqNow(), t = Math.floor(now / 1000 / RQ.STEP) * RQ.STEP;
    if (t !== RQ.slot) { RQ.slot = t; RQ.items.forEach(function (it) { rqDraw(it, t); }); if (big) rqDraw(big, t); }
    if (big) {
      $('qrCap').textContent = '휴대폰 카메라로 찍으면 바로 환불 등록 화면으로 이동합니다 · ' + Math.max(1, Math.ceil(t + RQ.STEP - now / 1000)) + '초 뒤 새 QR';
      if (!document.hidden) markAct();         // 크게 보기를 띄워 둔 동안은 로그인 유지
    }
  }
  function rqStart() { if (!RQ.t) RQ.t = setInterval(rqTick, 1000); rqTick(); }
  function rqOpen(e) {                         // QR 크게 보기 (누르면 닫힘)
    $('qrBig').innerHTML = ''; $('qrUrl').textContent = '';
    $('qrOver').classList.add('picOnly');
    $('qrOver').classList.remove('hidden'); popPush();
    RQ.big = { e: e, el: $('qrBig') };
    if (RQ.slot) rqDraw(RQ.big, RQ.slot);
    rqStart();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && RQ.t) rqTick(); });   // 화면을 다시 켜면 바로 새 QR

  /* ---------- QR 접수 남은 시간 다시 받기: 다른 관리자가 [5분 연장]한 것도 반영 ----------
   * 목록·직원 대리 등록 화면에 진행 중 환불 건이 있으면 1분마다, QR 시간이 끝나는 순간에도 한 번 */
  var RFL = { busy: false, at: 0 };
  function rfLeftAsk() {
    if (RFL.busy || !staff || !staff.token || staff.guest) return;
    RFL.busy = true; RFL.at = Date.now();
    srv().withSuccessHandler(function (r) { RFL.busy = false; rfLeftApply(r); })
      .withFailureHandler(function (x) { RFL.busy = false; if (/로그인이 필요/.test(errText(x)) && !signingNow()) logout(errText(x)); })
      .staffRfLeft(staff.token);
  }
  function rfLeftApply(r) {
    if (!r || !r.rf) return;
    if (r.now) RQ.off = Number(r.now) - Date.now();
    var now = Date.now(), redraw = false;
    edus.forEach(function (e) {
      if (!e.refund || e.open === false || !r.rf[e.id]) return;
      var o = r.rf[e.id], end = now + (Number(o.left) || 0);
      var wasOn = !!e.qrKey && (e.qrEnd || 0) > now, on = !!(o.qrKey || e.qrKey) && end > now;
      if (o.qrKey) e.qrKey = o.qrKey;
      e.qrLeft = Number(o.left) || 0; e.qrEnd = end;
      if (on !== wasOn) redraw = true;                 // QR이 새로 생기거나 없어짐 → 다시 그림
      [].forEach.call(document.querySelectorAll('.rfLeft'), function (el) { if (el.getAttribute('data-rf') === e.id) { el.setAttribute('data-end', String(end)); setRfLeft(el); } });
    });
    if (!redraw) return;
    if (curScreen === 's1') renderEdus();
    if (curScreen === 'sf' && rfEdu && !rfDirect) rfMiniSetup(rfEdu);
  }
  setInterval(function () {
    if (document.hidden || !staff || staff.guest || Date.now() - RFL.at < 55000) return;
    if (!(curScreen === 's1' || (curScreen === 'sf' && !rfDirect))) return;
    if (!edus.some(function (e) { return e.refund && e.open !== false; })) return;
    rfLeftAsk();
  }, 5000);
  document.addEventListener('visibilitychange', function () {   // 화면을 다시 켜면 (10초 넘게 지났으면) 바로 확인
    if (document.hidden || !staff || staff.guest || Date.now() - RFL.at < 10000) return;
    if ((curScreen === 's1' || (curScreen === 'sf' && !rfDirect)) && edus.some(function (e) { return e.refund && e.open !== false; })) rfLeftAsk();
  });

  function rfItem(e) {
    var closed = e.open === false;
    var w = document.createElement('div'); w.className = 'rfItem' + (closed ? ' closed' : '');
    w.innerHTML = '<button class="rfMain"><span class="rfTag">운행 장애 · 환불 등록</span><span class="rfWho">(직원용)</span><b></b><span class="rank"></span><span class="rfGo"></span></button>';
    // 제목 '2026.10.28.(수) 운행 장애 환불 신청' → 날짜 다음 줄에 '운행 장애 환불 신청'
    var tm = String(e.title || '').match(/^(\d{4}\.\d{2}\.\d{2}\.\(.\))\s+(.+)$/), tb = w.querySelector('b');
    if (tm) { tb.appendChild(document.createTextNode(tm[1])); tb.appendChild(document.createElement('br')); tb.appendChild(document.createTextNode(tm[2])); }
    else tb.textContent = e.title;
    w.querySelector('.rank').textContent = [e.date, '등록 ' + (e.count || 0) + '명'].filter(Boolean).join(' · ');
    if (closed) w.querySelector('.rfGo').textContent = '등록 마감'; else w.querySelector('.rfGo').remove();
    if (!closed) {                                   // 고객용 QR 접수 남은 시간 (지나도 직원 등록은 가능)
      var left = document.createElement('span'); left.className = 'rfLeft'; left.style.cssText = 'display:block;margin-top:2px;font-size:13px';
      e.qrEnd = e.qrEnd || Date.now() + (Number(e.qrLeft) || 0);   // QR 접수 끝 시각 (직원 대리 등록 화면의 [고객용 QR]도 같음, 연장되면 늘어남)
      left.setAttribute('data-end', String(e.qrEnd)); left.setAttribute('data-rf', e.id); setRfLeft(left);
      w.querySelector('.rfMain').appendChild(left);
    }
    if (closed) w.querySelector('.rfMain').disabled = true;
    else {
      w.querySelector('.rfMain').onclick = function () { openRefund(e); };
      if (e.qrKey && rfUrl(e.id) && RQ.ok && e.qrEnd > Date.now()) {   // 고객용 QR: 20초마다 바뀜 (화면이 직접 만듦)
        var qb = document.createElement('button'); qb.className = 'rfQr'; qb.type = 'button'; qb.setAttribute('aria-label', 'QR 크게 보기');
        qb.innerHTML = '<em>고객용</em><span></span><small>QR 크게</small>';
        qb.onclick = function () { rqOpen(e); };
        w.appendChild(qb);
        rqAdd(e, qb.querySelector('span'), e.qrEnd);
      }
    }
    return w;
  }
  var edTab = 'open';                    // 서명지 목록 탭: open 진행 중, closed 마감
  var edPdfBusy = false;
  function eduPdfGet(e) {
    if (edPdfBusy) return;
    edPdfBusy = true; msg($('msg1'), e.title + ' PDF 만드는 중… (10초 이상 걸릴 수 있습니다)', '#6b7686');
    srv().withSuccessHandler(function (r) {
      edPdfBusy = false;
      if (r.pdf) saveFile(r.base + '.pdf', b64Blob(r.pdf, 'application/pdf'));
      else (r.pdfs || []).forEach(function (b64, i) { setTimeout(function () { saveFile(r.base + '_' + (i + 1) + '.pdf', b64Blob(b64, 'application/pdf')); }, i * 700); });
      if (r.dl) { e.pdfDl = r.dl; renderEdus(); }    // PDF 받음 ✓ (서버에 남음)
      msg($('msg1'), 'PDF를 저장했습니다. 컴퓨터·휴대폰 다운로드 폴더를 확인하세요.', '#12833b');
    }).withFailureHandler(function (x) {
      edPdfBusy = false;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('msg1'), errText(x), '#c0392b');
    }).eduPdf(staff && staff.token || '', e.id);
  }
  function renderEdus() {
    var box = $('edus'), isOpen = edTab !== 'closed'; box.innerHTML = '';
    var opens = edus.filter(function (e) { return e.open !== false; }), closes = edus.filter(function (e) { return e.open === false; });
    $('edTabOpen').textContent = '진행 중 ' + opens.length + '건'; $('edTabClosed').textContent = '마감 ' + closes.length + '건';
    $('edTabOpen').classList.toggle('on', isOpen); $('edTabClosed').classList.toggle('on', !isOpen);
    var list = isOpen ? opens : closes;
    if (!list.length) { box.innerHTML = '<div class="hint" style="margin-top:8px">' + (isOpen ? '현재 진행 중인 서명지가 없습니다.' : '마감된 서명지가 없습니다.') + '</div>'; }
    var adm = !!(staff && staff.admin && !staff.guest);
    if (adm && list.length) { var hn = document.createElement('div'); hn.className = 'eswHint'; hn.textContent = '카드를 옆으로 밀어 보세요'; box.appendChild(hn); }
    var pdfSw = function (e) { return !!(e.pdfSign && (e.open === false || e.pdfSign.canDel)); };   // PDF 서명지: 완료되면 [PDF 받기], 올린 사람·관리자는 [삭제]
    if (!adm && list.some(pdfSw)) { var hp = document.createElement('div'); hp.className = 'eswHint'; hp.textContent = 'PDF 서명지 카드를 옆으로 밀어 보세요'; box.appendChild(hp); }
    var put = function (e, el) { box.appendChild(adm && !e.pdfSign || pdfSw(e) ? eswWrap(e, el) : el); };
    list.forEach(function (e) {
      if (e.refund) { put(e, rfItem(e)); return; }
      if (e.safety) { put(e, skItem(e)); return; }
      if (e.pdfSign) { put(e, pdfItem(e)); return; }
      var closed = e.open === false;
      var b = document.createElement('button');
      b.className = 'person' + (closed ? ' closed' : '') + (e.id === selId ? ' sel' : '');
      b.innerHTML = '<span><b></b><br><span class="rank"></span><span class="cnt1"></span></span><span class="badge"></span>';
      b.querySelector('b').textContent = e.title;
      b.querySelector('.rank').textContent = [e.dept, e.date].filter(Boolean).join(' · ');
      b.querySelector('.cnt1').textContent = '서명 완료 ' + (e.count || 0) + '명';
      var pdfOk = closed && !!(staff && staff.token && !staff.guest);   // 마감된 서명지: 직원은 눌러서 PDF (서명은 불가)
      var pdfTx = e.pdfDl ? '📄 PDF ✓' : '📄 PDF';     // 누가 받았으면 ✓ (서버 기록)
      b.querySelector('.badge').textContent = pdfOk ? pdfTx : closed ? '접수 마감' : '선택';
      if (pdfOk && e.pdfDl) { var dl = document.createElement('span'); dl.className = 'pdfDl'; dl.textContent = '✓ PDF 받음 · ' + (e.pdfDl.n || '') + ' ' + (e.pdfDl.at || ''); b.firstChild.appendChild(document.createElement('br')); b.firstChild.appendChild(dl); }
      if (pdfOk) b.onclick = function () {            // 실수로 눌러도 PDF를 만들지 않게 두 번 눌러 받기
        var bd = b.querySelector('.badge');
        if (!b.classList.contains('armed')) {
          b.classList.add('armed'); bd.textContent = '한 번 더 누르면 PDF';
          setTimeout(function () { b.classList.remove('armed'); bd.textContent = pdfTx; }, 4000);
          return;
        }
        b.classList.remove('armed'); bd.textContent = pdfTx; eduPdfGet(e);
      };
      else if (closed) b.disabled = true;
      else b.onclick = function () { openCode(e); };   // 누르면 접속 코드 창
      put(e, b);
    });
  }
  /* ---------- 관리자: 카드 밀기 → 마감 / 다시 열기·삭제 (마감·삭제는 두 번 눌러 실행), 정보 수정·내보내기 ---------- */
  function eswWrap(e, el) {
    var w = document.createElement('div'); w.className = 'esw';
    var act = document.createElement('div'); act.className = 'eswAct';
    var closed = e.open === false;
    w.style.setProperty('--sw', '-88px');
    // 관리자 (PDF 서명지 말고): 왼쪽으로 밀기 → 위 [마감]·마감 탭 [다시 열기], 아래 [정보 수정]
    //   오른쪽으로 밀기 → 위 마감 탭 [삭제]·진행 중 환불 등록 [5분 연장], 아래 [내보내기]
    // PDF 서명지: 완료되면 [PDF 받기], 올린 사람·관리자는 [삭제]
    act.className = 'eswAct' + (e.pdfSign ? '' : ' stack');
    act.innerHTML = e.pdfSign ? (closed ? eswBtn('pdfdl', 'PDF<br>받기') : '') :
      (closed ? eswBtn('reopen', '다시<br>열기') : eswBtn('close', '마감')) + eswBtn('info', '정보<br>수정');
    var f = document.createElement('div'); f.className = 'eswFront'; f.appendChild(el);
    w.appendChild(act);
    var lh = e.pdfSign ? (e.pdfSign.canDel ? eswBtn('del', '삭제') : '') :
      (closed ? eswBtn('del', '삭제') : e.refund ? eswBtn('ext', '5분<br>연장') : '') + eswBtn('exp', '내보<br>내기');
    if (lh) {
      var actL = document.createElement('div'); actL.className = 'eswAct eswActL' + (e.pdfSign ? '' : ' stack');
      actL.innerHTML = lh;
      w.appendChild(actL);
    }
    w.appendChild(f);
    [].forEach.call(w.querySelectorAll('.eswAct button'), function (b) {
      b.onclick = function () { eswDo(e, b); };
    });
    return w;
  }
  // 카드 밀기 버튼: 아이콘(선 그림) + 글자
  var ESW_IC = {
    close: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    reopen: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    exp: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    pdfdl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    ext: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };
  function eswBtn(k, label) {
    return '<button type="button" class="' + k + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ESW_IC[k] + '</svg><span>' + label + '</span></button>';
  }
  var eswT = null, eswBusy = false;
  function eswArm(b, on, text) {
    clearTimeout(eswT);
    [].forEach.call(document.querySelectorAll('.eswAct button.armed'), function (x) { x.classList.remove('armed'); x.querySelector('span').innerHTML = x.getAttribute('data-t'); });
    if (!on) return;
    var sp = b.querySelector('span');
    b.setAttribute('data-t', sp.innerHTML); b.classList.add('armed'); sp.textContent = text;
    eswT = setTimeout(function () { eswArm(null, false); }, 4000);
  }
  function eswDo(e, b) {
    if (eswBusy) return;
    if (b.classList.contains('pdfdl')) { eswArm(null, false); eswClose(); pdfDownload(e); return; }   // PDF 서명지: 서명된 PDF 받기
    if (b.classList.contains('info') || b.classList.contains('exp')) {   // 관리자: 서명지 관리 창 (관리자 정보는 처음 누를 때 받음)
      var md = b.classList.contains('exp') ? 'exp' : 'info';
      eswArm(null, false); eswClose();
      admEnsure(function () { admOverOpen(e.id, md); });
      return;
    }
    var k = b.classList.contains('del') ? 'del' : b.classList.contains('close') ? 'close' : b.classList.contains('ext') ? 'ext' : 'reopen';
    if (k === 'ext') {                                // 5분 연장: 한 번 누르면 바로 (되돌릴 위험 없음)
      eswArm(null, false); eswBusy = true;
      msg($('msg1'), e.title + ' QR 접수 연장 중…', '#6b7686');
      srv().withSuccessHandler(function (r) { eswBusy = false; loadInit(r); saveState(); msg($('msg1'), r.note || '', '#12833b'); })
        .withFailureHandler(function (x) { eswBusy = false; if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; } eswClose(); msg($('msg1'), errText(x), '#c0392b'); })
        .staffRfExtend(staff && staff.token || '', e.id);
      return;
    }
    if (k !== 'reopen' && !b.classList.contains('armed')) { eswArm(b, true, k === 'del' ? '한 번 더 누르면 삭제' : '한 번 더 누르면 마감'); return; }
    eswArm(null, false); eswBusy = true;
    msg($('msg1'), e.title + (k === 'del' ? ' 삭제 중…' : k === 'close' ? ' 마감 중…' : ' 다시 여는 중…'), '#6b7686');
    var ok = function (r) { eswBusy = false; if (k === 'reopen') edTab = 'open'; loadInit(r); saveState(); msg($('msg1'), r.note || '', '#12833b'); };
    var fail = function (x) { eswBusy = false; if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; } eswClose(); msg($('msg1'), errText(x), '#c0392b'); };
    if (k === 'del' && e.pdfSign) srv().withSuccessHandler(ok).withFailureHandler(fail).pdfDelete(staff && staff.token || '', e.id);
    else if (k === 'del') srv().withSuccessHandler(ok).withFailureHandler(fail).staffDeleteEdu(staff && staff.token || '', e.id);
    else srv().withSuccessHandler(ok).withFailureHandler(fail).staffSetOpen(staff && staff.token || '', e.id, k === 'reopen');
  }
  function eswClose(except) { [].forEach.call(document.querySelectorAll('#edus .esw.open, #edus .esw.openR'), function (x) { if (x !== except) x.classList.remove('open', 'openR'); }); }
  (function () {                                     // 밀기: 손가락·마우스 모두. 민 직후의 누르기와 열린 카드 누르기는 닫기만
    var box = $('edus'), S = null, at = 0;
    var width = function (w) { return w.querySelector('.eswAct:not(.eswActL) button') ? 88 : 0; };   // 왼쪽으로 밀 때 (오른쪽 버튼, 위아래로 쌓음)
    var widthL = function (w) { return w.querySelector('.eswActL button') ? 88 : 0; };              // 오른쪽으로 밀 때 (왼쪽 버튼)
    box.addEventListener('pointerdown', function (ev) {
      var w = ev.target.closest('.esw');
      if (!w || ev.target.closest('.eswAct')) return;
      var wd = width(w), wl = widthL(w);
      S = { w: w, f: w.querySelector('.eswFront'), x: ev.clientX, y: ev.clientY, on: false, dx: 0, wd: wd, wl: wl, mouse: ev.pointerType === 'mouse',
        start: w.classList.contains('open') ? -wd : w.classList.contains('openR') ? wl : 0 };
      if (S.mouse && !/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) ev.preventDefault();   // 마우스: 끄는 동안 글자 선택·끌어 놓기 막음
    });
    box.addEventListener('pointermove', function (ev) {
      if (!S) return;
      if (S.mouse && !(ev.buttons & 1)) { end(); return; }   // 버튼을 이미 뗐으면(놓친 pointerup) 끝냄
      var dx = ev.clientX - S.x, dy = ev.clientY - S.y;
      if (!S.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { S = null; return; } if (Math.abs(dx) < 10) return; S.on = true; eswClose(S.w); S.w.classList.add('drag'); if (S.mouse) try { box.setPointerCapture(ev.pointerId); } catch (x) {} }   // 마우스: 목록 밖에서 버튼을 떼도 끝나게
      S.dx = dx; S.f.style.transition = 'none';
      S.f.style.transform = 'translateX(' + Math.max(-S.wd, Math.min(S.wl, S.start + dx)) + 'px)';
    });
    var end = function () {
      if (!S) return;
      var s = S; S = null;
      if (!s.on) return;
      s.f.style.transition = ''; s.f.style.transform = '';
      var pos = Math.max(-s.wd, Math.min(s.wl, s.start + s.dx));
      var open = s.wd > 0 && pos < -Math.min(40, s.wd / 2), openR = s.wl > 0 && pos > Math.min(40, s.wl / 2);
      s.w.classList.toggle('open', open); s.w.classList.toggle('openR', openR);
      setTimeout(function () { s.w.classList.remove('drag'); }, 250);
      if (!open) eswArm(null, false);
      at = Date.now();
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('lostpointercapture', end);
    box.addEventListener('dragstart', function (ev) { if (ev.target.closest && ev.target.closest('.esw')) ev.preventDefault(); });
    box.addEventListener('touchmove', function (ev) { if (S && S.on) ev.preventDefault(); }, { passive: false });   // 옆으로 미는 중에는 페이지가 스크롤되지 않게 (스크롤이 남으면 다음 첫 탭이 무시됨)
    box.addEventListener('click', function (ev) {
      var w = ev.target.closest('.esw');
      if (!w || ev.target.closest('.eswAct')) return;
      if (Date.now() - at < 350) { ev.preventDefault(); ev.stopPropagation(); return; }
      if (w.classList.contains('open') || w.classList.contains('openR')) { ev.preventDefault(); ev.stopPropagation(); w.classList.remove('open', 'openR'); eswArm(null, false); }
    }, true);
  })();
  /** 휴대폰: 손을 떼는 순간 바로 실행 (뒤따르는 click은 무시) */
  function fastTap(el, fn) {
    var t = 0;
    el.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') { e.preventDefault(); t = Date.now(); fn(); } });
    el.addEventListener('click', function () { if (Date.now() - t > 600) fn(); });
  }
  var edTabAt = 0;                       // 탭을 바꾼 시각: 그 직후 0.5초는 목록 카드 누르기·밀기 무시 (탭 터치가 새로 그린 카드로 들어가지 않게)
  fastTap($('edTabOpen'), function () { edTabAt = Date.now(); edTab = 'open'; renderEdus(); saveState(); });
  fastTap($('edTabClosed'), function () { edTabAt = Date.now(); edTab = 'closed'; renderEdus(); saveState(); });
  ['pointerdown', 'click'].forEach(function (t) {
    $('edus').addEventListener(t, function (e) { if (Date.now() - edTabAt < 500) { e.preventDefault(); e.stopPropagation(); } }, true);
  });
  /* ---------- 첫 화면 QR (이 웹 앱 주소, 접속 코드는 넣지 않음) ---------- */
  /* 작은 QR 코드 생성기 (바이트 모드, 오류정정 M, 버전 1~10 = 영문 최대 213자). 외부 라이브러리 없이 동작 */
  function makeQR(text) {
    var data = [], s = unescape(encodeURIComponent(text));
    for (var i = 0; i < s.length; i++) data.push(s.charCodeAt(i));
    // [전체 코드워드, 블록당 오류정정 수, [[블록 수, 블록당 데이터 수], ...]]
    var T = [null, [26, 10, [[1, 16]]], [44, 16, [[1, 28]]], [70, 26, [[1, 44]]], [100, 18, [[2, 32]]], [134, 24, [[2, 43]]],
      [172, 16, [[4, 27]]], [196, 18, [[4, 31]]], [242, 22, [[2, 38], [2, 39]]], [292, 22, [[3, 36], [2, 37]]], [346, 26, [[4, 43], [1, 44]]]];
    var AL = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
    var ver = 0, cap = 0;
    for (var v = 1; v <= 10; v++) {
      cap = T[v][2].reduce(function (a, b) { return a + b[0] * b[1]; }, 0);
      if (4 + (v < 10 ? 8 : 16) + data.length * 8 <= cap * 8) { ver = v; break; }
    }
    if (!ver) return null;
    // 1) 비트열
    var bits = [];
    function put(val, n) { for (var k = n - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
    put(4, 4); put(data.length, ver < 10 ? 8 : 16);
    data.forEach(function (b) { put(b, 8); });
    for (var t = 0; t < 4 && bits.length < cap * 8; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (i = 0; i < bits.length; i += 8) { var x = 0; for (var k = 0; k < 8; k++) x = (x << 1) | bits[i + k]; cw.push(x); }
    for (var pad = 0xEC; cw.length < cap; pad ^= 0xEC ^ 0x11) cw.push(pad);
    // 2) 리드-솔로몬 오류정정
    var EXP = [], LOG = [];
    for (i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
    function mul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
    var ecn = T[ver][1], gen = [1];
    for (i = 0; i < ecn; i++) {
      var ng = []; for (k = 0; k <= gen.length; k++) ng[k] = 0;
      for (k = 0; k < gen.length; k++) { ng[k] ^= gen[k]; ng[k + 1] ^= mul(gen[k], EXP[i]); }
      gen = ng;
    }
    var blocks = [], ecs = [], p = 0;
    T[ver][2].forEach(function (g) {
      for (var n = 0; n < g[0]; n++) {
        var d = cw.slice(p, p + g[1]); p += g[1];
        var r = d.concat(new Array(ecn).fill(0));
        for (var a = 0; a < d.length; a++) { var f = r[a]; if (f) for (var b = 0; b < gen.length; b++) r[a + b] ^= mul(gen[b], f); }
        blocks.push(d); ecs.push(r.slice(d.length));
      }
    });
    var out = [], maxd = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < maxd; i++) blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    for (i = 0; i < ecn; i++) ecs.forEach(function (e) { out.push(e[i]); });
    // 3) 기본 무늬 배치
    var N = ver * 4 + 17, M = [], F = [];
    for (i = 0; i < N; i++) { M.push(new Array(N).fill(0)); F.push(new Array(N).fill(false)); }
    function set(r, c, v2) { M[r][c] = v2 ? 1 : 0; F[r][c] = true; }
    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        var on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        set(rr, cc, on);
      }
    }
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    for (i = 8; i < N - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var AP = AL[ver], last = AP.length - 1;
    AP.forEach(function (r, ia) {
      AP.forEach(function (c, ib) {
        if ((ia === 0 && ib === 0) || (ia === 0 && ib === last) || (ia === last && ib === 0)) return;   // 위치 찾기 무늬와 겹치는 곳
        for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      });
    });
    for (i = 0; i < 9; i++) { if (!F[8][i]) F[8][i] = true; if (!F[i][8]) F[i][8] = true; }   // 형식 정보 자리
    for (i = 0; i < 8; i++) { F[8][N - 1 - i] = true; F[N - 1 - i][8] = true; }
    set(N - 8, 8, 1);                                                                            // 검은 점
    if (ver >= 7) {                                                                              // 버전 정보
      var rem = ver; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
      var vbits = (ver << 12) | rem;
      for (i = 0; i < 18; i++) { var bit = (vbits >> i) & 1, a2 = Math.floor(i / 3), b2 = i % 3 + N - 11; set(a2, b2, bit); set(b2, a2, bit); }
    }
    // 4) 데이터 배치 (오른쪽 아래부터 지그재그)
    var allBits = [];
    out.forEach(function (b) { for (var k2 = 7; k2 >= 0; k2--) allBits.push((b >> k2) & 1); });
    var bi = 0;
    for (var col = N - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (var j = 0; j < N; j++) {
        var row = ((col + 1) & 2) === 0 ? N - 1 - j : j;
        for (var c2 = 0; c2 < 2; c2++) {
          var cc2 = col - c2;
          if (F[row][cc2]) continue;
          M[row][cc2] = bi < allBits.length ? allBits[bi] : 0; bi++;
        }
      }
    }
    // 5) 마스크 8가지 중 벌점이 가장 낮은 것
    var MASK = [function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; },
      function (r, c) { return (r + c) % 3 === 0; }, function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; }, function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];
    function format(mask) {
      var d = (0 << 3) | mask, rem2 = d;                          // 오류정정 M = 00
      for (var q = 0; q < 10; q++) rem2 = (rem2 << 1) ^ ((rem2 >> 9) * 0x537);
      return ((d << 10) | rem2) ^ 0x5412;
    }
    function build(mask) {
      var G = M.map(function (r) { return r.slice(); });
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!F[r][c] && MASK[mask](r, c)) G[r][c] ^= 1;
      var fb = format(mask), bit = function (q) { return (fb >> q) & 1; };
      for (var q = 0; q <= 5; q++) G[q][8] = bit(q);                 // 왼쪽 위 (세로)
      G[7][8] = bit(6); G[8][8] = bit(7); G[8][7] = bit(8);
      for (q = 9; q < 15; q++) G[8][14 - q] = bit(q);               // 왼쪽 위 (가로)
      for (q = 0; q < 8; q++) G[8][N - 1 - q] = bit(q);             // 오른쪽 위
      for (q = 8; q < 15; q++) G[N - 15 + q][8] = bit(q);           // 왼쪽 아래
      G[N - 8][8] = 1;
      return G;
    }
    function penalty(G) {
      var s2 = 0, r, c, run, k3;
      for (r = 0; r < N; r++) {
        for (run = 1, c = 1; c <= N; c++) { if (c < N && G[r][c] === G[r][c - 1]) run++; else { if (run >= 5) s2 += run - 2; run = 1; } }
        for (run = 1, c = 1; c <= N; c++) { if (c < N && G[c][r] === G[c - 1][r]) run++; else { if (run >= 5) s2 += run - 2; run = 1; } }
      }
      for (r = 0; r < N - 1; r++) for (c = 0; c < N - 1; c++) { k3 = G[r][c] + G[r + 1][c] + G[r][c + 1] + G[r + 1][c + 1]; if (k3 === 0 || k3 === 4) s2 += 3; }
      var dark = 0; for (r = 0; r < N; r++) for (c = 0; c < N; c++) dark += G[r][c];
      s2 += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
      return s2;
    }
    var best = null, bestP = 1e9;
    for (var m = 0; m < 8; m++) { var G2 = build(m), pp = penalty(G2); if (pp < bestP) { bestP = pp; best = G2; } }
    return best;
  }
  /** QR을 SVG 문자열로 (여백 4칸) */
  function qrSvg(text, color) {
    var G = makeQR(text); if (!G) return '';
    var N = G.length, q = 4, d = '';
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (G[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (N + 2 * q) + ' ' + (N + 2 * q) + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="' + (color || '#000') + '"/></svg>';
  }
  var qrUrl = '';
  function setupQr(url) {
    if (!url || url === qrUrl) return;
    var svg = qrSvg(url, '#1b2333');
    if (!svg) return;
    qrUrl = url;
    $('qrSmall').innerHTML = svg;
    $('qrBtn').classList.remove('hidden');
  }
  /* ---------- 팝업·화면과 휴대폰 [뒤로가기] ----------
   * 화면 단계만큼 브라우저 기록을 쌓아 둠 (첫 화면 0 → 본인 확인 1 → 서명 2, 순서·임무역할 1, 팝업이 열려 있으면 +1)
   * → 뒤로가기를 누를 때마다 한 단계씩 앞 화면으로 (팝업은 닫힘). 버튼으로 앞 화면에 가면 쌓아 둔 칸을 그만큼 되돌림.
   * 기록 칸은 화면을 넘어갈 때(누른 순간) 넣어 둠: 뒤로가기 처리 중에 다시 넣으면 휴대폰 크롬이 다음 뒤로가기 때 건너뜀.
   * 환불 등록: 교육 목록에서 들어왔으면 뒤로가기 → 첫 화면, 고객용 QR로 바로 들어왔으면 기록을 넣지 않음 (브라우저 기본 동작) */
  var POPS = ['qrOver', 'codeOver', 'regOver', 'skView', 'admOver', 'stPrevOver'];
  var NAV = { n: 0, skip: 0, t: null, q: false };   // n: 지금 쌓아 둔 칸 수, skip: 우리가 되돌려서 올 popstate 수
  function anyPop() { return POPS.some(function (id) { return !$(id).classList.contains('hidden'); }); }
  function navDepth() {                    // 지금 화면이 원하는 칸 수
    var id = curScreen;
    if (rfEdu && rfDirect && (id === 'sf' || id === 's3')) return 0;   // 환불 등록 QR로 바로 들어온 승객은 제외
    return ({ sp: 1, s2: edu && (edu.guest || edu.pdf) ? 2 : 1, s3: 1, sf: 1, so: 1, sr: 1, sk: 1, su: 1, sv: 1, sq: DID_CAR ? 0 : 1 })[id] || 0;   // 차량관리에서 온 DID: 뒤로가기 = 차량관리
  }
  function navApply() {                    // 쌓아 둔 칸을 지금 화면에 맞춤 (같은 순간의 여러 변화는 한 번에)
    if (NAV.q || window.APP_CAR) return;   // 차량 화면이 켜져 있으면 기록은 차량 화면이 씀 (돌아올 때 맞춤)
    NAV.q = true;
    setTimeout(function () {
      NAV.q = false;
      if (NAV.skip > 0 || window.APP_CAR) return;   // 되돌리는 중이면 끝난 뒤 다시
      var want = navDepth() + (anyPop() ? 1 : 0);
      while (NAV.n < want) { try { history.pushState({ nav: NAV.n + 1 }, ''); NAV.n++; } catch (x) { break; } }
      if (NAV.n > want) {
        var k = NAV.n - want; NAV.n = want; NAV.skip++;
        clearTimeout(NAV.t); NAV.t = setTimeout(function () { if (NAV.skip) { NAV.skip = 0; navApply(); } }, 1500);
        try { history.go(-k); } catch (x) { NAV.skip--; }
      }
    }, 0);
  }
  function navSync() { navApply(); }       // show()에서
  function screenBack() {                  // 휴대폰 뒤로가기 = 화면의 [뒤로]·[처음으로] 버튼
    var s = curScreen;
    if (s === 'sp' || s === 's3' || s === 'sf') resetAll();
    else if (s === 'su') $('puBack').onclick();
    else if (s === 'sv') $('pvBack').onclick();
    else if (s === 's2') { if (!submitting) signBack(); }
    else if (s === 'so') $('oBack').onclick();
    else if (s === 'sr') $('rBack').onclick();
    else if (s === 'sk') skBack();
    else if (s === 'sq') enterList();
  }
  function popPush() { navApply(); }       // 팝업을 열 때
  function popSync() { navApply(); }       // 팝업을 버튼·바깥 누르기 등으로 닫았을 때
  function onBack() {
    if (NAV.skip > 0) { NAV.skip--; if (!NAV.skip) navApply(); return; }   // 우리가 되돌린 것
    if (NAV.n === 0) return;               // 우리가 넣은 칸이 아님 (브라우저 기본)
    NAV.n--;
    if (anyPop()) {                        // 뒤로가기 → 열린 팝업 닫기
      if (!$('qrOver').classList.contains('hidden')) $('qrOver').classList.add('hidden');
      if (!$('codeOver').classList.contains('hidden')) closeCode();
      if (!$('regOver').classList.contains('hidden')) $('regOver').classList.add('hidden');
      if (!$('skView').classList.contains('hidden')) lvClose();
      if (!$('admOver').classList.contains('hidden')) admOverHide();
      if (!$('stPrevOver').classList.contains('hidden')) pvClose();
    } else screenBack();                   // 뒤로가기 → 이전 화면
    navApply();
  }
  try {
    window.addEventListener('popstate', function (e) { if (window.CARAPP && CARAPP.pop(e)) return; onBack(); });   // 차량 화면 기록이면 차량 화면이 처리
  } catch (x) {}

  /** QR 크게 보기 (누르면 닫힘) */
  function openQr(url, cap, picOnly) {   // picOnly: 링크 주소 없이 그림과 안내문만 (환불 등록 QR)
    var svg = qrSvg(url, '#1b2333'); if (!svg) return;
    RQ.big = null;
    $('qrBig').innerHTML = svg; $('qrUrl').textContent = picOnly ? '' : url;
    $('qrCap').textContent = cap;
    $('qrOver').classList.toggle('picOnly', !!picOnly);
    $('qrOver').classList.remove('hidden'); popPush();
  }
  function closeQr() { $('qrOver').classList.add('hidden'); RQ.big = null; popSync(); }
  $('qrBtn').onclick = function () { openQr(qrUrl, '휴대폰 카메라로 찍으면 이 서명 화면으로 들어옵니다'); };
  $('qrOver').onclick = closeQr;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('qrOver').classList.contains('hidden')) closeQr(); });

  function loadInit(r) {
    edus = (r && r.educations) || [];
    if (r && r.now) RQ.off = Number(r.now) - Date.now();   // 서버 시각에 맞춤 (고객용 환불 QR)
    if (r && r.url) setupQr(r.url);
    if (selId && !edus.some(function (e) { return e.id === selId && e.open !== false && !e.refund; })) selId = '';
    renderEdus();
    if (r && r.error) { msg($('msg1'), '불러오기 실패: ' + r.error, '#c0392b'); msg($('lgMsg'), '불러오기 실패: ' + r.error, '#c0392b'); }
  }
  /** 서명지 목록 받기. quiet: 목록이 안 보이는 화면(DID)이면 가운데 로딩 표시 없이 */
  function refreshInit(quiet) {
    BUSY_SKIP.getInit = quiet ? 1 : 0;
    srv().withSuccessHandler(loadInit).withFailureHandler(function (e) { msg($('msg1'), errText(e), '#c0392b'); }).getInit(staff && staff.token || '');
  }

  /* ---------- 접속 코드 창: 교육을 누르면 열림 ---------- */
  function openCode(e) {
    selId = e.id; renderEdus(); saveState();
    $('codeTitle').textContent = e.title;
    $('codeSub').textContent = [e.dept, e.date].filter(Boolean).join(' · ');
    $('code').value = ''; msg($('codeMsg'), ''); msg($('msg1'), ''); $('codeOk').disabled = false;
    $('codeOver').classList.remove('hidden'); popPush();
    setTimeout(function () { $('code').focus(); }, 50);
  }
  function closeCode() {
    $('codeOver').classList.add('hidden'); $('code').value = ''; msg($('codeMsg'), '');
    selId = ''; renderEdus(); saveState(); popSync();
  }
  $('codeCancel').onclick = closeCode;
  $('codeOver').onclick = function (e) { if (e.target === $('codeOver')) closeCode(); };   // 바깥(어두운 곳)을 누르면 닫힘
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('codeOver').classList.contains('hidden')) closeCode(); });

  // 접속 코드: 서버 확인을 기다리지 않고 바로 본인 확인 화면으로 (확인은 뒤에서 동시에, 틀리면 코드 창으로 돌아옴)
  // 이름·개인 코드를 제출할 때 서버가 접속 코드를 다시 확인하므로 틀린 코드로 서명할 수는 없음
  var codeSeq = 0;
  function enterSp(v, info) {
    code = v; edu = info; selId = info.id; rfEdu = null;
    $('eduName').textContent = edu.title; $('eduDate').textContent = [edu.dept, edu.date].filter(Boolean).join(' · ');
    $('name').value = ''; ['gDept', 'gRank', 'gRole', 'gNoteIn'].forEach(function (id) { $(id).value = ''; }); msg($('msgp'), '');
    guestMode(); show('sp'); setTimeout(function () { $(firstGuestField()).focus(); }, 50);
  }
  function submitCode() {
    var v = $('code').value.trim();
    if (!v) { msg($('codeMsg'), '접속 코드를 입력하세요.', '#c0392b'); $('code').focus(); return; }
    if (!selId) { closeCode(); return; }
    var id = selId, seq = ++codeSeq, local = edus.filter(function (x) { return x.id === id; })[0];
    if (local && local.guest) {                    // 본인 확인 없는 서명지: 받아 둔 정보로 바로 입력 화면
      $('codeOver').classList.add('hidden'); $('code').blur(); msg($('codeMsg'), ''); popSync();
      enterSp(v, { id: local.id, title: local.title, date: local.date, dept: local.dept, guest: true, fields: local.fields });
    } else { $('codeOk').disabled = true; msg($('codeMsg'), '확인 중…', '#6b7686'); }
    srv().withSuccessHandler(function (r) {
      $('codeOk').disabled = false;
      if (seq !== codeSeq) return;                 // 그사이 다른 교육을 고른 경우
      if (r.person) {                              // 본인 확인 서명지: 로그인으로 확인됨 → 바로 서명
        $('codeOver').classList.add('hidden'); $('code').blur(); msg($('codeMsg'), ''); popSync();
        code = v; edu = r.edu; selId = edu.id; rfEdu = null; goSign(r.person, { name: r.person.name });
        return;
      }
      if (!local) { $('codeOver').classList.add('hidden'); $('code').blur(); msg($('codeMsg'), ''); popSync(); enterSp(v, r.edu); return; }
      if (edu && edu.id === r.edu.id) {            // 서버 정보로 갱신 (본인 확인 없는 교육의 입력 칸이 달라졌으면 다시 그림)
        var changed = JSON.stringify(edu.fields || null) !== JSON.stringify(r.edu.fields || null) || !!edu.guest !== !!r.edu.guest;
        edu = r.edu; if (changed && curScreen === 'sp') guestMode();
      }
    }).withFailureHandler(function (e) {
      $('codeOk').disabled = false;
      if (seq !== codeSeq) return;
      if (/로그인이 필요/.test(errText(e))) { closeCode(); logout(errText(e)); return; }
      if (curScreen === 'sp' && edu && edu.id === id) { code = ''; edu = null; show('s1'); }   // 본인 확인 화면에서 되돌아옴
      if (curScreen !== 's1') return;
      var it = edus.filter(function (x) { return x.id === id; })[0];
      if (it) { openCode(it); $('code').value = v; }
      msg($('codeMsg'), errText(e), '#c0392b'); $('code').select();
    }).enterCode(id, v, staff && staff.token || '');
  }
  $('codeOk').onclick = submitCode;

  /* ---------- 열차 밀기 (이스터 에그): 열차 높이의 띠(좌우 끝까지)를 왼쪽으로 밀면 열차가 멈춰 따라오고, 떼면 제자리로 돌아가 다시 달림 ---------- */
  var trainX = null, trainY = 0, trainHit = $('trainHit'), trainDrag = $('trainDrag');
  function trainShift(px, slide) { trainDrag.style.transition = slide ? 'transform .2s ease-out' : 'none'; trainDrag.style.transform = px ? 'translateX(' + px + 'px)' : ''; }
  function trainRelease() { trainX = null; trainShift(0, true); $('train').style.animationPlayState = ''; }
  trainHit.addEventListener('pointerdown', function (e) {
    trainX = e.clientX; trainY = e.clientY; $('train').style.animationPlayState = 'paused';
    try { trainHit.setPointerCapture(e.pointerId); } catch (x) {}
  });
  trainHit.addEventListener('pointermove', function (e) {
    if (trainX === null) return;
    var w = trainHit.ownerSVGElement.getBoundingClientRect().width || 400;   // 화면 px → 그림 좌표
    trainShift(Math.min(0, e.clientX - trainX) * 400 / w);
  });
  trainHit.addEventListener('pointercancel', trainRelease);
  // 휴대폰: 가로로 움직이면 브라우저가 터치를 가져가지 못하게 막음 (안 그러면 pointercancel로 열차가 돌아감). 세로는 스크롤 그대로
  trainHit.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0];
    if (t && trainX !== null && Math.abs(t.clientX - trainX) > Math.abs(t.clientY - trainY)) e.preventDefault();
  }, { passive: false });
  trainHit.addEventListener('pointerup', function (e) {
    if (trainX === null) return;
    trainRelease();
  });
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitCode(); } });

  /* ---------- 로그인: 사번 + 개인 코드, 또는 배포용 아이디 ---------- */
  function setStaff(v) {
    staff = v;
    try { if (v) sessionStorage.setItem('bglStaff', JSON.stringify(v)); else sessionStorage.removeItem('bglStaff'); } catch (x) {}
  }
  function savedPin() { try { return localStorage.getItem('bglPin') || ''; } catch (x) { return ''; } }
  /** 로그인 2시간이 지나면 첫 화면(사번·개인 코드)으로. 서명 칸 화면·제출 중이면 제출이 끝날 때까지 기다림 */
  function signingNow() { return curScreen === 's2' || submitting || (curScreen === 'sk' && (skStep === 'sig' || skBusy)); }
  /** 자동 로그아웃: 마지막 동작(터치·입력·스크롤) 후 20분. 서명 칸 화면·제출 중이면 제출이 끝날 때까지 기다림 */
  function idleOver() { return !!(staff && staff.ttl && Date.now() - lastAct > staff.ttl * 1000); }
  function staffExpire() {
    if (!idleOver() || signingNow()) return;
    var mins = Math.round(staff.ttl / 60);
    landOff();
    if (!$('skView').classList.contains('hidden')) { $('skView').classList.add('hidden'); document.body.classList.remove('skLock'); }
    ['qrOver', 'regOver'].forEach(function (id) { $(id).classList.add('hidden'); });
    logout(mins + '분 동안 사용하지 않아 자동으로 로그아웃되었습니다. 사번과 개인 코드를 다시 입력하세요.');
  }
  /** 동작이 있으면 마지막 동작 시각을 새로. 화면에서만 움직이는 동안에도 서버 로그인이 끊기지 않게 5분마다 알림 */
  function markAct() {
    if (idleOver() && !signingNow()) { staffExpire(); return; }   // 이미 시간이 지났으면 이 동작으로 되살리지 않음
    var now = Date.now(); lastAct = now;
    if (now - lastSave > 15000) { lastSave = now; try { sessionStorage.setItem(ACT_KEY, String(now)); } catch (x) {} }
    if (staff && staff.token && now - lastPing > 300000) {
      lastPing = now;
      srv().withFailureHandler(function (e) { if (/로그인이 필요/.test(errText(e)) && !signingNow()) logout(errText(e)); }).staffPing(staff.token);
    }
  }
  ['pointerdown', 'keydown', 'input', 'scroll'].forEach(function (t) { document.addEventListener(t, markAct, { capture: true, passive: true }); });
  setInterval(staffExpire, 10000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) staffExpire(); });
  /** 서명지 목록으로 */
  function enterList() {
    var g = !!(staff && staff.guest);
    $('meName').textContent = g ? '외부 참석자' : ((staff.disp ? staff.disp + ' ' : '') + staff.name + ' 님').trim();
    if (!g && staff.admin) { var ma = document.createElement('span'); ma.className = 'meAdm' + (admLv() >= 2 ? ' mst' : ''); ma.textContent = '관리자 ' + admLv() + '등급'; $('meName').appendChild(ma); }
    $('chgCard').classList.toggle('hidden', g);
    admCards();                                     // 새 서명지 열기: 직원 모두, 배포용 아이디: 관리자, 개인 코드 관리·관리자 지정: 2등급 이상
    if (isAdm() && !admData) setTimeout(function () { admEnsure(function () {}, null, null, true); }, 1500);   // 관리자 정보(양식 목록 등)는 목록이 뜬 뒤 조용히 미리 받음
    if (!edus.length) $('edus').innerHTML = '<div class="hint">불러오는 중…</div>';
    show('s1');
    if (KIOSK_WANT && !g) kioskOpen();             // 차량관리의 [DID]로 왔으면 로그인 뒤 DID 화면
  }
  function logout(text) {
    if (staff && staff.token) srv().staffLogout(staff.token);
    admTok = null; admData = null; admMe = null; admExp = {}; admOrder = {}; admOverHide(); $('nDept').innerHTML = '';
    ['newCard', 'gstCard', 'stCard', 'smCard', 'pcCard', 'gdCard'].forEach(function (id) { $(id).classList.remove('open'); });
    try { localStorage.removeItem('bglStInfo'); } catch (x) {} stD = null; stPicked = false; stSel = {};   // DID 역 정보 저장본
    setStaff(null); edus = []; renderEdus(); resetAll();
    $('lgPin').value = savedPin(); $('lgCode').value = '';
    if (text) msg($('lgMsg'), text, '#c0392b');
  }
  function lgSubmit() {
    var pin = $('lgPin').value.trim(), pc = $('lgCode').value.trim();
    if (!pin) { msg($('lgMsg'), '사번을 입력하세요.', '#c0392b'); $('lgPin').focus(); return; }
    $('lgOk').disabled = true; msg($('lgMsg'), '확인 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('lgOk').disabled = false; msg($('lgMsg'), '');
      if (r.unregistered) {
        openReg(pin, r.mailDomain); return;
      }
      if (r.needCode) { msg($('lgMsg'), '코드를 입력해 주세요', '#c0392b'); $('lgCode').focus(); return; }
      if (!r.guest) { try { localStorage.setItem('bglPin', pin); } catch (x) {} }   // 함께 쓰는 아이디는 기억하지 않음
      if (r.dev) { try { localStorage.setItem('bglDev', r.dev); } catch (x) {} }    // 기기 열쇠: 이 휴대폰으로 로그인한 적 있음 (업무차량 QR 운행 시작에 필요, 로그아웃해도 남김)
      $('lgCode').value = '';
      var ttl = Number(r.ttl) || 1200;                    // 마지막 동작 후 이 시간(초)이면 자동 로그아웃 (서버와 같게)
      lastAct = lastPing = lastSave = Date.now(); try { sessionStorage.setItem(ACT_KEY, String(lastAct)); } catch (x) {}
      if (r.guest) { $('lgPin').value = ''; setStaff({ token: r.token, guest: true, ttl: ttl }); }
      else setStaff({ token: r.token, name: r.name, disp: r.disp, admin: !!r.admin, lv: Number(r.lv) || (r.admin ? 1 : 0), ttl: ttl });
      edus = []; enterList();
      if (r.init) loadInit(r.init); else refreshInit();
    }).withFailureHandler(function (e) {
      $('lgOk').disabled = false; $('lgCode').value = ''; msg($('lgMsg'), errText(e), '#c0392b');
    }).staffLogin({ pin: pin, pcode: pc, dev: (function () { try { return localStorage.getItem('bglDev') || ''; } catch (x) { return ''; } })() });
  }
  $('lgOk').onclick = lgSubmit;
  $('lgPin').value = savedPin();
  $('lgPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('lgCode').focus(); } });
  $('lgCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); lgSubmit(); } });
  $('meOut').onclick = function () { logout(); };

  /* ---------- 직원 등록: 미등록 안내 → 사내 메일 → 인증 코드 → 입력 → 다시 확인 → 직원DB에 기록 ---------- */
  var REG_UI = { regAsk: [0, '직원 등록', '등록되지 않은 사번입니다'], regMailStep: [1, '사내 메일 인증', '본인 메일로 인증 코드를 보내 드립니다'], regCodeStep: [2, '인증 코드 입력', '메일로 받은 숫자 6자리를 입력하세요'],
    regForm: [3, '직원 정보 입력', '서명지에 표시될 정보입니다'], regCheck: [3, '입력 내용 확인', '맞는지 다시 확인하세요'] };
  var regCur = 'regAsk', regDomain = '', regTicketAt = 0;
  function regStage(id) {
    regCur = id;
    $('regOver').classList.toggle('full', id === 'regForm' || id === 'regCheck');   // 정보 입력은 칸이 많아 전체 화면으로
    ['regAsk', 'regMailStep', 'regCodeStep', 'regForm', 'regCheck'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    var u = REG_UI[id]; $('regHeadT').textContent = u[1]; $('regHeadS').textContent = u[2];
    $('regSteps').classList.toggle('hidden', !u[0]);
    [].forEach.call($('regSteps').children, function (li, i) { li.classList.toggle('on', i + 1 === u[0]); li.classList.toggle('done', i + 1 < u[0]); li.firstChild.textContent = i + 1 < u[0] ? '✓' : String(i + 1); });
    document.querySelector('.regBox').scrollTop = 0;
  }
  /** 인증 코드 칸: 입력은 투명한 칸 하나(문자 자동 입력·숫자패드 그대로), 보이는 것은 숫자 6칸 */
  function regCodeDraw() {
    var v = $('regMailCode').value;
    [].forEach.call($('regCells').querySelectorAll('i'), function (c, i) { c.textContent = v.charAt(i); c.classList.toggle('fill', i < v.length); c.classList.toggle('cur', i === Math.min(v.length, 5)); });
  }
  function regCodeSet(v) { $('regMailCode').value = v; regCodeDraw(); }
  $('regMailCode').addEventListener('input', function () {
    regCodeSet(this.value.replace(/\D/g, '').slice(0, 6));
    if (this.value.length === 6 && !$('regCodeOk').disabled) $('regCodeOk').click();   // 6자리를 다 넣으면 바로 확인
  });
  $('regMailCode').addEventListener('focus', function () { $('regCells').classList.add('focus'); });
  $('regMailCode').addEventListener('blur', function () { $('regCells').classList.remove('focus'); });
  $('regMail').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('regMailSend').click(); } });
  var regTicket = '';
  function closeReg() { $('regOver').classList.add('hidden'); $('regC1').value = ''; $('regC2').value = ''; regCodeSet(''); regTicket = ''; popSync(); }
  function openReg(pin, domain) {
    if (regTicket && $('regPin').value === pin && Date.now() - regTicketAt < 1740000) {   // 뒤로가기로 닫혔을 때: 입력 내용·메일 인증 유지 (서버 표시 30분 안)
      $('regOver').classList.remove('hidden'); popPush(); regStage(regCur === 'regCheck' ? 'regCheck' : 'regForm'); return;
    }
    ['regName', 'regDept', 'regTeam', 'regPost', 'regRank', 'regC1', 'regC2', 'regMail'].forEach(function (id) { $(id).value = ''; });
    regCodeSet(''); $('regPin').value = pin; $('regAskPin').textContent = pin; regTicket = ''; ['regMsg', 'regMsg2', 'regMsgM', 'regMsgC'].forEach(function (id) { msg($(id), ''); });
    regDomain = domain || ''; $('regMailDom').textContent = regDomain ? '@' + regDomain : '';
    regStage('regAsk'); $('regOver').classList.remove('hidden'); popPush();
  }
  $('regMailNo').onclick = closeReg;
  $('regMailAgain').onclick = function () { regStage('regMailStep'); };
  $('regMailSend').onclick = function () {
    var mailId = $('regMail').value.trim().split('@')[0];
    if (!mailId) { msg($('regMsgM'), '메일 아이디를 입력하세요.', '#c0392b'); $('regMail').focus(); return; }
    $('regMailSend').disabled = true; msg($('regMsgM'), '보내는 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('regMailSend').disabled = false; msg($('regMsgM'), ''); msg($('regMsgC'), '');
      $('regMailShow').textContent = r.mail + ' 로 보냈습니다. 10분 안에 입력하세요.';
      regCodeSet(''); regStage('regCodeStep'); setTimeout(function () { $('regMailCode').focus(); }, 50);
    }).withFailureHandler(function (e) {
      $('regMailSend').disabled = false; msg($('regMsgM'), errText(e), '#c0392b');
    }).empMailSend({ pin: $('regPin').value.trim(), mail: mailId + '@' + regDomain });
  };
  $('regCodeOk').onclick = function () {
    $('regCodeOk').disabled = true; msg($('regMsgC'), '확인 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('regCodeOk').disabled = false; msg($('regMsgC'), '');
      regTicket = r.ticket; regTicketAt = Date.now(); regStage('regForm'); setTimeout(function () { $('regName').focus(); }, 50);
    }).withFailureHandler(function (e) {
      $('regCodeOk').disabled = false; regCodeSet(''); $('regMailCode').focus(); msg($('regMsgC'), errText(e), '#c0392b');
    }).empMailVerify({ pin: $('regPin').value.trim(), code: $('regMailCode').value.trim() });
  };
  $('regNo').onclick = closeReg; $('regCancel').onclick = closeReg;
  $('regGo').onclick = function () { regStage('regMailStep'); setTimeout(function () { $('regMail').focus(); }, 50); };
  $('regBack').onclick = function () { regStage('regForm'); };
  $('regNext').onclick = function () {
    var v = function (id) { return $(id).value.trim(); }, bad = function (t, id) { msg($('regMsg'), t, '#c0392b'); $(id).focus(); };
    if (!v('regName')) return bad('이름을 입력하세요.', 'regName');
    if (!v('regPin')) return bad('사번을 입력하세요.', 'regPin');
    if (!v('regDept')) return bad('부서명을 입력하세요.', 'regDept');
    if (!v('regRank')) return bad('직위를 입력하세요.', 'regRank');
    if (!/^\d{6}$/.test(v('regC1'))) return bad('개인 코드는 숫자 6자리로 정해 주세요.', 'regC1');
    if (v('regC1') !== v('regC2')) { $('regC2').value = ''; return bad('두 번 입력한 개인 코드가 다릅니다. 다시 입력하세요.', 'regC2'); }
    msg($('regMsg'), '');
    $('regShow').textContent = '';
    [['이름', v('regName')], ['사번', v('regPin')], ['부서명', v('regDept')], ['팀', v('regTeam') || '없음'], ['직책', v('regPost') || '없음'], ['직위', v('regRank')]].forEach(function (x) {
      var d = document.createElement('div'); d.textContent = x[0] + ': ' + x[1]; $('regShow').appendChild(d);
    });
    regStage('regCheck');
  };
  $('regSend').onclick = function () {
    $('regSend').disabled = true; msg($('regMsg2'), '등록 중…', '#6b7686');
    var pin = $('regPin').value.trim();
    srv().withSuccessHandler(function () {
      $('regSend').disabled = false; closeReg();
      try { localStorage.setItem('bglPin', pin); } catch (x) {}
      $('lgPin').value = pin; $('lgCode').value = '';
      msg($('lgMsg'), '등록을 완료했습니다. 개인 코드로 로그인하세요.', '#12833b');
    }).withFailureHandler(function (e) {
      $('regSend').disabled = false; msg($('regMsg2'), errText(e), '#c0392b');
    }).empRegister({ pin: pin, ticket: regTicket, name: $('regName').value, dept: $('regDept').value, team: $('regTeam').value, post: $('regPost').value, rank: $('regRank').value,
      newCode: $('regC1').value.trim(), newCode2: $('regC2').value.trim(), device: devInfo });
  };

  /* ---------- 개인정보 변경: 직원DB의 메일로 받은 인증 코드를 입력해야 열림 ---------- */
  $('chgHead').onclick = function () { $('chgCard').classList.toggle('open'); };
  var chgTicket = '';
  $('chgMailSend').onclick = function () {
    $('chgForm').classList.add('hidden'); chgTicket = '';
    $('chgMailSend').disabled = true; msg($('chgMsg'), '보내는 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('chgMailSend').disabled = false; $('chgMailSend').textContent = '인증 코드 다시 받기';
      $('chgCodeRow').classList.remove('hidden'); $('chgMailCode').value = ''; $('chgMailCode').focus();
      msg($('chgMsg'), r.mail + ' 로 인증 코드를 보냈습니다. 10분 안에 입력하세요.', '#12833b');
    }).withFailureHandler(function (e) {
      $('chgMailSend').disabled = false; msg($('chgMsg'), errText(e), '#c0392b');
    }).empChangeSend(staff && staff.token || '');
  };
  $('chgCodeOk').onclick = function () {
    $('chgCodeOk').disabled = true; msg($('chgMsg'), '확인 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('chgCodeOk').disabled = false; msg($('chgMsg'), '');
      chgTicket = r.ticket; $('chgCodeRow').classList.add('hidden');
      $('chgName').value = r.info.name; $('chgPinShow').value = r.info.pin; $('chgDept').value = r.info.dept; $('chgTeam').value = r.info.team || ''; $('chgPost').value = r.info.post; $('chgRank').value = r.info.rank;
      $('chgForm').classList.remove('hidden');
    }).withFailureHandler(function (e) {
      $('chgCodeOk').disabled = false; $('chgMailCode').value = ''; msg($('chgMsg'), errText(e), '#c0392b');
    }).empChangeVerify(staff && staff.token || '', $('chgMailCode').value.trim());
  };
  $('chgSend').onclick = function () {
    if (!chgTicket) return;
    $('chgSend').disabled = true; msg($('chgMsg'), '저장 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('chgSend').disabled = false; chgTicket = ''; $('chgForm').classList.add('hidden');
      $('chgMailSend').textContent = '메일로 인증 코드 받기';
      setStaff({ token: staff.token, name: r.name, disp: r.disp, admin: staff.admin, lv: staff.lv });
      enterList(); refreshInit();
      msg($('chgMsg'), '개인정보를 변경했습니다.', '#12833b');
    }).withFailureHandler(function (e) {
      $('chgSend').disabled = false; msg($('chgMsg'), errText(e), '#c0392b');
    }).empChange({ token: staff && staff.token || '', ticket: chgTicket, name: $('chgName').value, dept: $('chgDept').value, team: $('chgTeam').value, post: $('chgPost').value, rank: $('chgRank').value });
  };

  /* ---------- 본인 확인 없는 서명지: 양식에 있는 칸 직접 입력 ---------- */
  function goSign(r, cred) {
    person = { name: cred.name, guest: cred.guest || null, disp: r.disp, already: r.already, r: r };
    fillSign(r);
    show('s2'); setupCanvas(); clearPad();
    msg($('msg2'), '');
  }
  /** 서명 화면 [뒤로]: 본인 확인 없는 서명지는 입력 화면, 직원은 서명지 목록 */
  function signBack() { if (edu && edu.guest) show('sp'); else if (edu && edu.pdf && PV.e && PV.e.id === edu.id) show('sv'); else resetAll(); }   // PDF 서명지: 미리보기로
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
      srv().withSuccessHandler(function (r) {
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
    enterList(); refreshInit(edus.length > 0);       // 목록이 이미 있으면 로딩창 없이 뒤에서 최신으로
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
    var run = srv().withSuccessHandler(function (res) {
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

  /* ---------- 비상: 운행 장애 환불 승객 등록 (접속 코드 없음) ---------- */
  var rfEdu = null, rfDirect = false;      // rfDirect: QR(주소?e=…)로 바로 들어온 승객
  var rfEnter = '', rfEnd = 0, rfTick = null;   // QR 입장 표시(서버가 만듦), 입력 제한 시각
  // 이 휴대폰(브라우저)의 표시: QR로 들어온 등록을 휴대폰 한 대당 3건까지로 제한하는 데 씀 (개인정보 아님, 무작위 값)
  var devTok = (function () {
    try {
      var t = localStorage.getItem('bglDev');
      if (!t) { t = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem('bglDev', t); }
      return t;
    } catch (x) { return ''; }
  })();
  /** 직원 대리 등록: 제목 줄 [고객용 QR] → 쓰던 내용은 두고 QR 크게 보기 (QR 접수 시간 안일 때만, 끝나면 숨김, 연장되면 다시 보임) */
  function rfMiniSetup(e) {
    if (!e.qrEnd) e.qrEnd = Date.now() + (Number(e.qrLeft) || 0);
    var qSpan = $('rfQrBtn').querySelector('span');
    RQ.items = RQ.items.filter(function (it) { return it.el !== qSpan; });
    var qOn = !rfDirect && !!e.qrKey && RQ.ok && !!rfUrl(e.id) && e.qrEnd > Date.now();
    $('rfQrBtn').classList.toggle('hidden', !qOn);
    $('rfQrBtn').onclick = function () { rqOpen(e); };
    if (qOn) rqAdd(e, qSpan, e.qrEnd);
  }
  function openRefund(e) {
    rfEdu = e; edu = null; code = ''; person = null;
    $('rfTitle').textContent = e.title; $('rfDate').textContent = e.date || '';
    buildRfForm(e.form, e.formError);
    $('rfLocBox').classList.toggle('hidden', !rfDirect);     // 위치정보는 QR로 들어온 승객만 (역 직원 대리 등록은 안 받음)
    $('rfLocText').textContent = e.form ? e.form.locConsent || '' : '';
    $('rfBack').classList.toggle('hidden', rfDirect);        // 고객용 QR은 [처음으로] 없음 (직원용은 그대로)
    rfMiniSetup(e);
    $('rfAgree').checked = false; $('rfLocAgree').checked = false; $('rfAccOn').checked = false; rfConsentSync(); msg($('rfMsg'), ''); $('rfOk').disabled = false;
    show('sf');
    rfTimer();
  }
  /** 고객용 QR: 남은 입력 시간 표시, 다 되면 입력 내용을 지우고 안내 화면으로 (전송 중이면 결과를 기다림) */
  function rfTimer() {
    clearInterval(rfTick); rfTick = null;
    $('rfTime').classList.toggle('hidden', !rfDirect);
    if (!rfDirect) return;
    var tick = function () {
      if (curScreen !== 'sf') { clearInterval(rfTick); rfTick = null; return; }
      var ms = rfEnd - Date.now();
      if (ms <= 0) { if (!$('rfOk').disabled) rfExpire(); return; }
      var sec = Math.ceil(ms / 1000), ss = sec % 60;
      $('rfTime').textContent = '입력 제한 시간 ' + Math.floor(sec / 60) + ':' + (ss < 10 ? '0' : '') + ss;
      $('rfTime').classList.toggle('soon', sec <= 60);
    };
    tick(); rfTick = setInterval(tick, 1000);
  }
  function rfExpire() {
    clearInterval(rfTick); rfTick = null;
    $('rfFields').innerHTML = ''; $('rfAcc').innerHTML = ''; rfEdu = null;
    showNotice('입력 시간이 지났습니다', 'QR로 들어온 지 5분이 지났습니다. QR을 다시 찍어 주세요.');
  }
  function showNotice(title, text) { $('sxTitle').textContent = title; $('sxMsg').textContent = text; show('sx'); }
  /** 체크하면 안내문 접힘, 해제하면 다시 보임. 계좌 칸은 체크하면 나타남 */
  function rfConsentSync() {
    $('rfConsentText').classList.toggle('hidden', $('rfAgree').checked);
    $('rfLocText').classList.toggle('hidden', $('rfLocAgree').checked);
    $('rfAccForm').classList.toggle('hidden', !$('rfAccOn').checked);
    if (!$('rfAccOn').checked) [].forEach.call($('rfAcc').querySelectorAll('input'), function (el) { el.value = ''; });
  }
  function buildRfForm(form, err) {
    var box = $('rfFields'); box.innerHTML = ''; $('rfAcc').innerHTML = '';
    $('rfConsentText').textContent = form ? form.consent || '' : '';
    $('rfAccText').textContent = form ? form.accConsent || '' : '';
    $('rfAccBox').classList.toggle('hidden', !(form && form.fields.some(function (f) { return f.optional; })));
    if (!form) { box.innerHTML = '<div class="msg" style="color:#c0392b"></div>'; box.firstChild.textContent = '등록 화면을 불러오지 못했습니다. 관리자에게 문의하세요.' + (err ? ' (' + err + ')' : ''); return; }
    var fs = form.fields.slice(), si = fs.findIndex(function (f) { return f.type === 'station'; });
    if (si > -1) {                                                      // 승차권 종류는 시트 열 순서와 상관없이 역 칸 바로 위에
      var sel = fs.filter(function (f, i) { return f.type === 'select' && i > si; });
      fs = fs.filter(function (f) { return sel.indexOf(f) < 0; });
      fs.splice.apply(fs, [si, 0].concat(sel));
    }
    var isCardF = function (f) { return f.type === 'select' && (f.options || []).indexOf(form.cardOnly || '교통카드') > -1; };
    var ci = fs.findIndex(isCardF), oi = fs.findIndex(function (f) { return f.type === 'select' && !isCardF(f); });
    if (ci > -1 && oi > ci) fs.splice(ci, 0, fs.splice(oi, 1)[0]);      // 승객 구분은 승차권 종류 위에 (시트 열 순서와 상관없이)
    var stRow = null, idRow = null;
    fs.forEach(function (f) {
      var d = document.createElement('div'); d.className = 'field';
      var l = document.createElement('label'); l.textContent = f.label; d.appendChild(l);
      var el;
      if (f.type === 'station' || f.type === 'select') {
        el = document.createElement('select');
        var o0 = document.createElement('option'); o0.value = ''; o0.textContent = f.type === 'station' ? '역을 고르세요' : '고르세요'; el.appendChild(o0);
        (f.type === 'station' ? form.stations : f.options || []).forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
      } else {
        el = document.createElement('input'); el.type = f.type === 'tel' ? 'tel' : 'text'; el.autocomplete = 'off';
        if (f.type === 'tel') {
          el.inputMode = 'numeric'; el.placeholder = '010-0000-0000'; el.maxLength = 13;
          el.addEventListener('input', function () {          // 입력하면서 하이픈 자동
            var dg = el.value.replace(/\D/g, '').slice(0, 11);
            el.value = dg.length < 4 ? dg : dg.length < 8 ? dg.slice(0, 3) + '-' + dg.slice(3) : dg.slice(0, 3) + '-' + dg.slice(3, dg.length - 4) + '-' + dg.slice(-4);
          });
        } else { el.maxLength = 30; el.placeholder = f.label; }
      }
      el.setAttribute('data-key', f.key); el.setAttribute('data-label', f.label);
      if (f.type === 'station') { d.setAttribute('data-st', '1');      // 역 칸: 승차권 종류를 고르면 나타남
        if (!f.dest && el.options[0]) el.options[0].textContent = '탑승역 선택'; }
      if (f.dest) d.setAttribute('data-dest', '1');                    // 하차/목적지: 승차권 종류에 따라 이름이 바뀜
      d.appendChild(el);
      if (f.type === 'select') {                                       // 고르는 칸은 한 줄 버튼 (값은 숨긴 select에 담김). 승차권 종류는 처음에 선택 없음, 나머지는 첫 항목 선택
        el.style.display = 'none';
        var seg = document.createElement('div'); seg.className = 'rfSeg';
        var opts = f.options || [], paint = function () { [].forEach.call(seg.children, function (b) { b.classList.toggle('on', b.textContent === el.value); }); };
        opts.forEach(function (v) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = v;
          b.onclick = function () { el.value = v; paint(); rfSync(); };
          seg.appendChild(b);
        });
        if (opts.length && opts.indexOf(form.cardOnly || '교통카드') < 0) el.value = opts[0];
        paint(); d.appendChild(seg);
      }
      if (f.optional) $('rfAcc').appendChild(d);                       // 계좌 정보: 선택 칸
      else if (f.type === 'station') {                                 // 승차·하차는 한 줄에 나란히
        if (!stRow) { stRow = document.createElement('div'); stRow.className = 'rfStRow'; box.appendChild(stRow); }
        stRow.appendChild(d);
      } else if (f.isName || f.type === 'tel') {                       // 이름·연락처도 한 줄에
        if (!idRow) { idRow = document.createElement('div'); idRow.className = 'rfStRow'; box.appendChild(idRow); }
        idRow.appendChild(d);
      } else box.appendChild(d);
    });
    rfCard = form.cardOnly || '교통카드';
    rfSync();
  }
  /** 승차권 종류를 고르면 역 칸(승차역·하차역)이 나타남. 두 번째 역 칸 이름: 승차권 → '목적지'(산 표의 도착역), 교통카드 → '하차역' (둘 다 필수) */
  var rfCard = '교통카드';
  function rfSync() {
    var t = '';
    [].forEach.call($('rfFields').querySelectorAll('select'), function (el) { if (el.querySelector('option[value="' + rfCard + '"]')) t = el.value; });
    var name = t && t !== rfCard ? '목적지' : '하차역';
    var hint = name === '목적지' ? '목적지 선택' : '내린역 선택';
    [].forEach.call($('rfFields').querySelectorAll('[data-st]'), function (d) {
      d.classList.toggle('hidden', !t);
      if (!t) { var s = d.querySelector('select'); if (s) s.value = ''; }
    });
    [].forEach.call($('rfFields').querySelectorAll('[data-dest]'), function (d) {
      d.querySelector('label').textContent = name;
      var s = d.querySelector('select'); if (s) { s.setAttribute('data-label', name); if (s.options[0]) s.options[0].textContent = hint; }
    });
  }
  function nextRefund() {          // 다음 승객: 이름·연락처 등 글자 칸과 동의는 비우고, 고르는 칸(역·승차권)은 그대로
    [].forEach.call($('rfFields').querySelectorAll('input'), function (el) { el.value = ''; });
    $('rfAgree').checked = false; $('rfLocAgree').checked = false; $('rfAccOn').checked = false; rfConsentSync(); msg($('rfMsg'), ''); $('rfOk').disabled = false;
    show('sf');
    var first = $('rfFields').querySelector('input,select'); if (first) setTimeout(function () { first.focus(); }, 50);
  }
  $('rfOk').onclick = function () {
    if (!rfEdu) return;
    var vals = {}, miss = null;
    [].forEach.call($('sf').querySelectorAll('input[data-key],select[data-key]'), function (el) {
      var v = el.value.trim(); vals[el.getAttribute('data-key')] = v;
      if (el.closest('.hidden')) return;                                // 숨긴 칸은 빈칸 검사에서 뺌
      if (!v && !miss) miss = el;
    });
    if (miss) { msg($('rfMsg'), miss.getAttribute('data-label') + ' 칸을 입력하세요.', '#c0392b'); miss.focus(); return; }
    if (!$('rfAgree').checked) { msg($('rfMsg'), '개인정보 수집·이용에 동의해 주세요.', '#c0392b'); return; }
    var direct = rfDirect;
    if (direct && !(navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) {   // 고객용 QR: PC(터치 안 되는 기기)로는 등록 안 됨
      msg($('rfMsg'), '휴대폰으로 QR을 찍어 등록해 주세요. 컴퓨터에서는 등록할 수 없습니다. 어려우면 역 직원에게 문의해 주세요.', '#c0392b'); return;
    }
    if (direct && !$('rfLocAgree').checked) { msg($('rfMsg'), '위치정보 수집·이용에 동의하지 않으면 이 화면에서 등록할 수 없습니다. 역 직원에게 문의해 주세요.', '#c0392b'); return; }
    $('rfOk').disabled = true;
    if (!direct) { sendRefund(vals, null); return; }
    msg($('rfMsg'), '위치 확인 중… (휴대폰이 위치 사용을 물으면 [허용]을 눌러 주세요)', '#6b7686');
    getLoc(function (loc) {
      if (loc.denied) { $('rfOk').disabled = false; msg($('rfMsg'), '위치 권한이 꺼져 있어 등록할 수 없습니다. 휴대폰 설정에서 이 브라우저의 위치 권한을 허용하거나, 역 직원에게 문의해 주세요.', '#c0392b'); return; }
      if (loc.off) { $('rfOk').disabled = false; msg($('rfMsg'), '휴대폰 위치(GPS)가 꺼져 있습니다. 위치를 켜고 다시 눌러 주세요. 어려우면 역 직원에게 문의해 주세요.', '#c0392b'); return; }
      sendRefund(vals, loc);
    });
  };
  // 위치 한 번 받기 (최대 10초)
  // - 권한 거부 → denied (막음)
  // - '위치를 찾을 수 없음'이 바로(2.5초 안에) 오거나, '위치 켜기' 창을 거절하고 돌아온 경우 → off: 휴대폰 위치가 꺼진 것으로 보고 막음
  // - 기다리다 시간 초과(지하·실내) → err만 담아 그대로 등록 ('위치 확인 안 됨')
  function getLoc(cb) {
    var t0 = Date.now(), blurred = false, onBlur = function () { blurred = true; };
    window.addEventListener('blur', onBlur); document.addEventListener('visibilitychange', onBlur);
    var done = false, fin = function (r) {
      if (done) return; done = true;
      window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onBlur);
      cb(r);
    };
    if (!navigator.geolocation) { fin({ err: '지원 안 함' }); return; }
    setTimeout(function () { fin({ err: '시간 초과' }); }, 12000);
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        fin({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
      }, function (e) {
        if (e && e.code === 1) fin({ denied: true });
        else if (e && e.code === 2 && (Date.now() - t0 < 2500 || blurred)) fin({ off: true });
        else fin({ err: e && e.code === 3 ? '시간 초과' : '위치 못 잡음' });
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } catch (x) { fin({ err: '위치 오류' }); }
  }
  function sendRefund(vals, loc) {
    msg($('rfMsg'), '등록 중…', '#6b7686');
    srv().withSuccessHandler(function (r) {
      $('rfOk').disabled = false; msg($('rfMsg'), '');
      $('doneWho').textContent = r.name;
      $('doneMsg').textContent = r.title + ' — 환불 등록이 완료되었습니다.';
      show('s3');
    }).withFailureHandler(function (err) {
      $('rfOk').disabled = false;
      if (rfDirect && /QR을 다시 찍어/.test(errText(err))) { rfExpire(); return; }
      msg($('rfMsg'), errText(err), '#c0392b');
    }).submitRefund({ eduId: rfEdu.id, values: vals, consent: true, consentVer: (rfEdu.form || {}).consentVer || '',
      locConsent: !!loc, locVer: (rfEdu.form || {}).locVer || '', loc: loc || null, accConsent: $('rfAccOn').checked, accVer: (rfEdu.form || {}).accVer || '', device: devInfo, dev: devTok, direct: rfDirect, enter: rfDirect ? rfEnter : '', token: !rfDirect && staff && staff.token || '' });
  }
  $('rfBack').onclick = function () { resetAll(); };
  $('rfAgree').onchange = $('rfLocAgree').onchange = $('rfAccOn').onchange = function () { if (this.checked) msg($('rfMsg'), ''); rfConsentSync(); };

  /* ---------- 안전점검의 날 체크리스트 (그룹 서명) ----------
     서명지 목록에 카드 하나 (점검자·팀장 서명한 역 수 / 전체) → 누르면 역 선택 화면
     점검자: 역 선택 → 항목 양호·불량·비고 (지난 점검 값이 기본) → 완료 → 최종 확인 → 서명 → 다음(제출)
     팀장: 역 선택 화면에서 진행 상황 · [역별 내용 보기](이전·다음 역) · 모든 역 점검이 끝나면 [일괄 서명] → 서명 한 번이 모든 역에 */
  var sk = null, skSt = null, skStep = 'pick', skRes = {};   // sk: 점검자 화면 데이터, skSt: 고른 역
  var skSigMode = '';      // 서명 칸: 'ins' 점검자 · 'lead' 팀장 일괄 서명
  var SK_I = 'bglSafeI:';
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (x) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (x) { return false; } }

  function skItem(e) {
    var closed = e.open === false, c = e.safety || { n: 0, ins: 0, lead: 0 };
    var w = document.createElement('div'); w.className = 'skItem' + (closed ? ' closed' : ''); w.setAttribute('role', 'button'); w.tabIndex = 0;
    w.innerHTML = '<div class="skTop"><span class="skTag">안전점검의 날</span><b></b><span class="rank"></span></div>' +
      '<div class="skCnt">점검자 서명 <strong class="ins"></strong> · 팀장 서명 <strong class="lead"></strong></div><div class="skGo"></div>';
    var q = function (x) { return w.querySelector(x); };
    q('b').textContent = e.title; q('.rank').textContent = [e.dept, e.date].filter(Boolean).join(' · ');
    q('.ins').textContent = c.ins + '/' + c.n; q('.lead').textContent = c.lead + '/' + c.n;
    q('.ins').classList.toggle('done', c.n > 0 && c.ins >= c.n); q('.lead').classList.toggle('done', c.n > 0 && c.lead >= c.n);
    q('.skGo').textContent = closed ? '접수 마감 · 눌러서 보기·PDF' : '눌러서 역 선택';
    w.onclick = function () { if (skOpening) return; w.classList.add('busy'); skOpen(e.id, false, '', function () { w.classList.remove('busy'); }); };
    return w;
  }

  /* ---------- 점검자 ---------- */
  var skOpening = false, skPickAt = 0;   // 카드를 연달아 눌러도 한 번만, 역 선택 화면이 뜬 직후의 탭은 무시
  function skOpen(id, again, stName, done) {
    if (skOpening) return;
    skOpening = true; msg($('msg1'), '불러오는 중…', '#6b7686');
    srv().withSuccessHandler(function (d) {
      skOpening = false; if (done) done();
      msg($('msg1'), ''); msg($('skMsg'), ''); sk = d;
      $('skTitle').textContent = d.title; $('skDate').textContent = d.date || '';
      var st = stName && d.stations.filter(function (x) { return x.st === stName; })[0];
      if (st) skForm(st); else skStage('pick');
      show('sk');
    }).withFailureHandler(function (e) { skOpening = false; if (done) done(); msg($('msg1'), errText(e), '#c0392b'); }).safetyOpen(staff && staff.token || '', id);
  }
  function skStage(s) {
    skStep = s;
    ['pick', 'form', 'rev', 'sig'].forEach(function (k) { $('sk' + { pick: 'Pick', form: 'Form', rev: 'Rev', sig: 'Sig' }[k]).classList.toggle('hidden', k !== s); });
    if (s === 'pick') { skGrid(); skPickAt = Date.now(); }
    document.body.classList.toggle('skSig', s === 'sig');
    if (s !== 'sig') landOff();
    if (s === 'sig') { msg($('skMsg'), ''); $('skSigEdu').textContent = [sk.title, sk.date].filter(Boolean).join(' · '); setTimeout(function () { skPad.setup(); }, 30); }   // 서명 칸 높이는 skPad.fit이 맞춤
    window.scrollTo(0, 0); saveState();
  }
  /* ---------- PDF 출력: 팀장 확인이 끝난 역별 (마감된 서명지도 받을 수 있음, 전체 PDF는 없음) ---------- */
  var skPdfBusy = false;
  function skPdfGet(st) {
    if (skPdfBusy) return;
    skPdfBusy = true; msg($('skMsg'), 'PDF 만드는 중… (10초 이상 걸릴 수 있습니다)', '#6b7686');
    srv().withSuccessHandler(function (r) {
      skPdfBusy = false;
      if (r.pdf) saveFile(r.base + '.pdf', b64Blob(r.pdf, 'application/pdf'));
      else r.pdfs.forEach(function (b64, i) { setTimeout(function () { saveFile(r.base + '_' + (r.names[i] || i + 1) + '.pdf', b64Blob(b64, 'application/pdf')); }, i * 700); });
      if (r.dl) { sk.pdfDl = sk.pdfDl || {}; sk.pdfDl[st] = r.dl; skGrid(); }   // PDF 받음 ✓ (서버에 남음)
      msg($('skMsg'), st + ' PDF를 저장했습니다. 컴퓨터·휴대폰 다운로드 폴더를 확인하세요.', '#12833b');
    }).withFailureHandler(function (e) {
      skPdfBusy = false; msg($('skMsg'), errText(e), '#c0392b');
    }).safetyPdf(staff && staff.token || '', sk.id, st);
  }
  function skGrid() {
    var g = $('skGrid'); g.innerHTML = '';
    sk.stations.forEach(function (x) {
      var cell = document.createElement('div'); cell.className = 'skCell';
      var b = document.createElement('button'); b.type = 'button'; b.className = x.ins ? 'done' : '';
      b.innerHTML = '<span></span><small></small>';
      if (x.ins && x.chk) { b.className = 'chk'; b.insertAdjacentHTML('beforeend', '<small class="ck">확인 필요</small>'); }   // 지난 기록보다 수량이 바뀌었거나 비고·불량이 있는 역
      b.firstChild.textContent = x.st;
      b.children[1].textContent = x.ins ? '✓ ' + x.ins.name + (x.lead ? ' · ' + (typeof x.lead === 'string' ? x.lead : '팀장') + ' ✓' : '') : '미점검';   // 팀장 서명이 끝나면 팀장 이름
      b.onclick = function () {
        if (Date.now() - skPickAt < 500) return;      // 카드를 누른 손가락이 역 칸에 다시 눌린 것
        if (x.lead) { msg($('skMsg'), x.st + ': 팀장 확인이 끝나 점검 내용을 수정할 수 없습니다. PDF만 받을 수 있습니다.', '#c0392b'); return; }   // 팀장 서명 뒤에는 수정 불가
        if (sk.open === false) { msg($('skMsg'), '접수가 마감되어 점검할 수 없습니다.', '#c0392b'); return; }
        msg($('skMsg'), ''); skForm(x);
      };
      cell.appendChild(b);
      if (x.lead) {                                   // 점검자·팀장 서명이 끝난 역: PDF
        var got = (sk.pdfDl || {})[x.st];             // 받은 역: ✓ + 누가·언제
        var p = document.createElement('button'); p.type = 'button'; p.className = 'skPdfS' + (got ? ' got' : ''); p.textContent = got ? '📄 PDF ✓' : '📄 PDF';
        p.onclick = function () { skPdfGet(x.st); };
        cell.appendChild(p);
        if (got) { var gd = document.createElement('div'); gd.className = 'pdfDl'; gd.style.textAlign = 'center'; gd.textContent = (got.n || '') + ' ' + (got.at || ''); cell.appendChild(gd); }
      }
      g.appendChild(cell);
    });
    skLeadBox();
  }
  /* 팀장: 진행 상황 · 일괄 서명 (모든 역 점검자 서명이 끝나야 켜짐, 팀장 확인 전인 역에만 들어감) */
  function skLeadBox() {
    $('skLead').classList.toggle('hidden', !sk.leader);
    if (!sk.leader) return;
    var n = sk.stations.length, miss = sk.stations.filter(function (x) { return !x.ins; }), left = sk.stations.filter(function (x) { return !x.lead; }).length;
    $('skLeadSt').textContent =                 // 서명 수·미점검 역은 위 역 칸에 보이므로 지금 할 일만
      (sk.open === false ? '접수가 마감되었습니다.' : miss.length ? '모든 역 점검이 끝나야 일괄 서명할 수 있습니다.' :
        left ? '모든 역 점검이 끝났습니다. [일괄 서명]을 누르고 서명 한 번이면 팀장 확인 전인 역 ' + left + '개에 모두 들어갑니다.' : '모든 역의 팀장 확인이 끝났습니다.');
    $('skLeadSign').disabled = sk.open === false || !!miss.length || !left;
    $('skLeadView').disabled = n === miss.length;
    $('skLeadCRow').classList.toggle('hidden', left === n);   // 팀장 서명한 역이 있을 때만
    skCancelArm(false);
  }
  /* 팀장 일괄 서명 취소: 모든 역의 팀장 서명을 지움 (마감된 서명지는 관리자가 다시 연 뒤에만). 실수로 누르지 않게 두 번 눌러 실행 */
  var skCancelT = null;
  function skCancelArm(on) {
    clearTimeout(skCancelT); $('skLeadCancel').classList.toggle('armed', on);
    $('skLeadCancel').textContent = on ? '한 번 더 누르면 모든 역의 팀장 서명 취소' : '일괄 서명 취소';
    if (on) skCancelT = setTimeout(function () { skCancelArm(false); }, 4000);
  }
  $('skLeadCancel').onclick = function () {
    if (skBusy) return;
    if (sk.open === false) { msg($('skMsg'), '마감된 서명지입니다. 관리자가 접수를 다시 연 뒤 일괄 서명을 취소할 수 있습니다.', '#c0392b'); return; }
    if (!$('skLeadCancel').classList.contains('armed')) { skCancelArm(true); return; }
    skCancelArm(false); skBusy = true; $('skLeadCancel').disabled = true; msg($('skMsg'), '취소 중…', '#6b7686');
    var end = function (t, c) {
      srv().withSuccessHandler(function (d) { sk = d; skBusy = false; $('skLeadCancel').disabled = false; skStage('pick'); msg($('skMsg'), t, c); })
        .withFailureHandler(function () { skBusy = false; $('skLeadCancel').disabled = false; msg($('skMsg'), t, c); }).safetyOpen(staff && staff.token || '', sk.id);
    };
    srv().withSuccessHandler(function (r) { end('팀장 서명 ' + r.n + '개 역을 취소했습니다. 점검자가 다시 고칠 수 있습니다.', '#12833b'); })
      .withFailureHandler(function (e) { skBusy = false; $('skLeadCancel').disabled = false; msg($('skMsg'), errText(e), '#c0392b'); })
      .safetyLeaderCancel({ token: staff && staff.token || '', eduId: sk.id });
  };
  $('skLeadView').onclick = function () { skLeadOpen(sk.id); };
  $('skLeadSign').onclick = function () {
    var left = sk.stations.filter(function (x) { return !x.lead; }).length;
    skSigMode = 'lead'; msg($('skMsg'), '');
    $('skSigName').textContent = '팀장 일괄 서명 (' + left + '개 역)'; skPad.clear(); skStage('sig');
  };
  /** 수량 정리 (서버와 같게): 비었거나 0이면 '-', 줄바꿈은 '/'로도 입력 */
  function skQNorm(v) {
    var lines = String(v == null ? '' : v).split(/[\n\/]/).map(function (x) { return x.replace(/\s+/g, ' ').trim().slice(0, 30); }).filter(Boolean);
    var zero = function (x) { return /^(?:[^:：]*[:：]\s*)?0*\s*(개소|개|식)?$/.test(x) || x === '-'; };
    return !lines.length || lines.every(zero) ? '-' : lines.join('\n');
  }
  function skQtyOut() { var o = {}; skSt.items.forEach(function (it) { o[it.i] = skQNorm(skQty[it.i]); }); return o; }
  function skItemsEdited() { return skSt.items.map(function (it) { return { i: it.i, f: it.f, t: it.t, q: skQNorm(skQty[it.i]) }; }); }
  var skQty = {};
  function skDraftKey() { return SK_I + sk.id + ':' + skSt.st; }
  function skForm(x) {
    skSt = x; skSigMode = '';
    var dr = lsGet(skDraftKey());                     // 입력 중이던 값 (창을 닫았다 열어도)
    skRes = JSON.parse(JSON.stringify((dr && dr.res) || x.def || {}));
    skQty = {}; x.items.forEach(function (it) { skQty[it.i] = dr && dr.qty && dr.qty[it.i] !== undefined ? dr.qty[it.i] : it.q === '-' ? '' : it.q.replace(/\n/g, ' / '); });
    $('skStName').textContent = x.st;
    $('skDefNote').textContent = dr ? '입력하던 내용을 불러왔습니다.' : x.ins ? '이 서명지에 낸 값입니다. 고친 뒤 다시 서명하면 바뀝니다.' + (x.lead ? ' (팀장 확인은 다시 받아야 합니다)' : '') :
      x.def ? '지난 점검 값이 기본으로 선택되어 있습니다. 바뀐 곳만 고치세요.' : '첫 점검입니다. 모든 항목을 고르세요.';
    var box = $('skItems'), lastF = ''; box.innerHTML = '';
    x.items.forEach(function (it) {
      if (it.f !== lastF) { var h = document.createElement('div'); h.className = 'skGrp'; h.textContent = it.f; box.appendChild(h); lastF = it.f; }
      var v = skRes[it.i] || (skRes[it.i] = ['', '']);
      var d = document.createElement('div'); d.className = 'skIt'; d.setAttribute('data-i', it.i);
      d.innerHTML = '<div class="skH"><span class="t"></span></div>' +
        '<div class="skQ"><div class="skL"><input type="text" class="qi" maxlength="30" placeholder="수량 (없으면 -)" autocomplete="off"><label class="o"><input type="checkbox"> 양호</label></div>' +
        '<div class="skL"><textarea class="ni fold" rows="1" maxlength="200" placeholder="비고(조치사항)" wrap="off"></textarea><label class="x"><input type="checkbox"> 불량</label></div><button type="button" class="nTog hidden">▾ 펼치기</button></div>';
      d.querySelector('.t').textContent = it.t;
      var cks = d.querySelectorAll('.skL label input'), lbs = d.querySelectorAll('.skL label'), inp = d.querySelector('.ni'), qin = d.querySelector('.qi'), tog = d.querySelector('.nTog');
      qin.value = skQty[it.i]; qin.oninput = function () { skQty[it.i] = qin.value; skDraft(); };
      var paint = function () { cks[0].checked = v[0] === 'O'; cks[1].checked = v[0] === 'X'; lbs[0].classList.toggle('on', v[0] === 'O'); lbs[1].classList.toggle('on', v[0] === 'X'); };
      cks[0].onchange = function () { v[0] = cks[0].checked ? 'O' : ''; d.classList.remove('miss'); paint(); skDraft(); };   // 양호·불량 중 하나만 (다시 누르면 해제)
      cks[1].onchange = function () { v[0] = cks[1].checked ? 'X' : ''; d.classList.remove('miss'); paint(); skDraft(); };
      /* 비고: 접으면 한 줄, 길면 [펼치기]로 전체 글이 다 보이게 */
      var open = false;
      var fit = function () {
        if (open) { inp.classList.remove('fold'); inp.setAttribute('wrap', 'soft'); inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px'; }
        else { inp.classList.add('fold'); inp.setAttribute('wrap', 'off'); inp.style.height = ''; }
        tog.textContent = open ? '▴ 접기' : '▾ 펼치기';
        tog.classList.toggle('hidden', !open && inp.scrollWidth <= inp.clientWidth + 1);
      };
      tog.onclick = function () { open = !open; fit(); };
      inp.value = v[1] || ''; inp.oninput = function () { v[1] = inp.value.replace(/\n/g, ' '); if (v[1] !== inp.value) inp.value = v[1]; fit(); skDraft(); };
      paint(); box.appendChild(d); fit();
    });
    skStage('form');
  }
  function skDraft() { if (sk && skSt) lsSet(skDraftKey(), { res: skRes, qty: skQty }); }
  $('skHome').onclick = function () { resetAll(); };
  $('skFormBack').onclick = function () { skStage('pick'); };
  $('skDone').onclick = function () {
    var miss = skSt.items.filter(function (it) { var v = skRes[it.i]; return !v || (v[0] !== 'O' && v[0] !== 'X'); });
    [].forEach.call($('skItems').querySelectorAll('.skIt'), function (d) { d.classList.toggle('miss', miss.some(function (it) { return String(it.i) === d.getAttribute('data-i'); })); });
    if (miss.length) { msg($('skMsg'), '점검결과를 고르지 않은 항목 ' + miss.length + '개가 있습니다.', '#c0392b'); var f = $('skItems').querySelector('.miss'); if (f) f.scrollIntoView({ block: 'center' }); return; }
    msg($('skMsg'), '');
    $('skPaperBox').innerHTML = skPaper({ st: skSt.st, items: skItemsEdited() }, skRes, null, '', '', sk.title, sk.date, true);
    skStage('rev');
  };
  $('skRevBack').onclick = function () { skStage('form'); };
  $('skRevOk').onclick = function () { skSigMode = 'ins'; $('skSigName').textContent = skSt.st + ' 점검자 서명'; skPad.clear(); skStage('sig'); };
  $('skSigBack').onclick = function () { if (!skBusy) skStage(skSigMode === 'lead' ? 'pick' : 'rev'); };
  $('skClear').onclick = function () { if (!skBusy) skPad.clear(); };
  var skBusy = false;
  $('skSend').addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') { e.preventDefault(); skSubmit(); } });
  $('skSend').onclick = function () { skSubmit(); };
  function skSubmit() {
    if (skBusy || $('skSend').disabled) return;
    if (!skPad.strokes.length) { msg($('skMsg'), '서명해 주세요.', '#c0392b'); return; }
    if (skPad.n < 6) { msg($('skMsg'), '서명이 너무 짧습니다. 조금 더 크게 서명해 주세요.', '#c0392b'); return; }
    skBusy = true; skPad.locked = true; $('skPad').classList.add('locked'); $('skSend').disabled = true; $('skClear').disabled = true; $('skSigBack').disabled = true; msg($('skMsg'), '제출 중…', '#6b7686');
    var unlock = function () { skBusy = false; skPad.locked = false; $('skPad').classList.remove('locked'); $('skSend').disabled = skPad.n < 6; $('skClear').disabled = false; $('skSigBack').disabled = false; };
    var reload = function (done) {                   // 제출 뒤 역 목록을 다시 받아 역 선택 화면 (화면이 바뀐 뒤에 서명 칸 잠금을 풂)
      srv().withSuccessHandler(function (d) { sk = d; skStage('pick'); unlock(); msg($('skMsg'), done, '#12833b'); })
        .withFailureHandler(function () { skStage('pick'); unlock(); msg($('skMsg'), done, '#12833b'); }).safetyOpen(staff && staff.token || '', sk.id);
    };
    if (skSigMode === 'lead') {
      srv().withSuccessHandler(function (r) { skSigMode = ''; reload('팀장 서명을 ' + r.n + '개 역에 저장했습니다.'); })
        .withFailureHandler(function (e) { unlock(); msg($('skMsg'), errText(e), '#c0392b'); })
        .safetyLeaderSubmit({ token: staff && staff.token || '', eduId: sk.id, sign: skPad.png(), device: devInfo });
      return;
    }
    srv().withSuccessHandler(function (r) {
      lsSet(skDraftKey(), null);
      reload(r.st + ' 점검 서명을 ' + (r.resigned ? '다시 ' : '') + '제출했습니다.');
    }).withFailureHandler(function (e) {
      unlock(); msg($('skMsg'), errText(e), '#c0392b');
    }).safetySubmit({ token: staff && staff.token || '', eduId: sk.id, st: skSt.st, res: skRes, qty: skQtyOut(), dataUrl: skPad.png(), device: devInfo });
  }
  function skBack() {                                // 휴대폰 뒤로가기: 한 단계씩
    if (skBusy || skPdfBusy) return;
    if (skStep === 'sig') skStage(skSigMode === 'lead' ? 'pick' : 'rev'); else if (skStep === 'rev') skStage('form'); else if (skStep === 'form') skStage('pick'); else resetAll();
  }

  /** 체크리스트 모양: base(지난 점검 값)가 있으면 바뀐 줄을 노랗게 + 이전 값.
   *  chk(팀장 보기: { 항목: { q, m, x } })가 있으면 줄 대신 확인할 칸만 노랗게 (수량 바뀜·비고 있음·불량) */
  function skPaper(x, res, base, insImg, leadImg, title, date, noCmp, chk) {
    var groups = [];
    x.items.forEach(function (it) { var g = groups[groups.length - 1]; if (!g || g.f !== it.f) groups.push(g = { f: it.f, list: [] }); g.list.push(it); });
    var nChg = 0, nChk = 0, rows = '';
    groups.forEach(function (g) {
      g.list.forEach(function (it, k) {
        var v = res[it.i] || ['', ''], b = base && base[it.i];
        var ch = !!(b && (b[0] !== v[0] || (b[1] || '') !== (v[1] || '')));
        var c = chk && chk[it.i] || {}, ck = function (on) { return on ? ' ck' : ''; };
        if (ch) nChg++;
        if (c.q || c.m || c.x) nChk++;
        rows += '<tr class="' + (ch && !chk ? 'chg' : '') + '">' + (k ? '' : '<th rowspan="' + g.list.length + '">' + esc(g.f) + '</th>') +
          '<td class="pi">○ ' + esc(it.t) + (ch ? '<span class="was">이전: ' + esc(b[0] || '-') + (b[1] ? ' · ' + esc(b[1]) : '') + '</span>' : '') + '</td>' +
          '<td class="pq' + ck(c.q) + '">' + esc(it.q).replace(/\n/g, '<br>') + '</td><td class="pr' + (v[0] === 'X' ? ' x' : '') + ck(c.x) + '">' + esc(v[0] || '') + '</td><td class="pn' + ck(c.m) + '">' + esc(v[1] || '') + '</td></tr>';
      });
    });
    var img = function (u) { return u && u.indexOf('data:image/') === 0 ? '<img src="' + esc(u) + '" alt="서명">' : ''; };
    var head = chk ? '<div class="pChg' + (nChk ? '' : ' none') + '">' + (nChk ? '확인할 항목 ' + nChk + '개 (노란 칸: 수량 바뀜·비고·불량)' : '확인할 칸 없음') + (!base ? ' · 첫 점검' : nChg ? ' · 지난 점검과 결과가 바뀐 항목 ' + nChg + '개 (이전 값 표시)' : '') + '</div>' :
      '<div class="pChg' + (nChg ? '' : ' none') + '">' + (!base ? '첫 점검 (비교할 지난 점검 없음)' : nChg ? '지난 점검과 바뀐 곳 ' + nChg + '개 (노란 줄)' : '지난 점검과 같음') + '</div>';
    return '<div class="skPaper">' + (noCmp ? '' : head) +
      '<div class="pT">' + esc(title || '안전점검의 날 체크리스트') + '</div>' +
      '<table class="pHead"><colgroup><col style="width:18%"><col><col style="width:9%"><col style="width:19%"><col style="width:19%"></colgroup>' +
      '<tr><th>점검역사</th><td>' + esc(x.st) + '</td><th rowspan="2">결재</th><th>점검자</th><th>팀장</th></tr>' +
      '<tr><th>점검일자</th><td>' + esc(date || '') + '</td><td class="pSign">' + img(insImg) + '</td><td class="pSign">' + img(leadImg) + '</td></tr></table>' +
      '<div class="pNote">※ 점검결과 표기 : O = 양호, X = 불량</div>' +
      '<table><colgroup><col style="width:15%"><col><col style="width:15%"><col style="width:10%"><col style="width:20%"></colgroup>' +
      '<tr><th>점검<br>분야</th><th>점 검 항 목</th><th>점검<br>수량</th><th>결과</th><th>비고</th></tr>' + rows +
      '</table></div>';
  }

  /* ---------- 서명 칸 (점검자·팀장 공용): 획을 가상 좌표로 저장, 크기가 바뀌면 다시 그림 ---------- */
  function makePad(cv, msgEl, onDraw) {
    var c2 = cv.getContext('2d'), P = { strokes: [], n: 0 }, vw = 0, vh = 0, cur = null, down = false, lp = null;
    var xf = function () { var w = cv.clientWidth, h = cv.clientHeight, sc = Math.min(w / vw, h / vh); return { s: sc, ox: (w - vw * sc) / 2, oy: (h - vh * sc) / 2 }; };
    var toV = function (p) { var t = xf(); return { x: (p.x - t.ox) / t.s, y: (p.y - t.oy) / t.s }; };
    var toC = function (p) { var t = xf(); return { x: p.x * t.s + t.ox, y: p.y * t.s + t.oy }; };
    var at = function (e) { var b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    P.redraw = function () {
      c2.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
      if (!vw) return;
      P.strokes.forEach(function (st) {
        var f = toC(st[0]);
        if (st.length === 1) { c2.beginPath(); c2.arc(f.x, f.y, 1.2, 0, 6.283); c2.fill(); return; }
        c2.beginPath(); c2.moveTo(f.x, f.y);
        for (var i = 1; i < st.length; i++) { var q = toC(st[i]); c2.lineTo(q.x, q.y); }
        c2.stroke();
      });
    };
    P.locked = false;                                   // 제출 중에는 서명 칸에 더 그려지지 않게
    P.setup = function () {
      if (P.fit) P.fit();
      if (!cv.clientWidth) return;
      var r = window.devicePixelRatio || 1; cv.width = cv.clientWidth * r; cv.height = cv.clientHeight * r;
      c2.setTransform(r, 0, 0, r, 0, 0); c2.lineWidth = 3; c2.lineCap = 'round'; c2.lineJoin = 'round'; c2.strokeStyle = '#000'; c2.fillStyle = '#000';
      P.redraw();
    };
    P.clear = function () { P.strokes = []; P.n = 0; vw = 0; vh = 0; c2.clearRect(0, 0, cv.clientWidth, cv.clientHeight); if (P.onN) P.onN(0); };
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (P.locked) return;
      if (e.pointerType === 'mouse') { msg(msgEl, '서명은 휴대폰이나 태블릿 화면에 손가락(또는 펜)으로 해 주세요.', '#c0392b'); return; }
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      if (!vw) { vw = cv.clientWidth; vh = cv.clientHeight; }
      down = true; lp = at(e); cur = [toV(lp)]; P.strokes.push(cur); P.n++;
      c2.beginPath(); c2.arc(lp.x, lp.y, 1.2, 0, 6.283); c2.fill(); msg(msgEl, '');
      if (onDraw) onDraw();
      if (P.onN) P.onN(P.n);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return; e.preventDefault();
      var p = at(e);
      c2.beginPath(); c2.moveTo(lp.x, lp.y); c2.lineTo(p.x, p.y); c2.stroke();
      cur.push(toV(p)); P.n += Math.abs(p.x - lp.x) + Math.abs(p.y - lp.y) > 1 ? 1 : 0; lp = p;
      if (P.onN) P.onN(P.n);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { down = false; }); });
    /** 서명 부분만 잘라 PNG (셀 한 칸 5만 자 안으로) */
    P.png = function () {
      var pad = 12, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      P.strokes.forEach(function (st) { st.forEach(function (pt) { var c = toC(pt); x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }); });
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.clientWidth, x1 + pad); y1 = Math.min(cv.clientHeight, y1 + pad);
      var r = cv.width / cv.clientWidth, sw = Math.max(1, (x1 - x0) * r), sh = Math.max(1, (y1 - y0) * r), url = '';
      [[480, 192], [360, 144], [270, 108], [200, 80]].some(function (z) {
        var t = document.createElement('canvas'); t.width = z[0]; t.height = z[1];
        var sc = Math.min(t.width / sw, t.height / sh, 1.5);
        t.getContext('2d').drawImage(cv, x0 * r, y0 * r, sw, sh, (t.width - sw * sc) / 2, (t.height - sh * sc) / 2, sw * sc, sh * sc);
        url = t.toDataURL('image/png'); return url.length <= 48000;
      });
      return url;
    };
    window.addEventListener('resize', function () { setTimeout(P.setup, 150); });
    return P;
  }
  var skPad = makePad($('skPad'), $('skMsg'));
  skPad.onN = function (n) { if (!skBusy) $('skSend').disabled = n < 6; };   // 충분히 서명해야 [다음] 켜짐 (교육 서명과 같게)
  /* 세로 화면: 서명 칸 높이를 남은 화면에 맞춤 (160~280px) → 아래 버튼까지 한 화면에 보이게 (가로는 CSS) */
  skPad.fit = function () {
    var cv = $('skPad');
    if (!window.matchMedia || !window.matchMedia('(orientation: portrait)').matches) { cv.style.height = ''; return; }
    var top = cv.getBoundingClientRect().top + (window.scrollY || 0), acts = document.querySelector('#skSig .actions');
    var h = Math.round(window.innerHeight - top - ((acts ? acts.offsetHeight : 110) + 12 + 14));
    cv.style.height = Math.max(160, Math.min(280, h)) + 'px';
  };

  /* ---------- 팀장 내용 보기 (서명은 역 선택 화면의 [일괄 서명]) ---------- */
  var skL = null, skLBusy = false;   // skL: { id, data, idx }
  function skLeadOpen(id, idx) {
    if (skLBusy) return;
    skLBusy = true; $('skLeadView').disabled = true; msg($('skMsg'), '불러오는 중…', '#6b7686');
    var end = function () { skLBusy = false; $('skLeadView').disabled = false; };
    srv().withSuccessHandler(function (d) {
      end(); msg($('skMsg'), '');
      skL = { id: id, data: d, idx: Math.max(0, Math.min(Number(idx) || 0, d.stations.length - 1)) };
      lvOpen();
    }).withFailureHandler(function (e) { end(); msg($('skMsg'), errText(e), '#c0392b'); }).safetyLeaderData(staff && staff.token || '', id);
  }
  function lvOpen() {
    var was = $('skView').classList.contains('hidden');
    $('skView').classList.remove('hidden'); document.body.classList.add('skLock');
    $('lvTitle').textContent = skL.data.title + (skL.data.date ? ' · ' + skL.data.date : '');
    var sel = $('lvSel');                             // 역 바로 보기: 확인할 칸이 있는 역은 ⚠, 팀장 확인이 끝난 역은 ✓
    sel.innerHTML = skL.data.stations.map(function (x, i) {
      return '<option value="' + i + '">' + esc(x.st) + (Object.keys(x.chk || {}).length ? ' ⚠' : '') + (x.lead ? ' ✓' : '') + '</option>';
    }).join('');
    sel.classList.toggle('hidden', !skL.data.stations.length);
    lvGo(skL.idx);
    if (was) { popPush(); saveState(); }
  }
  function lvClose() {
    $('skView').classList.add('hidden'); document.body.classList.remove('skLock');
    popSync(); saveState();
  }
  $('lvClose').onclick = lvClose;
  $('lvSel').onchange = function () { lvGo(Number(this.value) || 0); };
  function lvGo(i) {
    var D = skL.data, n = D.stations.length, pg = $('lvPage'), h = '';
    skL.idx = Math.max(0, Math.min(i, n - 1));
    if (!n) { h = '<div class="card center"><div class="who">아직 점검자가 서명한 역이 없습니다.</div><div class="hint">점검자 서명이 끝난 역부터 볼 수 있습니다.</div></div>'; $('lvProg').textContent = ''; }
    else {
      var x = D.stations[skL.idx];
      h = (skL.idx ? '<div class="lvHint">▼ 맨 위에서 내리면 이전 역</div>' : '') +
        skPaper(x, x.res, x.base, x.ins.img, x.lead ? x.lead.img : '', D.title, D.date, false, x.chk || {}) +
        '<div class="hint" style="text-align:center">점검자 ' + esc((x.ins.disp ? x.ins.disp + ' ' : '') + x.ins.name) + ' · ' + esc(x.ins.at) + (x.lead ? ' · 팀장 확인 완료 (' + esc(x.lead.name) + ')' : ' · 팀장 확인 전') + '</div>' +
        (skL.idx < n - 1 ? '<div class="lvHint">▲ 끝까지 올리면 다음 역</div>' : '') +
        '<div class="row lvNav"><button class="btn gray" id="lvPrev" type="button"' + (skL.idx ? '' : ' disabled') + '>◀ 이전 역</button>' +
        '<button class="btn pri" id="lvNextSt" type="button"' + (skL.idx < n - 1 ? '' : ' disabled') + '>다음 역 ▶</button></div>';
      $('lvProg').textContent = (skL.idx + 1) + ' / ' + n;
      $('lvSel').value = String(skL.idx);
    }
    pg.innerHTML = h; pg.scrollTop = 0;
    if ($('lvPrev')) $('lvPrev').onclick = function () { lvGo(skL.idx - 1); };
    if ($('lvNextSt')) $('lvNextSt').onclick = function () { lvGo(skL.idx + 1); };
    saveState();
  }
  /* 체크리스트 넘기기: 끝까지 내려 본 뒤 더 올리면 다음 역, 맨 위에서 더 내리면 이전 역 (손가락·마우스 휠) */
  (function () {
    var pg = $('lvPage'), y0 = null, top0 = false, bot0 = false, fired = false, wsum = 0, wt = null;
    var atBot = function () { return pg.scrollTop + pg.clientHeight >= pg.scrollHeight - 2; };
    var canNext = function () { return skL && skL.idx < skL.data.stations.length - 1; }, canPrev = function () { return skL && skL.idx > 0; };
    pg.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; top0 = pg.scrollTop <= 0; bot0 = atBot(); fired = false; }, { passive: true });
    pg.addEventListener('touchmove', function (e) {
      if (y0 === null || fired || !skL) return;
      var dy = e.touches[0].clientY - y0;
      if (dy < -60 && bot0 && atBot() && canNext()) { fired = true; lvGo(skL.idx + 1); }
      else if (dy > 80 && top0 && pg.scrollTop <= 0 && canPrev()) { fired = true; lvGo(skL.idx - 1); }
    }, { passive: true });
    pg.addEventListener('touchend', function () { y0 = null; }, { passive: true });
    pg.addEventListener('wheel', function (e) {
      if (!skL) return;
      if (!(e.deltaY > 0 && atBot() && canNext()) && !(e.deltaY < 0 && pg.scrollTop <= 0 && canPrev())) { wsum = 0; return; }
      wsum += e.deltaY; clearTimeout(wt); wt = setTimeout(function () { wsum = 0; }, 400);
      if (wsum > 240) { wsum = 0; lvGo(skL.idx + 1); } else if (wsum < -240) { wsum = 0; lvGo(skL.idx - 1); }
    }, { passive: true });
  })();
  /* 안전점검 화면에서 페이지를 나가려 하면 확인 (휴대폰 뒤로가기 제스처로 창이 닫히는 것 막기) */
  window.addEventListener('beforeunload', function (e) {
    if (curScreen !== 'sk' && $('skView').classList.contains('hidden')) return;
    e.preventDefault(); e.returnValue = '';
  });

  /* ---------- 관리자 ---------- */
  /* 관리자 페이지 없음: 관리자로 지정된 직원은 서명지 목록 화면에서 바로 관리 (카드 밀기 [정보 수정]·[내보내기], 새 서명지 열기, 배포용 아이디, 개인 코드 관리, 관리자 지정)
   * 관리자 등급은 로그인 때 받음 (staff.lv). 관리 기능도 직원 로그인 토큰을 그대로 씀 (따로 관리자 접속 없음, 서버가 요청마다 등급 확인)
   * 관리자 정보(양식 목록·서명지 현황)는 목록이 뜬 뒤 조용히 미리 받음 (admEnsure quiet) */
  var admTok = null, admData = null, admExp = {}, admOrder = {};
  var admMe = null;                      // 로그인한 관리자의 { dept, team, lv }: 새 서명지 부서명·팀 기본값
  var PDF_TPL = '__pdf__';               // 새 서명지 양식 고르는 칸의 [PDF 서명지] (누구나)
  var admWait = [], admFails = [], admMsgs = [];
  function isAdm() { return !!(staff && staff.admin && !staff.guest && staff.token); }
  /** 관리자 등급 1~3 (예전에 저장된 로그인은 선임관리자 = 3) */
  function admLv() { return !isAdm() ? 0 : Number(staff.lv) || (staff.master ? 3 : 1); }
  /** 관리자 정보가 없으면 받은 뒤 cb (여러 번 불러도 서버는 한 번). quiet: 미리 받기 (안내 글 없음) */
  function admEnsure(cb, m, onFail, quiet) {
    if (isAdm()) admTok = staff.token;
    if (admTok && admData) { cb(); return; }
    if (!isAdm()) { if (onFail) onFail(); return; }
    if (!quiet) { m = m || $('msg1'); admMsgs.push(m); msg(m, '관리자 정보 불러오는 중…', '#6b7686'); }
    admWait.push(cb); if (onFail) admFails.push(onFail);
    if (admWait.length > 1) return;
    var clear = function () { admMsgs.forEach(function (x) { msg(x, ''); }); };
    var done = function () { var w = admWait; admWait = []; admFails = []; clear(); admMsgs = []; w.forEach(function (f) { f(); }); };
    var fail = function (e) {
      var fs = admFails, ms = admMsgs; admWait = []; admFails = []; admMsgs = [];
      if (/로그인이 필요/.test(errText(e))) { logout(errText(e)); return; }
      ms.forEach(function (x) { msg(x, errText(e), '#c0392b'); }); fs.forEach(function (f) { f(e); });
    };
    BUSY_SKIP.adminRefresh = quiet ? 1 : 0;           // 미리 받기는 가운데 로딩창 없이 (목록이 뜬 뒤 도는 로딩창 없앰)
    srv().withSuccessHandler(function (d) { admMe = d.me || admMe; renderAdmin(d, true); done(); })
      .withFailureHandler(fail).adminRefresh(admTok);
  }
  function admCall(fn, args, onOk, m, onFail) {
    m = m || $('msg1');
    if (!isAdm()) { msg(m, '관리자로 지정된 직원만 할 수 있습니다.', '#c0392b'); if (onFail) onFail(); return; }
    admTok = staff.token;
    msg(m, '처리 중…', '#6b7686');
    var run = srv().withSuccessHandler(function (r) { msg(m, ''); onOk(r); })
      .withFailureHandler(function (e) {
        if (/로그인이 필요/.test(errText(e))) { logout(errText(e)); return; }
        msg(m, errText(e), '#c0392b'); if (onFail) onFail(e);
      });
    run[fn].apply(run, [admTok].concat(args));
  }
  function today() {
    var d = new Date(), w = '일월화수목금토'.charAt(d.getDay());
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return String(d.getFullYear()).slice(2) + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' (' + w + ')';
  }

  /* ---------- 임무·역할 지정 화면 ---------- */
  var rData = null, rAssign = {}, rOrig = '', rLeave = false;
  function rState() { return JSON.stringify([rAssign, $('rHead').value.trim()]); }
  function rPeople(k) { return rData.people.filter(function (p) { return p.key === k; })[0]; }
  function openRoles(id) {
    admCall('adminRoleData', [id], function (d) { loadRoleData(d); admOverHide(true); show('sr'); }, admOverMsgEl());
  }
  function loadRoleData(d) {
    rData = d; rAssign = {}; rLeave = false;
    d.assign.forEach(function (a) { rAssign[a.key] = a.role; });
    $('rTitle').textContent = d.title;
    $('rNoCol').classList.toggle('hidden', d.hasRoleCol);
    $('rHeadCard').classList.toggle('hidden', !d.hasRoleCol);
    $('rHead').value = d.head || ''; $('rHeadAt').textContent = d.headAt ? '· ' + d.headAt + ' 칸' : '';
    var sel = $('rFrom'); sel.innerHTML = '';
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '다른 서명지의 지정 불러오기…'; sel.appendChild(o0);
    d.others.forEach(function (x) {
      var o = document.createElement('option'); o.value = x.id;
      o.textContent = x.title + (x.date ? ' (' + x.date + ')' : '') + ' · 지정 ' + x.count + '명';
      sel.appendChild(o);
    });
    $('rFromRow').classList.toggle('hidden', !d.others.length);
    $('rPaste').value = ''; msg($('rMsg'), '');
    rOrig = rState();
    drawRoles();
  }
  function drawRoles() {
    var box = $('rList'); box.innerHTML = '';
    var signed = {}; rData.assign.forEach(function (a) { if (a.signed) signed[a.key] = 1; });
    var e = admData.educations.filter(function (x) { return x.id === rData.id; })[0];
    if (e) e.signers.forEach(function (s) { signed[s.key] = 1; });
    var idx = {}; rData.people.forEach(function (p, i) { if (!(p.key in idx)) idx[p.key] = i; });
    var keys = Object.keys(rAssign).sort(function (a, b) { return (a in idx ? idx[a] : 1e9) - (b in idx ? idx[b] : 1e9); });
    if (!keys.length) box.innerHTML = '<div class="srow"><span class="hint">지정한 사람이 없습니다. 위에 붙여넣고 적용하세요.</span></div>';
    keys.forEach(function (k) {
      var p = rPeople(k) || { name: '(직원DB에 없음)', disp: '' }, row = document.createElement('div'); row.className = 'srow rrow';
      row.innerHTML = '<span class="nm"><small></small><span></span><span class="st"></span></span><span class="rl"></span><button class="x" title="지정 해제">✕</button>';
      row.querySelector('small').textContent = p.disp || '';
      row.querySelector('.nm span').textContent = p.name;
      row.querySelector('.st').textContent = signed[k] ? '서명함' : '';
      row.querySelector('.rl').textContent = rAssign[k];
      row.querySelector('.x').onclick = function () { delete rAssign[k]; rLeave = false; drawRoles(); };
      box.appendChild(row);
    });
    $('rCount').textContent = '· ' + keys.length + '명 지정';
    $('rSave').disabled = rState() === rOrig;
    saveState();
  }
  $('rHead').addEventListener('input', function () { rLeave = false; $('rSave').disabled = rState() === rOrig; saveState(); });
  $('rApply').onclick = function () {
    var bad = [], n = 0;
    $('rPaste').value.split('\n').forEach(function (line) {
      var t = line.trim().split(/\s+/).filter(Boolean);
      if (!t.length) return;
      var clean = function (tok) { return tok.replace(/^[,·:;\-]+|[,·:;\-]+$/g, ''); };
      var hit = null, nameAt = -1;
      t.forEach(function (tok, i) {
        if (hit) return;
        var c = rData.people.filter(function (p) { return p.name === clean(tok); });
        if (!c.length) return;
        if (c.length > 1) c = c.filter(function (p) { return t.slice(0, i).map(clean).indexOf(p.disp) > -1; });
        if (c.length === 1) { hit = c[0]; nameAt = i; }
      });
      if (!hit) { bad.push(line.trim()); return; }
      // 이름 뒤에 적은 글자를 쉼표·띄어쓰기 그대로 사용 (이름 앞에 직책만 적은 경우도 허용)
      var role = t.slice(nameAt + 1).join(' ').replace(/^[\s,·:;\-]+/, '').trim();
      if (!role) {
        var before = t.slice(0, nameAt).filter(function (tok) { return clean(tok) !== hit.disp; });
        role = before.join(' ').replace(/[\s,·:;\-]+$/, '').trim();
      }
      if (!role) { bad.push(line.trim()); return; }
      rAssign[hit.key] = role; n++;
    });
    rLeave = false; drawRoles();
    msg($('rMsg'), n + '명 적용' + (bad.length ? ' · 찾지 못한 줄(동명이인은 직책도 적기): ' + bad.join(' / ') : '') + (n ? ' · 저장해야 반영됩니다.' : ''),
      bad.length ? '#c0392b' : '#12833b');
    if (!bad.length) $('rPaste').value = '';
  };
  $('rLoad').onclick = function () {
    var x = rData.others.filter(function (o) { return o.id === $('rFrom').value; })[0];
    if (!x) return;
    var n = 0;
    Object.keys(x.assign).forEach(function (k) { if (rPeople(k)) { rAssign[k] = x.assign[k]; n++; } });
    rLeave = false; drawRoles();
    msg($('rMsg'), x.title + '의 지정 ' + n + '명을 불러왔습니다. 저장해야 반영됩니다.', '#12833b');
  };
  $('rSave').onclick = function () {
    $('rSave').disabled = true;
    admCall('adminSetRoles', [rData.id, rData.hasRoleCol && $('rHead').value.trim() !== (rData.head || '') ? { assign: rAssign, head: $('rHead').value } : { assign: rAssign }], function (r) {
      renderAdmin(r.data); loadRoleData(r.roleData);
      msg($('rMsg'), r.data.note, '#12833b');
    }, $('rMsg'));
  };
  $('rBack').onclick = function () {
    if (rState() !== rOrig && !rLeave) {
      rLeave = true;
      msg($('rMsg'), '저장하지 않은 변경이 있습니다. 한 번 더 누르면 저장하지 않고 돌아갑니다.', '#c0392b');
      return;
    }
    rData = null; admBackToList();
  };

  /* ---------- 서명자 순서 화면 ---------- */
  var ordId = null, ord = [], ordLeave = false;
  function ordEdu() { return ordEduById(ordId); }
  function ordEduById(id) { return admData && admData.educations.filter(function (x) { return x.id === id; })[0]; }
  function openOrder(id) {
    ordId = id; ordLeave = false;
    var e = ordEdu();
    ord = (admOrder[id] || e.signers.map(function (s) { return s.key; })).slice();
    msg($('oMsg'), '');
    admOverHide(true); drawOrder(); show('so');
  }
  function ordChanged() { var e = ordEdu(); return !!e && ord.join() !== e.signers.map(function (s) { return s.key; }).join(); }
  function drawOrder() {
    var e = ordEdu();
    if (!e) { admBackToList(); return; }
    var byKey = {}; e.signers.forEach(function (s) { byKey[s.key] = s; });
    ord = ord.filter(function (k) { return byKey[k]; });
    e.signers.forEach(function (s) { if (ord.indexOf(s.key) < 0) ord.push(s.key); });
    $('oTitle').textContent = e.title;
    $('oSub').textContent = [e.dept, e.date].filter(Boolean).join(' · ') + ' · 서명 ' + e.signers.length + '명' + (e.pages > 1 ? ' · ' + e.pages + '페이지' : '');
    var box = $('oList'); box.innerHTML = '';
    if (!ord.length) box.innerHTML = '<div class="srow"><span class="hint">아직 서명한 사람이 없습니다.</span></div>';
    ord.forEach(function (k, i) {
      var s = byKey[k], row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = '<span class="no"></span><span class="nm"><small></small><span></span></span>' +
        '<button class="mv up">↑</button><button class="mv dn">↓</button>';
      row.querySelector('.no').textContent = (i + 1) + '.';
      row.querySelector('small').textContent = s.disp || '';
      row.querySelector('.nm span').textContent = s.name + (s.role ? ' · ' + s.role : '');
      row.querySelector('.up').disabled = i === 0;
      row.querySelector('.dn').disabled = i === ord.length - 1;
      row.querySelector('.up').onclick = function () { ord.splice(i - 1, 0, ord.splice(i, 1)[0]); admOrder[ordId] = ord.slice(); ordLeave = false; drawOrder(); };
      row.querySelector('.dn').onclick = function () { ord.splice(i + 1, 0, ord.splice(i, 1)[0]); admOrder[ordId] = ord.slice(); ordLeave = false; drawOrder(); };
      box.appendChild(row);
    });
    $('oSave').disabled = !ordChanged();
    $('oDb').disabled = ord.length < 2;
    $('oDb').classList.toggle('hidden', !!e.guest);   // 본인 확인 없는 교육은 직원DB 순서 정렬 없음
    $('oHint').textContent = ordChanged() ? '바뀐 순서를 저장하세요.' : '↑ ↓로 순서를 바꾼 뒤 저장하세요.';
    saveState();
  }
  $('oSave').onclick = function () {
    $('oSave').disabled = true;
    admCall('adminReorder', [ordId, ord], function (d) {
      delete admOrder[ordId]; renderAdmin(d); ord = ordEdu().signers.map(function (s) { return s.key; }); drawOrder();
      msg($('oMsg'), '서명자 순서를 저장했습니다. PDF에 이 순서로 들어갑니다.', '#12833b');
    }, $('oMsg'));
  };
  $('oDb').onclick = function () {
    $('oDb').disabled = true;
    admCall('adminSortByDb', [ordId], function (d) {
      delete admOrder[ordId]; renderAdmin(d); ord = ordEdu().signers.map(function (s) { return s.key; }); drawOrder();
      msg($('oMsg'), '직원DB 순서로 정렬했습니다. PDF에 이 순서로 들어갑니다.', '#12833b');
    }, $('oMsg'));
  };
  $('oBack').onclick = function () {
    if (ordChanged() && !ordLeave) {   // 저장하지 않은 변경이 있으면 한 번 더 확인
      ordLeave = true;
      msg($('oMsg'), '저장하지 않은 순서가 있습니다. 한 번 더 누르면 저장하지 않고 돌아갑니다.', '#c0392b');
      return;
    }
    delete admOrder[ordId]; ordId = null;
    admBackToList();
  };

  /* 양식 미리보기: 머릿글과 줄 몇 개만 작게 그림 */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tplPreview(box, name) {
    var t = admData && admData.tplPrev && admData.tplPrev[name];
    box.classList.toggle('hidden', !t);
    if (!t) { box.innerHTML = ''; return; }
    if (t.refund) {                     // 비상(환불 등록) 양식: 입력 칸 이름만 줄바꿈되는 칩으로 (칸이 많아 표로 그리면 밖으로 넘침)
      var hs = (t.blocks[0] || { heads: [] }).heads;
      box.innerHTML = '<div class="cap"><b>' + esc(name) + '</b> · 환불 등록 · 입력 칸 ' + hs.length + '개</div><div class="chips">' +
        hs.map(function (h) { return '<span>' + esc(h.t) + '</span>'; }).join('') + '</div>';
      return;
    }
    if (t.safety) {                     // 안전점검 양식: 분야·항목·기본 수량 (역별 수량은 양식 탭 오른쪽 표)
      var its = t.items || [];
      box.innerHTML = '<div class="cap"><b>' + esc(name) + '</b> · 안전점검의 날 · 항목 ' + its.length + '개 · 수량은 역마다 다름</div><div class="wrap"><table class="skPrev"><colgroup><col style="width:22%"><col><col style="width:18%"></colgroup>' +
        '<tr><th>점검분야</th><th>점검항목</th><th>기본 수량</th></tr>' +
        its.slice(0, 3).map(function (it) { return '<tr><td>' + esc(it.f) + '</td><td class="l">' + esc(it.t) + '</td><td>' + esc(it.q || '-') + '</td></tr>'; }).join('') +   // 윗줄 3개만
        (its.length > 3 ? '<tr><td class="more" colspan="3">⋮ 외 ' + (its.length - 3) + '개 항목</td></tr>' : '') + '</table></div>';
      return;
    }
    if (!t.cap) { box.innerHTML = '<div class="cap">서명 칸을 찾지 못한 양식입니다.</div>'; return; }
    var hasRole = t.blocks.some(function (b) { return b.heads.some(function (h) { return h.k === 'role'; }); });
    var rows = {}, order = [];
    t.blocks.forEach(function (b) { if (!rows[b.row]) { rows[b.row] = []; order.push(b.row); } rows[b.row].push(b); });
    var html = '<div class="cap"><b>' + esc(name) + '</b> · 한 페이지 ' + t.cap + '명' +
      (t.blocks.length > 1 ? ' · 표 ' + t.blocks.length + '개' : '') + (hasRole ? '<span class="tag">임무·역할 칸</span>' : '') + '</div>';
    var no = 0;
    order.forEach(function (r) {
      html += '<div class="wrap">';
      rows[r].forEach(function (b) {
        var cols = b.heads.length || 1;
        html += '<table><tr>' + b.heads.map(function (h) { return '<th class="k-' + (h.k || 'x') + '" title="' + esc(h.t) + '">' + esc(h.t) + '</th>'; }).join('') + '</tr>';
        var show = Math.min(2, b.n);
        for (var i = 0; i < show; i++) {
          no++;
          html += '<tr>' + b.heads.map(function (h) { return '<td>' + (h.k === 'no' ? no : '') + '</td>'; }).join('') + '</tr>';
        }
        if (b.n > show) { html += '<tr><td class="more" colspan="' + cols + '">⋮</td></tr>'; no += b.n - show; }
        html += '</table>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
  }

  /** 고른 양식의 서명지에 부서 칸이 없으면(예: 양식3·4) 부서 입력칸 숨김 */
  function isSkTpl(name) { var t = admData && admData.tplPrev && admData.tplPrev[name]; return !!(t && t.safety); }
  /** 안전점검 날짜 기본값: 2026.10.06(화요일) */
  function skToday() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + '(' + '일월화수목금토'.charAt(d.getDay()) + '요일)';
  }
  function skChecks(name) {
    var box = $('nSkList'), t = admData.tplPrev[name] || {};
    if (box.children.length) return;
    (t.stations || []).forEach(function (st) {
      var l = document.createElement('label'), c = document.createElement('input'), sp = document.createElement('span');
      c.type = 'checkbox'; c.checked = true; c.value = /역$/.test(st) ? st : st + '역'; sp.textContent = c.value;
      c.onchange = function () { $('nSkAll').checked = ![].some.call(box.querySelectorAll('input'), function (x) { return !x.checked; }); };
      l.appendChild(c); l.appendChild(sp); box.appendChild(l);
    });
  }
  $('nSkAll').onchange = function () { [].forEach.call($('nSkList').querySelectorAll('input'), function (x) { x.checked = $('nSkAll').checked; }); };
  function isRfTpl(name) { var t = admData && admData.tplPrev && admData.tplPrev[name]; return !!(t && t.refund); }
  function tplHasDept(name) { var t = admData && admData.tplPrev && admData.tplPrev[name]; return !t || t.hasDept !== false; }
  function deptRow(row, name, guest) { row.classList.toggle('hidden', !!guest && !tplHasDept(name)); }   // 본인 확인 없는 서명지의 부서명은 양식에 적는 용도
  /** 고르는 칸 채우기: 첫 항목 [전체](빈 값). 목록에 없는 지금 값도 남겨 둠 */
  function orgOptions(sel, list, val) {
    sel.innerHTML = '';
    ['전체'].concat(list, val && list.indexOf(val) < 0 ? [val] : []).forEach(function (v, i) { var o = document.createElement('option'); o.value = i ? v : ''; o.textContent = v; sel.appendChild(o); });
    sel.value = val || '';
  }
  /** 부서명·팀 칸: 직원DB의 부서명에서 고르고, 고른 부서의 팀만 보여 줌 */
  function deptTeamSel(deptEl, teamEl, dept, team) {
    var orgs = (admData && admData.orgs) || [];
    var teams = function () { var o = orgs.filter(function (x) { return x.dept === deptEl.value; })[0]; return o ? o.teams : []; };
    orgOptions(deptEl, orgs.map(function (x) { return x.dept; }), dept);
    orgOptions(teamEl, teams(), team); teamEl.disabled = !deptEl.value;
    deptEl.onchange = function () { orgOptions(teamEl, teams(), ''); teamEl.disabled = !deptEl.value; };
  }

  /** 환불 등록 고객용 QR 접수 남은 시간 표시 (서명지 목록·관리자 화면, 15초마다). 끝나도 직원 등록은 가능 */
  function tickRfLeft() { [].forEach.call(document.querySelectorAll('.rfLeft'), setRfLeft); }
  function setRfLeft(el) {
    var ms = Number(el.getAttribute('data-end')) - Date.now();
    if (ms <= 0) { el.textContent = 'QR 접수 마감 · 직원 등록 가능'; el.classList.remove('soon'); el.classList.add('over'); return; }
    var m = Math.ceil(ms / 60000), h = Math.floor(m / 60); m = m % 60;
    el.textContent = 'QR 접수 남은 시간 ' + (h ? h + '시간 ' : '') + m + '분';
    el.classList.toggle('soon', ms < 180000);               // 3분 안 남으면 빨갛게
  }
  setInterval(tickRfLeft, 15000);
  /** 새 서명지 열기: 고른 양식에 맞게 칸 보이기·숨기기 ([PDF 서명지]는 PDF 올리는 화면으로) */
  function nTplUi() {
    var sel = $('nTpl'), pdf = sel.value === PDF_TPL;
    $('nPdfNote').classList.toggle('hidden', !pdf);
    if (pdf) {
      ['nKindRow', 'nRosterBox', 'nSkBox', 'nTitleRow', 'nDeptRow', 'nTeamRow', 'nDeptNote', 'nDateRow', 'nCodeRow', 'nRfMinRow', 'nRfNote', 'nNoVerify', 'nTplPrev'].forEach(function (id) { $(id).classList.add('hidden'); });
      $('nCreate').textContent = 'PDF 서명지 만들기';
      return;
    }
    var rf = isRfTpl(sel.value), skT = isSkTpl(sel.value);
    $('nSkBox').classList.toggle('hidden', !skT);
    if (skT) { skChecks(sel.value); if (!$('nDate').value || $('nDate').value === today()) $('nDate').value = skToday(); }
    else if ($('nDate').value === skToday()) $('nDate').value = today();
    var gNew = !$('nVerify').checked;
    $('nNoVerify').classList.toggle('hidden', !gNew);
    tplPreview($('nTplPrev'), sel.value); deptRow($('nDeptRow'), sel.value, gNew);
    if (rf) $('nDeptRow').classList.add('hidden');
    $('nTeamRow').classList.toggle('hidden', rf || gNew); $('nDeptNote').classList.toggle('hidden', rf || gNew);
    $('nKindRow').classList.toggle('hidden', rf); $('nCodeRow').classList.toggle('hidden', rf); $('nRfNote').classList.toggle('hidden', !rf); $('nRfMinRow').classList.toggle('hidden', !rf);
    $('nTitleRow').classList.toggle('hidden', rf); $('nDateRow').classList.toggle('hidden', rf);   // 비상: 제목·날짜 자동
    $('nCreate').textContent = rf ? '환불 등록 열기' : '서명지 열기';
    $('nRosterRow').classList.toggle('hidden', rf || !$('nVerify').checked);   // 명단 지정은 본인 확인 서명지만
    $('nRosterBox').classList.toggle('hidden', rf || !$('nVerify').checked || !$('nUseRoster').checked);
    if (skT) {                                   // 안전점검: 본인 확인(직원 로그인)만, 명단·접속 코드 없음
      $('nVerify').checked = true; $('nNoVerify').classList.add('hidden');
      ['nKindRow', 'nCodeRow', 'nRosterBox', 'nTitleRow', 'nDeptRow', 'nTeamRow', 'nDeptNote'].forEach(function (id) { $(id).classList.add('hidden'); });   // 제목은 고정, 부서명은 연 관리자의 부서
    }
  }
  $('nTpl').onchange = nTplUi; $('nUseRoster').onchange = nTplUi; $('nVerify').onchange = nTplUi;
  /** 양식 고르는 칸: 관리자는 양식목록 중 내 등급으로 열 수 있는 양식('01. 이름') + [PDF 서명지], 그 밖의 직원은 [PDF 서명지]만 */
  function nTplFill(list) {
    var sel = $('nTpl'), prev = sel.value, had = sel.options.length > 1; sel.innerHTML = '';
    list.concat([PDF_TPL]).forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t === PDF_TPL ? 'PDF 서명지 (PDF 올려서 서명받기)' : (admData && admData.tplNames && admData.tplNames[t]) || t; sel.appendChild(o); });
    if (prev && (list.indexOf(prev) > -1 || (prev === PDF_TPL && had))) sel.value = prev;   // 처음 양식을 받으면 첫 양식
    nTplUi();
  }
  /** 서명지 목록 화면에 들어올 때: 새 서명지 열기(직원 모두)·배포용 아이디(관리자)·개인 코드 관리·관리자 지정(2등급 이상) */
  function admCards() {
    var g = !!(staff && staff.guest), adm = isAdm();
    $('newCard').classList.toggle('hidden', g || !(staff && staff.token));
    $('gstCard').classList.toggle('hidden', !adm); $('stCard').classList.toggle('hidden', !adm); $('smCard').classList.toggle('hidden', adm || g || !(staff && staff.token)); $('pcCard').classList.toggle('hidden', admLv() < 2); $('gdCard').classList.toggle('hidden', admLv() < 2);
    if (!adm || !admData) nTplFill([]);
  }
  /** 관리자 작업 응답 그리기. quiet: 처음 받을 때(서명지 목록은 이미 최신) */
  function renderAdmin(d, quiet) {
    if (d && d.patch) {                  // 관리자 작업 응답: 바뀐 카드만 옴 → 가지고 있던 전체 값에 합쳐 다시 그림
      if (!admData) { admCall('adminRefresh', [], renderAdmin); return; }
      d.patch.forEach(function (x) {
        var i = -1; admData.educations.forEach(function (e, k) { if (e.id === x.id) i = k; });
        if (i > -1) admData.educations[i] = x; else admData.educations.push(x);
      });
      if (d.guest) admData.guest = d.guest;
      admData.note = d.note || ''; d = admData;
    }
    admData = d;
    if (d.me) admMe = d.me;
    var nFirst = !$('nDept').options.length;   // 처음 그릴 때·서명지를 연 뒤에는 관리자의 부서명·팀, 그 밖에는 고른 값 유지
    deptTeamSel($('nDept'), $('nTeam'), nFirst ? (admMe && admMe.dept) || '' : $('nDept').value, nFirst ? (admMe && admMe.team) || '' : $('nTeam').value);
    $('gstId').value = (d.guest && d.guest.id) || '';
    nTplFill(d.templates);
    if (!d.templates.length) msg($('nMsg'), '열 수 있는 양식이 없습니다. 시트의 양식목록 탭(열 수 있는 등급)을 확인하세요.', '#c0392b');
    if (!$('nDate').value) $('nDate').value = today();
    var note = d.note || ''; d.note = '';   // 안내는 한 번만
    admOverRedraw();
    if (note) admOverMsg(note);
    if (!quiet && staff && staff.token) refreshInit();   // 서명지 목록(제목·마감 등)도 새로
  }
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
  /* ---------- 서명지 관리 창: 서명지 목록 카드 밀기 [정보 수정]·[내보내기] (관리자) ---------- */
  var admOverId = null, admOverMode = '';
  function admOverOpen(id, mode) {
    var e = admData && admData.educations.filter(function (x) { return x.id === id; })[0];
    if (!e) { admOverHide(); msg($('msg1'), '이 서명지의 관리 정보를 찾지 못했습니다. 잠시 뒤 다시 해 보세요.', '#c0392b'); return; }
    admOverId = id; admOverMode = mode;
    $('admOverT').textContent = mode === 'exp' ? '내보내기' : '정보 수정';
    var b = $('admOverBody'); b.innerHTML = ''; b.appendChild(eduCard(e, mode));
    if ($('admOver').classList.contains('hidden')) { $('admOver').classList.remove('hidden'); popPush(); }
  }
  /** 닫기. keep: 순서·임무역할 화면으로 갔다가 돌아오면 다시 열도록 기억 */
  function admOverHide(keep) {
    if (!keep) admOverId = null;
    if ($('admOver').classList.contains('hidden')) return;
    $('admOver').classList.add('hidden'); if (!keep) $('admOverBody').innerHTML = '';
    popSync();
  }
  function admOverRedraw() { if (admOverId && !$('admOver').classList.contains('hidden')) admOverOpen(admOverId, admOverMode); }
  function admOverMsgEl() { return !$('admOver').classList.contains('hidden') && $('admOverBody').querySelector('.m') || $('msg1'); }
  function admOverMsg(t) { var m = !$('admOver').classList.contains('hidden') && $('admOverBody').querySelector('.m'); msg(m || $('msg1'), t, '#12833b'); }
  /** 순서·임무역할 화면에서 [← 서명지 목록]: 목록으로, 열어 두었던 정보 수정 창도 다시 */
  function admBackToList() {
    show('s1');
    if (admOverId && admData) admOverOpen(admOverId, admOverMode);
  }
  $('admOverClose').onclick = function () { admOverHide(); };
  $('admOver').addEventListener('click', function (ev) { if (ev.target === $('admOver')) admOverHide(); });   // 바깥 누르면 닫힘

  $('nHead').onclick = function () {
    var on = $('newCard').classList.toggle('open');
    if (on && isAdm() && !admData) admEnsure(function () {}, $('nMsg'));   // 관리자: 양식 목록은 펼칠 때 받음
  };

  /* 명단 지정: 동명이인을 부서·직위·이름·사번으로 보여 주고 고르기 (둘 다 가능) */
  function drawRosterPick(list) {
    var box = $('nPick'); box.innerHTML = ''; box.classList.remove('hidden');
    list.forEach(function (g) {
      var t = document.createElement('b'); t.textContent = g.name + ' ' + g.people.length + '명'; box.appendChild(t);
      g.people.forEach(function (p) {
        var l = document.createElement('label'), c = document.createElement('input'), s = document.createElement('span');
        c.type = 'checkbox'; c.setAttribute('data-g', g.key); c.value = p.pin;
        s.textContent = [p.dept, p.rank, p.name, p.pin].filter(Boolean).join(' · ');
        l.appendChild(c); l.appendChild(s); box.appendChild(l);
      });
    });
  }
  /** 고른 동명이인 { 이름: [사번] }. 고르는 칸이 없으면 null, 안 고른 이름이 있으면 false */
  function rosterPick() {
    var box = $('nPick'); if (box.classList.contains('hidden')) return null;
    var out = {}, ok = true;
    [].forEach.call(box.querySelectorAll('input'), function (c) { var k = c.getAttribute('data-g'); out[k] = out[k] || []; if (c.checked) out[k].push(c.value); });
    Object.keys(out).forEach(function (k) { if (!out[k].length) ok = false; });
    return ok ? out : false;
  }
  $('nRoster').addEventListener('input', function () { $('nPick').classList.add('hidden'); $('nPick').innerHTML = ''; });

  $('nCreate').onclick = function () {
    if ($('nTpl').value === PDF_TPL) { puOpen(); return; }   // PDF 서명지: PDF 올리는 화면
    if (!admData) { admEnsure(function () { nTplUi(); }, $('nMsg')); return; }
    var rfNew = isRfTpl($('nTpl').value), dept = rfNew || $('nDeptRow').classList.contains('hidden') ? '' : $('nDept').value;   // 숨겨진 칸의 기본값은 보내지 않음
    var skNew = isSkTpl($('nTpl').value);
    var need = [['nTitle', '교육명'], ['nDate', '날짜'], ['nCode', '접속 코드']].filter(function (f) {
      if (skNew) return f[0] === 'nDate' && !$(f[0]).value.trim();   // 안전점검: 날짜만 (제목은 비우면 기본 제목)
      return !rfNew && !$(f[0]).value.trim();        // 비상: 제목·날짜·접속 코드 입력 없음
    });
    if (need.length) {                        // 빈 칸은 서버에 보내기 전에 바로 안내 (버튼은 잠그지 않음)
      msg($('nMsg'), '입력하지 않은 칸: ' + need.map(function (f) { return f[1]; }).join(', '), '#c0392b');
      $(need[0][0]).focus();
      return;
    }
    if (skNew) {
      var sts = [].filter.call($('nSkList').querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.value; });
      if (!sts.length) { msg($('nMsg'), '점검할 역을 하나 이상 고르세요.', '#c0392b'); return; }
      $('nCreate').disabled = true;
      admCall('adminCreateEdu', [{ tpl: $('nTpl').value, date: $('nDate').value, stations: sts }], function (d) {
        $('nCreate').disabled = false;
        $('newCard').classList.remove('open'); edTab = 'open'; renderAdmin(d);
      }, $('nMsg'), function () { $('nCreate').disabled = false; });
      setTimeout(function () { $('nCreate').disabled = false; }, 20000);
      return;
    }
    var qrMin = rfNew ? rfMinVal() : '';
    if (rfNew && !(qrMin >= 1 && qrMin <= 600)) { msg($('nMsg'), 'QR 접수 시간은 1~600분으로 정해 주세요.', '#c0392b'); $('nRfMin').focus(); return; }
    var rosterNew = !rfNew && $('nVerify').checked && $('nUseRoster').checked;
    if (rosterNew && !$('nRoster').value.trim()) { msg($('nMsg'), '명단에 이름을 입력하세요.', '#c0392b'); $('nRoster').focus(); return; }
    var pick = rosterPick();
    if (pick === false) { msg($('nMsg'), '동명이인을 한 명 이상 고르세요.', '#c0392b'); return; }
    $('nCreate').disabled = true;
    var guestNew = !rfNew && !$('nVerify').checked;   // 본인 확인을 끄면 서명자가 칸을 직접 입력
    admCall('adminCreateEdu', [{ tpl: $('nTpl').value, title: rfNew ? '' : $('nTitle').value, dept: dept, team: dept ? $('nTeam').value : '', date: rfNew ? '' : $('nDate').value, code: rfNew ? '' : $('nCode').value, qrMin: qrMin, guest: guestNew, useRoster: rosterNew, roster: rosterNew ? $('nRoster').value : '', rosterPick: rosterNew ? pick : null }], function (d) {
      $('nCreate').disabled = false;
      if (d.rosterChoice) { drawRosterPick(d.rosterChoice); msg($('nMsg'), '같은 이름의 직원이 있습니다. 서명할 사람을 고른 뒤 다시 누르세요.', '#324eb3'); return; }
      $('nPick').classList.add('hidden'); $('nPick').innerHTML = '';
      if (!rfNew) { $('nTitle').value = ''; $('nCode').value = ''; $('nRoster').value = ''; $('nUseRoster').checked = false; $('nDept').innerHTML = ''; }
      $('newCard').classList.remove('open');   // 교육을 연 뒤에는 접음
      edTab = 'open'; renderAdmin(d);
    }, $('nMsg'), function () { $('nCreate').disabled = false; });   // 실패하면 바로 다시 누를 수 있게
    setTimeout(function () { $('nCreate').disabled = false; }, 20000);
  };

  /* 새 환불 등록: 고객용 QR 접수 시간 [10분] 또는 직접 입력 */
  [].forEach.call($('nRfMins').querySelectorAll('button'), function (b) {
    b.onclick = function () { [].forEach.call($('nRfMins').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); }); $('nRfMin').value = ''; };
  });
  $('nRfMin').oninput = function () {
    this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3);
    [].forEach.call($('nRfMins').querySelectorAll('button'), function (x) { x.classList.toggle('on', !$('nRfMin').value && x.getAttribute('data-m') === '10'); });
  };
  function rfMinVal() {
    var v = $('nRfMin').value.trim(), on = $('nRfMins').querySelector('button.on');
    return v ? Number(v) : on ? Number(on.getAttribute('data-m')) : 10;
  }
  /** 서명지 관리 창 안의 카드. mode: info 정보 수정(정보·접속 코드·순서·임무역할), exp 내보내기 */
  function eduCard(e, mode) {
    var c = document.createElement('div'); c.className = 'ecard open fixed m-' + (mode || 'info');
    if (!e.open) c.style.borderColor = '#f5c2bd';
    c.innerHTML = '<div class="head"><div class="t"></div><div class="d"></div><div class="cnt"></div>' +
      '<div class="tap">눌러서 펼치기</div></div>' +
      '<div class="body">' +
      '<div class="ibox"><div class="ihead"><b>서명지 정보 수정</b></div>' +
      '<div class="ibody">' +
      '<div class="field"><label>교육명</label><input type="text" class="i-title" autocomplete="off"></div>' +
      '<div class="fRow"><div class="field i-deptRow"><label>부서명</label><select class="i-dept"></select></div>' +
      '<div class="field i-teamRow"><label>팀</label><select class="i-team"></select></div></div>' +
      '<div class="field i-dateRow"><label>날짜</label><input type="text" class="i-date" autocomplete="off"></div>' +
      '<div class="row"><button class="btn gray b-info">변경 사항 저장</button></div>' +
      '<div class="codeSec"><div style="margin-top:12px"><b>접속 코드</b></div>' +
      '<div class="codeRow" style="margin-top:6px"><input type="text" class="c-code" autocomplete="off" inputmode="numeric" maxlength="4" pattern="[0-9]*" placeholder="숫자 4자리"><button class="btn pri sbtn b-code">코드 저장</button></div>' +
      '<div class="lockRow hidden"><span>⚠ 접속 코드가 20번 틀려 잠겼습니다.</span><button class="btn del sbtn b-unlock">잠금 풀기</button></div></div>' +
      '<div class="ordSec"><div style="margin-top:12px"><b>서명자 순서</b> <span class="hint">(마감 후에도 순서 변경 가능)</span></div>' +
      '<div class="row"><button class="btn gray b-order"></button></div></div>' +
      '</div></div>' +
      '<div class="roleBox"><div style="margin-top:12px"><b>임무·역할</b></div>' +
      '<div class="row"><button class="btn gray b-role"></button></div></div>' +
      '<div class="rosterSec hidden"><div style="margin-top:12px"><b>아직 서명 안 한 사람</b></div><div class="hint rosterLeft" style="margin-top:4px"></div></div>' +
      '<div class="expSec"><div style="margin-top:12px"><b class="expTitle">PDF · 로그</b></div>' +
      '<div class="row"><button class="btn pri b-exp">내보내기 준비</button></div>' +
      '<div class="exp hidden"><div class="row"><button class="btn gray b-pdf">PDF 저장</button><button class="btn gray b-csv">CSV 저장</button><button class="btn gray b-html">HTML 저장</button></div>' +
      '</div></div>' +
      '<div class="msg m"></div></div>';
    var q = function (s) { return c.querySelector(s); };
    q('.ihead').classList.add('hidden');   // 창 이름이 '정보 수정'
    if (mode === 'exp') { q('.ibox').classList.add('hidden'); q('.roleBox').classList.add('hidden'); q('.rosterSec').classList.add('hidden'); }
    else q('.expSec').classList.add('hidden');

    q('.t').textContent = e.title;
    if (e.refund) q('.t').appendChild(document.createElement('br'));   // 환불 건: 제목이 길어 표시는 다음 줄에
    var chip = document.createElement('span');
    chip.className = 'chip ' + (e.open ? 'on' : 'off'); chip.textContent = e.open ? '접수 중' : '마감';
    if (e.refund) chip.style.marginLeft = '0';
    q('.t').appendChild(chip);
    if (e.guest) { var gchip = document.createElement('span'); gchip.className = 'chip ext'; gchip.textContent = '본인 확인 없음'; q('.t').appendChild(gchip); }
    if (e.roster) { var ochip = document.createElement('span'); ochip.className = 'chip ext'; ochip.textContent = '명단 지정'; q('.t').appendChild(ochip);
      if (mode !== 'exp') q('.rosterSec').classList.remove('hidden'); q('.rosterLeft').textContent = (e.rosterLeft || []).join(', ') || '없음 (전원 서명)'; }
    if (e.codeLocked) { var lchip = document.createElement('span'); lchip.className = 'chip off'; lchip.textContent = '코드 잠김'; q('.t').appendChild(lchip); }
    if (e.missingTabs) { var tchip = document.createElement('span'); tchip.className = 'chip off'; tchip.textContent = '양식 없음'; q('.t').appendChild(tchip); }
    if (e.safety) { var kchip = document.createElement('span'); kchip.className = 'chip ext'; kchip.textContent = '안전점검'; q('.t').appendChild(kchip); }
    if (e.refund) { var rchip = document.createElement('span'); rchip.className = 'chip rf'; rchip.textContent = '환불 등록'; q('.t').appendChild(rchip);
      var rcnt = document.createElement('span'); rcnt.style.cssText = 'margin-left:6px;font-size:14px;font-weight:700;vertical-align:1px'; rcnt.textContent = e.signers.length + '명'; q('.t').appendChild(rcnt); }
    var tInfo = [e.dept, e.team, e.date].filter(Boolean).join(' · ');      // 부서명·팀·날짜는 제목 줄의 표시 옆에 (내보내기 창만, 정보 수정 창은 아래 입력칸에 같은 값)
    if (tInfo && !e.refund && mode === 'exp') { var tI = document.createElement('span'); tI.style.cssText = 'margin-left:6px;font-size:13px;font-weight:400;color:var(--sub)'; tI.textContent = tInfo; q('.t').appendChild(tI); }
    q('.d').textContent = (e.tpl || '') + (e.pages > 1 ? ' · ' + e.pages + '페이지' : '');
    q('.cnt').textContent = '서명 ' + e.signers.length + (e.roster ? '/' + e.roster : '') + '명';   // 접속 코드는 정보 수정 창의 입력칸에
    q('.d').classList.toggle('hidden', !!e.refund); q('.cnt').classList.toggle('hidden', !!e.refund);   // 환불 등록: 빨간 표시 옆 인원만
    if (mode !== 'exp' && !e.roster) q('.cnt').classList.add('hidden');   // 정보 수정 창: 서명 수는 [서명자 순서 (N명)] 버튼에 (명단 지정이면 N/M명은 남김)
    if (e.safety) { q('.d').textContent = '역 ' + e.safety.n + '개'; q('.cnt').classList.remove('hidden'); q('.cnt').textContent = '점검자 서명 ' + e.safety.ins + '/' + e.safety.n + ' · 팀장 서명 ' + e.safety.lead + '/' + e.safety.n; }
    if (e.refund && e.open) {                        // 고객용 QR 접수 남은 시간 (줄어들며 표시, 끝나면 'QR 접수 마감 · 직원 등록 가능')
      var left = document.createElement('span'); left.className = 'rfLeft';
      left.setAttribute('data-end', String(Date.now() + (Number(e.autoCloseLeft) || 0))); left.title = (e.autoClose ? e.autoClose + ' QR 접수 마감 · ' : '') + 'QR 접수 ' + (e.qrMin || '') + '분';
      q('.cnt').appendChild(document.createElement('br')); q('.cnt').appendChild(left); setRfLeft(left);
    }
    if (e.error) { var m0 = q('.m'); msg(m0, e.error, '#c0392b'); }

    // 접수 마감·다시 열기·삭제는 카드 밀기 버튼으로
    // 교육 정보 (기본은 접힘, 눌러서 펼치기)
    q('.i-title').value = e.title || ''; q('.i-date').value = e.date || '';
    deptTeamSel(q('.i-dept'), q('.i-team'), e.dept || '', e.team || '');
    deptRow(q('.i-deptRow'), e.tpl, e.guest); q('.i-teamRow').classList.toggle('hidden', !!e.guest || !!e.refund);
    q('.b-info').onclick = function () {
      q('.b-info').disabled = true;
      admCall('adminEditEdu', [e.id, { title: q('.i-title').value, dept: q('.i-dept').value, team: q('.i-dept').value ? q('.i-team').value : '', date: q('.i-date').value }], function (d) {
        renderAdmin(d);
      }, q('.m'));
      setTimeout(function () { q('.b-info').disabled = false; }, 15000);
    };
    // 접속 코드
    q('.c-code').value = e.code || '';
    q('.b-code').onclick = function () {
      admCall('adminSetCode', [e.id, q('.c-code').value], function (d) {
        renderAdmin(d); admOverMsg(e.title + ': 접속 코드를 저장했습니다.' + (e.codeLocked ? ' 잠금도 풀었습니다.' : ''));
      }, q('.m'));
    };
    // 접속 코드 잠금: 20번 틀려 막혔을 때만 보임 (코드 저장으로도 풀림)
    q('.lockRow').classList.toggle('hidden', !e.codeLocked);
    q('.b-unlock').onclick = function () {
      q('.b-unlock').disabled = true;
      admCall('adminUnlockCode', [e.id], function (d) {
        renderAdmin(d); admOverMsg(e.title + ': 접속 코드 잠금을 풀었습니다.');
      }, q('.m'), function () { q('.b-unlock').disabled = false; });
    };

    // 서명자 순서: 별도 화면에서 보고 수정
    q('.b-order').textContent = '서명자 순서 보기 · 수정 (' + e.signers.length + '명)';
    q('.b-order').disabled = !e.signers.length;
    q('.b-order').onclick = function () { openOrder(e.id); };
    q('.b-role').textContent = '임무·역할 지정 (' + e.assigned + '명)';
    q('.b-role').onclick = function () { openRoles(e.id); };
    q('.roleBox').classList.toggle('hidden', mode === 'exp' || !e.hasRole || !!e.guest || !!e.refund);
    // 비상(환불 등록): 접속 코드·서명자 순서 없음
    q('.codeSec').classList.toggle('hidden', !!e.refund || !!e.safety); q('.ordSec').classList.toggle('hidden', !!e.refund || !!e.safety);   // 안전점검: 접속 코드·순서 없음 (역 순서)
    if (e.safety) { q('.roleBox').classList.add('hidden'); q('.i-title').parentElement.classList.add('hidden'); q('.i-deptRow').classList.add('hidden'); q('.i-teamRow').classList.add('hidden'); }
    q('.b-pdf').classList.toggle('hidden', !!e.refund); q('.b-html').classList.toggle('hidden', !!e.refund);
    if (e.refund) q('.expTitle').textContent = '등록 명단 내보내기 (CSV)';
    if (e.refund) {
      q('.i-deptRow').classList.add('hidden');
      q('.i-title').previousElementSibling.textContent = '제목';   // 환불 건은 교육이 아니라서
      q('.i-dateRow').classList.add('hidden'); q('.i-date').value = '';   // 비상: 날짜는 제목에 들어 있으므로 칸 없음
    }   // 임무·역할 칸이 있는 양식만. 본인 확인 없는 교육은 서명자가 직접 입력

    // 내보내기 (선택) · 삭제 (마감 후 두 번 누르기)
    var saved = {};
    var noPdf = function () { var P = (admExp[e.id] || {}).pdf; return !!(P && P.missing); };   // 서명지 탭이 지워져 PDF를 만들 수 없음
    var allSaved = function () { return e.refund ? !!saved.csv : (saved.pdf || noPdf()) && saved.csv && saved.html; };   // 비상 등록은 CSV 하나만
    function mark(k) {
      saved[k] = true;
      if (allSaved()) msg(q('.m'), (e.refund ? 'CSV 파일을 저장했습니다.' : noPdf() ? 'CSV·HTML 파일을 저장했습니다.' : '파일 3개를 저장했습니다.') + ' 컴퓨터 폴더에 잘 들어갔는지 확인하세요.', '#12833b');
    }
    // 내보내기: 로그(CSV·HTML)와 PDF를 따로 동시에 요청 → 준비되는 대로 저장 버튼이 켜짐
    var setBtn = function (cls, label, on) { q(cls).textContent = label; q(cls).disabled = !on; };
    var expMsg = function () {
      var X = admExp[e.id] || {}, L = X.log, P = X.pdf;
      if (X.err) return;
      if (e.refund) { msg(q('.m'), L ? 'CSV를 저장하세요. (등록 ' + L.valid + '명)' : '준비 중…', '#6b7686'); return; }
      if (L && P && P.missing) msg(q('.m'), '양식 탭이 없어 PDF는 만들 수 없습니다. CSV·HTML 파일을 저장하세요. (유효 서명 ' + L.valid + '건, 로그 ' + L.count + '건)', '#c0392b');
      else if (L && P) msg(q('.m'), '파일 3개를 저장하세요. (유효 서명 ' + L.valid + '건, 로그 ' + L.count + '건' +
        (P.pageCount > 1 ? ', 서명지 ' + P.pageCount + '페이지' + (P.pdf ? '를 PDF 하나로' : '는 PDF 페이지별 파일로') : '') + ')', '#6b7686');
      else msg(q('.m'), (L ? '로그 준비 완료 · ' : '') + (P ? 'PDF 준비 완료 · ' : '') + (!P ? 'PDF 만드는 중… (서명지 크기에 따라 10초 이상 걸릴 수 있습니다)' : '로그 준비 중…'), '#6b7686');
    };
    q('.b-exp').onclick = function () {
      var X = admExp[e.id] = {};
      q('.b-exp').disabled = true; q('.exp').classList.remove('hidden');
      setBtn('.b-pdf', 'PDF 준비 중…', false); setBtn('.b-csv', 'CSV 준비 중…', false); setBtn('.b-html', 'HTML 준비 중…', false);
      expMsg();
      var fail = function (err) {
        X.err = true; q('.b-exp').disabled = false; msg(q('.m'), errText(err), '#c0392b');
      };
      var both = function () { if (X.log && (X.pdf || e.refund)) q('.b-exp').disabled = false; expMsg(); };
      srv().withSuccessHandler(function (r) {
        X.log = r; setBtn('.b-csv', 'CSV 저장', true); setBtn('.b-html', 'HTML 저장', true); both();
      }).withFailureHandler(fail).adminExportLog(staff.token, e.id);
      if (e.refund) return;                           // 비상 등록: PDF·HTML 없이 CSV만
      srv().withSuccessHandler(function (r) {
        X.pdf = r; if (r.missing) setBtn('.b-pdf', 'PDF 없음 (탭 없음)', false); else setBtn('.b-pdf', 'PDF 저장', true); both();
      }).withFailureHandler(fail).adminExportPdf(staff.token, e.id);
      setTimeout(function () { q('.b-exp').disabled = false; }, 60000);
    };
    q('.b-pdf').onclick = function () {
      var r = (admExp[e.id] || {}).pdf; if (!r || r.missing) return;
      if (r.pdf) saveFile(r.base + '_서명지.pdf', b64Blob(r.pdf, 'application/pdf'));
      else r.pdfs.forEach(function (b64, i) { setTimeout(function () { saveFile(r.base + '_서명지_' + (i + 1) + '.pdf', b64Blob(b64, 'application/pdf')); }, i * 700); });
      mark('pdf');
    };
    q('.b-csv').onclick = function () { var r = (admExp[e.id] || {}).log; if (!r) return; saveFile(r.base + (e.refund ? '_환불등록.csv' : '_서명로그.csv'), new Blob([r.csv], { type: 'text/csv;charset=utf-8' })); mark('csv'); };
    q('.b-html').onclick = function () { var r = (admExp[e.id] || {}).log; if (!r) return; saveFile(r.base + '_서명로그.html', new Blob([r.html], { type: 'text/html;charset=utf-8' })); mark('html'); };
    return c;
  }

  function b64Bytes(b64) { var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr; }
  function b64Blob(b64, type) { return new Blob([b64Bytes(b64)], { type: type }); }
  function saveFile(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }


  /** 개인 코드 칸: 복사·잘라내기·끌기·길게 눌러 메뉴·선택 막기 */
  ['copy', 'cut', 'dragstart', 'contextmenu'].forEach(function (t) {
    document.addEventListener(t, function (e) { if (e.target && e.target.classList && e.target.classList.contains('secret')) e.preventDefault(); });
  });
  document.addEventListener('select', function (e) { var el = e.target; if (el && el.classList && el.classList.contains('secret')) { var n = el.value.length; el.setSelectionRange(n, n); } });

  /* ---------- PDF 서명지: PDF 올리기 → 서명란 자동 찾기 → 서명자 고르기 → 서명 → 완료 PDF ----------
     PDF 도구(pdf.js·pdf-lib)는 쓸 때만 불러옴. 서명란 좌표는 PDF 좌표(왼쪽 아래 0, 쪽 번호 0부터) */
  var PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
  var PDFLIB_SRC = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  var PU_MAX_MB = 10, PU_MAX_PAGES = 30;
  var jsLoads = {};
  function loadJs(src) {
    return jsLoads[src] || (jsLoads[src] = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { delete jsLoads[src]; s.remove(); no(new Error('PDF 도구를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); };
      document.head.appendChild(s);
    }));
  }
  function pdfJs() {
    return loadJs(PDFJS_BASE + 'build/pdf.min.js').then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'build/pdf.worker.min.js';
      return window.pdfjsLib;
    });
  }

  /*PD-START 서명란 찾기 (시험 파일이 이 부분만 떼어 씀) */
  var PD = (function () {
    var SIGN_HEAD = /^(서명|서명란|서명인|날인|서명날인|서명또는날인|서명또는인|확인|인)$/;
    // 결재란 칸 이름: 기안자·검토·협조 등 + '~장'으로 끝나는 직책 (팀장·운영처장·역무팀장…). 한 줄에 2칸 이상 + 아래 칸이 있을 때만 씀
    var ROLE = /^(결재|결재란|담당|담당자|작성|작성자|기안|기안자|검토|검토자|확인자|승인|승인자|협조|협조자|합의|대리|주임|과장|차장|부장|이사|상무|전무|부사장|감독|감독자|책임자|관리자|[가-힣]{1,6}장)$/;
    var KYUL = /^결재란?$/;
    var MARK = /\(\s*(인|印|서\s*명|서명\s*또는\s*인|서명\s*또는\s*날인)\s*\)/g;
    function mul(m, n) {
      return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    }
    /** 표 선: 가로선 H [{y,x1,x2}], 세로선 V [{x,y1,y2}] (선·얇은 사각형·칸 테두리) */
    function segs(ol, OPS) {
      var H = [], V = [], ctm = [1, 0, 0, 1, 0, 0], st = [];
      var pt = function (x, y) { return [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]; };
      var add = function (a, b) {
        if (Math.abs(a[1] - b[1]) < 1 && Math.abs(a[0] - b[0]) > 3) H.push({ y: (a[1] + b[1]) / 2, x1: Math.min(a[0], b[0]), x2: Math.max(a[0], b[0]) });
        else if (Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) > 3) V.push({ x: (a[0] + b[0]) / 2, y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]) });
      };
      for (var i = 0; i < ol.fnArray.length; i++) {
        var fn = ol.fnArray[i], a = ol.argsArray[i];
        if (fn === OPS.save) st.push(ctm);
        else if (fn === OPS.restore) ctm = st.pop() || ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, a);
        else if (fn === OPS.paintFormXObjectBegin) { st.push(ctm); if (a && a[0]) ctm = mul(ctm, a[0]); }
        else if (fn === OPS.paintFormXObjectEnd) ctm = st.pop() || ctm;
        else if (fn === OPS.constructPath) {
          var ops = a[0], c = a[1], k = 0, cur = null, start = null;
          for (var j = 0; j < ops.length; j++) {
            var o = ops[j];
            if (o === OPS.moveTo) { cur = start = pt(c[k], c[k + 1]); k += 2; }
            else if (o === OPS.lineTo) { var p = pt(c[k], c[k + 1]); k += 2; if (cur) add(cur, p); cur = p; }
            else if (o === OPS.curveTo) { cur = pt(c[k + 4], c[k + 5]); k += 6; }
            else if (o === OPS.curveTo2 || o === OPS.curveTo3) { cur = pt(c[k + 2], c[k + 3]); k += 4; }
            else if (o === OPS.rectangle) {
              var q = [pt(c[k], c[k + 1]), pt(c[k] + c[k + 2], c[k + 1]), pt(c[k] + c[k + 2], c[k + 1] + c[k + 3]), pt(c[k], c[k + 1] + c[k + 3])];
              k += 4;
              var xs = q.map(function (v) { return v[0]; }), ys = q.map(function (v) { return v[1]; });
              var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
              if (y1 - y0 < 2.5) add([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]);          // 얇은 사각형 = 선
              else if (x1 - x0 < 2.5) add([(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]);
              else { add([x0, y0], [x1, y0]); add([x1, y0], [x1, y1]); add([x0, y1], [x1, y1]); add([x0, y0], [x0, y1]); }
              cur = start = q[0];
            }
            else if (o === OPS.closePath) { if (cur && start) add(cur, start); cur = start; }
          }
        }
      }
      return { H: H, V: V };
    }
    /** 글자 조각 → 칸 글자 (같은 줄에서 가깝고 사이에 세로선이 없으면 이어 붙임. '성   명'처럼 띄운 한 글자도) */
    function cells(items, V) {
      var t = items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
        var m = it.transform, fs = Math.hypot(m[2], m[3]) || it.height || 10;
        return { s: it.str, x1: m[4], x2: m[4] + (it.width || fs * it.str.length * 0.9), y: m[5], fs: fs };
      });
      t.sort(function (a, b) { return b.y - a.y || a.x1 - b.x1; });
      var lines = [];
      t.forEach(function (it) {
        var L = null;
        for (var i = 0; i < lines.length && !L; i++) if (Math.abs(lines[i].y - it.y) < Math.max(lines[i].fs, it.fs) * 0.4) L = lines[i];
        if (L) L.items.push(it); else lines.push({ y: it.y, fs: it.fs, items: [it] });
      });
      var out = [], one = /^\s*[가-힣]\s*$/;
      lines.forEach(function (l) {
        l.items.sort(function (a, b) { return a.x1 - b.x1; });
        var c = null;
        l.items.forEach(function (it) {
          var gap = c ? it.x1 - c.x2 : 0, fs = c ? Math.max(c.fs, it.fs) : it.fs, yc = l.y + fs * 0.35;
          var wall = c && V.some(function (v) { return v.x > c.x2 - 1 && v.x < it.x1 + 1 && v.y1 <= yc && v.y2 >= yc; });
          var near = c && (gap < fs * 1.6 || (gap < fs * 3.5 && one.test(it.s) && one.test(c.last)));
          if (c && near && !wall) { c.s += (gap > fs * 0.25 ? ' ' : '') + it.s; c.x2 = Math.max(c.x2, it.x2); c.last = it.s; c.fs = fs; }
          else { c = { s: it.s, x1: it.x1, x2: it.x2, y: l.y, fs: it.fs, last: it.s }; out.push(c); }
        });
      });
      out.forEach(function (c) { c.n = c.s.replace(/[\s()（）:：]/g, ''); c.cx = (c.x1 + c.x2) / 2; c.cy = c.y + c.fs * 0.35; });
      return out;
    }
    /** 칸 아래 줄들: 머릿글 칸 아래의 표 줄 [{y0,y1,x0,x1}] (rows: 최대 줄 수) */
    function rowsBelow(h, S, rows) {
      var ys = S.H.filter(function (l) { return l.x1 <= h.cx + 1 && l.x2 >= h.cx - 1 && l.y < h.cy; })
        .map(function (l) { return l.y; }).sort(function (a, b) { return b - a; });
      var u = [];
      ys.forEach(function (y) { if (!u.length || u[u.length - 1] - y > 4) u.push(y); });   // 겹선은 하나로
      if (!u.length || h.cy - u[0] > h.fs * 4) return [];
      var out = [], first = 0;
      for (var i = 0; i + 1 < u.length && out.length < rows; i++) {
        var top = u[i], bot = u[i + 1], ht = top - bot;
        if (ht > 150) break;
        if (first && (ht > first * 2.2 || ht < first * 0.45)) break;   // 줄 높이가 크게 달라지면 표 끝
        if (!first) first = ht;
        var mid = (top + bot) / 2, l = -1e9, r = 1e9;
        S.V.forEach(function (v) {
          if (v.y1 > mid || v.y2 < mid) return;
          if (v.x < h.cx && v.x > l) l = v.x;
          if (v.x > h.cx && v.x < r) r = v.x;
        });
        if (l < -1e8) l = h.x1 - h.fs; if (r > 1e8) r = h.x2 + h.fs;
        out.push({ x0: l, x1: r, y0: bot, y1: top });
      }
      return out;
    }
    function isHead(c) { return SIGN_HEAD.test(c.n) && !/[(（]/.test(c.s); }   // '(인)'은 머릿글이 아니라 서명 자리
    function box(x0, y0, x1, y1) { var p = 1.5; return { x: x0 + p, y: y0 + p, w: Math.max(4, x1 - x0 - p * 2), h: Math.max(4, y1 - y0 - p * 2) }; }
    function markBox(cx, cy, fs) { var h = Math.max(18, Math.min(40, fs * 2.4)), w = h * 2.4; return { x: cx - w / 2, y: cy - h / 2, w: w, h: h }; }
    /** 한 쪽의 서명란 [{x,y,w,h, g:[그룹 y, 그룹 x, 줄]}] */
    function page(items, S) {
      var cs = cells(items, S.V), out = [];
      var push = function (b, gy, gx, i) { b.g = [gy, gx, i]; out.push(b); };
      cs.forEach(function (c) {
        if (isHead(c) && !ROLE.test(c.n)) {                       // 표 머릿글 '서명' 등: 아래 줄마다
          var rs = rowsBelow(c, S, 60);
          if (rs.length) rs.forEach(function (r, i) { push(box(r.x0, r.y0, r.x1, r.y1), c.cy, c.cx, i); });
          else if (/^서명/.test(c.n)) { var h = Math.max(18, c.fs * 2.4); push({ x: c.cx - h * 1.2, y: c.y - c.fs * 0.6 - h, w: h * 2.4, h: h }, c.cy, c.cx, 0); }
        }
      });
      cs.forEach(function (c) {                                                // 결재란: 한 줄에 직책 칸이 둘 이상, 또는 '결재' 글자 오른쪽 칸 (이름이 무엇이든)
        if (KYUL.test(c.n) || isHead(c)) return;
        var line = cs.filter(function (d) { return d !== c && Math.abs(d.cy - c.cy) < Math.max(c.fs, d.fs) * 0.6; });
        var byKyul = line.some(function (d) { return KYUL.test(d.n) && d.x2 <= c.x1 + 1; });
        if (!byKyul && !(ROLE.test(c.n) && line.some(function (d) { return ROLE.test(d.n) && !KYUL.test(d.n); }))) return;
        var rs = rowsBelow(c, S, 1);
        if (rs.length) push(box(rs[0].x0, rs[0].y0, rs[0].x1, rs[0].y1), c.cy, c.cx, 0);
      });
      cs.forEach(function (c) {                                                // 글 속 '(인)'·'(서명)' 자리, '서명 : ____'
        if (isHead(c)) return;
        var m, len = c.s.length || 1, wd = c.x2 - c.x1;
        MARK.lastIndex = 0;
        while ((m = MARK.exec(c.s))) push(markBox(c.x1 + wd * (m.index + m[0].length / 2) / len, c.cy, c.fs), c.cy, c.x1 + wd * m.index / len, 0);
        var lab = /서\s*명\s*[:：]\s*_*\s*$/.exec(c.s);
        if (lab) { var b = markBox(0, c.cy, c.fs), x0 = c.x1 + wd * (lab.index + lab[0].replace(/[_\s]+$/, '').length) / len + 3; b.x = x0; push(b, c.cy, c.x1, 0); }
      });
      var kept = [];                                                           // 다른 칸 안에 들어가는 자리는 뺌 (표 칸 안의 '(인)' 등)
      out.forEach(function (b) {
        var mx = b.x + b.w / 2, my = b.y + b.h / 2;
        if (!kept.some(function (k) { return mx > k.x && mx < k.x + k.w && my > k.y && my < k.y + k.h; })) kept.push(b);
      });
      kept.sort(function (a, b) { return Math.abs(a.g[0] - b.g[0]) > 3 ? b.g[0] - a.g[0] : a.g[1] - b.g[1] || a.g[2] - b.g[2]; });
      return kept.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h }; });
    }
    return { page: page, segs: segs, cells: cells };
  })();
  /*PD-END*/

  /* ---------- 만들기 화면 (su) ---------- */
  var PU = null;
  function puReset() {
    PU = { b64: '', name: '', pages: [], fields: [], signers: [], busy: false, seq: (PU && PU.seq || 0) + 1 };
    $('puTitle').value = ''; $('puFile').value = ''; $('puFind').value = ''; $('puHits').innerHTML = '';
    $('puPages').innerHTML = ''; $('puPrevCard').classList.add('hidden');
    msg($('puMsg'), ''); msg($('puMsg2'), ''); puDrawSigners();
  }
  function puOpen() { puReset(); $('newCard').classList.remove('open'); show('su'); }   // 새 서명지 열기 → 양식 [PDF 서명지]
  $('puBack').onclick = function () { if (!PU || !PU.busy) resetAll(); };

  function bytesB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  $('puFile').onchange = function () {
    var f = this.files && this.files[0], seq = PU.seq;
    PU.b64 = ''; PU.pages = []; PU.fields = []; $('puPages').innerHTML = ''; $('puPrevCard').classList.add('hidden');
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { msg($('puMsg'), 'PDF 파일을 고르세요. 한글·엑셀 파일은 먼저 PDF로 저장하세요.', '#c0392b'); return; }
    if (f.size > PU_MAX_MB * 1024 * 1024) { msg($('puMsg'), 'PDF 파일은 ' + PU_MAX_MB + 'MB까지 올릴 수 있습니다.', '#c0392b'); return; }
    if (!$('puTitle').value.trim()) $('puTitle').value = f.name.replace(/\.pdf$/i, '').slice(0, 60);
    PU.name = f.name;
    msg($('puMsg'), 'PDF를 읽고 서명란을 찾는 중…', '#6b7686');
    var rd = new FileReader();
    rd.onerror = function () { msg($('puMsg'), '파일을 읽지 못했습니다.', '#c0392b'); };
    rd.onload = function () {
      var u8 = new Uint8Array(rd.result);
      if (seq !== PU.seq) return;
      PU.b64 = bytesB64(u8);
      pdfJs().then(function (lib) {
        return lib.getDocument({ data: u8.slice(), cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS_BASE + 'standard_fonts/' }).promise;
      }).then(function (doc) {
        if (doc.numPages > PU_MAX_PAGES) throw new Error('PDF는 ' + PU_MAX_PAGES + '쪽까지 올릴 수 있습니다.');
        var chain = Promise.resolve(), found = [], textAny = false;
        for (var i = 1; i <= doc.numPages; i++) (function (n) {
          chain = chain.then(function () { return doc.getPage(n); }).then(function (pg) {
            return Promise.all([pg.getTextContent(), pg.getOperatorList()]).then(function (r) {
              if (r[0].items.some(function (it) { return it.str && it.str.trim(); })) textAny = true;
              PD.page(r[0].items, PD.segs(r[1], window.pdfjsLib.OPS)).forEach(function (b) { b.p = n - 1; found.push(b); });
              PU.pages.push({ pg: pg, vp: pg.getViewport({ scale: 1 }) });
            });
          });
        })(i);
        return chain.then(function () {
          if (seq !== PU.seq) return;
          PU.fields = found;
          msg($('puMsg'), !textAny ? '글자가 없는 PDF(스캔·사진)라 서명란을 찾지 못했습니다. 미리보기에서 서명할 자리를 눌러 추가하세요.' :
            found.length ? '서명란 ' + found.length + '개를 찾았습니다. 아래 미리보기에서 확인하세요.' : '서명란을 찾지 못했습니다. 미리보기에서 서명할 자리를 눌러 추가하세요.',
            textAny && found.length ? '#12833b' : '#c0392b');
          return puRender();
        });
      }).catch(function (x) {
        if (seq !== PU.seq) return;
        PU.b64 = ''; PU.pages = [];
        msg($('puMsg'), /password|encrypt/i.test(errText(x)) ? '암호가 걸린 PDF는 올릴 수 없습니다.' : /PDF 도구|쪽까지/.test(errText(x)) ? errText(x) : 'PDF를 읽지 못했습니다: ' + errText(x), '#c0392b');
      });
    };
    rd.readAsArrayBuffer(f);
  };

  /** 미리보기: 쪽마다 그림 + 서명란 상자 (번호 = 서명 순서, 누르면 지움, 빈 곳을 누르면 추가) */
  function puRender() {
    var box = $('puPages'), seq = PU.seq; box.innerHTML = '';
    $('puPrevCard').classList.remove('hidden');
    var cw = Math.max(240, box.clientWidth || 340), dpr = Math.min(2, window.devicePixelRatio || 1);
    var chain = Promise.resolve();
    PU.pages.forEach(function (P, i) {
      var wrap = document.createElement('div'); wrap.className = 'puPg';
      var cv2 = document.createElement('canvas'), layer = document.createElement('div'); layer.className = 'puLayer';
      var sc = cw * dpr / P.vp.width, vp = P.pg.getViewport({ scale: sc });
      cv2.width = Math.round(vp.width); cv2.height = Math.round(vp.height);
      wrap.style.aspectRatio = P.vp.width + ' / ' + P.vp.height;
      wrap.appendChild(cv2); wrap.appendChild(layer); box.appendChild(wrap);
      var no = document.createElement('div'); no.className = 'puNo'; no.textContent = (i + 1) + ' / ' + PU.pages.length + '쪽'; wrap.appendChild(no);
      layer.onclick = function (ev) { puTap(i, layer, ev); };
      chain = chain.then(function () { if (seq === PU.seq) return P.pg.render({ canvasContext: cv2.getContext('2d'), viewport: vp }).promise; });
    });
    puDrawBoxes();
    return chain;
  }
  function puRect(f) {                        // PDF 좌표 → 쪽 그림 안의 % 위치 (회전된 쪽도)
    var vp = PU.pages[f.p].vp, a = vp.convertToViewportPoint(f.x, f.y), b = vp.convertToViewportPoint(f.x + f.w, f.y + f.h);
    return { l: Math.min(a[0], b[0]) / vp.width * 100, t: Math.min(a[1], b[1]) / vp.height * 100,
      w: Math.abs(a[0] - b[0]) / vp.width * 100, h: Math.abs(a[1] - b[1]) / vp.height * 100 };
  }
  function puDrawBoxes() {
    var layers = $('puPages').querySelectorAll('.puLayer');
    [].forEach.call(layers, function (l) { l.innerHTML = ''; });
    PU.fields.forEach(function (f, i) {
      var l = layers[f.p]; if (!l) return;
      var r = puRect(f), d = document.createElement('div'), s = PU.signers[i];
      d.className = 'puBox' + (s ? '' : ' extra');
      d.style.left = r.l + '%'; d.style.top = r.t + '%'; d.style.width = r.w + '%'; d.style.height = r.h + '%';
      var lb = document.createElement('span'); lb.textContent = (i + 1) + (s ? ' ' + s.name : ''); d.appendChild(lb);   // 회색 칸 = 서명자 없음
      d.onclick = function (ev) { ev.stopPropagation(); PU.fields.splice(i, 1); puDrawBoxes(); };
      l.appendChild(d);
    });
    puCount();
  }
  function puTap(i, layer, ev) {
    var P = PU.pages[i], rc = layer.getBoundingClientRect();
    var px = (ev.clientX - rc.left) / rc.width * P.vp.width, py = (ev.clientY - rc.top) / rc.height * P.vp.height;
    var c = P.vp.convertToPdfPoint(px, py);
    var hs = PU.fields.map(function (f) { return f.h; }).sort(function (a, b) { return a - b; });
    var h = hs.length ? Math.min(60, Math.max(16, hs[hs.length >> 1])) : 26, w = h * 2.4;
    PU.fields.push({ p: i, x: c[0] - w / 2, y: c[1] - h / 2, w: w, h: h });
    puDrawBoxes();
  }
  function puCount() {
    var nf = PU.fields.length, ns = PU.signers.length, ok = nf === ns && ns > 0;
    $('puCount').textContent = '서명란 ' + nf + '개 · 서명자 ' + ns + '명' + (ok ? '' : nf > ns ? ' → 서명자를 더 넣거나 남는 칸을 눌러 지우세요' : ns ? ' → 미리보기 빈 곳을 눌러 칸을 추가하세요' : '');
    $('puCount').style.color = ok ? '#12833b' : '#b42318';
  }

  /* 서명자: 이름으로 찾아 추가 (추가한 순서 = 서명 순서 = 서명란 번호) */
  function puFind() {
    var q = $('puFind').value.trim();
    if (!q) { msg($('puMsg2'), '찾을 이름을 입력하세요.', '#c0392b'); return; }
    $('puFindBtn').disabled = true; msg($('puMsg2'), '찾는 중…', '#6b7686');
    srv().withSuccessHandler(function (list) {
      $('puFindBtn').disabled = false; msg($('puMsg2'), list.length ? '' : '"' + q + '" 직원을 찾지 못했습니다.', '#c0392b');
      var box = $('puHits'); box.innerHTML = '';
      list.forEach(function (p) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'puHit';
        b.textContent = p.name + (p.disp ? ' ' + p.disp : '') + (p.dept ? ' · ' + p.dept : '');
        b.onclick = function () {
          if (PU.signers.some(function (s) { return s.key === p.key; })) { msg($('puMsg2'), p.name + ' 님은 이미 넣었습니다.', '#c0392b'); return; }
          PU.signers.push(p); box.innerHTML = ''; $('puFind').value = ''; msg($('puMsg2'), ''); puDrawSigners(); $('puFind').focus();
        };
        box.appendChild(b);
      });
      if (list.length === 1) box.firstChild.focus();
    }).withFailureHandler(function (x) {
      $('puFindBtn').disabled = false;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('puMsg2'), errText(x), '#c0392b');
    }).pdfStaffFind(staff && staff.token || '', q);
  }
  $('puFindBtn').onclick = puFind;
  $('puFind').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); puFind(); } });
  function puDrawSigners() {
    var ol = $('puSigners'); ol.innerHTML = '';
    PU.signers.forEach(function (s, i) {
      var li = document.createElement('li'), t = document.createElement('span'), x = document.createElement('button');
      t.textContent = s.name + (s.disp ? ' ' + s.disp : '') + (s.dept ? ' · ' + s.dept : '');
      x.type = 'button'; x.className = 'puDel'; x.textContent = '빼기';
      x.onclick = function () { PU.signers.splice(i, 1); puDrawSigners(); };
      li.appendChild(t); li.appendChild(x); ol.appendChild(li);
    });
    if (PU.pages.length) puDrawBoxes(); else puCount();
  }

  $('puSave').onclick = function () {
    if (PU.busy) return;
    var title = $('puTitle').value.trim(), bad = function (t) { msg($('puMsg2'), t, '#c0392b'); };
    if (!PU.b64 || !PU.pages.length) return bad('PDF 파일을 고르세요.');
    if (!title) return bad('제목을 입력하세요.');
    if (!PU.signers.length) return bad('서명자를 한 명 이상 넣으세요.');
    if (PU.fields.length !== PU.signers.length) return bad('서명란(' + PU.fields.length + '개)과 서명자(' + PU.signers.length + '명) 수를 맞추세요.');
    PU.busy = true; $('puSave').disabled = true; msg($('puMsg2'), '올리는 중…', '#6b7686');
    var done = function () { PU.busy = false; $('puSave').disabled = false; };
    srv().withSuccessHandler(function (r) {
      done(); edTab = 'open'; resetAll(); loadInit(r); msg($('msg1'), r.note || '', '#12833b');
    }).withFailureHandler(function (x) {
      done();
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      bad(errText(x));
    }).pdfCreate(staff && staff.token || '', { title: title, name: PU.name, pdf: PU.b64, pages: PU.pages.length,
      fields: PU.fields.map(function (f) { return { p: f.p, x: f.x, y: f.y, w: f.w, h: f.h }; }),
      signers: PU.signers.map(function (s) { return s.key; }) });
  };

  /* ---------- 목록 카드 ---------- */
  function pdfItem(e) {
    var ps = e.pdfSign || {}, closed = e.open === false;
    var b = document.createElement('button');
    b.className = 'person pdfCard' + (closed ? ' closed' : '');
    b.innerHTML = '<span><span class="pdfTag">PDF 서명</span><b></b><br><span class="rank"></span><span class="pdfNames"></span></span><span class="badge"></span>';
    b.querySelector('b').textContent = e.title;
    b.querySelector('.rank').textContent = [ps.owner ? '올린 사람 ' + ps.owner : '', e.date].filter(Boolean).join(' · ');
    var nm = b.querySelector('.pdfNames');
    (ps.names || []).forEach(function (p, i) {
      if (i) nm.appendChild(document.createTextNode(' · '));
      var s = document.createElement('span'); s.className = p.ok ? 'ok' : ''; s.textContent = p.n + (p.ok ? ' ✔' : ''); nm.appendChild(s);
    });
    if (closed && e.pdfDl) { var dl = document.createElement('span'); dl.className = 'pdfDl'; dl.textContent = '✓ PDF 받음 · ' + (e.pdfDl.n || '') + ' ' + (e.pdfDl.at || ''); nm.parentNode.appendChild(dl); }
    var mine = ps.me > -1;
    b.querySelector('.badge').textContent = closed ? '서명 완료' : mine ? (ps.signed ? '재서명' : '서명') : '진행 중';
    b.onclick = function () { pdfView(e); };          // 누르면 문서 미리보기 (서명자는 그 화면에서 [서명하기])
    return b;
  }
  /* ---------- 미리보기 (sv): 문서만 (다른 사람 서명은 안 보임), 내 서명란은 빨간 칸 ---------- */
  var PV = { e: null, seq: 0, last: null };          // last: 마지막으로 받은 문서 { id, d } (다시 열 때 서버를 안 부름)
  function pdfView(e) {
    var ps = e.pdfSign || {}, seq = ++PV.seq, canSign = e.open !== false && ps.me > -1;
    PV.e = e;
    $('pvTitle').textContent = e.title;
    $('pvInfo').textContent = [ps.owner ? '올린 사람 ' + ps.owner : '', e.date].filter(Boolean).join(' · ') +
      (ps.names && ps.names.length ? '\n서명자: ' + ps.names.map(function (p) { return p.n + (p.ok ? ' ✔' : ''); }).join(' · ') : '');
    $('pvSign').classList.toggle('hidden', !canSign); $('pvSign').textContent = ps.signed ? '다시 서명하기' : '서명하기';
    $('pvPages').innerHTML = ''; msg($('pvMsg'), '문서를 불러오는 중…', '#6b7686');
    show('sv');
    var got = PV.last && PV.last.id === e.id ? Promise.resolve(PV.last.d) : new Promise(function (ok, no) {
      srv().withSuccessHandler(ok).withFailureHandler(no).pdfView(staff && staff.token || '', e.id);
    });
    got.then(function (d) {
      PV.last = { id: e.id, d: d };
      return pdfJs().then(function (lib) {
        return lib.getDocument({ data: b64Bytes(d.pdf), cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS_BASE + 'standard_fonts/' }).promise;
      }).then(function (doc) { if (seq === PV.seq) return pvRender(doc, d.mine, seq); });
    }).then(function () {
      if (seq !== PV.seq) return;
      msg($('pvMsg'), canSign ? '빨간 칸이 내 서명이 들어갈 자리입니다. 두 손가락으로 벌려 크게 볼 수 있습니다.' : '', '#324eb3');
    }).catch(function (x) {
      if (seq !== PV.seq) return;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('pvMsg'), errText(x), '#c0392b');
    });
  }
  function pvRender(doc, mine, seq) {
    var box = $('pvPages'), cw = Math.max(240, box.clientWidth || 340), dpr = Math.min(2, window.devicePixelRatio || 1), chain = Promise.resolve();
    for (var i = 1; i <= doc.numPages; i++) (function (n) {
      chain = chain.then(function () { return seq === PV.seq && doc.getPage(n); }).then(function (pg) {
        if (!pg || seq !== PV.seq) return;
        var vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: cw * dpr / vp1.width });
        var wrap = document.createElement('div'), cv2 = document.createElement('canvas'), layer = document.createElement('div');
        wrap.className = 'puPg'; layer.className = 'puLayer'; wrap.style.aspectRatio = vp1.width + ' / ' + vp1.height;
        cv2.width = Math.round(vp.width); cv2.height = Math.round(vp.height);
        wrap.appendChild(cv2); wrap.appendChild(layer);
        var no = document.createElement('div'); no.className = 'puNo'; no.textContent = n + ' / ' + doc.numPages + '쪽'; wrap.appendChild(no);
        if (mine && mine.p === n - 1) {
          var a = vp1.convertToViewportPoint(mine.x, mine.y), b = vp1.convertToViewportPoint(mine.x + mine.w, mine.y + mine.h), d = document.createElement('div');
          d.className = 'puBox'; d.style.left = Math.min(a[0], b[0]) / vp1.width * 100 + '%'; d.style.top = Math.min(a[1], b[1]) / vp1.height * 100 + '%';
          d.style.width = Math.abs(a[0] - b[0]) / vp1.width * 100 + '%'; d.style.height = Math.abs(a[1] - b[1]) / vp1.height * 100 + '%';
          var lb = document.createElement('span'); lb.textContent = '내 서명'; d.appendChild(lb); layer.appendChild(d);
        }
        box.appendChild(wrap);
        return pg.render({ canvasContext: cv2.getContext('2d'), viewport: vp }).promise;
      });
    })(i);
    return chain;
  }
  $('pvBack').onclick = function () { PV.seq++; resetAll(); };
  $('pvSign').onclick = function () { if (PV.e) pdfSignStart(PV.e); };

  function pdfSignStart(e) {
    var ps = e.pdfSign || {};
    edu = { id: e.id, title: e.title, date: e.date, pdf: true }; code = '';
    person = { name: staff.name, disp: staff.disp || '', already: !!ps.signed };
    person.r = { name: person.name, disp: person.disp, already: person.already };
    fillSign(person.r);
    show('s2'); setupCanvas(); clearPad();
    msg($('msg2'), '');
  }

  /* ---------- 완료 PDF: 원본 + 서명 그림을 서명란에 찍어서 저장 ---------- */
  var pdfDlBusy = false;
  function pdfDownload(e) {
    if (pdfDlBusy) return;
    pdfDlBusy = true; msg($('msg1'), e.title + ' PDF 만드는 중…', '#6b7686');
    var fail = function (x) {
      pdfDlBusy = false;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('msg1'), errText(x), '#c0392b');
    };
    srv().withSuccessHandler(function (r) {
      loadJs(PDFLIB_SRC).then(function () { return pdfStamp(r); }).then(function (bytes) {
        pdfDlBusy = false;
        saveFile(r.base + '_서명.pdf', new Blob([bytes], { type: 'application/pdf' }));
        if (r.dl) { e.pdfDl = r.dl; renderEdus(); }
        msg($('msg1'), 'PDF를 저장했습니다. 컴퓨터·휴대폰 다운로드 폴더를 확인하세요.', '#12833b');
      }).catch(fail);
    }).withFailureHandler(fail).pdfGet(staff && staff.token || '', e.id);
  }
  function pdfStamp(r) {
    var L = window.PDFLib;
    return L.PDFDocument.load(b64Bytes(r.pdf), { ignoreEncryption: true }).then(function (doc) {
      var pages = doc.getPages();
      return Promise.all(r.sigs.map(function (s) { return doc.embedPng(b64Bytes(String(s).split(',')[1] || '')); })).then(function (imgs) {
        r.fields.forEach(function (f, i) {
          var pg = pages[f.p], im = imgs[i]; if (!pg || !im) return;
          var sc = Math.min(f.w / im.width, f.h / im.height), w = im.width * sc, h = im.height * sc;
          pg.drawImage(im, { x: f.x + (f.w - w) / 2, y: f.y + (f.h - h) / 2, width: w, height: h });
        });
        return doc.save();
      });
    });
  }
  /* ---------- 업무차량관리 화면과 연결 (차량 화면은 src/car/, 같은 페이지 안의 CARAPP) ----------
   * APP_CAR: 지금 차량 화면이 켜져 있는지 (켜져 있으면 e-싸인의 뒤로가기 기록 쌓기를 멈춤)
   * 처음 주소가 ?car·?car=차량번호·?rec=차량번호면 차량 화면으로 시작
   * e-싸인 화면은 하나라서, 차량 화면으로 떠날 때 그 기록 칸에 그때 화면(sv)을 적어 두고 뒤로가기로 오면 그 화면으로 되돌림
   *   (e-싸인 목록 → 차량관리 → DID → 뒤로 → 뒤로 = 목록) */
  var DID_CAR = false;                               // 차량관리의 [DID]로 들어온 DID 화면: 뒤로가기 = 차량관리로 (뒤로가기 칸을 쌓지 않음)
  window.APP_CAR = (function () { var q = new URLSearchParams(location.search); return q.has('car') || q.has('rec'); })();
  if (window.APP_CAR) document.body.classList.add('carOn');
  window.SIGN_LINK = {
    /** 차량 화면으로 떠나기 직전 (CARAPP.go): 지금 e-싸인 기록 칸에 화면 이름을 적음 */
    mark: function () {
      try { history.replaceState(Object.assign({}, history.state, { sv: curScreen, did: DID_CAR }), ''); } catch (x) {}
    },
    /** 차량 화면에서 e-싸인으로 (kind: 'sign' 서명지 목록, 'kiosk' DID / how: 'push'·'replace' 버튼·링크, 'pop' 뒤로가기, st: 그 기록 칸) */
    show: function (kind, how, st) {
      NAV.skip = 0; NAV.n = how === 'pop' ? (st && st.nav) || 0 : 0;   // 이 기록 칸 위에 쌓인 e-싸인 칸 수
      var logged = !!(staff && staff.token);
      if (how === 'pop') {
        var sv = st && st.sv;                          // 떠날 때 적어 둔 화면 (없으면 지금 화면 그대로)
        if (sv && sv !== curScreen) {
          if (!logged || sv === 'sl') show('sl');
          else if (sv === 'sq') kioskOpen();
          else enterList();
        }
        if (sv === 'sq') DID_CAR = !!st.did;            // 그 DID가 차량관리에서 온 것인지도 그때대로
        navApply();
      }
      else if (!logged) { if (kind === 'kiosk') KIOSK_WANT = true; show('sl'); }   // 로그인 전: 로그인 화면 (로그인 뒤 DID)
      else if (kind === 'kiosk') { kioskOpen(); DID_CAR = true; }   // kioskOpen이 목록을 거쳐 가므로 뒤에 (show가 sq 아닌 화면에서 끔)
      else enterList();
      if (logged && !staff.guest) refreshInit(true);   // 목록은 뒤에서 조용히 새로 (예전에 페이지를 새로 열 때처럼)
    }
  };
  /* ---------- 개인 코드 관리 ---------- */
  $('gstHead').onclick = function () { if ($('gstCard').classList.toggle('open')) admEnsure(function () {}, $('gstMsg')); };   // 지금 아이디는 펼칠 때 받음
  $('gstSave').onclick = function () {
    $('gstSave').disabled = true;
    admCall('adminSetGuest', [{ id: $('gstId').value.trim() }], function (d) {
      var note = d.note; $('gstSave').disabled = false; renderAdmin(d, true); msg($('gstMsg'), note, '#12833b'); msg($('msg1'), '');
    }, $('gstMsg'), function () { $('gstSave').disabled = false; });
  };
  $('pcHead').onclick = function () { $('pcCard').classList.toggle('open'); };
  var pcArm = null, pcStep = 0;
  function pcDisarm() { clearTimeout(pcArm); pcArm = null; pcStep = 0; $('pcReset').textContent = '초기화'; }
  function pcArmNext(text) { clearTimeout(pcArm); pcArm = setTimeout(function () { pcDisarm(); msg($('pcMsg'), ''); }, 10000); $('pcReset').textContent = '한 번 더'; msg($('pcMsg'), text, '#b42318'); }
  $('pcReset').onclick = function () {
    var v = $('pcPin').value.trim();
    if (!v) { msg($('pcMsg'), '초기화할 직원의 사번을 입력하세요.', '#c0392b'); return; }
    if (pcStep === 0) {                            // 첫째: 누구인지 보여 주고 묻기
      $('pcReset').disabled = true;
      admCall('adminPcLookup', [v], function (d) {
        $('pcReset').disabled = false; pcStep = 1;
        pcArmNext(d.label + ' 님을 초기화할까요? 개인 코드와 직원DB 정보가 삭제되고 메일 인증으로 다시 등록해야 합니다. 한 번 더 누르면 실행됩니다.');
      }, $('pcMsg'), function () { $('pcReset').disabled = false; });
      return;
    }
    pcDisarm(); $('pcReset').disabled = true;      // 둘째: 실행
    admCall('adminPcReset', [v], function (d) {
      $('pcReset').disabled = false; $('pcPin').value = ''; msg($('pcMsg'), d.note, '#12833b');
    }, $('pcMsg'), function () { $('pcReset').disabled = false; });
  };
  $('pcPin').addEventListener('input', pcDisarm);

  /* ---------- 관리자 지정 (2등급: 자기 부서 직원을 1등급으로, 3등급: 1·2등급) ---------- */
  /* 카드를 열 때는 서버를 부르지 않음: 고를 수 있는 등급은 로그인 때 받은 내 등급으로. 명단은 [관리자 명단 보기]를 누를 때만 */
  function gdOpen() {
    var my = admLv(), can = my >= 3 ? [2, 1] : [1], sel = $('gdLv'), cur = sel.value; sel.innerHTML = '';
    can.forEach(function (lv) { var o = document.createElement('option'); o.value = lv; o.textContent = lv + '등급'; sel.appendChild(o); });
    if (cur && can.indexOf(Number(cur)) > -1) sel.value = cur;
    $('gdNote').textContent = my >= 3 ? '3등급은 1·2등급을 지정·해제할 수 있습니다 (3등급은 관리 탭에서 직접). 사번을 넣고 [지정]·[해제]를 누르세요. 지정·해제는 그 직원이 다시 로그인하면 반영됩니다.'
      : '2등급은 자기 부서 직원을 1등급으로 지정·해제할 수 있습니다. 휴가 등으로 자리를 비우기 전에 미리 지정해 두세요. 지정·해제는 그 직원이 다시 로그인하면 반영됩니다.';
  }
  function gdDraw(d) {
    var box = $('gdList'); box.innerHTML = ''; box.classList.remove('hidden'); $('gdShow').textContent = '관리자 명단 닫기';
    d.list.forEach(function (a) {
      var row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = '<span class="nm"><small></small><span></span></span><span class="st"></span>';
      row.querySelector('small').textContent = [a.dept, a.disp, a.pin].filter(Boolean).join(' ');
      row.querySelector('.nm span').textContent = a.name + (a.me ? ' (나)' : '');
      row.querySelector('.st').textContent = a.lv + '등급';
      box.appendChild(row);
    });
    if (!d.list.length) box.innerHTML = '<div class="srow"><span class="hint">지정된 관리자가 없습니다.</span></div>';
  }
  function gdHide() { $('gdList').classList.add('hidden'); $('gdList').innerHTML = ''; $('gdShow').textContent = '관리자 명단 보기'; }
  $('gdHead').onclick = function () { if ($('gdCard').classList.toggle('open')) { gdOpen(); gdHide(); msg($('gdMsg'), ''); } };
  $('gdShow').onclick = function () {
    if (!$('gdList').classList.contains('hidden')) { gdHide(); return; }
    $('gdShow').disabled = true;
    admCall('adminGradeList', [], function (d) { $('gdShow').disabled = false; gdDraw(d); }, $('gdMsg'), function () { $('gdShow').disabled = false; });
  };
  function gdRun(lv) {
    var v = $('gdPin').value.trim();
    if (!v) { msg($('gdMsg'), '직원의 사번을 입력하세요.', '#c0392b'); return; }
    $('gdSet').disabled = $('gdOff').disabled = true;
    var end = function () { $('gdSet').disabled = $('gdOff').disabled = false; };
    admCall('adminGradeSet', [v, lv, !$('gdList').classList.contains('hidden')], function (d) {   // 이미 관리자인지·아닌지는 서버가 판단해서 note로 알려 줌
      end(); msg($('gdMsg'), d.note, d.same ? '#b42318' : '#12833b');
      if (!d.same) $('gdPin').value = '';
      if (d.list && !$('gdList').classList.contains('hidden')) gdDraw(d);   // 명단을 펼쳐 둔 때만 새로 그림
    }, $('gdMsg'), end);
  }
  $('gdSet').onclick = function () { gdRun(Number($('gdLv').value) || 1); };
  $('gdOff').onclick = function () { gdRun(0); };

  /* ---------- 휴대폰 키보드: 팝업을 보이는 영역 안에 두고, 입력 칸이 가리지 않게 ---------- */
  (function () {
    var v = window.visualViewport, root = document.documentElement;
    if (!v) return;
    var inPop = function (el) { return el && el.closest && el.closest('.qrBox') && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName); };
    var showField = function () { var el = document.activeElement; if (inPop(el)) el.scrollIntoView({ block: 'center' }); };
    var sync = function () {
      root.style.setProperty('--vvh', v.height + 'px'); root.style.setProperty('--vvt', v.offsetTop + 'px');
      document.body.classList.toggle('kbOpen', window.innerHeight - v.height > 120);
      showField();
    };
    v.addEventListener('resize', sync); v.addEventListener('scroll', sync);
    document.addEventListener('focusin', function () { setTimeout(showField, 300); });
    sync();
  })();

  /* ---------- 시작 ---------- */
  {
    var DIRECT = typeof INIT !== 'undefined' && INIT && INIT.direct;     // 환불 등록 QR(주소?e=…)로 들어온 경우
    var NOQR = typeof INIT !== 'undefined' && INIT && INIT.noQr;         // 환불 주소에 건 번호가 없는 경우
    var enterNew = DIRECT && INIT.enter || '', enterLeft = DIRECT && INIT.enterLeft || 0, initErr = DIRECT && INIT.error || '', qrOld = DIRECT && INIT.qrOld;
    if (typeof INIT !== 'undefined' && INIT) { loadInit(INIT); INIT = null; }
    if (NOQR) showNotice('QR을 찍어 들어오세요', '환불 등록은 현장에 있는 QR을 휴대폰 카메라로 찍어야 할 수 있습니다.');
    else if (!DIRECT) restoreState();
    else {
      var kept = loadState();
      if (kept && kept.rf === DIRECT && (kept.s === 's3' || Number(kept.rz) > Date.now())) restoreState();   // 새로고침: 그 등록 화면(또는 완료 화면)을 그대로, 입력 시간은 이어서
      if (!(rfEdu && rfEdu.id === DIRECT)) {
        var de = edus.filter(function (x) { return x.id === DIRECT && x.refund; })[0];
        if (de && de.open !== false) { rfDirect = true; rfEnter = enterNew; rfEnd = Date.now() + enterLeft; openRefund(de); }
        else if (initErr) showNotice('불러오지 못했습니다', initErr);
        else if (qrOld) showNotice('QR을 다시 찍어 주세요', '환불 등록 QR은 20초마다 바뀝니다. 역 직원 휴대폰 화면의 QR을 지금 다시 찍어 주세요.');
        else showNotice('환불 등록이 마감되었습니다', de ? de.title : '이 QR로는 더 이상 등록할 수 없습니다. 역 직원에게 문의해 주세요.');
      }
    }
  }
})();
}

/* 화면 시작. 평소에는 서버를 기다리지 않고 로그인 화면부터 (목록은 로그인 뒤에 받음).
   환불 등록 QR(주소?e=…)은 입력 화면을 다 받은 뒤에 보여 줌 */
(function () {
  var q = new URLSearchParams(location.search), e = String(q.get('e') || '').replace(/[^\w]/g, '').slice(0, 20);
  var base = { url: SIGN_HOME, educations: [] };      // QR은 이 화면 주소로
  var onRefund = !!e || q.has('rf');                 // 환불 등록 QR(?e=건&k=…), 그 탭을 새로고침(?rf)
  if (onRefund) document.title = '환불 등록';
  var k = String(q.get('k') || '').replace(/[^\w.]/g, '').slice(0, 40), re = '';   // k: 20초마다 바뀌는 QR의 시각·서명
  if (onRefund) {
    // 주소창에서 환불 건 번호를 지움: 주소를 복사해 보내도 QR 없이는 못 들어옴. 이 탭에서 새로고침하면 입력 시간 안(또는 완료 화면)일 때만 이어서
    if (e) { try { history.replaceState(null, '', location.pathname + '?rf'); } catch (x) {} }
    else {
      var kept = null; try { kept = JSON.parse(sessionStorage.getItem('bglSign.v2') || 'null'); } catch (x) {}
      if (kept && kept.rf && kept.rfd && (kept.s === 's3' || Number(kept.rz) > Date.now())) { e = String(kept.rf).replace(/[^\w]/g, '').slice(0, 20); re = String(kept.re || ''); }
    }
  }
  if (!e && onRefund) { START({ noQr: true, educations: [] }); return; }
  if (!e) { START(base); return; }
  document.documentElement.classList.add('rfBoot');
  var go = function (d) {
    d.url = base.url; d.direct = e;
    START(d);
    document.documentElement.classList.remove('rfBoot');
  };
  api('refundInit', [e, k, re]).then(go, function (x) { go({ error: errText(x) || '불러오기 실패', educations: [] }); });
})();
