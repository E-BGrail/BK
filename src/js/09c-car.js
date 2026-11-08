  /* ---------- 업무차량관리 화면과 연결 (차량 화면은 src/car/, 같은 페이지 안의 CARAPP) ----------
   * APP_CAR: 지금 차량 화면이 켜져 있는지 (켜져 있으면 e-싸인의 뒤로가기 기록 쌓기를 멈춤)
   * 처음 주소가 ?car·?car=차량번호·?rec=·?mgr=차량번호면 차량 화면으로 시작
   * e-싸인 화면은 하나라서, 차량 화면으로 떠날 때 그 기록 칸에 그때 화면(sv)을 적어 두고 뒤로가기로 오면 그 화면으로 되돌림
   *   (e-싸인 목록 → 차량관리 → DID → 뒤로 → 뒤로 = 목록) */
  var DID_CAR = false;                               // 차량관리의 [DID]로 들어온 DID 화면: 뒤로가기 = 차량관리로 (뒤로가기 칸을 쌓지 않음)
  window.APP_CAR = (function () { var q = new URLSearchParams(location.search); return q.has('car') || q.has('rec') || q.has('mgr'); })();
  if (window.APP_CAR) document.body.classList.add('carOn');
  window.SIGN_LINK = {
    /** 차량 화면으로 떠나기 직전 (CARAPP.go): 지금 e-싸인 기록 칸에 화면 이름을 적음 */
    mark: function () {
      try { history.replaceState(Object.assign({}, history.state, { sv: curScreen, did: DID_CAR }), ''); } catch (x) {}
    },
    /** 차량 화면에서 e-싸인으로 (kind: 'sign' 서명지 목록, 'kiosk' DID / how: 'push'·'replace' 버튼·링크, 'pop' 뒤로가기, st: 그 기록 칸) */
    show: function (kind, how, st) {
      NAV.skip = 0; NAV.n = how === 'pop' ? (st && st.nav) || 0 : 0;   // 이 기록 칸 위에 쌓인 e-싸인 칸 수
      var logged = !!(staff && staff.token);
      if (how === 'pop') {
        var sv = st && st.sv;                          // 떠날 때 적어 둔 화면 (없으면 지금 화면 그대로)
        if (sv && sv !== curScreen) {
          if (!logged || sv === 'sl') show('sl');
          else if (sv === 'sq') kioskOpen();
          else enterList();
        }
        if (sv === 'sq') DID_CAR = !!st.did;            // 그 DID가 차량관리에서 온 것인지도 그때대로
        navApply();
      }
      else if (!logged) { if (kind === 'kiosk') KIOSK_WANT = true; show('sl'); }   // 로그인 전: 로그인 화면 (로그인 뒤 DID)
      else if (kind === 'kiosk') { kioskOpen(); DID_CAR = true; }   // kioskOpen이 목록을 거쳐 가므로 뒤에 (show가 sq 아닌 화면에서 끔)
      else enterList();
      if (logged && !staff.guest) refreshInit(true);   // 목록은 뒤에서 조용히 새로 (예전에 페이지를 새로 열 때처럼)
    }
  };
