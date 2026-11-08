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
  var gdArm = null;
  function gdDisarm() { clearTimeout(gdArm); gdArm = null; }
  function gdDraw(d) {
    var sel = $('gdLv'), cur = sel.value; sel.innerHTML = '';
    d.can.slice().reverse().forEach(function (lv) { var o = document.createElement('option'); o.value = lv; o.textContent = lv + '등급'; sel.appendChild(o); });
    if (cur && d.can.indexOf(Number(cur)) > -1) sel.value = cur;
    $('gdNote').textContent = d.myLv >= 3 ? '3등급은 1·2등급을 지정할 수 있습니다 (3등급은 관리 탭에서 직접). 지정·해제는 그 직원이 다시 로그인하면 반영됩니다.'
      : '2등급은 자기 부서(' + (d.dept || '부서 없음') + ') 직원을 1등급으로 지정할 수 있습니다. 휴가 등으로 자리를 비우기 전에 미리 지정해 두세요. 지정·해제는 그 직원이 다시 로그인하면 반영됩니다.';
    var box = $('gdList'); box.innerHTML = '';
    d.list.forEach(function (a) {
      var row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = '<span class="nm"><small></small><span></span></span><span class="st"></span><button class="x" title="관리자 해제">✕</button>';
      row.querySelector('small').textContent = [a.dept, a.disp].filter(Boolean).join(' ');
      row.querySelector('.nm span').textContent = a.name + (a.me ? ' (나)' : '');
      row.querySelector('.st').textContent = a.lv + '등급';
      var x = row.querySelector('.x');
      if (a.me || a.lv >= d.myLv) x.remove();
      else x.onclick = function () {
        if (gdArm !== a.pin) { gdDisarm(); gdArm = a.pin; setTimeout(function () { if (gdArm === a.pin) { gdArm = null; msg($('gdMsg'), ''); } }, 10000); msg($('gdMsg'), a.name + ' 님을 관리자에서 해제할까요? ✕를 한 번 더 누르면 해제됩니다.', '#b42318'); return; }
        gdDisarm(); admCall('adminGradeSet', [a.pin, 0], gdDone, $('gdMsg'));
      };
      box.appendChild(row);
    });
    if (!d.list.length) box.innerHTML = '<div class="srow"><span class="hint">지정된 관리자가 없습니다.</span></div>';
  }
  function gdDone(d) { gdDraw(d); $('gdPin').value = ''; msg($('gdMsg'), d.note, '#12833b'); }
  $('gdHead').onclick = function () { if ($('gdCard').classList.toggle('open')) admCall('adminGradeList', [], gdDraw, $('gdMsg')); };
  $('gdSet').onclick = function () {
    var v = $('gdPin').value.trim();
    if (!v) { msg($('gdMsg'), '지정할 직원의 사번을 입력하세요.', '#c0392b'); return; }
    $('gdSet').disabled = true;
    admCall('adminGradeSet', [v, Number($('gdLv').value) || 1], function (d) { $('gdSet').disabled = false; gdDone(d); }, $('gdMsg'), function () { $('gdSet').disabled = false; });
  };

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
  var DIALOG = false;               // 예전 시트 메뉴 '관리자 페이지' 창 (없앰)
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
  var base = { url: SIGN_HOME, carPage: SIGN_HOME.replace(/[^\/]*$/, '') + 'car.html', educations: [] };   // QR은 이 화면 주소로, 업무차량관리는 같은 저장소의 car.html
  var onRefund = /refund\.html$/.test(location.pathname);               // 환불 등록 QR은 refund.html, e-싸인은 sign.html
  if (e && !onRefund) { location.replace('refund.html' + location.search); return; }
  var k = String(q.get('k') || '').replace(/[^\w.]/g, '').slice(0, 40), re = '';   // k: 20초마다 바뀌는 QR의 시각·서명
  if (onRefund) {
    // 주소창에서 환불 건 번호를 지움: 주소를 복사해 보내도 QR 없이는 못 들어옴. 이 탭에서 새로고침하면 입력 시간 안(또는 완료 화면)일 때만 이어서
    if (e) { try { history.replaceState(null, '', location.pathname); } catch (x) {} }
    else {
      var kept = null; try { kept = JSON.parse(sessionStorage.getItem('bglSign.v2') || 'null'); } catch (x) {}
      if (kept && kept.rf && kept.rfd && (kept.s === 's3' || Number(kept.rz) > Date.now())) { e = String(kept.rf).replace(/[^\w]/g, '').slice(0, 20); re = String(kept.re || ''); }
    }
  }
  if (!e && onRefund) { START({ noQr: true, educations: [] }); return; }
  if (!e) { START(base); return; }
  document.documentElement.classList.add('rfBoot');
  var go = function (d) {
    d.url = base.url; d.carPage = base.carPage; d.direct = e;
    START(d);
    document.documentElement.classList.remove('rfBoot');
  };
  fetch(API + '?api=sign&e=' + encodeURIComponent(e) + (k ? '&k=' + encodeURIComponent(k) : '') + (re ? '&re=' + encodeURIComponent(re) : '')).then(function (r) { return r.json(); })
    .then(function (j) { go(j.ok ? j.data : { error: j.error || '불러오기 실패', educations: [] }); })
    .catch(function () { go({ error: '서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.', educations: [] }); });
})();
