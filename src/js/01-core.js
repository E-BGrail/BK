/* ▼▼▼ 여기만 고치세요: 전자서명 웹 앱 배포 주소 (…/exec 로 끝남, 업무차량관리 car.html과 같은 주소) ▼▼▼ */
var API = 'https://script.google.com/macros/s/AKfycbwjudREVuPqSxXknvG5XClW_tQKbD-4wkCJkyeZt0KKY-spuDCymTt9O5j_6L28Z9QK/exec';
/* ▲▲▲ */
/* GitHub Pages용 전자서명 화면: 구글 웹 앱 화면 위의 '구글 사용자가 만든 앱' 알림 없이 열림.
   화면은 여기, 저장·조회는 전자서명 Apps Script(doPost {fn:'sign'})가 처리 */
var SIGN_HOME = location.origin + location.pathname;
/** 서버 함수 호출 (text/plain POST: 다른 주소에서도 사전 요청 없이) */
function signCall(name, args) {
  return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'sign', name: name, args: args }) })
    .then(function (r) { if (!r.ok) throw new Error('서버 응답 오류 (' + r.status + ')'); return r.json(); },
          function () { throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.'); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || '오류가 났습니다.'); return j.data; });
}
/** google.script.run 흉내: 화면 코드는 그대로 두고 서버 호출만 fetch로 */
function signRunner(ok, fail) {
  return new Proxy({}, { get: function (_, k) {
    if (k === 'withSuccessHandler') return function (f) { return signRunner(f, fail); };
    if (k === 'withFailureHandler') return function (f) { return signRunner(ok, f); };
    if (typeof k !== 'string') return undefined;
    return function () {
      signCall(k, [].slice.call(arguments)).then(function (d) { if (ok) ok(d); }, function (e) { if (fail) fail(e); });
    };
  } });
}
window.google = { script: { get run() { return signRunner(null, null); } } };

function START(INIT) {
/** 오른쪽 위 전환 버튼 [전자서명][업무차량관리]: 누른 쪽에 불이 들어오며 그 화면으로 이동 */
var swAllowed = false;
function appSwitch(sw, here, urls) {
  var gone = false;
  [].forEach.call(sw.querySelectorAll('.sw'), function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var k = b.dataset.k;
      if (!swAllowed || gone || k === here || !urls[k]) return;   // 로그인 전·배포용 아이디는 눌러도 반응 없음
      gone = true; sw.classList.add('go');
      [].forEach.call(sw.querySelectorAll('.sw'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      setTimeout(function () { window.open(urls[k], '_top'); }, 220);
      setTimeout(function () {                               // 이동이 안 됐을 때(뒤로 오기 등) 원래대로
        gone = false; sw.classList.remove('go');
        [].forEach.call(sw.querySelectorAll('.sw'), function (x) { var on = x.dataset.k === here; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      }, 4000);
    });
  });
}
var CAR_PAGE = (INIT && INIT.carPage) || '';     // INIT는 첫 화면을 그린 뒤 지워지므로 따로 보관
if (CAR_PAGE) appSwitch(document.getElementById('appSw'), 'sign', { car: CAR_PAGE });
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var drawn = 0, drawing = false, last = null, submitting = false;   // submitting: 서명 제출 중 (서명 칸·지우기·뒤로 막음)
  var edus = [], selId = '', code = '', edu = null, person = null;
  var staff = null;                      // 로그인: { token, name, disp, admin } 또는 배포용 아이디 { token, guest: true } (이 탭에서만 기억, 개인 코드는 저장 안 함)
  try { staff = JSON.parse(sessionStorage.getItem('bglStaff') || 'null'); } catch (x) {}
  var ACT_KEY = 'bglAct', lastAct = 0, lastPing = 0, lastSave = 0;   // 마지막 동작 시각 (이 탭에서만), 서버에 '사용 중' 알린 시각
  try { lastAct = Number(sessionStorage.getItem(ACT_KEY)) || 0; } catch (x) {}
  if (staff && (!staff.token || !staff.ttl || Date.now() - lastAct > staff.ttl * 1000)) staff = null;   // 예전 표시·마지막 동작 후 20분 지난 로그인

  function show(id) {
    ['sl', 's1', 'sp', 's2', 's3', 'sf', 'sx', 'sa', 'so', 'sr', 'sk'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    var flow = ['s1', 's2', 's3'], at = id === 'sp' ? 1 : flow.indexOf(id), adminScr = ['sa', 'so', 'sr'].indexOf(id) > -1;
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
    var swOn = !!(CAR_PAGE && (id === 's1' || id === 'sl') && !adminScr && !(typeof DIALOG !== 'undefined' && DIALOG));   // 로그인·서명지 목록에서 전환 버튼
    swAllowed = !!(swOn && id === 's1' && staff && staff.token && !staff.guest);
    $('appSw').classList.toggle('hidden', !swOn); document.querySelector('header h1').classList.toggle('hidden', swOn);
    document.documentElement.classList.toggle('noPull', id === 'sk');
    if (id !== 'sk') document.body.classList.remove('skSig');
    if (id !== 's2' && id !== 'sk') landOff();
    window.scrollTo(0, 0);
    curScreen = id; saveState();
    navSync();
  }

  /* ---------- 새로고침해도 지금 화면 유지 ----------
     이 탭(창)에서만 기억 (sessionStorage): 탭을 닫으면 지워짐. 처음으로·나가기·서명 완료 시 필요한 것만 남김 */
  var curScreen = 'sl', KEEP = 'bglSign.v2';
  function saveState() {
    if (typeof DIALOG !== 'undefined' && DIALOG) return;   // 시트 메뉴 창에서는 기억하지 않음
    try {
      var st = { s: curScreen, edTab: edTab };
      if (edu && code && ['sp', 's2', 's3'].indexOf(curScreen) > -1) { st.edu = edu; st.code = code; st.name = $('name').value; st.gd = $('gDept').value; st.gr = $('gRank').value; st.go = $('gRole').value; st.gn = $('gNoteIn').value; }
      if (curScreen === 's2' && person) { st.person = JSON.parse(JSON.stringify(person));
        st.strokes = strokes; st.vw = vw; st.vh = vh; st.drawn = drawn; }
      if (curScreen === 's3') st.done = { who: $('doneWho').textContent, msg: $('doneMsg').textContent };
      if (curScreen === 'sk' && sk) { st.sk = sk.id; st.skSt = skStep !== 'pick' && skSigMode !== 'lead' && skSt ? skSt.st : ''; }
      if (skL && !$('skView').classList.contains('hidden')) { st.skL = skL.id; st.skLi = skL.idx; }
      if (rfEdu && (curScreen === 'sf' || curScreen === 's3')) { st.rf = rfEdu.id; st.rfd = rfDirect; st.re = rfEnter; st.rz = rfEnd; }          // 환불 등록: 어느 등록인지만 (입력값·연락처는 저장 안 함)
      if (admTok && ['sa', 'so', 'sr'].indexOf(curScreen) > -1) {
        st.admTok = admTok; st.admOrder = admOrder; st.admOpen = admOpen; st.admInfo = admInfo; st.admTab = admTab; st.admMe = admMe;
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
    if (st.admTok && staff) {        // 관리자 화면: 직원 로그인·관리자 표시가 살아 있으면 그대로 다시 열기 (2시간 지나면 처음 화면)
      admTok = st.admTok; admOrder = st.admOrder || {}; admOpen = st.admOpen || {}; admInfo = st.admInfo || {}; admTab = st.admTab || 'open'; admMe = st.admMe || null;
      show('sa'); msg($('aMsg'), '불러오는 중…', '#6b7686');
      google.script.run.withFailureHandler(function () {
        admTok = null; resetAll();
        msg($(staff ? 'msg1' : 'lgMsg'), '관리자 접속 시간이 지나 처음 화면으로 돌아왔습니다. 서명지 목록의 열차를 왼쪽으로 밀어 다시 들어오세요.', '#c0392b');
      }).withSuccessHandler(function (d) {
        msg($('aMsg'), ''); renderAdmin(d);
        if (st.s === 'so' && st.ordId && ordEduById(st.ordId)) openOrder(st.ordId);
        else if (st.s === 'sr' && st.r) {
          admCall('adminRoleData', [st.r.id], function (rd) {
            loadRoleData(rd);
            rAssign = st.r.assign || rAssign; $('rHead').value = st.r.head != null ? st.r.head : $('rHead').value;
            drawRoles(); show('sr');
          });
        }
      }).adminRefresh(admTok);
      return;
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
    refreshInit();
    if (st.skL) { enterList(); skOpen(st.skL); skLeadOpen(st.skL, st.skLi); return; }   // 팀장 내용 보기 중이었으면 그 역
    if (st.s === 'sk' && st.sk) { enterList(); skOpen(st.sk, false, st.skSt); return; }
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
  function errText(e) { return (e && e.message ? e.message : String(e)).replace(/^Error:\s*/, ''); }
  function msg(el, text, color) { el.style.color = color || ''; el.textContent = text || ''; }

