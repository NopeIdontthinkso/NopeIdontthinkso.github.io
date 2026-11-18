/*!
 * 短劇放映室 嵌入組件 v1（示範版 · YouTube 官方頻道來源）
 *
 * 網站主只要貼上：
 *   <div id="dj-player"></div>
 *   <script async src="https://cdn.example.com/widget/v1.js" data-site="站點密鑰"></script>
 *
 * 可選屬性：
 *   data-layout  auto（預設：寬螢幕嵌在 data-target，手機改浮動按鈕）| inline | float
 *   data-target  容器選擇器，預設 #dj-player
 *   data-series  只播某一部劇（劇 ID）
 *   data-accent  主題色，例如 #7c5cff
 *
 * 網站主頁面可以呼叫：DJWidget.pause() / play() / open() / close()
 * 會在 window 上發出事件：djw:ready、djw:series、djw:play、djw:pause、djw:minimize
 *
 * 說明：YouTube 播放器直接建立在網站主頁面上（不包在組件自己的 iframe 裡），
 * 並保留 YouTube 播放器的標準功能，以符合 YouTube API 服務條款。
 */
(function () {
  if (window.DJWidget && window.DJWidget._loaded) return;

  var script = document.currentScript || document.querySelector('script[src*="widget/v1.js"]');
  var base = script.src.replace(/[^/]*$/, '');
  var cfg = {
    site: script.getAttribute('data-site') || 'demo',
    layout: script.getAttribute('data-layout') || 'auto',
    target: script.getAttribute('data-target') || '#dj-player',
    series: script.getAttribute('data-series') || '',
    accent: script.getAttribute('data-accent') || '#ff5a3c'
  };
  var STORE = 'djw:' + cfg.site;

  // ---------------- 小工具 ----------------
  function emit(type, detail) { try { window.dispatchEvent(new CustomEvent('djw:' + type, { detail: detail || {} })); } catch (e) {} }
  function loadProg() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function saveProg(id, t) { try { var p = loadProg(); p[id] = Math.floor(t); localStorage.setItem(STORE, JSON.stringify(p)); } catch (e) {} }
  function fmt(s) { s = Math.floor(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------- 樣式（Shadow DOM 內，不會影響網站主頁面） ----------------
  var CSS = [
    ':host{all:initial;display:block;visibility:inherit}',
    '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
    '.root{--acc:' + cfg.accent + ';height:100%;display:flex;flex-direction:column;background:#0d0d12;color:#f3f3f6;',
    ' font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;border-radius:14px;overflow:hidden}',
    'button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}',
    '.top{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid #22222c;flex:none}',
    '.brand{font-weight:700;font-size:15px;display:flex;align-items:center;gap:8px;flex:1;min-width:0}',
    '.dot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 10px var(--acc);flex:none}',
    '.ib{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:#a5a5b5;flex:none}',
    '.ib:hover{background:#1c1c25;color:#fff}',
    '.body{flex:1;overflow-y:auto;overscroll-behavior:contain}',
    '.list{padding:10px;display:grid;gap:10px}',
    '.card{display:flex;gap:10px;text-align:left;width:100%;padding:7px;border-radius:12px;background:#15151d;border:1px solid #22222c}',
    '.card:hover{border-color:#383846}',
    '.thumb{position:relative;width:132px;flex:none;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#222}',
    '.thumb img{width:100%;height:100%;object-fit:cover;display:block}',
    '.thumb em{position:absolute;right:4px;bottom:4px;font-style:normal;font-size:10.5px;background:rgba(0,0,0,.75);padding:1px 5px;border-radius:4px}',
    '.thumb i{position:absolute;left:0;bottom:0;height:3px;background:var(--acc)}',
    '.meta{min-width:0;display:flex;flex-direction:column;gap:4px;padding-top:1px}',
    '.meta b{font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.meta span{font-size:11.5px;color:#9a9aab}',
    '.meta .res{color:var(--acc)}',
    '.frame{position:relative;width:100%;aspect-ratio:16/9;background:#000;flex:none}',
    '.frame iframe,.frame > div{position:absolute;inset:0;width:100%;height:100%;border:0}',
    '.poster{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:hidden;background:#000;cursor:pointer}',
    '.poster img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(.72);transform:scale(1.02);transition:transform .4s,filter .3s}',
    '.poster:hover img{transform:scale(1.05);filter:brightness(.82)}',
    '.poster .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 40%,rgba(0,0,0,.75))}',
    '.poster .pbtn{position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;background:var(--acc);',
    ' display:grid;place-items:center;box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 6px rgba(255,255,255,.12);transition:transform .15s}',
    '.poster:hover .pbtn{transform:scale(1.07)}',
    '.poster .ptxt{position:absolute;left:12px;right:12px;bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:8px;font-size:12px;color:#e8e8ef}',
    '.poster .ptxt b{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.poster .ptxt span{flex:none;background:rgba(0,0,0,.55);padding:2px 7px;border-radius:5px}',
    '.poster .res{color:#fff;background:var(--acc)!important}',
    '.info{padding:12px 12px 4px}',
    '.info h3{margin:0 0 6px;font-size:16px;line-height:1.35}',
    '.src{font-size:12px;color:#9a9aab;margin-bottom:8px}',
    '.src a{color:#cfcfe0}',
    '.tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}',
    '.tag{font-size:11px;color:#a5a5b5;border:1px solid #2a2a35;border-radius:5px;padding:1px 6px}',
    '.intro{font-size:13px;line-height:1.65;color:#cfcfd8;margin:0 0 6px}',
    '.sec{font-size:12.5px;color:#9a9aab;padding:10px 12px 0}',
    '.note{font-size:10.5px;color:#6f6f80;padding:8px 12px 12px;line-height:1.5}',
    '.hidden{display:none!important}'
  ].join('');

  // ---------------- YouTube IFrame API（只載入一次） ----------------
  var ytReady = null;
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(function (res) {
      if (window.YT && window.YT.Player) return res(window.YT);
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(window.YT); };
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    });
    return ytReady;
  }

  // ---------------- 組件本體 ----------------
  var CAT = null, ui = null, player = null, cur = null, saveTimer = null, isFloat = false;

  function build(host) {
    var shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + CSS + '</style>' +
      '<div class="root">' +
      ' <div class="top"><button class="ib hidden" data-act="back" aria-label="返回片單"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '  <div class="brand"><span class="dot"></span><span class="bt">短劇放映室</span></div>' +
      '  <button class="ib hidden" data-act="min" aria-label="收起"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></button></div>' +
      ' <div class="body">' +
      '  <div class="shelf"><div class="list"></div></div>' +
      '  <div class="watch hidden"><div class="frame"><div class="yt"></div></div><div class="info"></div><div class="sec">接著看</div><div class="list more"></div></div>' +
      ' </div>' +
      ' <div class="note">影片由 YouTube 官方播放器播放，觀看次數與廣告收益歸原頻道所有。</div>' +
      '</div>';
    var q = function (s) { return shadow.querySelector(s); };
    ui = { shadow: shadow, q: q };
    q('[data-act=back]').onclick = showShelf;
    q('[data-act=min]').onclick = function () { pause(); close(); emit('minimize'); };
    if (isFloat) q('[data-act=min]').classList.remove('hidden');
  }

  function cardHTML(s, prog) {
    var t = prog[s.id];
    var dur = s.durationSec || 0;
    var bar = (t && dur) ? '<i style="width:' + Math.min(100, t / dur * 100) + '%"></i>' : '';
    var sub = t ? '<span class="res">▶ 看到 ' + fmt(t) + '</span>' : '<span>' + esc(s.channel) + ' · ' + esc(s.tags.slice(0, 2).join(' / ')) + '</span>';
    return '<button class="card" data-id="' + esc(s.id) + '"><div class="thumb"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + esc(s.videoId) + '/mqdefault.jpg"><em>' + esc(s.duration) + '</em>' + bar + '</div>' +
      '<div class="meta"><b>' + esc(s.title) + '</b>' + sub + '</div></button>';
  }
  function bindCards(root) {
    root.querySelectorAll('.card').forEach(function (b) { b.onclick = function () { openSeries(b.getAttribute('data-id'), true); }; });
  }

  function showShelf() {
    destroyPlayer();
    var q = ui.q, prog = loadProg();
    q('.shelf').classList.remove('hidden'); q('.watch').classList.add('hidden');
    q('[data-act=back]').classList.add('hidden');
    q('.bt').textContent = CAT.brand;
    q('.shelf .list').innerHTML = CAT.series.map(function (s) { return cardHTML(s, prog); }).join('');
    bindCards(q('.shelf .list'));
    q('.body').scrollTop = 0;
  }

  function openSeries(id, userTap) {
    var s = CAT.series.filter(function (x) { return x.id === id; })[0] || CAT.series[0];
    destroyPlayer();          // 先存好上一部的進度，再切換
    cur = s;
    var q = ui.q, prog = loadProg();
    q('.shelf').classList.add('hidden'); q('.watch').classList.remove('hidden');
    q('[data-act=back]').classList.remove('hidden');
    q('.info').innerHTML = '<h3>' + esc(s.title) + '</h3>' +
      '<div class="src">來源：<a href="' + esc(s.channelUrl) + '" target="_blank" rel="noopener">' + esc(s.channel) + '</a>（YouTube 官方頻道）· 全集 ' + esc(s.duration) + '</div>' +
      '<div class="tags">' + s.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<p class="intro">' + esc(s.intro) + '</p>';
    q('.more').innerHTML = CAT.series.filter(function (x) { return x.id !== s.id; }).map(function (x) { return cardHTML(x, prog); }).join('');
    bindCards(q('.more'));
    q('.body').scrollTop = 0;
    emit('series', { id: s.id });

    showPoster(s, prog[s.id] || 0);
  }

  // 先顯示組件自己的封面（不載入 YouTube），觀眾點了才建立 YouTube 播放器並直接開始播放。
  // 這樣開場不會出現 YouTube 的標題列與按鈕；播放開始後 YouTube 播放器保持原樣、不遮蓋。
  function showPoster(s, start) {
    destroyPlayer();
    var slot = ui.q('.yt');
    var res = start > 5 ? '<span class="res">從 ' + fmt(start) + ' 繼續</span>' : '<span>全集 ' + esc(s.duration) + '</span>';
    slot.innerHTML = '<button class="poster" aria-label="播放 ' + esc(s.title) + '">' +
      '<img alt="" src="https://i.ytimg.com/vi/' + esc(s.videoId) + '/hqdefault.jpg"><div class="shade"></div>' +
      '<div class="pbtn"><svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div>' +
      '<div class="ptxt"><b>' + esc(s.title) + '</b>' + res + '</div></button>';
    slot.querySelector('.poster').onclick = function () { startPlayer(s, start); };
  }

  function startPlayer(s, start) {
    var slot = ui.q('.yt');
    var go = function (YT) {
      var el = document.createElement('div'); slot.innerHTML = ''; slot.appendChild(el);
      player = new YT.Player(el, {
        width: '100%', height: '100%', videoId: s.videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, iv_load_policy: 3, start: Math.floor(start), origin: location.origin },
        events: {
          onReady: function (e) { try { e.target.playVideo(); } catch (err) {} },
          onStateChange: function (e) {
            if (!cur) return;
            if (e.data === 1) { emit('play', { id: cur.id }); startSaving(); }
            if (e.data === 2) { emit('pause', { id: cur.id }); persist(); }
            if (e.data === 0) { saveProg(cur.id, 0); }
          }
        }
      });
    };
    if (window.YT && window.YT.Player) go(window.YT);   // API 已預先載入：在同一次點擊內建立，才能直接播放
    else loadYT().then(go);
  }

  function destroyPlayer() {
    persist(); clearInterval(saveTimer);
    try { if (player && player.destroy) player.destroy(); } catch (e) {}
    player = null;
  }

  function persist() { try { if (player && cur && player.getCurrentTime) saveProg(cur.id, player.getCurrentTime()); } catch (e) {} }
  function startSaving() { clearInterval(saveTimer); saveTimer = setInterval(persist, 5000); }
  function pause() { try { if (player && player.pauseVideo) { player.pauseVideo(); persist(); } } catch (e) {} }
  function play() { try { if (player && player.playVideo) player.playVideo(); } catch (e) {} }

  // ---------------- 版面：嵌入 / 浮動 ----------------
  var panel, launcher, hostEl;
  var FLOAT_CSS = [
    '.djw-launch{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:11px 16px 11px 12px;',
    ' border:0;border-radius:999px;cursor:pointer;color:#fff;font:600 14px/1 -apple-system,"PingFang TC","Noto Sans TC",sans-serif;background:' + cfg.accent + ';box-shadow:0 8px 24px rgba(0,0,0,.35)}',
    '.djw-launch span{width:10px;height:10px;border-radius:50%;background:#fff;animation:djwp 1.8s infinite}',
    '@keyframes djwp{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}70%{box-shadow:0 0 0 9px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}',
    '.djw-panel{position:fixed;right:18px;bottom:18px;z-index:2147483001;width:380px;height:min(660px,calc(100vh - 36px));border-radius:16px;',
    ' box-shadow:0 18px 50px rgba(0,0,0,.5);transform:translateY(16px);opacity:0;visibility:hidden;transition:transform .22s,opacity .22s,visibility .22s;pointer-events:none}',
    '.djw-panel.djw-open{transform:none;opacity:1;visibility:visible;pointer-events:auto}',
    '@media (max-width:640px){.djw-panel{left:0;right:0;bottom:0;width:100%;height:68vh;border-radius:16px 16px 0 0}}'
  ].join('');

  function mountFloat() {
    isFloat = true;
    var st = document.createElement('style'); st.textContent = FLOAT_CSS; document.head.appendChild(st);
    launcher = document.createElement('button'); launcher.className = 'djw-launch';
    launcher.innerHTML = '<span></span>等待時看短劇'; launcher.onclick = open;
    panel = document.createElement('div'); panel.className = 'djw-panel';
    hostEl = document.createElement('div'); hostEl.style.height = '100%';
    panel.appendChild(hostEl);
    document.body.appendChild(launcher); document.body.appendChild(panel);
  }
  function open() { if (!panel) return; panel.classList.add('djw-open'); launcher.style.display = 'none'; }
  function close() { if (!panel) return; panel.classList.remove('djw-open'); launcher.style.display = ''; }

  function init() {
    var el = document.querySelector(cfg.target);
    var layout = cfg.layout === 'auto' ? ((el && window.innerWidth >= 900) ? 'inline' : 'float') : cfg.layout;
    if (layout === 'inline' && el) { hostEl = document.createElement('div'); hostEl.style.height = '100%'; el.appendChild(hostEl); }
    else mountFloat();
    build(hostEl);
    fetch(base + 'catalog.json').then(function (r) { return r.json(); }).then(function (c) {
      CAT = c;
      CAT.series.forEach(function (s) { var p = s.duration.split(':').map(Number); s.durationSec = p.reduce(function (a, b) { return a * 60 + b; }, 0); });
      ui.q('.bt').textContent = CAT.brand;
      if (cfg.series) openSeries(cfg.series, false); else showShelf();
      loadYT();
      emit('ready');
    }).catch(function () { ui.q('.shelf .list').innerHTML = '<p style="color:#999;font-size:13px">片庫載入失敗，請稍後再試。</p>'; });
  }

  window.DJWidget = { _loaded: true, pause: pause, play: play, open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
