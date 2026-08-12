/* Background music, shared by the tenant-facing pages.

   Browsers refuse to play audio until the visitor interacts with the page, so
   this waits for their first click or key press rather than trying on load and
   being silently blocked. The choice is remembered, and the playback position
   carries across pages so moving from the room list to a room does not restart
   the track. */
(function(){
  const PREF = 'utu-music';        // 'on' | 'off', remembered across visits
  const POS  = 'utu-music-time';   // playback position, this tab only

  let audio = null, track = null, started = false;

  const wanted = () => localStorage.getItem(PREF) !== 'off';

  function build(){
    const bar = document.createElement('button');
    bar.id = 'musicToggle';
    bar.type = 'button';
    bar.setAttribute('aria-pressed', String(wanted()));
    bar.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M9 18V5l10-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/>' +
      '<circle cx="16" cy="16" r="3" stroke="currentColor" stroke-width="2"/></svg>' +
      '<span class="label"></span>';
    document.body.appendChild(bar);

    const style = document.createElement('style');
    style.textContent = `
      #musicToggle{position:fixed;left:22px;bottom:22px;z-index:150;display:inline-flex;align-items:center;gap:8px;
        border:1.5px solid var(--line,#F3E3D6);background:var(--white,#fff);color:var(--ink,#241610);
        border-radius:999px;padding:9px 16px;font-family:inherit;font-weight:700;font-size:.82rem;cursor:pointer;
        box-shadow:0 6px 18px rgba(36,22,16,.10);transition:border-color .15s,color .15s}
      #musicToggle:hover{border-color:var(--orange,#F05A0E);color:var(--orange,#F05A0E)}
      #musicToggle[aria-pressed="true"]{background:var(--orange,#F05A0E);border-color:var(--orange,#F05A0E);color:#fff}
      #musicToggle svg{flex:none}
      @media (max-width:560px){ #musicToggle{left:12px;bottom:14px;padding:8px 13px;font-size:.76rem} }
      @media (max-width:400px){ #musicToggle .label{display:none} }
    `;
    document.head.appendChild(style);

    bar.addEventListener('click', toggle);
    return bar;
  }

  function paint(){
    const bar = document.getElementById('musicToggle');
    if (!bar) return;
    const on = wanted();
    bar.setAttribute('aria-pressed', String(on));
    bar.title = on ? 'Turn the music off' : 'Turn the music on';
    bar.querySelector('.label').textContent = on ? 'Music on' : 'Music off';
  }

  function ensureAudio(){
    if (audio) return audio;
    audio = new Audio(track.url);
    audio.loop = true;
    audio.volume = 0.35;              // background, not a performance
    audio.preload = 'none';
    const at = parseFloat(sessionStorage.getItem(POS) || '0');
    if (at > 0) audio.addEventListener('loadedmetadata', () => {
      if (at < audio.duration) audio.currentTime = at;
    }, { once: true });
    audio.addEventListener('timeupdate', () => {
      if (!audio.paused) sessionStorage.setItem(POS, String(audio.currentTime));
    });
    return audio;
  }

  function play(){
    const a = ensureAudio();
    const p = a.play();
    // A rejected promise means the browser still wants a gesture — leave the
    // control showing "off" rather than lying about what is happening.
    if (p && p.catch) p.catch(() => { localStorage.setItem(PREF, 'off'); paint(); });
  }

  function toggle(){
    const on = !wanted();
    localStorage.setItem(PREF, on ? 'on' : 'off');
    paint();
    if (on) play();
    else if (audio) audio.pause();
  }

  function firstGesture(){
    if (started) return;
    started = true;
    if (wanted()) play();
  }

  window.addEventListener('pagehide', () => {
    if (audio && !audio.paused) sessionStorage.setItem(POS, String(audio.currentTime));
  });

  fetch('/api/music')
    .then(r => r.json())
    .then(cfg => {
      // No track configured yet: stay completely out of the way.
      if (!cfg || !cfg.url) return;
      track = cfg;
      build();
      paint();
      document.addEventListener('pointerdown', firstGesture, { once: true });
      document.addEventListener('keydown', firstGesture, { once: true });
    })
    .catch(() => {});
})();
