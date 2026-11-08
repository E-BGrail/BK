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
    google.script.run.withSuccessHandler(function (r) {
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
    if (typeof DIALOG !== 'undefined' && DIALOG) return;   // 시트 메뉴 창은 관리자 표시로만
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
      google.script.run.withFailureHandler(function (e) { if (/로그인이 필요/.test(errText(e)) && !signingNow()) logout(errText(e)); }).staffPing(staff.token);
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
    if (staff && staff.token) google.script.run.staffLogout(staff.token);
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
    google.script.run.withSuccessHandler(function (r) {
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
    google.script.run.withSuccessHandler(function (r) {
      $('regMailSend').disabled = false; msg($('regMsgM'), ''); msg($('regMsgC'), '');
      $('regMailShow').textContent = r.mail + ' 로 보냈습니다. 10분 안에 입력하세요.';
      regCodeSet(''); regStage('regCodeStep'); setTimeout(function () { $('regMailCode').focus(); }, 50);
    }).withFailureHandler(function (e) {
      $('regMailSend').disabled = false; msg($('regMsgM'), errText(e), '#c0392b');
    }).empMailSend({ pin: $('regPin').value.trim(), mail: mailId + '@' + regDomain });
  };
  $('regCodeOk').onclick = function () {
    $('regCodeOk').disabled = true; msg($('regMsgC'), '확인 중…', '#6b7686');
    google.script.run.withSuccessHandler(function (r) {
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
    google.script.run.withSuccessHandler(function () {
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
    google.script.run.withSuccessHandler(function (r) {
      $('chgMailSend').disabled = false; $('chgMailSend').textContent = '인증 코드 다시 받기';
      $('chgCodeRow').classList.remove('hidden'); $('chgMailCode').value = ''; $('chgMailCode').focus();
      msg($('chgMsg'), r.mail + ' 로 인증 코드를 보냈습니다. 10분 안에 입력하세요.', '#12833b');
    }).withFailureHandler(function (e) {
      $('chgMailSend').disabled = false; msg($('chgMsg'), errText(e), '#c0392b');
    }).empChangeSend(staff && staff.token || '');
  };
  $('chgCodeOk').onclick = function () {
    $('chgCodeOk').disabled = true; msg($('chgMsg'), '확인 중…', '#6b7686');
    google.script.run.withSuccessHandler(function (r) {
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
    google.script.run.withSuccessHandler(function (r) {
      $('chgSend').disabled = false; chgTicket = ''; $('chgForm').classList.add('hidden');
      $('chgMailSend').textContent = '메일로 인증 코드 받기';
      setStaff({ token: staff.token, name: r.name, disp: r.disp, admin: staff.admin, lv: staff.lv });
      enterList(); refreshInit();
      msg($('chgMsg'), '개인정보를 변경했습니다.', '#12833b');
    }).withFailureHandler(function (e) {
      $('chgSend').disabled = false; msg($('chgMsg'), errText(e), '#c0392b');
    }).empChange({ token: staff && staff.token || '', ticket: chgTicket, name: $('chgName').value, dept: $('chgDept').value, team: $('chgTeam').value, post: $('chgPost').value, rank: $('chgRank').value });
  };

