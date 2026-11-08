/* ===================== 업무차량관리 화면 (예전 car.html, 지금은 sign.html 안의 한 화면) =====================
 * 주소: sign.html?car = 차량 목록, ?car=차량번호 = 운행 시작·종료(차량 QR), ?rec=차량번호 = 운행기록 (예전 car.html?… 는 car.html이 여기로 넘김)
 * 화면 하나 = 예전 페이지 하나: 주소가 바뀔 때마다 #carApp 안에 Shadow DOM 칸을 새로 만들고 carMake()를 처음부터 돌림
 *   (예전 car.html을 새로 연 것과 같음, 이전 칸은 카메라·숫자 인식·이벤트를 끄고 버림). 글자 모양은 Shadow DOM이라 e-싸인과 섞이지 않음
 * e-싸인 쪽 연결: 09c-car.js (SIGN_LINK, APP_CAR), 뒤로가기는 03-qr-nav.js popstate가 먼저 CARAPP.pop을 부름
 * 서버 호출·로딩 표시·오류 글은 e-싸인과 같은 api()·busyOn()·errText() (01-core.js 맨 위) */
var CARAPP = (function () {
  var inst = null, seq = 0, title0 = document.title;
  function carUrl(search) { var q = new URLSearchParams(search == null ? location.search : search); return q.has('car') || q.has('rec'); }
  function setOn(on) {
    window.APP_CAR = on;
    document.body.classList.toggle('carOn', on);
    document.title = on ? '업무차량관리' : title0;
  }
  function unmount() { if (inst) { inst.kill(); inst = null; } }
  /** 차량 화면 하나 열기 (search: '?car', '?car=12가1234', '?rec=…'). o.fromHome: 차량관리 안에서 넘어옴 */
  function mount(search, o) {
    o = o || {};
    unmount();
    var id = 'c' + Date.now().toString(36) + (++seq);
    try { history.replaceState({ ci: id }, ''); } catch (x) {}   // 이 칸의 기본 기록 (뒤로가기로 여기 오면 이 칸이 처리)
    var box = document.getElementById('carApp'), host = document.createElement('div');
    box.innerHTML = ''; box.appendChild(host);
    var R = host.attachShadow({ mode: 'open' });
    R.appendChild(document.getElementById('carTpl').content.cloneNode(true));
    var offs = [], dead = false;
    var ctx = {
      id: id, search: search, fromHome: !!o.fromHome,
      dead: function () { return dead; },
      on: function (t, type, fn, opt) { t.addEventListener(type, fn, opt); offs.push(function () { t.removeEventListener(type, fn, opt); }); },
      go: function (s) { if (!dead) go(s); },
      replace: function (s) { if (!dead) replace(s); },
      toSign: function (kind, how) { if (!dead) toSign(kind, how); }
    };
    setOn(true);
    var made = null, me = { id: id, pop: function () {}, skipping: function () { return false; },
      kill: function () { dead = true; if (made) try { made.stop(); } catch (x) {} offs.forEach(function (f) { f(); }); offs = []; host.remove(); } };
    inst = me;
    made = carMake(R, ctx);                            // 시작하자마자 e-싸인으로 넘길 수도 있음 (로그인 전 차량 목록)
    if (dead) { try { made.stop(); } catch (x) {} return; }
    me.pop = made.pop; me.skipping = made.skipping;
  }
  /** 차량관리 안에서 다른 화면으로 (예전 location.href): 새 기록 */
  function go(search) {
    if (!window.APP_CAR && window.SIGN_LINK) SIGN_LINK.mark();   // e-싸인에서 떠남: 뒤로 오면 그때 화면으로
    try { history.pushState(null, '', location.pathname + search); } catch (x) {}
    mount(search, { fromHome: true });
  }
  /** 예전 location.replace: 지금 기록을 바꿈 */
  function replace(search) {
    try { history.replaceState(null, '', location.pathname + search); } catch (x) {}
    mount(search, { fromHome: true });
  }
  /** e-싸인 쪽으로 (kind: 'sign' 서명지 목록, 'kiosk' DID / how: 'push' 새 기록, 'replace' 지금 기록을 바꿈) */
  function toSign(kind, how) {
    unmount();
    try { history[how === 'replace' ? 'replaceState' : 'pushState'](null, '', location.pathname); } catch (x) {}
    setOn(false);
    if (window.SIGN_LINK) SIGN_LINK.show(kind, how);
  }
  /** 뒤로·앞으로 (03-qr-nav.js popstate가 먼저 부름): 처리했으면 true */
  function pop(e) {
    var st = e.state || {};
    if (carUrl()) {
      if (window.APP_CAR && inst && (st.ci === inst.id || inst.skipping())) { inst.pop(); return true; }
      mount(location.search, { fromHome: true });      // 다른 차량 화면의 기록: 그 화면을 새로 (예전에 그 주소를 다시 연 것과 같음)
      return true;
    }
    if (!window.APP_CAR) return false;                 // e-싸인 안에서의 뒤로가기
    unmount(); setOn(false);
    if (window.SIGN_LINK) SIGN_LINK.show('', 'pop', st);
    return true;
  }
  /** 처음 열 때 주소가 차량 화면이면 (e-싸인 START 뒤에 부름) */
  function boot() {
    if (!carUrl()) return;
    var fromHome = false;
    try { fromHome = document.referrer.indexOf(location.origin + location.pathname) === 0; } catch (x) {}
    mount(location.search, { fromHome: fromHome });
  }
  return { go: function (s) { go(s); }, pop: pop, boot: boot, isCarUrl: carUrl };
})();

/** 차량 화면 하나 (예전 car.html의 스크립트 전체). R: 이 화면의 Shadow DOM, ctx: 주소 이동·이벤트 정리
 *  돌려주는 것: stop(버릴 때 카메라·숫자 인식 끔), pop(뒤로가기), skipping(되돌리는 중인지) */
function carMake(R, ctx) {
var INIT = {};
var S = { mode: 'start', km: '', kmImg: '', reason: '', route: '', busy: false };
var ME_KEY = 'bglPin';     // 이 휴대폰에서 마지막으로 쓴 사번 (e-싸인 로그인과 같은 칸)
var $ = function (id) { return R.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n) { return (n === '' || n == null || isNaN(n)) ? '' : Number(n).toLocaleString('ko-KR'); }
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function device() { return { ua: navigator.userAgent, scr: screen.width + 'x' + screen.height, touch: navigator.maxTouchPoints || 0 }; }
var BUSY_TEXT = { carDevLogin: '로그인하는 중', carRemove: '삭제하는 중' };
/** 저장하는 서버 호출: 로딩 표시와 함께 (값 p 하나) */
function call(fn, p) { return busyWrap(api(fn, [p]), BUSY_TEXT[fn] || '데이터 저장 중'); }
function show(id) {
  ['cam', 'cf', 'done', 'pick', 'home', 'rec', 'need'].forEach(function (x) { $(x).classList.toggle('hidden', x !== id); });
  $('chrome').classList.toggle('hidden', id === 'cam');
  $('bandCar').classList.toggle('hidden', id === 'home');     // 첫 화면(차량 목록)은 오른쪽 칩 없음. 운행기록은 오른쪽 칩에 차량번호
  window.scrollTo(0, 0);
  CUR = id; navSync();
}

/* ---------- 휴대폰 [뒤로가기] ----------
 * 화면 단계만큼 브라우저 기록을 쌓아 둠 → 뒤로가기를 누를 때마다 한 단계씩 앞 화면으로
 *   확인 화면 → 다시 촬영, 촬영·완료 화면 → 업무차량관리 첫 화면 (QR로 바로 들어왔을 때. 첫 화면에서 들어왔으면 첫 화면으로 돌아감)
 *   차량 목록·운행기록 화면은 브라우저 기본 동작 */
var CUR = '', NAV = { n: 0, skip: 0, t: null, q: false };
var FROM_HOME = ctx.fromHome;                       // 차량 목록에서 들어옴 (QR로 바로 연 게 아님)
function navDepth() {
  var base = FROM_HOME ? 0 : 1;                     // QR로 바로 들어왔으면 촬영 화면 뒤에 '첫 화면' 한 칸
  return (CUR === 'cf' ? base + 1 : (CUR === 'cam' || CUR === 'done') ? base : 0) + (PIC_ON ? 1 : 0);   // 전표 사진 팝업: 한 칸 더 (뒤로가기 = 닫기)
}
function navSync() {
  if (NAV.q) return;
  NAV.q = true;
  setTimeout(function () {
    NAV.q = false;
    if (NAV.skip > 0 || ctx.dead()) return;
    var want = navDepth();
    while (NAV.n < want) { try { history.pushState({ nav: NAV.n + 1, ci: ctx.id }, ''); NAV.n++; } catch (e) { break; } }
    if (NAV.n > want) {
      var k = NAV.n - want; NAV.n = want; NAV.skip++;
      clearTimeout(NAV.t); NAV.t = setTimeout(function () { if (NAV.skip) { NAV.skip = 0; navSync(); } }, 1500);
      try { history.go(-k); } catch (e) { NAV.skip--; }
    }
  }, 0);
}
function onPop() {                                   // 뒤로가기 (CARAPP.pop이 이 화면의 기록일 때 부름)
  if (NAV.skip > 0) {                                  // 우리가 되돌린 것
    NAV.skip--;
    try { history.replaceState(Object.assign({}, history.state, { ci: ctx.id }), ''); } catch (x) {}   // 되돌아온 칸도 이 화면 것으로
    if (!NAV.skip) navSync(); return;
  }
  if (NAV.n === 0) return;
  NAV.n--;
  if (PIC_ON) { crcPicClose(); return; }                 // 전표 사진 팝업 닫기
  if (S.busy) { navSync(); return; }                                  // 저장 중에는 그대로
  if (CUR === 'cf') openCam();
  else if (CUR === 'cam' || CUR === 'done') { stopCam(); ctx.replace('?car'); }   // 업무차량관리 첫 화면 (로그인 안 했으면 e-싸인 로그인)
}
function loadMe() { try { return localStorage.getItem(ME_KEY) || ''; } catch (e) { return ''; } }
/** 개인 코드 칸: 복사·잘라내기·끌기·길게 눌러 메뉴·선택 막기 (Shadow DOM 안 이벤트라 R에서 받음) */
['copy', 'cut', 'dragstart', 'contextmenu'].forEach(function (t) {
  R.addEventListener(t, function (e) { if (e.target && e.target.classList && e.target.classList.contains('secret')) e.preventDefault(); });
});
R.addEventListener('select', function (e) { var el = e.target; if (el && el.classList && el.classList.contains('secret')) { var n = el.value.length; el.setSelectionRange(n, n); } });
/** 차량번호 + 차종 표시 */
function carLabel(no, model) { return (no || '') + (model ? ' ' + model : ''); }
/** 기기 열쇠: 이 휴대폰으로 e-싸인에 로그인한 적이 있으면 있음 (같은 GitHub 주소라 e-싸인 화면과 같이 씀) */
function devKey() { try { return localStorage.getItem('bglDev') || ''; } catch (e) { return ''; } }
/** 운행 시작 전: 로그인 기록이 없으면 사진을 찍기 전에 안내 */
var NEED_FROM = '';                                    // 'boot': 사진 찍기 전 → 로그인 뒤 카메라, 'submit': 확인 화면에서 → 로그인 뒤 확인 화면
var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
function showNeed(from) {
  NEED_FROM = from || 'boot';
  if (NEED_FROM === 'boot') stopCam();
  $('bandTitle').textContent = '운행 시작'; $('bandCar').textContent = carLabel(INIT.car, INIT.model);
  $('needIos').classList.toggle('hidden', !IOS);
  $('ndPin').value = loadMe(); $('ndPc').value = ''; $('ndMsg').textContent = ''; $('ndReg').classList.add('hidden'); $('ndOk').disabled = false;
  show('need');
}
function needLogin() {
  var pin = $('ndPin').value.trim(), pc = digits($('ndPc').value), m = $('ndMsg');
  if (!pin) { m.textContent = '사번을 입력하세요.'; $('ndPin').focus(); return; }
  if (pc.length !== 6) { m.textContent = '개인 코드 숫자 6자리를 입력하세요.'; $('ndPc').focus(); return; }
  $('ndOk').disabled = true; m.textContent = '';
  call('carDevLogin', { pin: pin, pcode: pc, dev: devKey() }).then(function (r) {
    $('ndOk').disabled = false;
    if (r.unregistered) { m.textContent = unregText(r); $('ndReg').classList.remove('hidden'); return; }
    if (r.needCode) { m.textContent = '코드를 입력해 주세요.'; $('ndPc').focus(); return; }
    try { localStorage.setItem('bglDev', r.dev); } catch (x) {}
    saveMe(pin); $('ndPc').value = '';
    if (NEED_FROM === 'submit') { show('cf'); msg(r.name + ' 님 확인되었습니다. [운행 시작]을 눌러 주세요.'); return; }
    show('cam'); startCam(); openCam();
  }).catch(function (e) { $('ndOk').disabled = false; $('ndPc').value = ''; m.textContent = errText(e); });
}
$('ndOk').addEventListener('click', needLogin);
$('ndPc').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); needLogin(); } });
function saveMe(pin) { try { localStorage.setItem(ME_KEY, pin); } catch (e) {} }
/** 미등록 응답 안내 문구 */
function unregText() { return '등록되지 않은 직원입니다. e-싸인에서 직원 등록을 해 주세요.'; }
/** e-싸인에 직원으로 로그인해 있는지 (같은 탭에서 넘어온 경우) */
function isStaff() { try { var s = JSON.parse(sessionStorage.getItem('bglStaff') || 'null'); return !!(s && s.token); } catch (e) { return false; } }

