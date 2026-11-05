  /* ---------- 안전점검의 날 체크리스트 (그룹 서명) ----------
     서명지 목록에 카드 하나 (점검자·팀장 서명한 역 수 / 전체) → 누르면 역 선택 화면
     점검자: 역 선택 → 항목 양호·불량·비고 (지난 점검 값이 기본) → 완료 → 최종 확인 → 서명 → 다음(제출)
     팀장: 역 선택 화면에서 진행 상황 · [역별 내용 보기](이전·다음 역) · 모든 역 점검이 끝나면 [일괄 서명] → 서명 한 번이 모든 역에 */
  var sk = null, skSt = null, skStep = 'pick', skRes = {};   // sk: 점검자 화면 데이터, skSt: 고른 역
  var skSigMode = '';      // 서명 칸: 'ins' 점검자 · 'lead' 팀장 일괄 서명
  var SK_I = 'bglSafeI:';
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (x) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (x) { return false; } }

  function skItem(e) {
    var closed = e.open === false, c = e.safety || { n: 0, ins: 0, lead: 0 };
    var w = document.createElement('div'); w.className = 'skItem' + (closed ? ' closed' : ''); w.setAttribute('role', 'button'); w.tabIndex = 0;
    w.innerHTML = '<div class="skTop"><span class="skTag">안전점검의 날</span><b></b><span class="rank"></span></div>' +
      '<div class="skCnt">점검자 서명 <strong class="ins"></strong> · 팀장 서명 <strong class="lead"></strong></div><div class="skGo"></div>';
    var q = function (x) { return w.querySelector(x); };
    q('b').textContent = e.title; q('.rank').textContent = [e.dept, e.date].filter(Boolean).join(' · ');
    q('.ins').textContent = c.ins + '/' + c.n; q('.lead').textContent = c.lead + '/' + c.n;
    q('.ins').classList.toggle('done', c.n > 0 && c.ins >= c.n); q('.lead').classList.toggle('done', c.n > 0 && c.lead >= c.n);
    q('.skGo').textContent = closed ? '접수 마감 · 눌러서 보기·PDF' : '눌러서 역 선택';
    w.onclick = function () { if (skOpening) return; w.classList.add('busy'); skOpen(e.id, false, '', function () { w.classList.remove('busy'); }); };
    return w;
  }

  /* ---------- 점검자 ---------- */
  var skOpening = false, skPickAt = 0;   // 카드를 연달아 눌러도 한 번만, 역 선택 화면이 뜬 직후의 탭은 무시
  function skOpen(id, again, stName, done) {
    if (skOpening) return;
    skOpening = true; msg($('msg1'), '불러오는 중…', '#6b7686');
    google.script.run.withSuccessHandler(function (d) {
      skOpening = false; if (done) done();
      msg($('msg1'), ''); msg($('skMsg'), ''); sk = d;
      $('skTitle').textContent = d.title; $('skDate').textContent = d.date || '';
      var st = stName && d.stations.filter(function (x) { return x.st === stName; })[0];
      if (st) skForm(st); else skStage('pick');
      show('sk');
    }).withFailureHandler(function (e) { skOpening = false; if (done) done(); msg($('msg1'), errText(e), '#c0392b'); }).safetyOpen(staff && staff.token || '', id);
  }
  function skStage(s) {
    skStep = s;
    ['pick', 'form', 'rev', 'sig'].forEach(function (k) { $('sk' + { pick: 'Pick', form: 'Form', rev: 'Rev', sig: 'Sig' }[k]).classList.toggle('hidden', k !== s); });
    if (s === 'pick') { skGrid(); skPickAt = Date.now(); }
    document.body.classList.toggle('skSig', s === 'sig');
    if (s !== 'sig') landOff();
    if (s === 'sig') { msg($('skMsg'), ''); $('skSigEdu').textContent = [sk.title, sk.date].filter(Boolean).join(' · '); setTimeout(function () { skPad.setup(); }, 30); }   // 서명 칸 높이는 skPad.fit이 맞춤
    window.scrollTo(0, 0); saveState();
  }
  /* ---------- PDF 출력: 팀장 확인이 끝난 역별 (마감된 서명지도 받을 수 있음, 전체 PDF는 없음) ---------- */
  var skPdfBusy = false;
  function skPdfGet(st) {
    if (skPdfBusy) return;
    skPdfBusy = true; msg($('skMsg'), 'PDF 만드는 중… (10초 이상 걸릴 수 있습니다)', '#6b7686');
    google.script.run.withSuccessHandler(function (r) {
      skPdfBusy = false;
      if (r.pdf) saveFile(r.base + '.pdf', b64Blob(r.pdf, 'application/pdf'));
      else r.pdfs.forEach(function (b64, i) { setTimeout(function () { saveFile(r.base + '_' + (r.names[i] || i + 1) + '.pdf', b64Blob(b64, 'application/pdf')); }, i * 700); });
      if (r.dl) { sk.pdfDl = sk.pdfDl || {}; sk.pdfDl[st] = r.dl; skGrid(); }   // PDF 받음 ✓ (서버에 남음)
      msg($('skMsg'), st + ' PDF를 저장했습니다. 컴퓨터·휴대폰 다운로드 폴더를 확인하세요.', '#12833b');
    }).withFailureHandler(function (e) {
      skPdfBusy = false; msg($('skMsg'), errText(e), '#c0392b');
    }).safetyPdf(staff && staff.token || '', sk.id, st);
  }
  function skGrid() {
    var g = $('skGrid'); g.innerHTML = '';
    sk.stations.forEach(function (x) {
      var cell = document.createElement('div'); cell.className = 'skCell';
      var b = document.createElement('button'); b.type = 'button'; b.className = x.ins ? 'done' : '';
      b.innerHTML = '<span></span><small></small>';
      if (x.ins && x.chk) { b.className = 'chk'; b.insertAdjacentHTML('beforeend', '<small class="ck">확인 필요</small>'); }   // 지난 기록보다 수량이 바뀌었거나 비고·불량이 있는 역
      b.firstChild.textContent = x.st;
      b.children[1].textContent = x.ins ? '✓ ' + x.ins.name + (x.lead ? ' · ' + (typeof x.lead === 'string' ? x.lead : '팀장') + ' ✓' : '') : '미점검';   // 팀장 서명이 끝나면 팀장 이름
      b.onclick = function () {
        if (Date.now() - skPickAt < 500) return;      // 카드를 누른 손가락이 역 칸에 다시 눌린 것
        if (x.lead) { msg($('skMsg'), x.st + ': 팀장 확인이 끝나 점검 내용을 수정할 수 없습니다. PDF만 받을 수 있습니다.', '#c0392b'); return; }   // 팀장 서명 뒤에는 수정 불가
        if (sk.open === false) { msg($('skMsg'), '접수가 마감되어 점검할 수 없습니다.', '#c0392b'); return; }
        msg($('skMsg'), ''); skForm(x);
      };
      cell.appendChild(b);
      if (x.lead) {                                   // 점검자·팀장 서명이 끝난 역: PDF
        var got = (sk.pdfDl || {})[x.st];             // 받은 역: ✓ + 누가·언제
        var p = document.createElement('button'); p.type = 'button'; p.className = 'skPdfS' + (got ? ' got' : ''); p.textContent = got ? '📄 PDF ✓' : '📄 PDF';
        p.onclick = function () { skPdfGet(x.st); };
        cell.appendChild(p);
        if (got) { var gd = document.createElement('div'); gd.className = 'pdfDl'; gd.style.textAlign = 'center'; gd.textContent = (got.n || '') + ' ' + (got.at || ''); cell.appendChild(gd); }
      }
      g.appendChild(cell);
    });
    skLeadBox();
  }
  /* 팀장: 진행 상황 · 일괄 서명 (모든 역 점검자 서명이 끝나야 켜짐, 팀장 확인 전인 역에만 들어감) */
  function skLeadBox() {
    $('skLead').classList.toggle('hidden', !sk.leader);
    if (!sk.leader) return;
    var n = sk.stations.length, miss = sk.stations.filter(function (x) { return !x.ins; }), left = sk.stations.filter(function (x) { return !x.lead; }).length;
    $('skLeadSt').textContent =                 // 서명 수·미점검 역은 위 역 칸에 보이므로 지금 할 일만
      (sk.open === false ? '접수가 마감되었습니다.' : miss.length ? '모든 역 점검이 끝나야 일괄 서명할 수 있습니다.' :
        left ? '모든 역 점검이 끝났습니다. [일괄 서명]을 누르고 서명 한 번이면 팀장 확인 전인 역 ' + left + '개에 모두 들어갑니다.' : '모든 역의 팀장 확인이 끝났습니다.');
    $('skLeadSign').disabled = sk.open === false || !!miss.length || !left;
    $('skLeadView').disabled = n === miss.length;
    $('skLeadCRow').classList.toggle('hidden', left === n);   // 팀장 서명한 역이 있을 때만
    skCancelArm(false);
  }
  /* 팀장 일괄 서명 취소: 모든 역의 팀장 서명을 지움 (마감된 서명지는 관리자가 다시 연 뒤에만). 실수로 누르지 않게 두 번 눌러 실행 */
  var skCancelT = null;
  function skCancelArm(on) {
    clearTimeout(skCancelT); $('skLeadCancel').classList.toggle('armed', on);
    $('skLeadCancel').textContent = on ? '한 번 더 누르면 모든 역의 팀장 서명 취소' : '일괄 서명 취소';
    if (on) skCancelT = setTimeout(function () { skCancelArm(false); }, 4000);
  }
  $('skLeadCancel').onclick = function () {
    if (skBusy) return;
    if (sk.open === false) { msg($('skMsg'), '마감된 서명지입니다. 관리자가 접수를 다시 연 뒤 일괄 서명을 취소할 수 있습니다.', '#c0392b'); return; }
    if (!$('skLeadCancel').classList.contains('armed')) { skCancelArm(true); return; }
    skCancelArm(false); skBusy = true; $('skLeadCancel').disabled = true; msg($('skMsg'), '취소 중…', '#6b7686');
    var end = function (t, c) {
      google.script.run.withSuccessHandler(function (d) { sk = d; skBusy = false; $('skLeadCancel').disabled = false; skStage('pick'); msg($('skMsg'), t, c); })
        .withFailureHandler(function () { skBusy = false; $('skLeadCancel').disabled = false; msg($('skMsg'), t, c); }).safetyOpen(staff && staff.token || '', sk.id);
    };
    google.script.run.withSuccessHandler(function (r) { end('팀장 서명 ' + r.n + '개 역을 취소했습니다. 점검자가 다시 고칠 수 있습니다.', '#12833b'); })
      .withFailureHandler(function (e) { skBusy = false; $('skLeadCancel').disabled = false; msg($('skMsg'), errText(e), '#c0392b'); })
      .safetyLeaderCancel({ token: staff && staff.token || '', eduId: sk.id });
  };
  $('skLeadView').onclick = function () { skLeadOpen(sk.id); };
  $('skLeadSign').onclick = function () {
    var left = sk.stations.filter(function (x) { return !x.lead; }).length;
    skSigMode = 'lead'; msg($('skMsg'), '');
    $('skSigName').textContent = '팀장 일괄 서명 (' + left + '개 역)'; skPad.clear(); skStage('sig');
  };
  /** 수량 정리 (서버와 같게): 비었거나 0이면 '-', 줄바꿈은 '/'로도 입력 */
  function skQNorm(v) {
    var lines = String(v == null ? '' : v).split(/[\n\/]/).map(function (x) { return x.replace(/\s+/g, ' ').trim().slice(0, 30); }).filter(Boolean);
    var zero = function (x) { return /^(?:[^:：]*[:：]\s*)?0*\s*(개소|개|식)?$/.test(x) || x === '-'; };
    return !lines.length || lines.every(zero) ? '-' : lines.join('\n');
  }
  function skQtyOut() { var o = {}; skSt.items.forEach(function (it) { o[it.i] = skQNorm(skQty[it.i]); }); return o; }
  function skItemsEdited() { return skSt.items.map(function (it) { return { i: it.i, f: it.f, t: it.t, q: skQNorm(skQty[it.i]) }; }); }
  var skQty = {};
  function skDraftKey() { return SK_I + sk.id + ':' + skSt.st; }
  function skForm(x) {
    skSt = x; skSigMode = '';
    var dr = lsGet(skDraftKey());                     // 입력 중이던 값 (창을 닫았다 열어도)
    skRes = JSON.parse(JSON.stringify((dr && dr.res) || x.def || {}));
    skQty = {}; x.items.forEach(function (it) { skQty[it.i] = dr && dr.qty && dr.qty[it.i] !== undefined ? dr.qty[it.i] : it.q === '-' ? '' : it.q.replace(/\n/g, ' / '); });
    $('skStName').textContent = x.st;
    $('skDefNote').textContent = dr ? '입력하던 내용을 불러왔습니다.' : x.ins ? '이 서명지에 낸 값입니다. 고친 뒤 다시 서명하면 바뀝니다.' + (x.lead ? ' (팀장 확인은 다시 받아야 합니다)' : '') :
      x.def ? '지난 점검 값이 기본으로 선택되어 있습니다. 바뀐 곳만 고치세요.' : '첫 점검입니다. 모든 항목을 고르세요.';
    var box = $('skItems'), lastF = ''; box.innerHTML = '';
    x.items.forEach(function (it) {
      if (it.f !== lastF) { var h = document.createElement('div'); h.className = 'skGrp'; h.textContent = it.f; box.appendChild(h); lastF = it.f; }
      var v = skRes[it.i] || (skRes[it.i] = ['', '']);
      var d = document.createElement('div'); d.className = 'skIt'; d.setAttribute('data-i', it.i);
      d.innerHTML = '<div class="skH"><span class="t"></span></div>' +
        '<div class="skQ"><div class="skL"><input type="text" class="qi" maxlength="30" placeholder="수량 (없으면 -)" autocomplete="off"><label class="o"><input type="checkbox"> 양호</label></div>' +
        '<div class="skL"><textarea class="ni fold" rows="1" maxlength="200" placeholder="비고(조치사항)" wrap="off"></textarea><label class="x"><input type="checkbox"> 불량</label></div><button type="button" class="nTog hidden">▾ 펼치기</button></div>';
      d.querySelector('.t').textContent = it.t;
      var cks = d.querySelectorAll('.skL label input'), lbs = d.querySelectorAll('.skL label'), inp = d.querySelector('.ni'), qin = d.querySelector('.qi'), tog = d.querySelector('.nTog');
      qin.value = skQty[it.i]; qin.oninput = function () { skQty[it.i] = qin.value; skDraft(); };
      var paint = function () { cks[0].checked = v[0] === 'O'; cks[1].checked = v[0] === 'X'; lbs[0].classList.toggle('on', v[0] === 'O'); lbs[1].classList.toggle('on', v[0] === 'X'); };
      cks[0].onchange = function () { v[0] = cks[0].checked ? 'O' : ''; d.classList.remove('miss'); paint(); skDraft(); };   // 양호·불량 중 하나만 (다시 누르면 해제)
      cks[1].onchange = function () { v[0] = cks[1].checked ? 'X' : ''; d.classList.remove('miss'); paint(); skDraft(); };
      /* 비고: 접으면 한 줄, 길면 [펼치기]로 전체 글이 다 보이게 */
      var open = false;
      var fit = function () {
        if (open) { inp.classList.remove('fold'); inp.setAttribute('wrap', 'soft'); inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px'; }
        else { inp.classList.add('fold'); inp.setAttribute('wrap', 'off'); inp.style.height = ''; }
        tog.textContent = open ? '▴ 접기' : '▾ 펼치기';
        tog.classList.toggle('hidden', !open && inp.scrollWidth <= inp.clientWidth + 1);
      };
      tog.onclick = function () { open = !open; fit(); };
      inp.value = v[1] || ''; inp.oninput = function () { v[1] = inp.value.replace(/\n/g, ' '); if (v[1] !== inp.value) inp.value = v[1]; fit(); skDraft(); };
      paint(); box.appendChild(d); fit();
    });
    skStage('form');
  }
  function skDraft() { if (sk && skSt) lsSet(skDraftKey(), { res: skRes, qty: skQty }); }
  $('skHome').onclick = function () { resetAll(); };
  $('skFormBack').onclick = function () { skStage('pick'); };
  $('skDone').onclick = function () {
    var miss = skSt.items.filter(function (it) { var v = skRes[it.i]; return !v || (v[0] !== 'O' && v[0] !== 'X'); });
    [].forEach.call($('skItems').querySelectorAll('.skIt'), function (d) { d.classList.toggle('miss', miss.some(function (it) { return String(it.i) === d.getAttribute('data-i'); })); });
    if (miss.length) { msg($('skMsg'), '점검결과를 고르지 않은 항목 ' + miss.length + '개가 있습니다.', '#c0392b'); var f = $('skItems').querySelector('.miss'); if (f) f.scrollIntoView({ block: 'center' }); return; }
    msg($('skMsg'), '');
    $('skPaperBox').innerHTML = skPaper({ st: skSt.st, items: skItemsEdited() }, skRes, null, '', '', sk.title, sk.date, true);
    skStage('rev');
  };
  $('skRevBack').onclick = function () { skStage('form'); };
  $('skRevOk').onclick = function () { skSigMode = 'ins'; $('skSigName').textContent = skSt.st + ' 점검자 서명'; skPad.clear(); skStage('sig'); };
  $('skSigBack').onclick = function () { if (!skBusy) skStage(skSigMode === 'lead' ? 'pick' : 'rev'); };
  $('skClear').onclick = function () { if (!skBusy) skPad.clear(); };
  var skBusy = false;
  $('skSend').addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') { e.preventDefault(); skSubmit(); } });
  $('skSend').onclick = function () { skSubmit(); };
  function skSubmit() {
    if (skBusy || $('skSend').disabled) return;
    if (!skPad.strokes.length) { msg($('skMsg'), '서명해 주세요.', '#c0392b'); return; }
    if (skPad.n < 6) { msg($('skMsg'), '서명이 너무 짧습니다. 조금 더 크게 서명해 주세요.', '#c0392b'); return; }
    skBusy = true; skPad.locked = true; $('skPad').classList.add('locked'); $('skSend').disabled = true; $('skClear').disabled = true; $('skSigBack').disabled = true; msg($('skMsg'), '제출 중…', '#6b7686');
    var unlock = function () { skBusy = false; skPad.locked = false; $('skPad').classList.remove('locked'); $('skSend').disabled = skPad.n < 6; $('skClear').disabled = false; $('skSigBack').disabled = false; };
    var reload = function (done) {                   // 제출 뒤 역 목록을 다시 받아 역 선택 화면 (화면이 바뀐 뒤에 서명 칸 잠금을 풂)
      google.script.run.withSuccessHandler(function (d) { sk = d; skStage('pick'); unlock(); msg($('skMsg'), done, '#12833b'); })
        .withFailureHandler(function () { skStage('pick'); unlock(); msg($('skMsg'), done, '#12833b'); }).safetyOpen(staff && staff.token || '', sk.id);
    };
    if (skSigMode === 'lead') {
      google.script.run.withSuccessHandler(function (r) { skSigMode = ''; reload('팀장 서명을 ' + r.n + '개 역에 저장했습니다.'); })
        .withFailureHandler(function (e) { unlock(); msg($('skMsg'), errText(e), '#c0392b'); })
        .safetyLeaderSubmit({ token: staff && staff.token || '', eduId: sk.id, sign: skPad.png(), device: devInfo });
      return;
    }
    google.script.run.withSuccessHandler(function (r) {
      lsSet(skDraftKey(), null);
      reload(r.st + ' 점검 서명을 ' + (r.resigned ? '다시 ' : '') + '제출했습니다.');
    }).withFailureHandler(function (e) {
      unlock(); msg($('skMsg'), errText(e), '#c0392b');
    }).safetySubmit({ token: staff && staff.token || '', eduId: sk.id, st: skSt.st, res: skRes, qty: skQtyOut(), dataUrl: skPad.png(), device: devInfo });
  }
  function skBack() {                                // 휴대폰 뒤로가기: 한 단계씩
    if (skBusy || skPdfBusy) return;
    if (skStep === 'sig') skStage(skSigMode === 'lead' ? 'pick' : 'rev'); else if (skStep === 'rev') skStage('form'); else if (skStep === 'form') skStage('pick'); else resetAll();
  }

  /** 체크리스트 모양: base(지난 점검 값)가 있으면 바뀐 줄을 노랗게 + 이전 값.
   *  chk(팀장 보기: { 항목: { q, m, x } })가 있으면 줄 대신 확인할 칸만 노랗게 (수량 바뀜·비고 있음·불량) */
  function skPaper(x, res, base, insImg, leadImg, title, date, noCmp, chk) {
    var groups = [];
    x.items.forEach(function (it) { var g = groups[groups.length - 1]; if (!g || g.f !== it.f) groups.push(g = { f: it.f, list: [] }); g.list.push(it); });
    var nChg = 0, nChk = 0, rows = '';
    groups.forEach(function (g) {
      g.list.forEach(function (it, k) {
        var v = res[it.i] || ['', ''], b = base && base[it.i];
        var ch = !!(b && (b[0] !== v[0] || (b[1] || '') !== (v[1] || '')));
        var c = chk && chk[it.i] || {}, ck = function (on) { return on ? ' ck' : ''; };
        if (ch) nChg++;
        if (c.q || c.m || c.x) nChk++;
        rows += '<tr class="' + (ch && !chk ? 'chg' : '') + '">' + (k ? '' : '<th rowspan="' + g.list.length + '">' + esc(g.f) + '</th>') +
          '<td class="pi">○ ' + esc(it.t) + (ch ? '<span class="was">이전: ' + esc(b[0] || '-') + (b[1] ? ' · ' + esc(b[1]) : '') + '</span>' : '') + '</td>' +
          '<td class="pq' + ck(c.q) + '">' + esc(it.q).replace(/\n/g, '<br>') + '</td><td class="pr' + (v[0] === 'X' ? ' x' : '') + ck(c.x) + '">' + esc(v[0] || '') + '</td><td class="pn' + ck(c.m) + '">' + esc(v[1] || '') + '</td></tr>';
      });
    });
    var img = function (u) { return u && u.indexOf('data:image/') === 0 ? '<img src="' + esc(u) + '" alt="서명">' : ''; };
    var head = chk ? '<div class="pChg' + (nChk ? '' : ' none') + '">' + (nChk ? '확인할 항목 ' + nChk + '개 (노란 칸: 수량 바뀜·비고·불량)' : '확인할 칸 없음') + (!base ? ' · 첫 점검' : nChg ? ' · 지난 점검과 결과가 바뀐 항목 ' + nChg + '개 (이전 값 표시)' : '') + '</div>' :
      '<div class="pChg' + (nChg ? '' : ' none') + '">' + (!base ? '첫 점검 (비교할 지난 점검 없음)' : nChg ? '지난 점검과 바뀐 곳 ' + nChg + '개 (노란 줄)' : '지난 점검과 같음') + '</div>';
    return '<div class="skPaper">' + (noCmp ? '' : head) +
      '<div class="pT">' + esc(title || '안전점검의 날 체크리스트') + '</div>' +
      '<table class="pHead"><colgroup><col style="width:18%"><col><col style="width:9%"><col style="width:19%"><col style="width:19%"></colgroup>' +
      '<tr><th>점검역사</th><td>' + esc(x.st) + '</td><th rowspan="2">결재</th><th>점검자</th><th>팀장</th></tr>' +
      '<tr><th>점검일자</th><td>' + esc(date || '') + '</td><td class="pSign">' + img(insImg) + '</td><td class="pSign">' + img(leadImg) + '</td></tr></table>' +
      '<div class="pNote">※ 점검결과 표기 : O = 양호, X = 불량</div>' +
      '<table><colgroup><col style="width:15%"><col><col style="width:15%"><col style="width:10%"><col style="width:20%"></colgroup>' +
      '<tr><th>점검<br>분야</th><th>점 검 항 목</th><th>점검<br>수량</th><th>결과</th><th>비고</th></tr>' + rows +
      '</table></div>';
  }

  /* ---------- 서명 칸 (점검자·팀장 공용): 획을 가상 좌표로 저장, 크기가 바뀌면 다시 그림 ---------- */
  function makePad(cv, msgEl, onDraw) {
    var c2 = cv.getContext('2d'), P = { strokes: [], n: 0 }, vw = 0, vh = 0, cur = null, down = false, lp = null;
    var xf = function () { var w = cv.clientWidth, h = cv.clientHeight, sc = Math.min(w / vw, h / vh); return { s: sc, ox: (w - vw * sc) / 2, oy: (h - vh * sc) / 2 }; };
    var toV = function (p) { var t = xf(); return { x: (p.x - t.ox) / t.s, y: (p.y - t.oy) / t.s }; };
    var toC = function (p) { var t = xf(); return { x: p.x * t.s + t.ox, y: p.y * t.s + t.oy }; };
    var at = function (e) { var b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    P.redraw = function () {
      c2.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
      if (!vw) return;
      P.strokes.forEach(function (st) {
        var f = toC(st[0]);
        if (st.length === 1) { c2.beginPath(); c2.arc(f.x, f.y, 1.2, 0, 6.283); c2.fill(); return; }
        c2.beginPath(); c2.moveTo(f.x, f.y);
        for (var i = 1; i < st.length; i++) { var q = toC(st[i]); c2.lineTo(q.x, q.y); }
        c2.stroke();
      });
    };
    P.locked = false;                                   // 제출 중에는 서명 칸에 더 그려지지 않게
    P.setup = function () {
      if (P.fit) P.fit();
      if (!cv.clientWidth) return;
      var r = window.devicePixelRatio || 1; cv.width = cv.clientWidth * r; cv.height = cv.clientHeight * r;
      c2.setTransform(r, 0, 0, r, 0, 0); c2.lineWidth = 3; c2.lineCap = 'round'; c2.lineJoin = 'round'; c2.strokeStyle = '#000'; c2.fillStyle = '#000';
      P.redraw();
    };
    P.clear = function () { P.strokes = []; P.n = 0; vw = 0; vh = 0; c2.clearRect(0, 0, cv.clientWidth, cv.clientHeight); if (P.onN) P.onN(0); };
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (P.locked) return;
      if (e.pointerType === 'mouse') { msg(msgEl, '서명은 휴대폰이나 태블릿 화면에 손가락(또는 펜)으로 해 주세요.', '#c0392b'); return; }
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      if (!vw) { vw = cv.clientWidth; vh = cv.clientHeight; }
      down = true; lp = at(e); cur = [toV(lp)]; P.strokes.push(cur); P.n++;
      c2.beginPath(); c2.arc(lp.x, lp.y, 1.2, 0, 6.283); c2.fill(); msg(msgEl, '');
      if (onDraw) onDraw();
      if (P.onN) P.onN(P.n);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return; e.preventDefault();
      var p = at(e);
      c2.beginPath(); c2.moveTo(lp.x, lp.y); c2.lineTo(p.x, p.y); c2.stroke();
      cur.push(toV(p)); P.n += Math.abs(p.x - lp.x) + Math.abs(p.y - lp.y) > 1 ? 1 : 0; lp = p;
      if (P.onN) P.onN(P.n);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { down = false; }); });
    /** 서명 부분만 잘라 PNG (셀 한 칸 5만 자 안으로) */
    P.png = function () {
      var pad = 12, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      P.strokes.forEach(function (st) { st.forEach(function (pt) { var c = toC(pt); x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }); });
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.clientWidth, x1 + pad); y1 = Math.min(cv.clientHeight, y1 + pad);
      var r = cv.width / cv.clientWidth, sw = Math.max(1, (x1 - x0) * r), sh = Math.max(1, (y1 - y0) * r), url = '';
      [[480, 192], [360, 144], [270, 108], [200, 80]].some(function (z) {
        var t = document.createElement('canvas'); t.width = z[0]; t.height = z[1];
        var sc = Math.min(t.width / sw, t.height / sh, 1.5);
        t.getContext('2d').drawImage(cv, x0 * r, y0 * r, sw, sh, (t.width - sw * sc) / 2, (t.height - sh * sc) / 2, sw * sc, sh * sc);
        url = t.toDataURL('image/png'); return url.length <= 48000;
      });
      return url;
    };
    window.addEventListener('resize', function () { setTimeout(P.setup, 150); });
    return P;
  }
  var skPad = makePad($('skPad'), $('skMsg'));
  skPad.onN = function (n) { if (!skBusy) $('skSend').disabled = n < 6; };   // 충분히 서명해야 [다음] 켜짐 (교육 서명과 같게)
  /* 세로 화면: 서명 칸 높이를 남은 화면에 맞춤 (160~280px) → 아래 버튼까지 한 화면에 보이게 (가로는 CSS) */
  skPad.fit = function () {
    var cv = $('skPad');
    if (!window.matchMedia || !window.matchMedia('(orientation: portrait)').matches) { cv.style.height = ''; return; }
    var top = cv.getBoundingClientRect().top + (window.scrollY || 0), acts = document.querySelector('#skSig .actions');
    var h = Math.round(window.innerHeight - top - ((acts ? acts.offsetHeight : 110) + 12 + 14));
    cv.style.height = Math.max(160, Math.min(280, h)) + 'px';
  };

  /* ---------- 팀장 내용 보기 (서명은 역 선택 화면의 [일괄 서명]) ---------- */
  var skL = null, skLBusy = false;   // skL: { id, data, idx }
  function skLeadOpen(id, idx) {
    if (skLBusy) return;
    skLBusy = true; $('skLeadView').disabled = true; msg($('skMsg'), '불러오는 중…', '#6b7686');
    var end = function () { skLBusy = false; $('skLeadView').disabled = false; };
    google.script.run.withSuccessHandler(function (d) {
      end(); msg($('skMsg'), '');
      skL = { id: id, data: d, idx: Math.max(0, Math.min(Number(idx) || 0, d.stations.length - 1)) };
      lvOpen();
    }).withFailureHandler(function (e) { end(); msg($('skMsg'), errText(e), '#c0392b'); }).safetyLeaderData(staff && staff.token || '', id);
  }
  function lvOpen() {
    var was = $('skView').classList.contains('hidden');
    $('skView').classList.remove('hidden'); document.body.classList.add('skLock');
    $('lvTitle').textContent = skL.data.title + (skL.data.date ? ' · ' + skL.data.date : '');
    var sel = $('lvSel');                             // 역 바로 보기: 확인할 칸이 있는 역은 ⚠, 팀장 확인이 끝난 역은 ✓
    sel.innerHTML = skL.data.stations.map(function (x, i) {
      return '<option value="' + i + '">' + esc(x.st) + (Object.keys(x.chk || {}).length ? ' ⚠' : '') + (x.lead ? ' ✓' : '') + '</option>';
    }).join('');
    sel.classList.toggle('hidden', !skL.data.stations.length);
    lvGo(skL.idx);
    if (was) { popPush(); saveState(); }
  }
  function lvClose() {
    $('skView').classList.add('hidden'); document.body.classList.remove('skLock');
    popSync(); saveState();
  }
  $('lvClose').onclick = lvClose;
  $('lvSel').onchange = function () { lvGo(Number(this.value) || 0); };
  function lvGo(i) {
    var D = skL.data, n = D.stations.length, pg = $('lvPage'), h = '';
    skL.idx = Math.max(0, Math.min(i, n - 1));
    if (!n) { h = '<div class="card center"><div class="who">아직 점검자가 서명한 역이 없습니다.</div><div class="hint">점검자 서명이 끝난 역부터 볼 수 있습니다.</div></div>'; $('lvProg').textContent = ''; }
    else {
      var x = D.stations[skL.idx];
      h = (skL.idx ? '<div class="lvHint">▼ 맨 위에서 내리면 이전 역</div>' : '') +
        skPaper(x, x.res, x.base, x.ins.img, x.lead ? x.lead.img : '', D.title, D.date, false, x.chk || {}) +
        '<div class="hint" style="text-align:center">점검자 ' + esc((x.ins.disp ? x.ins.disp + ' ' : '') + x.ins.name) + ' · ' + esc(x.ins.at) + (x.lead ? ' · 팀장 확인 완료 (' + esc(x.lead.name) + ')' : ' · 팀장 확인 전') + '</div>' +
        (skL.idx < n - 1 ? '<div class="lvHint">▲ 끝까지 올리면 다음 역</div>' : '') +
        '<div class="row lvNav"><button class="btn gray" id="lvPrev" type="button"' + (skL.idx ? '' : ' disabled') + '>◀ 이전 역</button>' +
        '<button class="btn pri" id="lvNextSt" type="button"' + (skL.idx < n - 1 ? '' : ' disabled') + '>다음 역 ▶</button></div>';
      $('lvProg').textContent = (skL.idx + 1) + ' / ' + n;
      $('lvSel').value = String(skL.idx);
    }
    pg.innerHTML = h; pg.scrollTop = 0;
    if ($('lvPrev')) $('lvPrev').onclick = function () { lvGo(skL.idx - 1); };
    if ($('lvNextSt')) $('lvNextSt').onclick = function () { lvGo(skL.idx + 1); };
    saveState();
  }
  /* 체크리스트 넘기기: 끝까지 내려 본 뒤 더 올리면 다음 역, 맨 위에서 더 내리면 이전 역 (손가락·마우스 휠) */
  (function () {
    var pg = $('lvPage'), y0 = null, top0 = false, bot0 = false, fired = false, wsum = 0, wt = null;
    var atBot = function () { return pg.scrollTop + pg.clientHeight >= pg.scrollHeight - 2; };
    var canNext = function () { return skL && skL.idx < skL.data.stations.length - 1; }, canPrev = function () { return skL && skL.idx > 0; };
    pg.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; top0 = pg.scrollTop <= 0; bot0 = atBot(); fired = false; }, { passive: true });
    pg.addEventListener('touchmove', function (e) {
      if (y0 === null || fired || !skL) return;
      var dy = e.touches[0].clientY - y0;
      if (dy < -60 && bot0 && atBot() && canNext()) { fired = true; lvGo(skL.idx + 1); }
      else if (dy > 80 && top0 && pg.scrollTop <= 0 && canPrev()) { fired = true; lvGo(skL.idx - 1); }
    }, { passive: true });
    pg.addEventListener('touchend', function () { y0 = null; }, { passive: true });
    pg.addEventListener('wheel', function (e) {
      if (!skL) return;
      if (!(e.deltaY > 0 && atBot() && canNext()) && !(e.deltaY < 0 && pg.scrollTop <= 0 && canPrev())) { wsum = 0; return; }
      wsum += e.deltaY; clearTimeout(wt); wt = setTimeout(function () { wsum = 0; }, 400);
      if (wsum > 240) { wsum = 0; lvGo(skL.idx + 1); } else if (wsum < -240) { wsum = 0; lvGo(skL.idx - 1); }
    }, { passive: true });
  })();
  /* 안전점검 화면에서 페이지를 나가려 하면 확인 (휴대폰 뒤로가기 제스처로 창이 닫히는 것 막기) */
  window.addEventListener('beforeunload', function (e) {
    if (curScreen !== 'sk' && $('skView').classList.contains('hidden')) return;
    e.preventDefault(); e.returnValue = '';
  });

