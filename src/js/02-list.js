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
      var pdfOk = closed && !!(staff && staff.token && !staff.guest);   // 마감된 서명지: 직원은 [PDF] 버튼만 눌러 받기 (카드는 안 눌림)
      var b = document.createElement(pdfOk ? 'div' : 'button');
      b.className = 'person' + (closed ? ' closed' : '') + (e.id === selId ? ' sel' : '');
      b.innerHTML = '<span><b></b><br><span class="rank"></span><span class="cnt1"></span></span>' + (pdfOk ? '<button type="button" class="pdfBtn">📄 PDF</button>' : '<span class="badge"></span>');
      b.querySelector('b').textContent = e.title;
      b.querySelector('.rank').textContent = [e.dept, e.date].filter(Boolean).join(' · ');
      b.querySelector('.cnt1').textContent = '서명 완료 ' + (e.count || 0) + '명';
      if (!pdfOk) b.querySelector('.badge').textContent = closed ? '접수 마감' : '선택';
      if (pdfOk && e.pdfDl) { var dl = document.createElement('span'); dl.className = 'pdfDl'; dl.textContent = '✓ PDF 받음 · ' + (e.pdfDl.n || '') + ' ' + (e.pdfDl.at || ''); b.firstChild.appendChild(document.createElement('br')); b.firstChild.appendChild(dl); }
      if (pdfOk) b.querySelector('.pdfBtn').onclick = function () { eduPdfGet(e); };
      else if (closed) b.disabled = true;
      else b.onclick = function () { openCode(e); };   // 누르면 접속 코드 창
      put(e, b);
    });
    eswNudge();
  }
  // 카드 밀기 첫 사용 힌트: 이 휴대폰에서 처음 한 번, 밀 수 있는 첫 카드가 왼쪽으로 살짝 밀렸다 돌아옴 (목록이 화면에 보일 때만)
  var nudgeT = null;
  function eswNudge() {
    try { if (localStorage.getItem('bglSwHint')) return; } catch (x) { return; }
    clearTimeout(nudgeT);
    nudgeT = setTimeout(function () {
      var w = document.querySelector('#edus .esw');
      if (!w || !w.offsetParent || document.querySelector('#edus .esw.open, #edus .esw.openR')) return;
      try { localStorage.setItem('bglSwHint', '1'); } catch (x) {}
      w.classList.add('nudge');
      setTimeout(function () { w.classList.remove('nudge'); }, 1000);
    }, 600);
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