/* ===================== 시작 ===================== */
/** QR(주소?car=차량번호)로 열리면: 카메라를 먼저 켜고, 그동안 차량 정보를 받아 옴 */
function boot() {
  appSwitch($('appSw'), 'car', {                       // 페이지 이동 없이 같은 화면 안에서
    sign: function () { ctx.toSign('sign', 'push'); }, car: function () { ctx.go('?car'); }, kiosk: function () { ctx.toSign('kiosk', 'push'); }   // DID: e-싸인 안의 DID 화면
  });
  var q = new URLSearchParams(ctx.search), car = q.get('car') || '';
  ROUTE = q.has('rec') ? 'rec' : car ? 'car' : 'home';
  if (!car && !isStaff()) { ctx.toSign('sign', 'replace'); return; }   // 차량 QR이 아니면 로그인부터
  if (q.has('rec')) return showRec(q.get('rec') || '');
  if (!car) return showHome();
  $('camTitle').textContent = '차량 정보 불러오는 중…';
  $('shCar').textContent = car; $('shState').textContent = '확인 중';
  shRows([['이전 종료 km', '…'], ['최근 운행', '…']]);   // 정보가 와도 칸 높이가 그대로이도록 2줄을 미리
  show('cam');
  if (car) startCam();
  api('carInit', [car])
    .catch(function (e) { return { error: errText(e) }; })   // 서버 오류·연결 안 됨 → 차량 고르기 화면에 그 글
    .then(function (d) {
      if (ctx.dead()) return;
      INIT = d;
      INIT.url = location.origin + location.pathname;
      if (INIT.error || INIT.needCar) { stopCam(); return showPick(); }
      setInit(INIT);
      if (S.mode === 'start' && !devKey()) return showNeed('boot');   // 로그인한 적 없는 휴대폰: 운행 시작 불가 (종료는 사번·개인 코드로 그대로)
      if (PENDING) return finishCapture();             // 정보가 오기 전에 이미 촬영함
      openCam();
    });
}
function setInit(init) {
  INIT.st = init.st; INIT.mode = init.mode; INIT.car = init.car; INIT.model = init.model || '';
  if (init.reasons) INIT.reasons = init.reasons;
  if (init.routes) INIT.routes = init.routes;
  S.mode = init.mode;
  S.reason = init.st.freq.reason; S.route = init.st.freq.route;
}
var ROUTE = '';                                       // 이 화면: home 차량 목록, rec 운행기록, car 운행 시작·종료
/** 오른쪽 위 전환 버튼 [e-싸인][차량관리][DID]: 누른 쪽에 불이 들어오며 그 화면으로 (urls 값은 함수)
 *  지금 켜진 버튼(업무차량관리)을 누르면 업무차량관리 첫 화면으로 */
