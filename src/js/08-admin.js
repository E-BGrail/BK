  /* ---------- 관리자 ---------- */
  /* 관리자 페이지 없음: 관리자로 지정된 직원은 서명지 목록 화면에서 바로 관리 (카드 밀기 [정보 수정]·[내보내기], 새 서명지 열기, 배포용 아이디, 개인 코드 관리)
   * 관리자 정보(양식·서명지 현황)는 처음 필요할 때 한 번만 받음 (admEnsure) → 직원 화면 로딩은 그대로 */
  var admTok = null, admData = null, admExp = {}, admOrder = {};
  var admMe = null;                      // 로그인한 관리자의 { dept, team }: 새 서명지 부서명·팀 기본값
  var PDF_TPL = '__pdf__';               // 새 서명지 양식 고르는 칸의 [PDF 서명지] (누구나)
  var admWait = [], admFails = [];
  function isAdm() { return !!(staff && staff.admin && !staff.guest && staff.token); }
  /** 관리자 접속·정보가 없으면 받은 뒤 cb (여러 번 불러도 서버는 한 번) */
  function admEnsure(cb, m, onFail) {
    if (admTok && admData) { cb(); return; }
    if (!isAdm()) { if (onFail) onFail(); return; }
    m = m || $('msg1');
    admWait.push(cb); if (onFail) admFails.push(onFail);
    if (admWait.length > 1) return;
    msg(m, '관리자 정보 불러오는 중…', '#6b7686');
    var done = function () { var w = admWait; admWait = []; admFails = []; w.forEach(function (f) { f(); }); };
    var fail = function (e) {
      var fs = admFails; admWait = []; admFails = [];
      if (/로그인이 필요/.test(errText(e))) { logout(errText(e)); return; }
      msg(m, errText(e), '#c0392b'); fs.forEach(function (f) { f(e); });
    };
    var login = function () {
      google.script.run.withSuccessHandler(function (r) { admTok = r.token; admMe = r.me || null; msg(m, ''); renderAdmin(r.data, true); saveState(); done(); })
        .withFailureHandler(fail).adminLogin(staff.token);
    };
    if (admTok) google.script.run.withSuccessHandler(function (d) { msg(m, ''); renderAdmin(d, true); done(); })
      .withFailureHandler(function () { admTok = null; login(); }).adminRefresh(admTok);
    else login();
  }
  function admCall(fn, args, onOk, m, onFail, again) {
    m = m || $('msg1');
    if (!admTok) { admEnsure(function () { admCall(fn, args, onOk, m, onFail, true); }, m, onFail); return; }
    msg(m, '처리 중…', '#6b7686');
    var run = google.script.run.withSuccessHandler(function (r) { msg(m, ''); onOk(r); })
      .withFailureHandler(function (e) {
        if (!again && /관리자 로그인 시간이 지났/.test(errText(e))) { admTok = null; admData = null; admCall(fn, args, onOk, m, onFail, true); return; }   // 관리자 접속만 끊김 → 다시 받고 한 번 더 (서버는 확인 단계에서 멈췄으므로 안전)
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
      msg($('oMsg'), '서명자 순서를 저장했습니다. 서명지에도 반영되었습니다.', '#12833b');
    }, $('oMsg'));
  };
  $('oDb').onclick = function () {
    $('oDb').disabled = true;
    admCall('adminSortByDb', [ordId], function (d) {
      delete admOrder[ordId]; renderAdmin(d); ord = ordEdu().signers.map(function (s) { return s.key; }); drawOrder();
      msg($('oMsg'), '직원DB 순서로 정렬했습니다. 서명지에도 반영되었습니다.', '#12833b');
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
    if (t.refund) {                     // 비상(환불 등록) 양식: 입력 칸만 보여 줌
      var hs = (t.blocks[0] || { heads: [] }).heads;
      box.innerHTML = '<div class="cap"><b>' + esc(name) + '</b> · 환불 등록 · 입력 칸 ' + hs.length + '개</div><div class="wrap"><table><tr>' +
        hs.map(function (h) { return '<th>' + esc(h.t) + '</th>'; }).join('') + '</tr><tr>' + hs.map(function () { return '<td></td>'; }).join('') + '</tr></table></div>';
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
  /** 양식 고르는 칸: 관리자는 시트의 양식 + [PDF 서명지], 그 밖의 직원은 [PDF 서명지]만 */
  function nTplFill(list) {
    var sel = $('nTpl'), prev = sel.value, had = sel.options.length > 1; sel.innerHTML = '';
    list.concat([PDF_TPL]).forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t === PDF_TPL ? 'PDF 서명지 (PDF 올려서 서명받기)' : t; sel.appendChild(o); });
    if (prev && (list.indexOf(prev) > -1 || (prev === PDF_TPL && had))) sel.value = prev;   // 처음 양식을 받으면 첫 양식
    nTplUi();
  }
  /** 서명지 목록 화면에 들어올 때: 새 서명지 열기(직원 모두)·배포용 아이디(관리자)·개인 코드 관리(선임관리자만) */
  function admCards() {
    var g = !!(staff && staff.guest), adm = isAdm();
    $('newCard').classList.toggle('hidden', g || !(staff && staff.token));
    $('gstCard').classList.toggle('hidden', !adm); $('pcCard').classList.toggle('hidden', !(adm && staff.master));
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
    var nFirst = !$('nDept').options.length;   // 처음 그릴 때·서명지를 연 뒤에는 관리자의 부서명·팀, 그 밖에는 고른 값 유지
    deptTeamSel($('nDept'), $('nTeam'), nFirst ? (admMe && admMe.dept) || '' : $('nDept').value, nFirst ? (admMe && admMe.team) || '' : $('nTeam').value);
    $('gstId').value = (d.guest && d.guest.id) || '';
    nTplFill(d.templates);
    if (!d.templates.length) msg($('nMsg'), '양식 탭이 없습니다. 시트에 이름이 "양식"으로 시작하는 탭을 만들어 두세요.', '#c0392b');
    if (!$('nDate').value) $('nDate').value = today();
    var note = d.note || ''; d.note = '';   // 안내는 한 번만
    admOverRedraw();
    if (note) admOverMsg(note);
    if (!quiet && staff && staff.token) refreshInit();   // 서명지 목록(제목·마감 등)도 새로
  }
