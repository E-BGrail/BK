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
  var POPS = ['qrOver', 'codeOver', 'regOver', 'skView', 'admOver'];
  var NAV = { n: 0, skip: 0, t: null, q: false };   // n: 지금 쌓아 둔 칸 수, skip: 우리가 되돌려서 올 popstate 수
  function anyPop() { return POPS.some(function (id) { return !$(id).classList.contains('hidden'); }); }
  function navDepth() {                    // 지금 화면이 원하는 칸 수
    if (typeof DIALOG !== 'undefined' && DIALOG) return 0;   // 시트 메뉴 창
    var id = curScreen;
    if (rfEdu && rfDirect && (id === 'sf' || id === 's3')) return 0;   // 환불 등록 QR로 바로 들어온 승객은 제외
    return ({ sp: 1, s2: edu && (edu.guest || edu.pdf) ? 2 : 1, s3: 1, sf: 1, so: 1, sr: 1, sk: 1, su: 1, sv: 1, sq: 1 })[id] || 0;
  }
  function navApply() {                    // 쌓아 둔 칸을 지금 화면에 맞춤 (같은 순간의 여러 변화는 한 번에)
    if (NAV.q) return;
    NAV.q = true;
    setTimeout(function () {
      NAV.q = false;
      if (NAV.skip > 0) return;            // 되돌리는 중이면 끝난 뒤 다시
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
    } else screenBack();                   // 뒤로가기 → 이전 화면
    navApply();
  }
  try {
    if (window.google && google.script && google.script.history) google.script.history.setChangeHandler(onBack);
    else window.addEventListener('popstate', onBack);
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
    google.script.run.withSuccessHandler(loadInit).withFailureHandler(function (e) { msg($('msg1'), errText(e), '#c0392b'); }).getInit(staff && staff.token || '');
  }
  window.SIGN_RELOAD = loadInit;     // 저장해 둔 목록으로 먼저 그린 뒤 서버 최신 목록으로 바꿈

