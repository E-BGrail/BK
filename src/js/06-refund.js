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
    google.script.run.withSuccessHandler(function (r) {
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

