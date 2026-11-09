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
    if (!staff) {                                    // 로그인 전
      show('sl');
      api('getInit', ['']).catch(function () {});    // 서버 미리 깨우기: 사번·개인 코드를 넣는 동안 (오래 안 쓴 뒤 첫 호출이 느림, 결과는 안 씀)
      return;
    }
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
  function msg(el, text, color) {
    el.style.color = color || ''; el.textContent = text || '';
    if (text && color === '#12833b') toast(text);    // 결과(완료·저장) 알림은 화면 아래에도 잠깐 (스크롤해 둔 곳에서도 보이게). 오류·진행 중은 칸 옆에만
  }
  var toastT = null;
  function toast(text) {
    var t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.onclick = function () { t.classList.remove('on'); }; document.body.appendChild(t); }
    t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3000);
  }

