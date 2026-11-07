  /* ---------- 관리자: 역 안내 화면 (서버 Station.js, 역 PC는 GitHub Pages의 station.html) ----------
   * 역을 골라 환불 등록 QR 띄우기·내리기, 안내 이미지 바꾸기, 역 코드 정하기. 서버가 GitHub에 올리고 역 PC는 10초마다 확인 (반영 약 1분) */
  var stSel = {}, stD = null;
  function stPageUrl() { return /sign\.html/.test(qrUrl) ? qrUrl.replace(/sign\.html.*$/, 'station.html') : 'https://e-bgrail.github.io/BK/station.html'; }
  function stNames() { return Object.keys(stSel).filter(function (k) { return stSel[k]; }); }
  function stRender(d) {
    stD = d; $('stPage').textContent = stPageUrl();
    var box = $('stList'), names = d.stations.map(function (s) { return s.name; }); box.innerHTML = '';
    Object.keys(stSel).forEach(function (k) { if (names.indexOf(k) < 0) delete stSel[k]; });
    d.stations.forEach(function (s) {
      var l = document.createElement('label'); l.className = 'stRow' + (s.qr && s.qr.live ? ' on' : '');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!stSel[s.name];
      cb.onchange = function () { stSel[s.name] = cb.checked; stSync(); };
      var t = document.createElement('div'), b = document.createElement('b'), sm = document.createElement('small');
      b.textContent = s.name;
      sm.textContent = [s.code ? '코드 ' + s.code : '코드 없음', '이미지 ' + s.imgs + '장' + (s.imgs ? ' · ' + s.sec + '초' : ''),
        s.qr ? (s.qr.live ? 'QR 표시 중' : 'QR 끝남') : ''].filter(Boolean).join(' · ');
      if (s.qr) sm.title = s.qr.title;
      t.appendChild(b); t.appendChild(sm); l.appendChild(cb); l.appendChild(t); box.appendChild(l);
    });
    var sel = $('stRf'), prev = sel.value; sel.innerHTML = '';
    if (!d.refunds.length) { var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '고객용 QR 접수 중인 환불 등록 없음'; sel.appendChild(o0); }
    d.refunds.forEach(function (e) { var o = document.createElement('option'); o.value = e.id; o.textContent = e.title; sel.appendChild(o); });
    if (prev && d.refunds.some(function (e) { return e.id === prev; })) sel.value = prev;
    stSync();
    if (!d.ready) msg($('stMsg'), '역 화면 저장소 토큰이 아직 없습니다 (스크립트 속성 ST_GH_TOKEN). 넣기 전에는 올릴 수 없습니다.', '#c0392b');
    else if (d.note) msg($('stMsg'), d.note, '#12833b');
  }
  function stSync() {
    var n = stNames().length;
    $('stQrOn').disabled = !n || !$('stRf').value; $('stQrOff').disabled = !n;
    $('stImgSave').disabled = !n; $('stImgClear').disabled = !n; $('stCodeSave').disabled = n !== 1;
  }
  function stLoad() { admCall('adminStInfo', [], stRender, $('stMsg')); }
  function stNeed() { if (!stNames().length) { msg($('stMsg'), '역을 하나 이상 고르세요.', '#c0392b'); return false; } return true; }
  $('stHead').onclick = function () { if ($('stCard').classList.toggle('open')) stLoad(); };
  $('stAll').onclick = function () { if (stD) stD.stations.forEach(function (s) { stSel[s.name] = true; }); if (stD) stRender(Object.assign({}, stD, { note: '' })); };
  $('stNone').onclick = function () { stSel = {}; if (stD) stRender(Object.assign({}, stD, { note: '' })); };
  $('stRf').onchange = stSync;
  $('stQrOn').onclick = function () {
    if (!stNeed() || !$('stRf').value) return;
    admCall('adminStQr', [stNames(), $('stRf').value, rfUrl('')], stRender, $('stMsg'));
  };
  $('stQrOff').onclick = function () { if (stNeed()) admCall('adminStQr', [stNames(), '', ''], stRender, $('stMsg')); };
  $('stCodeSave').onclick = function () {
    var n = stNames(); if (n.length !== 1) { msg($('stMsg'), '역 코드는 한 역만 골라서 정하세요.', '#c0392b'); return; }
    var c = $('stCode').value.trim();
    if (!c && !confirm(n[0] + ' 역 코드를 지우면 그 역 화면이 꺼집니다. 지울까요?')) return;
    admCall('adminStCode', [n[0], c], function (d) { $('stCode').value = ''; stRender(d); }, $('stMsg'));
  };
  /** 이미지를 긴 쪽 1920px 이하 JPEG로 줄여서 보냄 (작은 PNG·WEBP는 그대로) */
  function stShrink(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var W = im.naturalWidth, H = im.naturalHeight, s = Math.min(1, 1920 / Math.max(W, H));
        if (s === 1 && file.size < 1.5e6 && /^image\/(png|webp|jpeg)$/.test(file.type)) {
          URL.revokeObjectURL(url);
          var fr = new FileReader();
          fr.onload = function () { ok({ type: file.type, b64: String(fr.result).split(',')[1] }); };
          fr.onerror = function () { no(new Error(file.name + ': 읽지 못했습니다.')); };
          fr.readAsDataURL(file); return;
        }
        var cv = document.createElement('canvas'); cv.width = Math.round(W * s); cv.height = Math.round(H * s);
        var g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok({ type: 'image/jpeg', b64: cv.toDataURL('image/jpeg', 0.85).split(',')[1] });
      };
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error(file.name + ': 이미지를 읽지 못했습니다.')); };
      im.src = url;
    });
  }
  $('stImgSave').onclick = function () {
    if (!stNeed()) return;
    var fs = [].slice.call($('stFiles').files || []), sec = Number($('stSec').value) || 10;
    if (fs.length > 10) { msg($('stMsg'), '이미지는 10장까지 올릴 수 있습니다.', '#c0392b'); return; }
    if (!fs.length) {                               // 이미지 없이 누르면 넘김 시간만 바꿈
      admCall('adminStImgs', [{ names: stNames(), files: [], sec: sec }], stRender, $('stMsg')); return;
    }
    msg($('stMsg'), '이미지 줄이는 중…', '#6b7686');
    Promise.all(fs.map(stShrink)).then(function (files) {
      admCall('adminStImgs', [{ names: stNames(), files: files, sec: sec }], function (d) { $('stFiles').value = ''; stRender(d); }, $('stMsg'));
    }).catch(function (e) { msg($('stMsg'), e.message, '#c0392b'); });
  };
  $('stImgClear').onclick = function () {
    if (!stNeed() || !confirm('고른 역 ' + stNames().length + '곳의 안내 이미지를 비울까요? (역 화면에는 시계만 나옵니다)')) return;
    admCall('adminStImgs', [{ names: stNames(), files: [], clear: true }], stRender, $('stMsg'));
  };

  /* ---------- 역 근무자: 우리 역 안내 이미지 (역 코드로 그 역만, QR은 관리자만) ---------- */
  $('smHead').onclick = function () { $('smCard').classList.toggle('open'); };
  function smSend(p, ok) {
    var code = $('smCode').value.trim();
    if (!code) { msg($('smMsg'), '역 코드를 넣으세요.', '#c0392b'); return; }
    msg($('smMsg'), '올리는 중…', '#6b7686');
    google.script.run.withSuccessHandler(function (r) { if (ok) ok(); msg($('smMsg'), r.note, '#12833b'); })
      .withFailureHandler(function (e) { if (/로그인이 필요/.test(errText(e))) { logout(errText(e)); return; } msg($('smMsg'), errText(e), '#c0392b'); })
      .staffStImgs(staff && staff.token || '', code, p);
  }
  $('smSave').onclick = function () {
    var fs = [].slice.call($('smFiles').files || []), sec = Number($('smSec').value) || 10;
    if (fs.length > 10) { msg($('smMsg'), '이미지는 10장까지 올릴 수 있습니다.', '#c0392b'); return; }
    if (!fs.length) { smSend({ files: [], sec: sec }); return; }
    msg($('smMsg'), '이미지 줄이는 중…', '#6b7686');
    Promise.all(fs.map(stShrink)).then(function (files) { smSend({ files: files, sec: sec }, function () { $('smFiles').value = ''; }); })
      .catch(function (e) { msg($('smMsg'), e.message, '#c0392b'); });
  };
  $('smClear').onclick = function () { if (confirm('이 역의 안내 이미지를 비울까요? (역 화면에는 시계만 나옵니다)')) smSend({ files: [], clear: true }); };