function appSwitch(sw, here, urls) {
  var gone = false, btns = sw.querySelectorAll('.sw');
  var light = function (k) { [].forEach.call(btns, function (x) { var on = x.dataset.k === k; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }); };
  [].forEach.call(btns, function (b) {
    b.href = '#';
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var k = b.dataset.k, fn = urls[k];
      if (gone || !fn) return;
      if (CUR === 'cam' || CUR === 'cf' || CUR === 'done') return;   // 운행 시작·종료 화면에서는 반응 없음
      if (k === here && ROUTE === 'home') return;            // 이미 첫 화면
      gone = true; sw.classList.add('go'); light(k);
      setTimeout(fn, 220);                                   // 불이 들어오는 것을 잠깐 보여 준 뒤
    });
  });
}
ctx.on(window, 'pageshow', function (e) { if (e.persisted) location.reload(); });   // 다른 페이지에서 뒤로 오기: 버튼 불·목록 새로
/** 화면 안 링크(?car=·?rec=·sign.html): 페이지를 새로 열지 않고 같은 화면 안에서 */
R.addEventListener('click', function (e) {
  if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  var a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download')) return;
  var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
  if (u.origin !== location.origin) return;
  var file = u.pathname.replace(/^.*\//, ''), here = location.pathname.replace(/^.*\//, '');
  if (file && file !== here && file !== 'sign.html' && file !== 'car.html' && file !== 'index.html') return;
  e.preventDefault();
  if (CARAPP.isCarUrl(u.search)) ctx.go(u.search); else ctx.toSign('sign', 'push');   // e-싸인에서 직원 등록 등
});

/* ===================== 차량 목록 · 운행 기록 ===================== */
/** 보기용 서버 호출: list 차량 목록, recs 운행 기록 (이름은 이 휴대폰 저장본 열쇠로도 씀) */
function apiGet(fn, car, quiet) {
  var pr = fn === 'list' ? api('carListInfo') : api('carRecs', [car]);
  return quiet ? pr : busyWrap(pr, '데이터 불러오는 중');   // quiet: 저장본을 먼저 그렸으면 뒤에서 조용히
}
/** 빠른 화면: 지난번 받은 값(이 휴대폰에 저장)으로 바로 그리고, 서버 응답이 오면 최신 값으로 다시 그림.
 *  저장본이 있으면 서버 오류는 조용히 넘김 (저장·운행 시작/종료는 언제나 서버에서 확인) */
function cachedGet(fn, car, draw, fail) {
  var key = 'bglCar:' + fn + ':' + (car || ''), old = null, had = false;
  try { old = localStorage.getItem(key); } catch (x) {}
  if (old) { try { draw(JSON.parse(old), true); had = true; } catch (x) { old = null; } }
  apiGet(fn, car, had).then(function (d) {
    var s = JSON.stringify(d);
    try { localStorage.setItem(key, s); } catch (x) {}
    if (s !== old) draw(d, false);
  }).catch(function (e) { if (!had) fail(e); });
}
function stateTag(run) { return run ? '<span class="tag run">운행 중</span>' : '<span class="tag idle">대기 중</span>'; }
/* ---------- 업무차량관리 첫 화면: 차량 목록 (카드마다 주행거리 촬영 · 운행 기록) ---------- */
// 카드 밀기 버튼 아이콘 (선 그림, e-싸인 카드와 같은 모양)
var CAR_IC = {
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  rec: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  rc: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>'
};
function carIc(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CAR_IC[k] + '</svg>'; }
function showHome() {
  show('home');
  $('bandTitle').textContent = '업무차량관리'; $('bandCar').textContent = '';
  cachedGet('list', '', function (d) {
    $('carList2').innerHTML = (d.cars || []).map(function (c) {
      var sub = c.last ? fmt(c.last.km) + ' km' : '운행 기록 없음';      // 주행거리만 (운전자·날짜·시각은 운행 기록에서)
      return '<div class="carSw"><div class="carAct carActL"><button type="button" class="carDel" data-car="' + esc(c.no) + '"' + (c.run ? ' data-run="1"' : '') + '>' + carIc('del') + '<span>차량<br>삭제</span></button></div>' +
        '<div class="carAct carActR"><a class="carRec" href="?rec=' + encodeURIComponent(c.no) + '" aria-label="' + esc(c.no) + ' 운행 기록">' + carIc('rec') + '<span>운행<br>기록</span></a>' +
        '<button type="button" class="carRc" data-car="' + esc(c.no) + '" data-model="' + esc(c.model || '') + '">' + carIc('rc') + '<span>전표<br>등록</span></button></div>' +
        '<div class="carItem card" style="margin:0;box-shadow:none;border:1px solid var(--line)"><span class="ci"><b>' + esc(c.no) + (c.model ? '<span class="carModel">' + esc(c.model) + '</span>' : '') + '</b><small>' + stateTag(c.run) + sub + '</small></span>' +
        '<span class="carBtns"><a class="camBtn big" href="?car=' + encodeURIComponent(c.no) + '" aria-label="' + esc(c.no) + ' 주행거리 촬영">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>주행거리 촬영</a></span></div></div>';
    }).join('') || '<div style="padding:14px;color:var(--sub);font-size:14px">등록된 차량이 없습니다.</div>';
  }, function (e) { $('carList2').innerHTML = '<div class="msg">' + esc(errText(e)) + '</div>'; });
}

/* ---------- 차량 등록(누구나) · 삭제(관리자 사번 + 개인 코드) ---------- */
/** 목록 위 패널(차량 삭제 확인·전표 등록) 하나만 보이기. 차량 등록 박스는 목록 아래에 늘 있음 */
function carPanel(id) { ['carDelBox', 'carRcBox'].forEach(function (x) { $(x).classList.toggle('hidden', x !== id); }); }
/** 패널 닫고 입력칸 비우기 */
function carReset() {
  carSwClose(); carPanel('');
  $('carNote').textContent = ''; $('carNo').value = ''; $('carAddMsg').textContent = ''; $('carDelPw').value = '';
}
function carDone(d) {                                  // 서버가 돌려준 최신 목록으로 저장본을 바꾸고 다시 그림
  try { localStorage.setItem('bglCar:list:', JSON.stringify(d)); } catch (x) {}
  carReset(); showHome();
}
$('carAddOk').onclick = function () {
  var m = /^\s*((?:[가-힣]{2})?\d{2,3}\s*[가-힣]\s*\d{4})\s*(.*?)\s*$/.exec($('carNo').value);   // 한 칸에 '번호 차종' (띄어쓰기 없어도 됨)
  if (!m) { $('carAddMsg').textContent = '차량번호를 바르게 입력하세요. (예: 12가1234 스타리아)'; $('carNo').focus(); return; }
  if (!m[2]) { $('carAddMsg').textContent = '차종도 함께 입력하세요. (예: 12가1234 스타리아)'; $('carNo').focus(); return; }
  var no = m[1].replace(/\s/g, ''), model = m[2];
  $('carAddOk').disabled = true; $('carAddMsg').textContent = '';
  call('carAdd', { car: no, model: model }).then(function (d) { $('carAddOk').disabled = false; carDone(d); },
    function (e) { $('carAddOk').disabled = false; $('carAddMsg').textContent = errText(e); });
};
/* 차량 카드 밀기: 왼쪽 → [운행 기록]·[전표 등록], 오른쪽 → [차량 삭제] (한 번에 한 카드). 민 직후의 누르기와, 열린 카드를 누르면 닫기만 */
var SW = null, swAt = 0;
function carSwClose(except) { [].forEach.call(R.querySelectorAll('#carList2 .carSw.open, #carList2 .carSw.openR'), function (x) { if (x !== except) x.classList.remove('open', 'openR'); }); }
$('carList2').addEventListener('pointerdown', function (e) {
  var c = e.target.closest('.carSw');
  if (!c || e.target.closest('.carAct')) return;
  SW = { c: c, it: c.querySelector('.carItem'), x: e.clientX, y: e.clientY, on: false, start: c.classList.contains('open') ? -96 : c.classList.contains('openR') ? 96 : 0, dx: 0, mouse: e.pointerType === 'mouse' };
  if (SW.mouse && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();   // 마우스: 끄는 동안 글자 선택·끌어 놓기 막음
});
$('carList2').addEventListener('pointermove', function (e) {
  if (!SW) return;
  if (SW.mouse && !(e.buttons & 1)) { swEnd(); return; }   // 버튼을 이미 뗐으면(놓친 pointerup) 끝냄
  var dx = e.clientX - SW.x, dy = e.clientY - SW.y;
  if (!SW.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { SW = null; return; } if (Math.abs(dx) < 10) return; SW.on = true; carSwClose(SW.c); SW.c.classList.add('drag'); if (SW.mouse) try { $('carList2').setPointerCapture(e.pointerId); } catch (x) {} }   // 마우스: 목록 밖에서 버튼을 떼도 끝나게
  SW.dx = dx; SW.it.style.transition = 'none';
  SW.it.style.transform = 'translateX(' + Math.max(-96, Math.min(96, SW.start + dx)) + 'px)';
});
function swEnd() {
  if (!SW) return;
  var s = SW; SW = null;
  if (!s.on) return;
  s.it.style.transition = ''; s.it.style.transform = '';
  setTimeout(function () { s.c.classList.remove('drag'); }, 250);
  var pos = Math.max(-96, Math.min(96, s.start + s.dx));
  s.c.classList.toggle('open', pos < -40); s.c.classList.toggle('openR', pos > 40);
  swAt = Date.now();
}
$('carList2').addEventListener('pointerup', swEnd);
$('carList2').addEventListener('pointercancel', swEnd);
$('carList2').addEventListener('lostpointercapture', swEnd);
$('carList2').addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.carSw')) e.preventDefault(); });
$('carList2').addEventListener('touchmove', function (e) { if (SW && SW.on) e.preventDefault(); }, { passive: false });   // 옆으로 미는 중에는 페이지 스크롤 막음
$('carList2').addEventListener('click', function (e) {
  var c = e.target.closest('.carSw');
  if (Date.now() - swAt < 350 || (c && (c.classList.contains('open') || c.classList.contains('openR')) && !e.target.closest('.carAct'))) {
    e.preventDefault(); e.stopPropagation(); if (Date.now() - swAt >= 350) carSwClose(); return;
  }
}, true);
$('carList2').addEventListener('click', function (e) {
  var b = e.target.closest('.carDel'); if (!b) return;
  carSwClose();
  $('carNote').textContent = '';
  if (b.getAttribute('data-run')) { carPanel(''); $('carNote').style.color = ''; $('carNote').textContent = '운행 종료 후 삭제 가능합니다.'; return; }
  $('carDelNo').textContent = b.getAttribute('data-car'); $('carDelPw').value = ''; $('carDelMsg').textContent = '';
  if (!$('carDelPin').value) $('carDelPin').value = loadMe();
  carPanel('carDelBox'); $($('carDelPin').value ? 'carDelPw' : 'carDelPin').focus();
});
$('carDelNoBtn').onclick = function () { $('carDelPw').value = ''; carPanel(''); };
$('carDelOk').onclick = function () {
  var pin = $('carDelPin').value.trim(), pw = $('carDelPw').value.trim();
  if (!pin) { $('carDelMsg').textContent = '관리자 사번을 입력하세요.'; $('carDelPin').focus(); return; }
  if (!pw) { $('carDelMsg').textContent = '개인 코드를 입력하세요.'; $('carDelPw').focus(); return; }
  $('carDelOk').disabled = true; $('carDelMsg').textContent = '';
  call('carRemove', { car: $('carDelNo').textContent, pin: pin, pcode: pw }).then(function (d) { $('carDelOk').disabled = false; $('carDelPw').value = ''; carDone(d); },
    function (e) { $('carDelOk').disabled = false; $('carDelMsg').textContent = errText(e); });
};

/* ---------- 전표 등록 (차량 카드를 왼쪽으로 밀기): 운행 고르기 → 관리일지 칸(구분·계기판 km·세부내용·금액·비고) → 촬영 → 사번·개인 코드
 * 등록하면 차량관리일지(별지 제3호)에 한 줄. 위 [관리일지 PDF]: 고른 달의 차량관리일지 ---------- */
var CRC = { car: '', id: '', img: '', rows: [], all: [], fuel: [], pics: {} };   // rows: 최근 운행 15개, all: 전체, fuel: 최근 주유 3개, pics: 받아 둔 전표 사진
function crcSync() {
  $('crcForm').classList.toggle('hidden', !CRC.id);
  $('crcThumb').classList.toggle('hidden', !CRC.img); if (CRC.img) $('crcThumb').src = CRC.img;
  $('crcShot').firstChild.nodeValue = CRC.img ? '다시 촬영' : '전표 촬영';
  $('crcOk').disabled = !(CRC.id && CRC.img);
}
$('carList2').addEventListener('click', function (e) {
  var b = e.target.closest('.carRc'); if (!b) return;
  carSwClose();
  CRC = { car: b.getAttribute('data-car'), id: '', img: '', rows: [], all: [], fuel: [], pics: {} };
  ['crcKm', 'crcDetail', 'crcAmt', 'crcNote'].forEach(function (id) { $(id).value = ''; }); $('crcKind').value = '주유';
  $('crcMonth').innerHTML = monthOpts([]); $('crcPdf').disabled = false;
  $('crcTitle').textContent = carLabel(CRC.car, b.getAttribute('data-model')) + ' 기록 선택';
  $('crcPin').value = loadMe(); $('crcPc').value = '';     // 사번만 자동 완성, 코드는 직접 입력
  $('crcMsg').textContent = ''; $('carNote').textContent = ''; $('crcList').textContent = '운행 기록을 불러오는 중…';
  carPanel('carRcBox'); crcSync();
  var car = CRC.car;
  apiGet('recs', car).then(function (d) {
    if (CRC.car !== car) return;
    CRC.all = d.rows || []; CRC.rows = CRC.all.slice(0, 15);   // 최근 운행
    CRC.fuel = CRC.all.filter(function (r) { return r.fuel; }).slice(0, 3);   // 최근 주유 기록 3개 (운행목적 또는 전표 구분이 주유)
    $('crcMonth').innerHTML = monthOpts(CRC.all);
    crcDraw(false);
  }, function (e) { $('crcList').textContent = errText(e); });
});
/** 운행 고르기 목록: 처음엔 최근 주유 기록 3개, [다른 운행 고르기]를 누르면 최근 운행 15개. 전표가 있으면 [전표] 버튼 (누르면 사진 크게) */
function crcDraw(all) {
  var rows = all ? CRC.rows : CRC.fuel;
  var row = function (r) {
    return '<div class="crcItem"><button type="button" class="crcRow' + (r.id === CRC.id ? ' on' : '') + '" data-id="' + esc(r.id) + '">' + esc(r.date + ' ' + r.time + ' · ' + r.driver + ' · ' + r.reason) + '</button>' +
      (r.receipt ? '<button type="button" class="crcPic" data-id="' + esc(r.id) + '" aria-label="전표 사진 보기">' + carIc('rc') + '전표</button>' : '') + '</div>';
  };
  $('crcList').innerHTML = '<div class="crcSub">' + (all ? '최근 운행' : '최근 주유 기록') + '</div>' +
    (rows.map(row).join('') || '<div class="crcSub">' + (all ? '운행 기록이 없습니다.' : '최근 주유 기록이 없습니다.') + '</div>') +
    (!all && CRC.rows.length ? '<button type="button" class="crcMore">다른 운행 고르기</button>' : '');
}
/** 전표 사진 크게 (화면 전체 팝업, 누르거나 뒤로가기로 닫음) */
var PIC_ON = false;
function crcPicOpen(id) {
  var show = function (src) { $('crcPopImg').src = src; $('crcPop').classList.remove('hidden'); PIC_ON = true; navSync(); };
  if (CRC.pics[id]) return show(CRC.pics[id]);
  var car = CRC.car;
  busyWrap(api('carReceipt', [id, car]), '사진 불러오는 중').then(function (d) {
    if (CRC.car !== car) return;
    if (d.img) { CRC.pics[id] = d.img; show(d.img); } else if (d.url) window.open(d.url, '_blank'); else throw new Error('전표 사진이 없습니다.');
  }).catch(function (e) { $('crcMsg').textContent = errText(e); });
}
function crcPicClose() { if (!PIC_ON) return; PIC_ON = false; $('crcPop').classList.add('hidden'); $('crcPopImg').removeAttribute('src'); navSync(); }
$('crcPop').addEventListener('click', crcPicClose);
$('crcList').addEventListener('click', function (e) {
  var pic = e.target.closest('.crcPic'); if (pic) { crcPicOpen(pic.getAttribute('data-id')); return; }
  if (e.target.closest('.crcMore')) { crcDraw(true); return; }
  var b = e.target.closest('.crcRow'); if (!b) return;
  [].forEach.call($('crcList').querySelectorAll('.crcRow'), function (x) { x.classList.toggle('on', x === b); });
  CRC.id = b.getAttribute('data-id');
  var r = CRC.all.filter(function (x) { return x.id === CRC.id; })[0];
  if (r) { $('crcKm').value = r.endKm === '' || r.endKm == null ? '' : String(r.endKm); $('crcKind').value = r.reason === '주유' ? '주유' : $('crcKind').value; }
  crcSync();
});
function crcFileChange() {
  var f = this.files && this.files[0]; this.value = '';
  if (!f) return;
  loadImg(f).then(function (img) {
    var w = Math.min(900, img.naturalWidth), c = document.createElement('canvas');
    c.width = w; c.height = Math.round(img.naturalHeight * w / img.naturalWidth);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); gray(c);
    CRC.img = toJpeg(c, 900) || '';
    $('crcMsg').textContent = CRC.img ? '' : '사진이 너무 큽니다. 전표만 가까이 다시 찍어 주세요.';
    crcSync();
  }).catch(function () { $('crcMsg').textContent = '사진을 열 수 없습니다. 다시 찍어 주세요.'; });
}
$('crcFile').addEventListener('change', crcFileChange);
$('crcFile2').addEventListener('change', crcFileChange);
$('crcNo').onclick = function () { CRC = { car: '', id: '', img: '', rows: [] }; carPanel(''); };
$('crcPdf').onclick = function () { if (CRC.car && $('crcMonth').value) getPdf('mgr', CRC.car, $('crcMonth').value, this); };
$('crcOk').onclick = function () {
  var pc = $('crcPc').value.trim(), pin = $('crcPin').value.trim();
  var m = { kind: $('crcKind').value, km: digits($('crcKm').value), detail: $('crcDetail').value.trim(), amount: digits($('crcAmt').value), note: $('crcNote').value.trim() };
  if (!m.km) { $('crcMsg').textContent = '계기판 km를 입력하세요.'; $('crcKm').focus(); return; }
  if (!m.amount) { $('crcMsg').textContent = '금액을 입력하세요.'; $('crcAmt').focus(); return; }
  if (!pin || !pc) { $('crcMsg').textContent = '사번과 개인 코드를 입력하세요.'; return; }
  $('crcOk').disabled = true; $('crcMsg').textContent = '저장 중…';
  call('carReceiptAdd', { car: CRC.car, id: CRC.id, receipt: CRC.img, pcode: pc, pin: pin, device: device(), mgr: m }).then(function (r) {
    $('crcOk').disabled = false;
    if (r.unregistered) { $('crcMsg').textContent = unregText(r); return; }
    if (r.needCode) { $('crcMsg').textContent = '코드를 입력해 주세요.'; $('crcPc').focus(); return; }
    saveMe(pin);
    var car = CRC.car; CRC = { car: '', id: '', img: '', rows: [] };
    carReset(); $('carNote').style.color = 'var(--ok)'; $('carNote').textContent = car + ' 전표를 등록했습니다.';
  }, function (e) { $('crcOk').disabled = false; $('crcMsg').textContent = errText(e); });
};

/* ---------- 운행기록: 차량별 월 단위 보기 · 엑셀 · 운행일지 PDF ---------- */
var REC = { car: '', data: null, month: '', months: [] };
function showRec(car) {
  show('rec');
  $('bandTitle').textContent = '운행기록'; $('bandCar').textContent = car || '…';
  loadRec(car);
}
function loadRec(car) {
  $('rRows').innerHTML = '<div style="padding:14px 0;color:var(--sub);font-size:14px">불러오는 중…</div>';
  REC.req = car; REC.month = '';
  cachedGet('recs', car, function (d) {
    if (REC.req !== car) return;                       // 그 사이 다른 차량을 고름
    var keep = REC.month;                              // 저장본을 보다가 최신 값이 오면 보던 달 그대로
    REC.data = d; REC.car = d.car; REC.model = d.model || '';
    if (!ctx.dead()) try { history.replaceState(history.state, '', '?rec=' + encodeURIComponent(d.car)); } catch (x) {}   // 기록 칸(ci)은 그대로
    $('bandCar').textContent = carLabel(d.car, d.model);
    // 월 단위 조회: 이번 달 + 기록이 있는 달 (최근 달이 위). 처음엔 이번 달
    var now = new Date(), cur = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2), months = [cur];
    d.rows.forEach(function (r) { var m = r.date.slice(0, 7); if (m && months.indexOf(m) < 0) months.push(m); });
    months.sort().reverse();
    REC.months = months; REC.month = keep && months.indexOf(keep) > -1 ? keep : cur;
    $('rMonth').innerHTML = months.map(function (m) {
      return '<option value="' + m + '">' + m.slice(2, 4) + '년 ' + Number(m.slice(5)) + '월</option>';     // 26년 10월
    }).join('');
    drawRec();
  }, function (e) { if (REC.req === car) $('rRows').innerHTML = '<div class="msg">' + esc(errText(e)) + '</div>'; });
}
/** 달 고르기 칸: 이번 달 + 기록이 있는 달 (최근 달이 위) */
function monthOpts(rows) {
  var now = new Date(), cur = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2), ms = [cur];
  rows.forEach(function (r) { var m = String(r.date || '').slice(0, 7); if (m && ms.indexOf(m) < 0) ms.push(m); });
  ms.sort().reverse();
  return ms.map(function (m) { return '<option value="' + m + '">' + m.slice(2, 4) + '년 ' + Number(m.slice(5)) + '월</option>'; }).join('');
}
/** 양식 모양 PDF 받기: kind run 차량운행일지 / mgr 차량관리일지 (서버가 기준 양식 탭으로 만듦) */
function getPdf(kind, car, month, btn) {
  var t = btn.textContent; btn.disabled = true;
  busyWrap(api('carPdf', [car, kind, month]), 'PDF 만드는 중').then(function (d) {
    btn.disabled = false; btn.textContent = t;
    var bin = atob(d.b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' })); a.download = d.name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }).catch(function (e) { btn.disabled = false; btn.textContent = t; alert(errText(e) || 'PDF를 만들지 못했습니다.'); });
}
$('rPdf').addEventListener('click', function () { if (REC.car && REC.month) getPdf('run', REC.car, REC.month, this); });
function recRows() { var m = REC.month; return (REC.data ? REC.data.rows : []).filter(function (r) { return r.date.slice(0, 7) === m; }); }
function dayText(r) { return r.date ? r.date.slice(2).replace(/-/g, '/') + '(' + r.dow + ')' : ''; }    // 2026-10-29 → 26/10/29(목)
function drawRec() {
  var rows = recRows(), i = REC.months.indexOf(REC.month);
  $('rMonth').value = REC.month;
  $('rPrev').disabled = i >= REC.months.length - 1; $('rNext').disabled = i <= 0;
  $('rXlsx').disabled = !rows.length; $('rPdf').disabled = !rows.length;
  // 엑셀 같은 표 (보고용 운행일지와 같은 열). 양식 모양은 [PDF]로
  $('rRows').innerHTML = rows.length ? '<div class="recTbl"><table><thead><tr><th>날짜</th><th>운전자</th><th>출발 km</th><th>도착 km</th><th>운행거리</th><th>행선지</th><th>운행목적</th><th>특이사항</th></tr></thead><tbody>' +
    rows.map(function (r) {
      return '<tr><td>' + esc(dayText(r)) + '</td><td>' + esc(r.driver) + '</td>' +
        '<td class="n">' + fmt(r.startKm) + '</td><td class="n">' + fmt(r.endKm) + '</td><td class="n"><b>' + fmt(r.dist) + '</b></td>' +
        '<td>' + esc(r.route) + '</td><td>' + esc(r.reason) + '</td>' +
        '<td>' + esc(r.memo || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    : '<div style="padding:14px 0;color:var(--sub);font-size:14px">이 달의 운행 기록이 없습니다.</div>';
}
$('rMonth').addEventListener('change', function () { REC.month = this.value; drawRec(); });
$('rPrev').addEventListener('click', function () { var i = REC.months.indexOf(REC.month); if (i < REC.months.length - 1) { REC.month = REC.months[i + 1]; drawRec(); } });
$('rNext').addEventListener('click', function () { var i = REC.months.indexOf(REC.month); if (i > 0) { REC.month = REC.months[i - 1]; drawRec(); } });

/* 엑셀 내보내기: 보고용 운행일지와 같은 열 (오래된 기록부터) */
var XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise(function (res, rej) {
    var sc = document.createElement('script'); sc.src = XLSX_URL;
    sc.onload = function () { window.XLSX ? res(window.XLSX) : rej(); }; sc.onerror = rej;
    document.head.appendChild(sc);
  });
}
$('rXlsx').addEventListener('click', function () {
  var rows = recRows().slice().reverse(), btn = this;
  if (!rows.length) return;
  var head = ['날짜', '요일', '운전자', '주행거리 출발 시(km)', '주행거리 도착 시(km)', '운행거리(km)', '행선지', '운행목적', '특이사항'];
  var aoa = [head].concat(rows.map(function (r) { return [r.date, r.dow, r.driver, r.startKm, r.endKm, r.dist, r.route, r.reason, r.memo || '']; }));
  var name = '운행일지_' + REC.car + '_' + (REC.month || '전체');
  btn.disabled = true; btn.textContent = '…';
  loadXlsx().then(function (X) {
    var ws = X.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [12, 6, 10, 18, 18, 13, 14, 16, 40].map(function (w) { return { wch: w }; });
    var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, String(REC.car).slice(0, 31));
    X.writeFile(wb, name + '.xlsx');
  }).catch(function () {                              // 엑셀 도구를 못 불러오면 CSV(엑셀에서 열림)로
    var csv = aoa.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }).then(function () { btn.disabled = false; btn.textContent = '엑셀'; });
});

function showPick() {
  show('pick');
  $('bandTitle').textContent = '업무차량관리'; $('bandCar').textContent = INIT.car || '-';
  if (INIT.error) $('pickText').textContent = INIT.error;
  var base = INIT.url || '';
  $('carList').innerHTML = (INIT.cars || []).map(function (c) {
    return '<a href="' + esc(base + '?car=' + encodeURIComponent(c)) + '">' + esc(c) + '</a>';
  }).join('');
}

/* ===================== 카메라 ===================== */
var CAM = { stream: null, track: null, caps: null, hwZoom: 1, dz: 1, zoom: 3, torch: false, on: false };
var OCR = { workers: null, k: 0, n: 0, ready: false, failed: false, loading: false, busy: false, last: null, hits: 0, timer: null };

function shRows(rows) { $('shRows').innerHTML = rows.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join(''); }
function openCam() {
  var st = INIT.st, end = S.mode === 'end';
  $('camTitle').textContent = end ? '운행 종료 · 하차 km' : '운행 시작 · 탑승 km';
  $('shCar').textContent = carLabel(INIT.car, INIT.model);
  $('shState').textContent = end ? '운행 중' : '대기 중';
  $('shState').style.cssText = end ? 'background:#fdebdd;color:#8a3f0a;font-weight:700' : 'background:#e3f4ea;color:#17663a;font-weight:700';
  var rows = end
    ? [['시작 시각', st.run.startAt], ['이전 종료 km', st.last ? fmt(st.last.km) + ' km' : '기록 없음']]
    : [['이전 종료 km', st.last ? fmt(st.last.km) + ' km' : '기록 없음'], ['최근 운행', st.last ? st.last.at : '-']];
  shRows(rows);
  $('live').textContent = ''; $('guide').classList.remove('hit');
  $('cropper').classList.add('hidden'); $('fallback').classList.add('hidden');
  $('camCtl').classList.remove('hidden'); $('guide').classList.remove('hidden'); $('camHint').classList.remove('hidden');
  show('cam');
  startCam();
}

function startCam() {
  if (CAM.on) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camFallback({ name: 'NoApi' });
  try { if (document.featurePolicy && !document.featurePolicy.allowsFeature('camera')) return camFallback({ name: 'Policy' }); } catch (e) {}
  navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
    .then(function (stream) {
      if (ctx.dead() || CUR !== 'cam') { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); return; }   // 그 사이 화면을 떠남: 카메라 바로 끔
      CAM.stream = stream; CAM.track = stream.getVideoTracks()[0]; CAM.on = true;
      var v = $('video'); v.srcObject = stream;
      return v.play().catch(function () {});
    })
    .then(function () {
      if (!CAM.on) return;
      CAM.caps = (CAM.track && CAM.track.getCapabilities) ? CAM.track.getCapabilities() : {};
      $('torch').classList.toggle('hidden', !CAM.caps.torch);
      if ((CAM.caps.focusMode || []).indexOf('continuous') > -1) CAM.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {});   // 자동 초점 (지원하는 기기만)
      setZoom(3);                                  // 기본 3배
      initExposure();                              // 야간 빛 번짐 대비 밝기(노출) 조절
      loadOcr();
      ocrLoop();
      $('fallback').classList.add('hidden'); $('camCtl').classList.remove('hidden'); $('guide').classList.remove('hidden');
    })
    .catch(function (err) { camFallback(err); });
}
function stopCam() {
  CAM.on = false; clearTimeout(OCR.timer); clearTimeout(EXP.timer);
  if (CAM.stream) CAM.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
  CAM.stream = null; CAM.track = null; CAM.torch = false; $('torch').classList.remove('on');
}
function camFallback(err) {
  stopCam();
  var n = err && err.name || '', why = {
    Policy: '이 웹 앱 화면은 실시간 카메라를 허용하지 않습니다 (구글 웹 앱 제한).',
    NoApi: '이 브라우저는 웹 카메라를 지원하지 않습니다. Chrome이나 삼성 인터넷으로 열어 보세요.',
    NotAllowedError: '카메라 권한이 막혀 있습니다. 주소창 왼쪽 자물쇠 → 권한 → 카메라 허용 후 다시 시도하세요.',
    NotFoundError: '사용할 수 있는 카메라를 찾지 못했습니다.',
    NotReadableError: '다른 앱이 카메라를 쓰고 있습니다. 카메라 앱을 닫고 다시 시도하세요.',
    OverconstrainedError: '카메라 설정을 맞추지 못했습니다.'
  }[n] || '';
  $('fbWhy').textContent = why + (n ? ' [' + n + ']' : '');
  $('cropper').classList.add('hidden');
  $('fallback').classList.remove('hidden');
  loadOcr(); $('camCtl').classList.add('hidden'); $('guide').classList.add('hidden'); $('camHint').classList.add('hidden');
}

/** 줌: 카메라가 지원하면 카메라 줌, 모자라거나 안 되면 화면 확대(디지털 줌)로 나머지 배율 */
function setZoom(z) {
  CAM.zoom = z;
  var hw = 1, c = CAM.caps && CAM.caps.zoom;
  if (c && c.max > 1) {
    hw = Math.min(Math.max(z, c.min || 1), c.max);
    try { CAM.track.applyConstraints({ advanced: [{ zoom: hw }] }).catch(function () {}); } catch (e) { hw = 1; }
  }
  CAM.hwZoom = hw; CAM.dz = Math.max(1, z / hw);
  $('video').style.transform = CAM.dz > 1 ? 'scale(' + CAM.dz + ')' : '';
  Array.prototype.forEach.call($('zoom').children, function (b) {
    var on = Number(b.dataset.z) === z; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
}
$('zoom').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setZoom(Number(b.dataset.z)); });
$('torch').addEventListener('click', function () {
  if (!CAM.track) return;
  CAM.torch = !CAM.torch;
  CAM.track.applyConstraints({ advanced: [{ torch: CAM.torch }] }).catch(function () {});
  this.classList.toggle('on', CAM.torch); this.setAttribute('aria-label', CAM.torch ? '플래시 끄기' : '플래시 켜기');
  if (CAM.torch) setOcrState('계기판은 플래시 없이 찍어야 잘 읽혀요 (유리에 반사)');
});

/* ---------- 주간·야간 모드: 저녁 7시~아침 7시는 야간 (카메라 위 버튼으로 바꿀 수 있음, 이 탭에서만 기억) ----------
 * 야간: 계기판 숫자가 스스로 빛나서 하얗게 번짐 → 노출을 크게 낮추고(셔터 속도·감도도 지원하면), 사진 처리에서 번짐을 깎음 */
var NIGHT = (function () {
  try { var v = sessionStorage.getItem('bglCarNight'); if (v === '1' || v === '0') return v === '1'; } catch (e) {}
  var h = new Date().getHours(); return h >= 19 || h < 7;
})();
function dnDraw() { var b = $('dayNight'); b.textContent = NIGHT ? '야간' : '주간'; b.classList.toggle('night', NIGHT); }
dnDraw();
$('dayNight').addEventListener('click', function () {
  NIGHT = !NIGHT; dnDraw();
  try { sessionStorage.setItem('bglCarNight', NIGHT ? '1' : '0'); } catch (e) {}
  if (CAM.on) initExposure();
  setOcrState(NIGHT ? '야간 모드 · 숫자가 또렷하게 보이도록 어둡게 찍습니다' : '주간 모드');
});

/* ---------- 밝기(노출): 처음 어둡게 시작 → 박스 안 밝기에 맞춰 자동 조절 (−/＋를 누르면 수동) ---------- */
var EXP = { ok: false, min: 0, max: 0, step: 0.1, v: 0, auto: true, timer: null, t: null };   // t: 야간 셔터 속도 직접 조절 { min, max, v }
function initExposure() {
  var c = CAM.caps && CAM.caps.exposureCompensation, et = CAM.caps && CAM.caps.exposureTime, modes = (CAM.caps && CAM.caps.exposureMode) || [];
  EXP.ok = !!(c && c.max > c.min);
  EXP.t = null;
  if (NIGHT && et && et.max > et.min && modes.indexOf('manual') > -1) {          // 셔터 속도를 직접 정할 수 있는 휴대폰: 지금 값의 절반에서 시작
    var cur = 0; try { cur = Number(CAM.track.getSettings().exposureTime) || 0; } catch (e) {}
    EXP.t = { min: et.min, max: et.max, v: Math.max(et.min, Math.min(et.max, (cur || (et.min + et.max) / 8) * 0.5)) };
  }
  $('expRow').classList.toggle('hidden', !EXP.ok && !EXP.t);
  if (EXP.ok) { EXP.min = c.min; EXP.max = c.max; EXP.step = c.step || 0.1; }
  EXP.auto = true; $('expAuto').textContent = ' 자동';
  if (EXP.t) setExpTime(EXP.t.v);
  else {
    if (modes.indexOf('continuous') > -1) { try { CAM.track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] }).catch(function () {}); } catch (e) {} }
    if (EXP.ok) setExposure(Math.max(EXP.min, NIGHT ? -2 : -1));                  // 주간 1단계, 야간 2단계 어둡게 시작 (계기판은 자체 발광)
  }
  if (EXP.ok || EXP.t) expLoop();
}
/** 야간: 셔터 속도(노출 시간) 직접, 감도는 가장 낮게 */
function setExpTime(v) {
  var t = EXP.t; if (!t) return;
  t.v = Math.max(t.min, Math.min(t.max, v));
  var k = { exposureMode: 'manual', exposureTime: t.v }, iso = CAM.caps && CAM.caps.iso;
  if (iso && iso.min) k.iso = iso.min;
  try { CAM.track.applyConstraints({ advanced: [k] }).catch(function () {}); } catch (e) {}
  $('expVal').textContent = '셔터';
}
/** 박스 안에서 밝은 쪽(상위 5%)의 밝기 0~255: 계기판 숫자가 하얗게 날아갔는지, 너무 어두운지 봄 */
function brightTop(c) {
  var p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, h = new Array(256).fill(0), n = p.length / 4, left = n * 0.05;
  for (var i = 0; i < p.length; i += 4) h[Math.round(p[i])]++;
  for (var b = 255; b > 0; b--) { left -= h[b]; if (left <= 0) return b; }
  return 0;
}
/** 1초마다 박스 안 밝기를 보고 한 단계씩 보정 (사이에 있으면 그대로) */
function expLoop() {
  clearTimeout(EXP.timer);
  if (!CAM.on || (!EXP.ok && !EXP.t) || !EXP.auto) return;
  EXP.timer = setTimeout(function () {
    var c = null;
    try { c = cropGuide(160); } catch (e) {}
    if (c && CAM.on && EXP.auto) {
      // 밝은 쪽(숫자) 목표: 주간 150~225, 야간 110~190 (야간은 숫자가 하얗게 날지 않게 낮게)
      var b = brightTop(c), d = Math.max(EXP.step, 0.3), hi = NIGHT ? 190 : 225, lo = NIGHT ? 110 : 150;
      if (EXP.t) { if (b > hi) setExpTime(EXP.t.v * 0.7); else if (b < lo) setExpTime(EXP.t.v * 1.4); }
      else if (b > hi && EXP.v > EXP.min) setExposure(EXP.v - d);
      else if (b < lo && EXP.v < EXP.max) setExposure(EXP.v + d);
    }
    expLoop();
  }, 1000);
}
function expManual(d) {
  EXP.auto = false; clearTimeout(EXP.timer); $('expAuto').textContent = ' 수동';
  if (EXP.t) setExpTime(EXP.t.v * (d > 0 ? 1.4 : 0.7)); else setExposure(EXP.v + d);
}
function setExposure(v) {
  v = Math.max(EXP.min, Math.min(EXP.max, Math.round(v / EXP.step) * EXP.step));
  EXP.v = v;
  var modes = (CAM.caps && CAM.caps.exposureMode) || [], k = { exposureCompensation: v };
  if (modes.indexOf('continuous') > -1) k.exposureMode = 'continuous';
  try { CAM.track.applyConstraints({ advanced: [k] }).catch(function () {}); } catch (e) {}
  $('expVal').textContent = (v > 0 ? '+' : '') + v.toFixed(1);
}
$('expDn').addEventListener('click', function () { expManual(-Math.max(EXP.step, 0.3)); });
$('expUp').addEventListener('click', function () { expManual(Math.max(EXP.step, 0.3)); });
/** 가이드 박스 영역을 영상에서 잘라 캔버스로 (흑백) */
function cropGuide(outW) {
  var v = $('video'), view = $('view'), g = $('guide');
  var vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return null;
  var W = view.clientWidth, H = view.clientHeight;
  var s = Math.max(W / vw, H / vh) * CAM.dz;                    // object-fit:cover + 화면 확대
  var ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  var vr = view.getBoundingClientRect(), gr = g.getBoundingClientRect();
  var sx = (gr.left - vr.left - ox) / s, sy = (gr.top - vr.top - oy) / s, sw = gr.width / s, sh = gr.height / s;
  var outH = Math.round(outW * sh / sw);
  var c = document.createElement('canvas'); c.width = outW; c.height = outH;
  var x = c.getContext('2d');
  x.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH);
  return gray(c);
}
function gray(c) {
  var x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (var i = 0; i < p.length; i += 4) { var l = p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114; p[i] = p[i + 1] = p[i + 2] = l; }
  x.putImageData(d, 0, 0);
  return c;
}
/** 저장용 JPEG: 셀 한도(48,000자) 안으로 품질·크기를 낮춰 가며 */
function toJpeg(c, maxW) {
  var w = Math.min(maxW, c.width), q = 0.75, out = '';
  for (var k = 0; k < 12; k++) {
    var t = document.createElement('canvas'); t.width = w; t.height = Math.round(c.height * w / c.width);
    var x = t.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, t.width, t.height); x.drawImage(c, 0, 0, t.width, t.height);
    out = t.toDataURL('image/jpeg', q);
    if (out.length <= 47000) return out;
    if (q > 0.4) q -= 0.12; else w = Math.round(w * 0.85);
  }
  return out.length <= 47000 ? out : '';
}

