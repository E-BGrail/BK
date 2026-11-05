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
    if (e.missingTabs) { var tchip = document.createElement('span'); tchip.className = 'chip off'; tchip.textContent = '탭 없음'; q('.t').appendChild(tchip); }
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
      if (L && P && P.missing) msg(q('.m'), '서명지 탭이 없어 PDF는 만들 수 없습니다. CSV·HTML 파일을 저장하세요. (유효 서명 ' + L.valid + '건, 로그 ' + L.count + '건)', '#c0392b');
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
      google.script.run.withSuccessHandler(function (r) {
        X.log = r; setBtn('.b-csv', 'CSV 저장', true); setBtn('.b-html', 'HTML 저장', true); both();
      }).withFailureHandler(fail).adminExportLog(admTok, e.id);
      if (e.refund) return;                           // 비상 등록: PDF·HTML 없이 CSV만
      google.script.run.withSuccessHandler(function (r) {
        X.pdf = r; if (r.missing) setBtn('.b-pdf', 'PDF 없음 (탭 없음)', false); else setBtn('.b-pdf', 'PDF 저장', true); both();
      }).withFailureHandler(fail).adminExportPdf(admTok, e.id);
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

