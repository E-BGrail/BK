  /* ---------- PDF 서명지: PDF 올리기 → 서명란 자동 찾기 → 서명자 고르기 → 서명 → 완료 PDF ----------
     PDF 도구(pdf.js·pdf-lib)는 쓸 때만 불러옴. 서명란 좌표는 PDF 좌표(왼쪽 아래 0, 쪽 번호 0부터) */
  var PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
  var PDFLIB_SRC = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  var PU_MAX_MB = 10, PU_MAX_PAGES = 30;
  var jsLoads = {};
  function loadJs(src) {
    return jsLoads[src] || (jsLoads[src] = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { delete jsLoads[src]; s.remove(); no(new Error('PDF 도구를 불러오지 못했습니다. 인터넷 연결을 확인하세요.')); };
      document.head.appendChild(s);
    }));
  }
  function pdfJs() {
    return loadJs(PDFJS_BASE + 'build/pdf.min.js').then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'build/pdf.worker.min.js';
      return window.pdfjsLib;
    });
  }

  /*PD-START 서명란 찾기 (시험 파일이 이 부분만 떼어 씀) */
  var PD = (function () {
    var SIGN_HEAD = /^(서명|서명란|서명인|날인|서명날인|서명또는날인|서명또는인|확인|인)$/;
    // 결재란 칸 이름: 기안자·검토·협조 등 + '~장'으로 끝나는 직책 (팀장·운영처장·역무팀장…). 한 줄에 2칸 이상 + 아래 칸이 있을 때만 씀
    var ROLE = /^(결재|결재란|담당|담당자|작성|작성자|기안|기안자|검토|검토자|확인자|승인|승인자|협조|협조자|합의|대리|주임|과장|차장|부장|이사|상무|전무|부사장|감독|감독자|책임자|관리자|[가-힣]{1,6}장)$/;
    var KYUL = /^결재란?$/;
    var MARK = /\(\s*(인|印|서\s*명|서명\s*또는\s*인|서명\s*또는\s*날인)\s*\)/g;
    function mul(m, n) {
      return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    }
    /** 표 선: 가로선 H [{y,x1,x2}], 세로선 V [{x,y1,y2}] (선·얇은 사각형·칸 테두리) */
    function segs(ol, OPS) {
      var H = [], V = [], ctm = [1, 0, 0, 1, 0, 0], st = [];
      var pt = function (x, y) { return [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]; };
      var add = function (a, b) {
        if (Math.abs(a[1] - b[1]) < 1 && Math.abs(a[0] - b[0]) > 3) H.push({ y: (a[1] + b[1]) / 2, x1: Math.min(a[0], b[0]), x2: Math.max(a[0], b[0]) });
        else if (Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) > 3) V.push({ x: (a[0] + b[0]) / 2, y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]) });
      };
      for (var i = 0; i < ol.fnArray.length; i++) {
        var fn = ol.fnArray[i], a = ol.argsArray[i];
        if (fn === OPS.save) st.push(ctm);
        else if (fn === OPS.restore) ctm = st.pop() || ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, a);
        else if (fn === OPS.paintFormXObjectBegin) { st.push(ctm); if (a && a[0]) ctm = mul(ctm, a[0]); }
        else if (fn === OPS.paintFormXObjectEnd) ctm = st.pop() || ctm;
        else if (fn === OPS.constructPath) {
          var ops = a[0], c = a[1], k = 0, cur = null, start = null;
          for (var j = 0; j < ops.length; j++) {
            var o = ops[j];
            if (o === OPS.moveTo) { cur = start = pt(c[k], c[k + 1]); k += 2; }
            else if (o === OPS.lineTo) { var p = pt(c[k], c[k + 1]); k += 2; if (cur) add(cur, p); cur = p; }
            else if (o === OPS.curveTo) { cur = pt(c[k + 4], c[k + 5]); k += 6; }
            else if (o === OPS.curveTo2 || o === OPS.curveTo3) { cur = pt(c[k + 2], c[k + 3]); k += 4; }
            else if (o === OPS.rectangle) {
              var q = [pt(c[k], c[k + 1]), pt(c[k] + c[k + 2], c[k + 1]), pt(c[k] + c[k + 2], c[k + 1] + c[k + 3]), pt(c[k], c[k + 1] + c[k + 3])];
              k += 4;
              var xs = q.map(function (v) { return v[0]; }), ys = q.map(function (v) { return v[1]; });
              var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
              if (y1 - y0 < 2.5) add([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]);          // 얇은 사각형 = 선
              else if (x1 - x0 < 2.5) add([(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]);
              else { add([x0, y0], [x1, y0]); add([x1, y0], [x1, y1]); add([x0, y1], [x1, y1]); add([x0, y0], [x0, y1]); }
              cur = start = q[0];
            }
            else if (o === OPS.closePath) { if (cur && start) add(cur, start); cur = start; }
          }
        }
      }
      return { H: H, V: V };
    }
    /** 글자 조각 → 칸 글자 (같은 줄에서 가깝고 사이에 세로선이 없으면 이어 붙임. '성   명'처럼 띄운 한 글자도) */
    function cells(items, V) {
      var t = items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
        var m = it.transform, fs = Math.hypot(m[2], m[3]) || it.height || 10;
        return { s: it.str, x1: m[4], x2: m[4] + (it.width || fs * it.str.length * 0.9), y: m[5], fs: fs };
      });
      t.sort(function (a, b) { return b.y - a.y || a.x1 - b.x1; });
      var lines = [];
      t.forEach(function (it) {
        var L = null;
        for (var i = 0; i < lines.length && !L; i++) if (Math.abs(lines[i].y - it.y) < Math.max(lines[i].fs, it.fs) * 0.4) L = lines[i];
        if (L) L.items.push(it); else lines.push({ y: it.y, fs: it.fs, items: [it] });
      });
      var out = [], one = /^\s*[가-힣]\s*$/;
      lines.forEach(function (l) {
        l.items.sort(function (a, b) { return a.x1 - b.x1; });
        var c = null;
        l.items.forEach(function (it) {
          var gap = c ? it.x1 - c.x2 : 0, fs = c ? Math.max(c.fs, it.fs) : it.fs, yc = l.y + fs * 0.35;
          var wall = c && V.some(function (v) { return v.x > c.x2 - 1 && v.x < it.x1 + 1 && v.y1 <= yc && v.y2 >= yc; });
          var near = c && (gap < fs * 1.6 || (gap < fs * 3.5 && one.test(it.s) && one.test(c.last)));
          if (c && near && !wall) { c.s += (gap > fs * 0.25 ? ' ' : '') + it.s; c.x2 = Math.max(c.x2, it.x2); c.last = it.s; c.fs = fs; }
          else { c = { s: it.s, x1: it.x1, x2: it.x2, y: l.y, fs: it.fs, last: it.s }; out.push(c); }
        });
      });
      out.forEach(function (c) { c.n = c.s.replace(/[\s()（）:：]/g, ''); c.cx = (c.x1 + c.x2) / 2; c.cy = c.y + c.fs * 0.35; });
      return out;
    }
    /** 칸 아래 줄들: 머릿글 칸 아래의 표 줄 [{y0,y1,x0,x1}] (rows: 최대 줄 수) */
    function rowsBelow(h, S, rows) {
      var ys = S.H.filter(function (l) { return l.x1 <= h.cx + 1 && l.x2 >= h.cx - 1 && l.y < h.cy; })
        .map(function (l) { return l.y; }).sort(function (a, b) { return b - a; });
      var u = [];
      ys.forEach(function (y) { if (!u.length || u[u.length - 1] - y > 4) u.push(y); });   // 겹선은 하나로
      if (!u.length || h.cy - u[0] > h.fs * 4) return [];
      var out = [], first = 0;
      for (var i = 0; i + 1 < u.length && out.length < rows; i++) {
        var top = u[i], bot = u[i + 1], ht = top - bot;
        if (ht > 150) break;
        if (first && (ht > first * 2.2 || ht < first * 0.45)) break;   // 줄 높이가 크게 달라지면 표 끝
        if (!first) first = ht;
        var mid = (top + bot) / 2, l = -1e9, r = 1e9;
        S.V.forEach(function (v) {
          if (v.y1 > mid || v.y2 < mid) return;
          if (v.x < h.cx && v.x > l) l = v.x;
          if (v.x > h.cx && v.x < r) r = v.x;
        });
        if (l < -1e8) l = h.x1 - h.fs; if (r > 1e8) r = h.x2 + h.fs;
        out.push({ x0: l, x1: r, y0: bot, y1: top });
      }
      return out;
    }
    function isHead(c) { return SIGN_HEAD.test(c.n) && !/[(（]/.test(c.s); }   // '(인)'은 머릿글이 아니라 서명 자리
    function box(x0, y0, x1, y1) { var p = 1.5; return { x: x0 + p, y: y0 + p, w: Math.max(4, x1 - x0 - p * 2), h: Math.max(4, y1 - y0 - p * 2) }; }
    function markBox(cx, cy, fs) { var h = Math.max(18, Math.min(40, fs * 2.4)), w = h * 2.4; return { x: cx - w / 2, y: cy - h / 2, w: w, h: h }; }
    /** 한 쪽의 서명란 [{x,y,w,h, g:[그룹 y, 그룹 x, 줄]}] */
    function page(items, S) {
      var cs = cells(items, S.V), out = [];
      var push = function (b, gy, gx, i) { b.g = [gy, gx, i]; out.push(b); };
      cs.forEach(function (c) {
        if (isHead(c) && !ROLE.test(c.n)) {                       // 표 머릿글 '서명' 등: 아래 줄마다
          var rs = rowsBelow(c, S, 60);
          if (rs.length) rs.forEach(function (r, i) { push(box(r.x0, r.y0, r.x1, r.y1), c.cy, c.cx, i); });
          else if (/^서명/.test(c.n)) { var h = Math.max(18, c.fs * 2.4); push({ x: c.cx - h * 1.2, y: c.y - c.fs * 0.6 - h, w: h * 2.4, h: h }, c.cy, c.cx, 0); }
        }
      });
      cs.forEach(function (c) {                                                // 결재란: 한 줄에 직책 칸이 둘 이상, 또는 '결재' 글자 오른쪽 칸 (이름이 무엇이든)
        if (KYUL.test(c.n) || isHead(c)) return;
        var line = cs.filter(function (d) { return d !== c && Math.abs(d.cy - c.cy) < Math.max(c.fs, d.fs) * 0.6; });
        var byKyul = line.some(function (d) { return KYUL.test(d.n) && d.x2 <= c.x1 + 1; });
        if (!byKyul && !(ROLE.test(c.n) && line.some(function (d) { return ROLE.test(d.n) && !KYUL.test(d.n); }))) return;
        var rs = rowsBelow(c, S, 1);
        if (rs.length) push(box(rs[0].x0, rs[0].y0, rs[0].x1, rs[0].y1), c.cy, c.cx, 0);
      });
      cs.forEach(function (c) {                                                // 글 속 '(인)'·'(서명)' 자리, '서명 : ____'
        if (isHead(c)) return;
        var m, len = c.s.length || 1, wd = c.x2 - c.x1;
        MARK.lastIndex = 0;
        while ((m = MARK.exec(c.s))) push(markBox(c.x1 + wd * (m.index + m[0].length / 2) / len, c.cy, c.fs), c.cy, c.x1 + wd * m.index / len, 0);
        var lab = /서\s*명\s*[:：]\s*_*\s*$/.exec(c.s);
        if (lab) { var b = markBox(0, c.cy, c.fs), x0 = c.x1 + wd * (lab.index + lab[0].replace(/[_\s]+$/, '').length) / len + 3; b.x = x0; push(b, c.cy, c.x1, 0); }
      });
      var kept = [];                                                           // 다른 칸 안에 들어가는 자리는 뺌 (표 칸 안의 '(인)' 등)
      out.forEach(function (b) {
        var mx = b.x + b.w / 2, my = b.y + b.h / 2;
        if (!kept.some(function (k) { return mx > k.x && mx < k.x + k.w && my > k.y && my < k.y + k.h; })) kept.push(b);
      });
      kept.sort(function (a, b) { return Math.abs(a.g[0] - b.g[0]) > 3 ? b.g[0] - a.g[0] : a.g[1] - b.g[1] || a.g[2] - b.g[2]; });
      return kept.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h }; });
    }
    return { page: page, segs: segs, cells: cells };
  })();
  /*PD-END*/

  /* ---------- 만들기 화면 (su) ---------- */
  var PU = null;
  function puReset() {
    PU = { b64: '', name: '', pages: [], fields: [], signers: [], busy: false, seq: (PU && PU.seq || 0) + 1 };
    $('puTitle').value = ''; $('puFile').value = ''; $('puFind').value = ''; $('puHits').innerHTML = '';
    $('puPages').innerHTML = ''; $('puPrevCard').classList.add('hidden');
    msg($('puMsg'), ''); msg($('puMsg2'), ''); puDrawSigners();
  }
  function puOpen() { puReset(); $('newCard').classList.remove('open'); show('su'); }   // 새 서명지 열기 → 양식 [PDF 서명지]
  $('puBack').onclick = function () { if (!PU || !PU.busy) resetAll(); };

  function bytesB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  $('puFile').onchange = function () {
    var f = this.files && this.files[0], seq = PU.seq;
    PU.b64 = ''; PU.pages = []; PU.fields = []; $('puPages').innerHTML = ''; $('puPrevCard').classList.add('hidden');
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { msg($('puMsg'), 'PDF 파일을 고르세요. 한글·엑셀 파일은 먼저 PDF로 저장하세요.', '#c0392b'); return; }
    if (f.size > PU_MAX_MB * 1024 * 1024) { msg($('puMsg'), 'PDF 파일은 ' + PU_MAX_MB + 'MB까지 올릴 수 있습니다.', '#c0392b'); return; }
    if (!$('puTitle').value.trim()) $('puTitle').value = f.name.replace(/\.pdf$/i, '').slice(0, 60);
    PU.name = f.name;
    msg($('puMsg'), 'PDF를 읽고 서명란을 찾는 중…', '#6b7686');
    var rd = new FileReader();
    rd.onerror = function () { msg($('puMsg'), '파일을 읽지 못했습니다.', '#c0392b'); };
    rd.onload = function () {
      var u8 = new Uint8Array(rd.result);
      if (seq !== PU.seq) return;
      PU.b64 = bytesB64(u8);
      pdfJs().then(function (lib) {
        return lib.getDocument({ data: u8.slice(), cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS_BASE + 'standard_fonts/' }).promise;
      }).then(function (doc) {
        if (doc.numPages > PU_MAX_PAGES) throw new Error('PDF는 ' + PU_MAX_PAGES + '쪽까지 올릴 수 있습니다.');
        var chain = Promise.resolve(), found = [], textAny = false;
        for (var i = 1; i <= doc.numPages; i++) (function (n) {
          chain = chain.then(function () { return doc.getPage(n); }).then(function (pg) {
            return Promise.all([pg.getTextContent(), pg.getOperatorList()]).then(function (r) {
              if (r[0].items.some(function (it) { return it.str && it.str.trim(); })) textAny = true;
              PD.page(r[0].items, PD.segs(r[1], window.pdfjsLib.OPS)).forEach(function (b) { b.p = n - 1; found.push(b); });
              PU.pages.push({ pg: pg, vp: pg.getViewport({ scale: 1 }) });
            });
          });
        })(i);
        return chain.then(function () {
          if (seq !== PU.seq) return;
          PU.fields = found;
          msg($('puMsg'), !textAny ? '글자가 없는 PDF(스캔·사진)라 서명란을 찾지 못했습니다. 미리보기에서 서명할 자리를 눌러 추가하세요.' :
            found.length ? '서명란 ' + found.length + '개를 찾았습니다. 아래 미리보기에서 확인하세요.' : '서명란을 찾지 못했습니다. 미리보기에서 서명할 자리를 눌러 추가하세요.',
            textAny && found.length ? '#12833b' : '#c0392b');
          return puRender();
        });
      }).catch(function (x) {
        if (seq !== PU.seq) return;
        PU.b64 = ''; PU.pages = [];
        msg($('puMsg'), /password|encrypt/i.test(errText(x)) ? '암호가 걸린 PDF는 올릴 수 없습니다.' : /PDF 도구|쪽까지/.test(errText(x)) ? errText(x) : 'PDF를 읽지 못했습니다: ' + errText(x), '#c0392b');
      });
    };
    rd.readAsArrayBuffer(f);
  };

  /** 미리보기: 쪽마다 그림 + 서명란 상자 (번호 = 서명 순서, 누르면 지움, 빈 곳을 누르면 추가) */
  function puRender() {
    var box = $('puPages'), seq = PU.seq; box.innerHTML = '';
    $('puPrevCard').classList.remove('hidden');
    var cw = Math.max(240, box.clientWidth || 340), dpr = Math.min(2, window.devicePixelRatio || 1);
    var chain = Promise.resolve();
    PU.pages.forEach(function (P, i) {
      var wrap = document.createElement('div'); wrap.className = 'puPg';
      var cv2 = document.createElement('canvas'), layer = document.createElement('div'); layer.className = 'puLayer';
      var sc = cw * dpr / P.vp.width, vp = P.pg.getViewport({ scale: sc });
      cv2.width = Math.round(vp.width); cv2.height = Math.round(vp.height);
      wrap.style.aspectRatio = P.vp.width + ' / ' + P.vp.height;
      wrap.appendChild(cv2); wrap.appendChild(layer); box.appendChild(wrap);
      var no = document.createElement('div'); no.className = 'puNo'; no.textContent = (i + 1) + ' / ' + PU.pages.length + '쪽'; wrap.appendChild(no);
      layer.onclick = function (ev) { puTap(i, layer, ev); };
      chain = chain.then(function () { if (seq === PU.seq) return P.pg.render({ canvasContext: cv2.getContext('2d'), viewport: vp }).promise; });
    });
    puDrawBoxes();
    return chain;
  }
  function puRect(f) {                        // PDF 좌표 → 쪽 그림 안의 % 위치 (회전된 쪽도)
    var vp = PU.pages[f.p].vp, a = vp.convertToViewportPoint(f.x, f.y), b = vp.convertToViewportPoint(f.x + f.w, f.y + f.h);
    return { l: Math.min(a[0], b[0]) / vp.width * 100, t: Math.min(a[1], b[1]) / vp.height * 100,
      w: Math.abs(a[0] - b[0]) / vp.width * 100, h: Math.abs(a[1] - b[1]) / vp.height * 100 };
  }
  function puDrawBoxes() {
    var layers = $('puPages').querySelectorAll('.puLayer');
    [].forEach.call(layers, function (l) { l.innerHTML = ''; });
    PU.fields.forEach(function (f, i) {
      var l = layers[f.p]; if (!l) return;
      var r = puRect(f), d = document.createElement('div'), s = PU.signers[i];
      d.className = 'puBox' + (s ? '' : ' extra');
      d.style.left = r.l + '%'; d.style.top = r.t + '%'; d.style.width = r.w + '%'; d.style.height = r.h + '%';
      var lb = document.createElement('span'); lb.textContent = (i + 1) + (s ? ' ' + s.name : ''); d.appendChild(lb);   // 회색 칸 = 서명자 없음
      d.onclick = function (ev) { ev.stopPropagation(); PU.fields.splice(i, 1); puDrawBoxes(); };
      l.appendChild(d);
    });
    puCount();
  }
  function puTap(i, layer, ev) {
    var P = PU.pages[i], rc = layer.getBoundingClientRect();
    var px = (ev.clientX - rc.left) / rc.width * P.vp.width, py = (ev.clientY - rc.top) / rc.height * P.vp.height;
    var c = P.vp.convertToPdfPoint(px, py);
    var hs = PU.fields.map(function (f) { return f.h; }).sort(function (a, b) { return a - b; });
    var h = hs.length ? Math.min(60, Math.max(16, hs[hs.length >> 1])) : 26, w = h * 2.4;
    PU.fields.push({ p: i, x: c[0] - w / 2, y: c[1] - h / 2, w: w, h: h });
    puDrawBoxes();
  }
  function puCount() {
    var nf = PU.fields.length, ns = PU.signers.length, ok = nf === ns && ns > 0;
    $('puCount').textContent = '서명란 ' + nf + '개 · 서명자 ' + ns + '명' + (ok ? '' : nf > ns ? ' → 서명자를 더 넣거나 남는 칸을 눌러 지우세요' : ns ? ' → 미리보기 빈 곳을 눌러 칸을 추가하세요' : '');
    $('puCount').style.color = ok ? '#12833b' : '#b42318';
  }

  /* 서명자: 이름으로 찾아 추가 (추가한 순서 = 서명 순서 = 서명란 번호) */
  function puFind() {
    var q = $('puFind').value.trim();
    if (!q) { msg($('puMsg2'), '찾을 이름을 입력하세요.', '#c0392b'); return; }
    $('puFindBtn').disabled = true; msg($('puMsg2'), '찾는 중…', '#6b7686');
    google.script.run.withSuccessHandler(function (list) {
      $('puFindBtn').disabled = false; msg($('puMsg2'), list.length ? '' : '"' + q + '" 직원을 찾지 못했습니다.', '#c0392b');
      var box = $('puHits'); box.innerHTML = '';
      list.forEach(function (p) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'puHit';
        b.textContent = p.name + (p.disp ? ' ' + p.disp : '') + (p.dept ? ' · ' + p.dept : '');
        b.onclick = function () {
          if (PU.signers.some(function (s) { return s.key === p.key; })) { msg($('puMsg2'), p.name + ' 님은 이미 넣었습니다.', '#c0392b'); return; }
          PU.signers.push(p); box.innerHTML = ''; $('puFind').value = ''; msg($('puMsg2'), ''); puDrawSigners(); $('puFind').focus();
        };
        box.appendChild(b);
      });
      if (list.length === 1) box.firstChild.focus();
    }).withFailureHandler(function (x) {
      $('puFindBtn').disabled = false;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('puMsg2'), errText(x), '#c0392b');
    }).pdfStaffFind(staff && staff.token || '', q);
  }
  $('puFindBtn').onclick = puFind;
  $('puFind').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); puFind(); } });
  function puDrawSigners() {
    var ol = $('puSigners'); ol.innerHTML = '';
    PU.signers.forEach(function (s, i) {
      var li = document.createElement('li'), t = document.createElement('span'), x = document.createElement('button');
      t.textContent = s.name + (s.disp ? ' ' + s.disp : '') + (s.dept ? ' · ' + s.dept : '');
      x.type = 'button'; x.className = 'puDel'; x.textContent = '빼기';
      x.onclick = function () { PU.signers.splice(i, 1); puDrawSigners(); };
      li.appendChild(t); li.appendChild(x); ol.appendChild(li);
    });
    if (PU.pages.length) puDrawBoxes(); else puCount();
  }

  $('puSave').onclick = function () {
    if (PU.busy) return;
    var title = $('puTitle').value.trim(), bad = function (t) { msg($('puMsg2'), t, '#c0392b'); };
    if (!PU.b64 || !PU.pages.length) return bad('PDF 파일을 고르세요.');
    if (!title) return bad('제목을 입력하세요.');
    if (!PU.signers.length) return bad('서명자를 한 명 이상 넣으세요.');
    if (PU.fields.length !== PU.signers.length) return bad('서명란(' + PU.fields.length + '개)과 서명자(' + PU.signers.length + '명) 수를 맞추세요.');
    PU.busy = true; $('puSave').disabled = true; msg($('puMsg2'), '올리는 중…', '#6b7686');
    var done = function () { PU.busy = false; $('puSave').disabled = false; };
    google.script.run.withSuccessHandler(function (r) {
      done(); edTab = 'open'; resetAll(); loadInit(r); msg($('msg1'), r.note || '', '#12833b');
    }).withFailureHandler(function (x) {
      done();
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      bad(errText(x));
    }).pdfCreate(staff && staff.token || '', { title: title, name: PU.name, pdf: PU.b64, pages: PU.pages.length,
      fields: PU.fields.map(function (f) { return { p: f.p, x: f.x, y: f.y, w: f.w, h: f.h }; }),
      signers: PU.signers.map(function (s) { return s.key; }) });
  };

  /* ---------- 목록 카드 ---------- */
  function pdfItem(e) {
    var ps = e.pdfSign || {}, closed = e.open === false;
    var b = document.createElement('button');
    b.className = 'person pdfCard' + (closed ? ' closed' : '');
    b.innerHTML = '<span><span class="pdfTag">PDF 서명</span><b></b><br><span class="rank"></span><span class="pdfNames"></span></span><span class="badge"></span>';
    b.querySelector('b').textContent = e.title;
    b.querySelector('.rank').textContent = [ps.owner ? '올린 사람 ' + ps.owner : '', e.date].filter(Boolean).join(' · ');
    var nm = b.querySelector('.pdfNames');
    (ps.names || []).forEach(function (p, i) {
      if (i) nm.appendChild(document.createTextNode(' · '));
      var s = document.createElement('span'); s.className = p.ok ? 'ok' : ''; s.textContent = p.n + (p.ok ? ' ✔' : ''); nm.appendChild(s);
    });
    if (closed && e.pdfDl) { var dl = document.createElement('span'); dl.className = 'pdfDl'; dl.textContent = '✓ PDF 받음 · ' + (e.pdfDl.n || '') + ' ' + (e.pdfDl.at || ''); nm.parentNode.appendChild(dl); }
    var mine = ps.me > -1;
    b.querySelector('.badge').textContent = closed ? '서명 완료' : mine ? (ps.signed ? '재서명' : '서명') : '진행 중';
    b.onclick = function () { pdfView(e); };          // 누르면 문서 미리보기 (서명자는 그 화면에서 [서명하기])
    return b;
  }
  /* ---------- 미리보기 (sv): 문서만 (다른 사람 서명은 안 보임), 내 서명란은 빨간 칸 ---------- */
  var PV = { e: null, seq: 0, last: null };          // last: 마지막으로 받은 문서 { id, d } (다시 열 때 서버를 안 부름)
  function pdfView(e) {
    var ps = e.pdfSign || {}, seq = ++PV.seq, canSign = e.open !== false && ps.me > -1;
    PV.e = e;
    $('pvTitle').textContent = e.title;
    $('pvInfo').textContent = [ps.owner ? '올린 사람 ' + ps.owner : '', e.date].filter(Boolean).join(' · ') +
      (ps.names && ps.names.length ? '\n서명자: ' + ps.names.map(function (p) { return p.n + (p.ok ? ' ✔' : ''); }).join(' · ') : '');
    $('pvSign').classList.toggle('hidden', !canSign); $('pvSign').textContent = ps.signed ? '다시 서명하기' : '서명하기';
    $('pvPages').innerHTML = ''; msg($('pvMsg'), '문서를 불러오는 중…', '#6b7686');
    show('sv');
    var got = PV.last && PV.last.id === e.id ? Promise.resolve(PV.last.d) : new Promise(function (ok, no) {
      google.script.run.withSuccessHandler(ok).withFailureHandler(no).pdfView(staff && staff.token || '', e.id);
    });
    got.then(function (d) {
      PV.last = { id: e.id, d: d };
      return pdfJs().then(function (lib) {
        return lib.getDocument({ data: b64Bytes(d.pdf), cMapUrl: PDFJS_BASE + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS_BASE + 'standard_fonts/' }).promise;
      }).then(function (doc) { if (seq === PV.seq) return pvRender(doc, d.mine, seq); });
    }).then(function () {
      if (seq !== PV.seq) return;
      msg($('pvMsg'), canSign ? '빨간 칸이 내 서명이 들어갈 자리입니다. 두 손가락으로 벌려 크게 볼 수 있습니다.' : '', '#324eb3');
    }).catch(function (x) {
      if (seq !== PV.seq) return;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('pvMsg'), errText(x), '#c0392b');
    });
  }
  function pvRender(doc, mine, seq) {
    var box = $('pvPages'), cw = Math.max(240, box.clientWidth || 340), dpr = Math.min(2, window.devicePixelRatio || 1), chain = Promise.resolve();
    for (var i = 1; i <= doc.numPages; i++) (function (n) {
      chain = chain.then(function () { return seq === PV.seq && doc.getPage(n); }).then(function (pg) {
        if (!pg || seq !== PV.seq) return;
        var vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: cw * dpr / vp1.width });
        var wrap = document.createElement('div'), cv2 = document.createElement('canvas'), layer = document.createElement('div');
        wrap.className = 'puPg'; layer.className = 'puLayer'; wrap.style.aspectRatio = vp1.width + ' / ' + vp1.height;
        cv2.width = Math.round(vp.width); cv2.height = Math.round(vp.height);
        wrap.appendChild(cv2); wrap.appendChild(layer);
        var no = document.createElement('div'); no.className = 'puNo'; no.textContent = n + ' / ' + doc.numPages + '쪽'; wrap.appendChild(no);
        if (mine && mine.p === n - 1) {
          var a = vp1.convertToViewportPoint(mine.x, mine.y), b = vp1.convertToViewportPoint(mine.x + mine.w, mine.y + mine.h), d = document.createElement('div');
          d.className = 'puBox'; d.style.left = Math.min(a[0], b[0]) / vp1.width * 100 + '%'; d.style.top = Math.min(a[1], b[1]) / vp1.height * 100 + '%';
          d.style.width = Math.abs(a[0] - b[0]) / vp1.width * 100 + '%'; d.style.height = Math.abs(a[1] - b[1]) / vp1.height * 100 + '%';
          var lb = document.createElement('span'); lb.textContent = '내 서명'; d.appendChild(lb); layer.appendChild(d);
        }
        box.appendChild(wrap);
        return pg.render({ canvasContext: cv2.getContext('2d'), viewport: vp }).promise;
      });
    })(i);
    return chain;
  }
  $('pvBack').onclick = function () { PV.seq++; resetAll(); };
  $('pvSign').onclick = function () { if (PV.e) pdfSignStart(PV.e); };

  function pdfSignStart(e) {
    var ps = e.pdfSign || {};
    edu = { id: e.id, title: e.title, date: e.date, pdf: true }; code = '';
    person = { name: staff.name, disp: staff.disp || '', already: !!ps.signed };
    person.r = { name: person.name, disp: person.disp, already: person.already };
    fillSign(person.r);
    show('s2'); setupCanvas(); clearPad();
    msg($('msg2'), '');
  }

  /* ---------- 완료 PDF: 원본 + 서명 그림을 서명란에 찍어서 저장 ---------- */
  var pdfDlBusy = false;
  function pdfDownload(e) {
    if (pdfDlBusy) return;
    pdfDlBusy = true; msg($('msg1'), e.title + ' PDF 만드는 중…', '#6b7686');
    var fail = function (x) {
      pdfDlBusy = false;
      if (/로그인이 필요/.test(errText(x))) { logout(errText(x)); return; }
      msg($('msg1'), errText(x), '#c0392b');
    };
    google.script.run.withSuccessHandler(function (r) {
      loadJs(PDFLIB_SRC).then(function () { return pdfStamp(r); }).then(function (bytes) {
        pdfDlBusy = false;
        saveFile(r.base + '_서명.pdf', new Blob([bytes], { type: 'application/pdf' }));
        if (r.dl) { e.pdfDl = r.dl; renderEdus(); }
        msg($('msg1'), 'PDF를 저장했습니다. 컴퓨터·휴대폰 다운로드 폴더를 확인하세요.', '#12833b');
      }).catch(fail);
    }).withFailureHandler(fail).pdfGet(staff && staff.token || '', e.id);
  }
  function pdfStamp(r) {
    var L = window.PDFLib;
    return L.PDFDocument.load(b64Bytes(r.pdf), { ignoreEncryption: true }).then(function (doc) {
      var pages = doc.getPages();
      return Promise.all(r.sigs.map(function (s) { return doc.embedPng(b64Bytes(String(s).split(',')[1] || '')); })).then(function (imgs) {
        r.fields.forEach(function (f, i) {
          var pg = pages[f.p], im = imgs[i]; if (!pg || !im) return;
          var sc = Math.min(f.w / im.width, f.h / im.height), w = im.width * sc, h = im.height * sc;
          pg.drawImage(im, { x: f.x + (f.w - w) / 2, y: f.y + (f.h - h) / 2, width: w, height: h });
        });
        return doc.save();
      });
    });
  }