/** 촬영: 박스 영역을 흑백으로 저장하고 확인 화면으로 (숫자는 사진을 보고 숫자 패드로 입력) */
/* ===================== 숫자 자동 인식 (Tesseract.js, 폰 안에서 무료) =====================
 * 디지털(7세그먼트·LCD) 숫자 모델과 영문 모델을 함께 띄워 화면마다 번갈아 읽음 (둘 중 먼저 준비된 것부터)
 * 디지털 숫자 모델: github.com/Shreeshrii/tessdata_ssd 의 ssd_int (1.4MB) */
var OCR_SSD = 'https://cdn.jsdelivr.net/gh/Shreeshrii/tessdata_ssd@master';
function loadOcr() {
  if (OCR.workers || OCR.failed || OCR.loading) return;
  OCR.loading = true; OCR.workers = []; OCR.k = 0;
  var to = setTimeout(function () { if (!OCR.ready) ocrFail(); }, 25000), left = 2;
  var add = function (lang, opt) {
    return Tesseract.createWorker(lang, 1, opt).then(function (w) {
      if (ctx.dead()) { try { w.terminate(); } catch (e) {} return; }   // 그 사이 화면을 떠남
      return w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '7' }).then(function () {
        OCR.workers.push({ w: w, lang: lang });
        if (!OCR.ready) { clearTimeout(to); OCR.ready = true; if (CAM.on) setOcrState('박스 안 숫자를 읽는 중 · 가운데 버튼으로 바로 촬영 가능'); }
      });
    }).catch(function () {}).then(function () { if (--left === 0 && !OCR.ready) { clearTimeout(to); ocrFail(); } });
  };
  var go = function () { add('ssd_int', { langPath: OCR_SSD, gzip: false }); add('eng', {}); };
  if (window.Tesseract) return go();                   // 앞 화면에서 이미 받음
  var sc = document.createElement('script');
  sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  sc.onload = go;
  sc.onerror = function () { clearTimeout(to); ocrFail(); };
  document.head.appendChild(sc);
}
/** 다음에 쓸 인식기 (번갈아) */
function ocrWorker() { var a = OCR.workers || []; return a.length ? a[(OCR.k++) % a.length] : null; }
function ocrFail() { OCR.failed = true; setOcrState('자동 인식을 쓸 수 없어요 · 가운데 버튼으로 촬영하세요'); }
function setOcrState(t) { $('ocrState').textContent = t; }
/** 인식용 전처리: 이진화(오츠) → 글자 검정·배경 흰색, 여백 */
/** 인식용 흑백: 자동 기준(Otsu)에서 숫자 쪽으로 기준을 옮겨 번짐을 잘라 내고, 디지털 숫자 모델은 끊어진 획을 두껍게 이어 붙임
 *  (가짜 야간 사진 시험: 디지털 숫자는 기준 0.3~0.55 + 글자 높이의 1/50 두께 잇기, 일반 글꼴은 기준 0.55 + 1칸이 가장 잘 읽힘)
 *  v: 강도 0·1 (화면마다 번갈아), seg: 디지털(7세그먼트) 숫자 모델용 */
function prepOcr(c, v, seg) {
  var x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Array(256).fill(0), n = p.length / 4, sum = 0, i;
  for (i = 0; i < p.length; i += 4) { hist[p[i] | 0]++; sum += p[i]; }
  var sumB = 0, wB = 0, best = 0, thr = 127;
  for (var t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; var wF = n - wB; if (!wF) break;
    sumB += t * hist[t]; var mB = sumB / wB, mF = (sum - sumB) / wF, bt = wB * wF * (mB - mF) * (mB - mF);
    if (bt > best) { best = bt; thr = t; }
  }
  var dark = 0;
  for (i = 0; i < p.length; i += 4) if (p[i] <= thr) dark++;
  var inv = dark > n / 2;
  // 기준을 숫자 쪽으로: 밝은 숫자(어두운 바탕)면 더 밝은 쪽, 어두운 숫자면 더 어두운 쪽 (번짐은 숫자보다 흐림). 야간은 더 세게
  var f = NIGHT ? (v ? 0.55 : 0.3) : (v ? 0.3 : 0);
  if (f) {
    if (inv) { var top = 255; while (top > thr && !hist[top]) top--; thr = Math.round(thr + (top - thr) * f); }
    else { var bot = 0; while (bot < thr && !hist[bot]) bot++; thr = Math.round(thr - (thr - bot) * f); }
  }
  var W = c.width, H = c.height, ink = new Uint8Array(n);
  for (i = 0; i < n; i++) { var on = p[i * 4] > thr; ink[i] = inv ? (on ? 1 : 0) : (on ? 0 : 1); }   // 1 = 글자
  // 획 잇기(두껍게): 디지털 숫자 모델은 글자 높이의 약 1/50만큼, 영문 모델은 야간만 1칸
  var grows = seg ? Math.max(1, Math.round(H / 50)) : NIGHT ? 1 : 0;
  for (var gi = 0; gi < grows; gi++) {
    var grow = new Uint8Array(n);
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
      var k = yy * W + xx;
      grow[k] = ink[k] || (xx > 0 && ink[k - 1]) || (xx < W - 1 && ink[k + 1]) || (yy > 0 && ink[k - W]) || (yy < H - 1 && ink[k + W]) ? 1 : 0;
    }
    ink = grow;
  }
  for (i = 0; i < n; i++) { var g = ink[i] ? 0 : 255; p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = g; }
  x.putImageData(d, 0, 0);
  var o = document.createElement('canvas'); o.width = c.width + 40; o.height = c.height + 40;
  var ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, o.width, o.height); ox.drawImage(c, 20, 20);
  return o;
}
/** 기대값: 이전 운행 종료 km (종료 때는 탑승 km가 있으면 그것) */
function expectKm() {
  var st = INIT.st; if (!st) return null;
  if (S.mode === 'end' && st.run && st.run.startKm != null) return st.run.startKm;
  return st.last ? st.last.km : null;
}
/** 읽은 글자에서 주행거리 후보: 기대값 이상·+3,000 이내, 기대값이 없으면 5자리 이상 */
function pickKm(text) {
  var runs = String(text || '').match(/\d{3,7}/g) || [], exp = expectKm(), best = null;
  runs.forEach(function (r) {
    var v = Number(r);
    if (exp != null) { if (v < exp || v > exp + 3000) return; } else if (r.length < 5) return;
    if (best == null || (exp != null ? Math.abs(v - exp) < Math.abs(best - exp) : r.length > String(best).length)) best = v;
  });
  return best;
}
/** 카메라 화면에서 계속 읽다가 같은 숫자가 2번 연속 나오면 자동 촬영 */
function ocrLoop() {
  clearTimeout(OCR.timer);
  if (!CAM.on) return;
  if (!OCR.ready || OCR.busy || !INIT.st) { OCR.timer = setTimeout(ocrLoop, 400); return; }
  var c = cropGuide(640);
  if (!c) { OCR.timer = setTimeout(ocrLoop, 300); return; }
  OCR.busy = true; OCR.n = (OCR.n || 0) + 1;
  var ow = ocrWorker();
  ow.w.recognize(prepOcr(c, (OCR.n >> 1) & 1, ow.lang !== 'eng')).then(function (r) {
    OCR.busy = false;
    if (!CAM.on) return;
    var v = pickKm(r && r.data && r.data.text);
    if (v == null) { OCR.last = null; OCR.hits = 0; $('live').textContent = ''; $('guide').classList.remove('hit'); }
    else {
      OCR.hits = v === OCR.last ? OCR.hits + 1 : 1; OCR.last = v;
      $('live').textContent = fmt(v); placeLive();
      var ex = expectKm(), near = ex != null && v - ex <= 300;   // 이전 km에서 300km 안이면 한 번에, 아니면 같은 값 두 번
      if (OCR.hits >= (near ? 1 : 2)) { $('guide').classList.add('hit'); setOcrState('인식 완료 · 자동 촬영'); return capture(v); }
    }
    OCR.timer = setTimeout(ocrLoop, 250);
  }).catch(function () { OCR.busy = false; OCR.timer = setTimeout(ocrLoop, 800); });
}
function placeLive() {
  var vr = $('view').getBoundingClientRect(), gr = $('guide').getBoundingClientRect();
  $('live').style.top = (gr.bottom - vr.top + 8) + 'px';
}
/** 사진 한 장을 한 번 읽기 (최대 4초) */
function ocrOnce(c, cb) {
  if (!OCR.ready || OCR.busy || !c) return cb(null);
  var done = false, fin = function (v) { if (done) return; done = true; cb(v); };
  OCR.busy = true;
  var ws = OCR.workers.slice(), src = c, tryNext = function (i) {   // 사진 한 장: 인식기를 차례로 (먼저 읽힌 값)
    if (i >= ws.length || done) { OCR.busy = false; return fin(null); }
    var cc = document.createElement('canvas'); cc.width = src.width; cc.height = src.height; cc.getContext('2d').drawImage(src, 0, 0);
    ws[i].w.recognize(prepOcr(cc, 0, ws[i].lang !== 'eng')).then(function (r) { var v = pickKm(r && r.data && r.data.text); if (v != null) { OCR.busy = false; fin(v); } else tryNext(i + 1); })
      .catch(function () { tryNext(i + 1); });
  };
  tryNext(0);
  setTimeout(function () { OCR.busy = false; fin(null); }, 4000);
}

/** 촬영: 박스 영역을 흑백으로 저장하고 확인 화면으로. 종료 때는 인식한 숫자를 하차 km에 미리 채움 */
var PENDING = null;     // 차량 정보가 오기 전에 찍은 사진 { img, km }
function capture(km) {
  var c = cropGuide(600);
  if (!c) return;
  PENDING = { img: toJpeg(c, 600), km: km == null ? null : km };
  stopCam();
  if (!INIT.st) { $('camTitle').textContent = '촬영됨 · 차량 정보 확인 중…'; setOcrState('잠시만 기다려 주세요'); return; }   // boot()에서 이어서
  finishCapture();
}
function finishCapture() {
  var p = PENDING; PENDING = null;
  if (S.mode === 'start') S.km0 = null;
  S.kmImg = p.img;
  S.ocrKm = p.km;
  S.km = S.mode === 'end' && p.km != null ? String(p.km) : '';
  openConfirm();
  focusKm();
}
function defaultKm() { return ''; }
/** 종료 때만 하차 km 칸에 숫자 패드 (시작은 사진만) */
function focusKm() { if (S.mode !== 'end') return; var k = $('km'); try { k.focus(); k.select(); } catch (e) {} }
$('shutter').addEventListener('click', function () {
  if (!CAM.on) return;
  setOcrState('숫자 읽는 중…');
  ocrOnce(cropGuide(640), capture);
});
function manualKm() { if (!INIT.st) return; stopCam(); S.km = defaultKm(); S.kmImg = ''; S.ocrKm = null; openConfirm(); focusKm(); }
$('manual2').addEventListener('click', manualKm);

/** 카메라를 못 열 때: 휴대폰 카메라 앱으로 찍은 사진 → 주행거리 부분에 박스를 맞춰 자르기 */
var CROP = { img: null, cx: 0.5, cy: 0.5 };
function onPhoto() {
  var f = this.files && this.files[0]; this.value = '';
  if (!f) return;
  loadImg(f).then(function (img) {
    var w = Math.min(1600, img.naturalWidth), c = document.createElement('canvas');   // 큰 사진은 줄여서 (메모리)
    c.width = w; c.height = Math.round(img.naturalHeight * w / img.naturalWidth);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    CROP.img = c; CROP.cx = 0.5; CROP.cy = 0.5;
    $('cropImg').src = c.toDataURL('image/jpeg', 0.85);
    $('fallback').classList.add('hidden'); $('cropper').classList.remove('hidden');
    requestAnimationFrame(drawBox);
  }).catch(function () { alert('사진을 열 수 없습니다. 다시 찍어 주세요.'); });
}
$('fileKm').addEventListener('change', onPhoto);
$('fileKm2').addEventListener('change', onPhoto);
$('camRetry').addEventListener('click', function () { $('fallback').classList.add('hidden'); $('camCtl').classList.remove('hidden'); $('guide').classList.remove('hidden'); $('camHint').classList.remove('hidden'); startCam(); });
/** 사진이 화면에 그려진 영역 (object-fit: contain) */
function imgRect() {
  var st = $('cropStage'), W = st.clientWidth, H = st.clientHeight, iw = CROP.img.width, ih = CROP.img.height;
  var s = Math.min(W / iw, H / ih);
  return { x: (W - iw * s) / 2, y: (H - ih * s) / 2, w: iw * s, h: ih * s, s: s };
}
/** 박스: 사진 폭의 (크기)%, 가로:세로 = 3.2:1. 중심(cx, cy)은 사진 안 비율 */
function boxRect() {
  var r = imgRect(), bw = r.w * Number($('cSize').value) / 100, bh = bw / 3.2;
  if (bh > r.h) { bh = r.h; bw = bh * 3.2; }
  var x = r.x + CROP.cx * r.w - bw / 2, y = r.y + CROP.cy * r.h - bh / 2;
  x = Math.max(r.x, Math.min(r.x + r.w - bw, x)); y = Math.max(r.y, Math.min(r.y + r.h - bh, y));
  return { x: x, y: y, w: bw, h: bh, r: r };
}
function drawBox() {
  if (!CROP.img) return;
  var b = boxRect(), el = $('cbox');
  el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.width = b.w + 'px'; el.style.height = b.h + 'px';
}
$('cSize').addEventListener('input', drawBox);
ctx.on(window, 'resize', drawBox);
(function () {
  var st = $('cropStage'), on = false;
  function move(e) {
    if (!CROP.img) return;
    var rr = st.getBoundingClientRect(), r = imgRect();
    CROP.cx = Math.max(0, Math.min(1, (e.clientX - rr.left - r.x) / r.w));
    CROP.cy = Math.max(0, Math.min(1, (e.clientY - rr.top - r.y) / r.h));
    drawBox();
  }
  st.addEventListener('pointerdown', function (e) { on = true; try { st.setPointerCapture(e.pointerId); } catch (x) {} move(e); });
  st.addEventListener('pointermove', function (e) { if (on) move(e); });
  st.addEventListener('pointerup', function () { on = false; });
  st.addEventListener('pointercancel', function () { on = false; });
})();
/** 박스 영역을 원본 사진에서 잘라 흑백 캔버스로 */
function cropPhoto(outW) {
  var b = boxRect(), r = b.r;
  var sx = (b.x - r.x) / r.s, sy = (b.y - r.y) / r.s, sw = b.w / r.s, sh = b.h / r.s;
  var c = document.createElement('canvas'); c.width = outW; c.height = Math.round(outW * sh / sw);
  c.getContext('2d').drawImage(CROP.img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return gray(c);
}
$('cropUse').addEventListener('click', function () {
  if (!CROP.img || !INIT.st) return;
  S.kmImg = toJpeg(cropPhoto(600), 600);
  ocrOnce(cropPhoto(640), function (v) {
    S.ocrKm = v; S.km = S.mode === 'end' && v != null ? String(v) : '';
    $('cropper').classList.add('hidden'); CROP.img = null;
    openConfirm(); focusKm();
  });
});
function loadImg(file) {
  return new Promise(function (res, rej) {
    var u = URL.createObjectURL(file), img = new Image();
    img.onload = function () { URL.revokeObjectURL(u); res(img); };
    img.onerror = function () { URL.revokeObjectURL(u); rej(); };
    img.src = u;
  });
}
ctx.on(document, 'visibilitychange', function () {
  if (document.hidden) stopCam();
  else if (!$('cam').classList.contains('hidden') && $('fallback').classList.contains('hidden') && $('cropper').classList.contains('hidden')) startCam();
});

/* ===================== 확인 화면 ===================== */
function openConfirm(note) {
  var end = S.mode === 'end', st = INIT.st;
  $('bandTitle').textContent = end ? '운행 종료' : '운행 시작';
  $('bandCar').textContent = carLabel(INIT.car, INIT.model);
  $('st1Label').textContent = end ? '하차 km' : '탑승 km';
  $('cfTitle').textContent = end ? '운행 종료 확인' : '운행 시작 확인';
  $('submit').textContent = end ? '운행 종료' : '운행 시작';
  $('cfNote').classList.toggle('hidden', !note); $('cfNote').textContent = note || '';
  // 사진: 시작은 탑승 사진 1장, 종료는 탑승·하차 2장
  var ph = function (src, cap, none) {
    return '<figure><figcaption>' + esc(cap) + '</figcaption>' + (src ? '<img class="ph" alt="' + esc(cap) + ' 사진" src="' + src + '">' : '<div class="none">' + esc(none) + '</div>') + '</figure>';
  };
  $('photos').className = 'photos' + (end ? ' two' : '');
  $('photos').innerHTML = end
    ? ph(st.run.startImg, '탑승 (' + st.run.startAt + ')', '탑승 사진 없음') + ph(S.kmImg, '하차 (지금)', '하차 사진 없음')
    : ph(S.kmImg, '탑승 사진', '사진 없음');
  $('retake').textContent = end ? '하차 사진 다시 촬영' : '탑승 사진 다시 촬영';
  // km: 종료 때만 입력 (탑승 km는 이전 운행 종료 km 자동 입력, 수정 가능 / 하차 km는 직접 입력)
  $('kmInputs').classList.toggle('hidden', !end);
  if (end) {
    var k0 = st.run.startKm != null ? st.run.startKm : (st.last ? st.last.km : '');
    $('km0').value = S.km0 != null ? S.km0 : String(k0);
    $('km').value = S.km;
    kmCheck();
  }
  // 사번·개인 코드는 종료 때만: 사번은 이 휴대폰에서 마지막으로 성공한 값 (다른 사람이면 칸을 고쳐 쓰면 됨), 코드는 직접 입력
  $('idBox').classList.toggle('hidden', !end);
  $('nm').value = loadMe(); $('pc').value = '';
  $('regLink').classList.add('hidden');
  if (!end) $('memo').value = '';
  // 종료: 행선지·운행목적
  $('endBox').classList.toggle('hidden', !end);
  if (end) { drawChips('reasons', INIT.reasons, S.reason); drawChips('routes', INIT.routes, S.route); syncEnd(); }
  msg('');
  show('cf');
}
function kmCheck() {
  var a = digits($('km0').value), b = digits($('km').value), st = INIT.st, el = $('kmCmp');
  if ($('km0').value !== a) $('km0').value = a;
  if ($('km').value !== b) $('km').value = b;
  S.km0 = a; S.km = b;
  el.className = 'cmp';
  var notes = [];
  if (a && st.last && Number(a) !== st.last.km) notes.push('탑승 km가 이전 운행 종료(' + fmt(st.last.km) + ')와 다릅니다');
  if (!a) { el.textContent = '탑승 km를 입력하세요.'; el.classList.add('warn'); return; }
  if (!b) { el.textContent = '사진을 보고 하차 km를 입력하세요.' + (notes.length ? ' · ' + notes[0] : ''); el.classList.add('warn'); return; }
  var d = Number(b) - Number(a);
  if (d < 0) { el.textContent = '하차 km가 탑승 km보다 작습니다. 숫자를 확인하세요.'; el.classList.add('warn'); return; }
  el.innerHTML = '운행거리 <b style="font-size:16px;margin-left:4px">' + fmt(d) + ' km</b>' + (d > 500 ? ' · 숫자를 확인하세요' : '') +
    (S.ocrKm != null && Number(b) === S.ocrKm ? '<br>하차 km는 자동 인식값 · 사진과 같은지 확인하세요' : '') + (notes.length ? '<br>' + esc(notes[0]) : '');
  el.classList.add(d > 500 || notes.length ? 'warn' : 'ok');
}
$('km0').addEventListener('input', kmCheck);
$('km').addEventListener('input', kmCheck);
$('retake').addEventListener('click', function () { openCam(); });
$('pc').addEventListener('input', function () { this.value = digits(this.value).slice(0, 6); });

function drawChips(id, list, sel) {
  $(id).innerHTML = (list || []).map(function (t) {
    var on = t === sel;
    return '<button type="button" data-v="' + esc(t) + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' + esc(t) + '</button>';
  }).join('');
}
$('reasons').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S.reason = b.dataset.v; drawChips('reasons', INIT.reasons, S.reason); syncEnd(); });
$('routes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S.route = b.dataset.v; drawChips('routes', INIT.routes, S.route); syncEnd(); });
function syncEnd() {
  $('reasonEtc').classList.toggle('hidden', S.reason !== '기타');
  $('routeEtc').classList.toggle('hidden', S.route !== '기타');
}

/* ===================== 제출 ===================== */
function msg(t) { $('msg').textContent = t || ''; }
function busy(on) {
  S.busy = on; $('submit').disabled = on;
  $('submit').innerHTML = on ? '<span class="spin"></span>저장 중…' : esc(S.mode === 'end' ? '운행 종료' : '운행 시작');
}
function payload() {
  var end = S.mode === 'end';
  var p = { car: INIT.car, km: end ? digits($('km').value) : (S.ocrKm != null ? String(S.ocrKm) : ''), startKm: end ? digits($('km0').value) : '', img: S.kmImg, device: device() };
  if (!end) p.dev = devKey();
  if (S.mode === 'end') {
    p.pin = $('nm').value.trim(); p.pcode = digits($('pc').value); p.memo = $('memo').value;
    p.id = INIT.st.run.id; p.reason = S.reason; p.reasonEtc = $('reasonEtc').value; p.route = S.route; p.routeEtc = $('routeEtc').value;
  }
  return p;
}
$('submit').addEventListener('click', submit);
function submit() {
  if (S.busy) return;
  var p = payload();
  if (S.mode === 'end' && !p.startKm) { msg('탑승 km를 입력하세요.'); $('km0').focus(); return; }
  if (S.mode === 'end' && !p.km) { msg('하차 km를 입력하세요.'); $('km').focus(); return; }
  if (!p.img && !confirm('사진 없이 진행할까요?')) return;
  if (S.mode === 'end') {
    if (!p.pin) { msg('사번을 입력하세요.'); $('nm').focus(); return; }
    if (p.pcode.length !== 6) { msg('개인 코드 숫자 6자리를 입력하세요.'); $('pc').focus(); return; }
    if (Number(p.km) < Number(p.startKm)) { msg('하차 km가 탑승 km보다 작습니다.'); $('km').focus(); return; }
    if (S.reason === '기타' && !p.reasonEtc.trim()) { msg('운행목적을 입력하세요.'); $('reasonEtc').focus(); return; }
    if (S.route === '기타' && !p.routeEtc.trim()) { msg('행선지를 입력하세요.'); $('routeEtc').focus(); return; }
  }
  S.km = p.km; S.km0 = p.startKm || null;
  msg(''); busy(true);
  call(S.mode === 'end' ? 'carEnd' : 'carStart', p).then(function (r) {
    busy(false);
    if (r.unregistered) { msg(unregText(r)); $('regLink').classList.remove('hidden'); return; }   // 미등록: 운행은 저장되지 않음
    if (r.needCode) { msg('코드를 입력해 주세요.'); $('pc').focus(); return; }
    if (r.needLogin) { try { localStorage.removeItem('bglDev'); } catch (x) {} return showNeed('submit'); }   // 열쇠가 없거나 못 씀 (개인 코드 변경·초기화·사파리가 지움)
    if (r.running) {                                  // 이미 운행 중 → 종료부터
      setInit(r.init); S.mode = 'end';
      return openConfirm('이 차량은 운행 중(' + r.init.st.run.startAt + ' 시작)으로 기록돼 있습니다. 먼저 운행을 종료해 주세요. 방금 찍은 사진을 하차 사진으로 넣었습니다.');
    }
    if (r.notRunning) {                               // 그 사이 다른 사람이 종료 → 새 운행 시작으로
      setInit(r.init); S.mode = 'start';
      return openConfirm('이 차량의 운행은 이미 종료되었습니다. 새 운행을 시작하려면 아래 내용을 확인하세요.');
    }
    if (r.ok) {
      if (p.pin) saveMe(p.pin);     // 다음에 열면 사번 자동 입력
      $('memo').value = '';
      showDone(r);
    }
  }).catch(function (e) {
    busy(false); msg(errText(e));
    if (/코드가 틀렸/.test(errText(e))) $('pc').value = '';
  });
}
function showDone(r) {
  var end = r.mode === 'end';
  $('bandTitle').textContent = end ? '운행 종료' : '운행 시작';
  $('doneTitle').textContent = end ? '운행이 종료되었습니다' : '운행이 시작되었습니다';
  var rows = end
    ? [['차량', carLabel(r.car, INIT.model)], ['운전자', r.name], ['탑승 → 하차', fmt(r.startKm) + ' → ' + fmt(r.km) + ' km'], ['운행거리', fmt(r.dist) + ' km'], ['행선지 · 목적', r.route + ' · ' + r.reason], ['종료 시각', r.at]]
    : [['차량', carLabel(r.car, INIT.model)], ['운전자', r.name || ''], ['시작 시각', r.at], ['km · 행선지 · 목적', '운행 종료 때 입력']];
  $('doneHome').classList.toggle('hidden', !isStaff());   // 차량 목록은 e-싸인에 로그인한 직원만 (QR로만 들어온 운전자는 화면을 닫으면 끝)
  $('doneRows').innerHTML = rows.map(function (x) { return '<div class="kv"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
  show('done');
}
$('doneHome').onclick = function () { stopCam(); ctx.replace('?car'); };   // 업무차량관리 첫 화면 (차량 목록, 로그인한 직원만 보임)

boot();
return {
  stop: function () {                                  // 이 화면을 버릴 때: 카메라·숫자 인식·타이머 끔
    stopCam(); clearTimeout(NAV.t);
    (OCR.workers || []).forEach(function (x) { try { x.w.terminate(); } catch (e) {} });
    OCR.workers = []; OCR.ready = false;
  },
  pop: onPop,
  skipping: function () { return NAV.skip > 0; }
};
}

/* 처음 주소가 차량 화면이면 (e-싸인 START가 끝난 뒤) */
CARAPP.boot();
