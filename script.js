/* ============================
   CINEMA PROFILE — script.js
   Works with your HTML + CSS.
   No libs.
   ============================ */

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function setAriaHidden(el, hidden) {
    if (!el) return;
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
  }

  // Simple focus trap for dialogs
  function trapFocus(modalEl) {
    const focusables = $$(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      modalEl
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    function onKeyDown(e) {
      if (e.key !== "Tab") return;
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    modalEl.addEventListener("keydown", onKeyDown);
    return () => modalEl.removeEventListener("keydown", onKeyDown);
  }

  // ---------- Theme toggle (Dark/Light) ----------
  const btnMode = $("#btnMode");
  const modeText = $("#modeText");
  const rootHtml = document.documentElement;

  function applyTheme(theme) {
    rootHtml.setAttribute("data-theme", theme);
    if (modeText) modeText.textContent = theme === "light" ? "Light" : "Dark";
    try {
      localStorage.setItem("cinemaTheme", theme);
    } catch {}
  }

  function toggleTheme() {
    const current = rootHtml.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  // Load saved theme
  try {
    const saved = localStorage.getItem("cinemaTheme");
    if (saved === "light" || saved === "dark") applyTheme(saved);
  } catch {}

  btnMode?.addEventListener("click", toggleTheme);

  // ---------- Animated counters ----------
  const counters = $$(".num[data-count]");
  let countersRan = false;

  function animateCounters() {
    if (countersRan) return;
    countersRan = true;

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    counters.forEach((el) => {
      const raw = el.getAttribute("data-count");
      const target = Number(raw);
      if (!Number.isFinite(target)) return;

      // If reduced motion, set immediately
      if (prefersReduced) {
        el.textContent = formatCount(target);
        return;
      }

      const duration = 900 + Math.random() * 450;
      const start = performance.now();
      const startVal = 0;

      function tick(now) {
        const t = clamp((now - start) / duration, 0, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const val = Math.round(startVal + (target - startVal) * eased);
        el.textContent = formatCount(val);
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function formatCount(n) {
    if (n >= 1000) {
      const k = n / 1000;
      // 1200 -> 1.2K, 1000 -> 1K
      const str = k % 1 === 0 ? `${k.toFixed(0)}K` : `${k.toFixed(1)}K`;
      return str.replace(".0K", "K");
    }
    return String(n);
  }

  // Run counters when page is ready
  window.addEventListener("load", animateCounters, { once: true });

  // ---------- Friends modal ----------
  const btnFriends = $("#btnFriends");
  const modalFriends = $("#modalFriends");
  let releaseFriendsTrap = null;
  let lastFocusEl = null;

  function openFriends() {
    if (!modalFriends) return;
    lastFocusEl = document.activeElement;
    setAriaHidden(modalFriends, false);

    // Focus first close button
    const closeBtn = $('[data-close]', modalFriends);
    closeBtn?.focus();

    // Trap focus
    releaseFriendsTrap?.();
    releaseFriendsTrap = trapFocus(modalFriends);

    document.addEventListener("keydown", onFriendsKeydown);
  }

  function closeFriends() {
    if (!modalFriends) return;
    setAriaHidden(modalFriends, true);
    releaseFriendsTrap?.();
    releaseFriendsTrap = null;
    document.removeEventListener("keydown", onFriendsKeydown);
    if (lastFocusEl && typeof lastFocusEl.focus === "function") lastFocusEl.focus();
  }

  function onFriendsKeydown(e) {
    if (e.key === "Escape") closeFriends();
  }

  btnFriends?.addEventListener("click", openFriends);

  // Close friends on click of buttons with data-close, or backdrop click
  modalFriends?.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.matches?.("[data-close]")) closeFriends();
    if (t === modalFriends) closeFriends(); // backdrop
  });

  // Fix accidental broken URL in your cast list (httpsatimg.com ...)
  // This prevents a dead image in the modal.
  $$(".castItem img", modalFriends || document).forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("httpsatimg.com/")) {
      img.setAttribute("src", src.replace("httpsatimg.com/", "https://xatimg.com/"));
    }
  });

  // ---------- Photos gallery + lightbox ----------
  const btnPhotos = $("#btnPhotos");
  const gallery = $("#gallery");
  const galleryWall = $("#galleryWall");
  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImg");

  const closeGalleryBtns = $$("[data-close-gallery]", gallery || document);
  const closeLightboxBtn = $(".lbClose", lightbox || document);
  const prevBtn = $(".nav.prev", lightbox || document);
  const nextBtn = $(".nav.next", lightbox || document);

  let frames = [];
  let currentIndex = 0;
  let releaseGalleryTrap = null;
  let releaseLightboxTrap = null;
  let lastFocusBeforeGallery = null;
  let lastFocusBeforeLightbox = null;

  function collectFrames() {
    frames = $$("button.frame[data-img]", galleryWall || document);
  }
  collectFrames();

  function openGallery() {
    if (!gallery) return;
    lastFocusBeforeGallery = document.activeElement;
    setAriaHidden(gallery, false);

    // focus close
    const closeBtn = $("[data-close-gallery]", gallery);
    closeBtn?.focus();

    releaseGalleryTrap?.();
    releaseGalleryTrap = trapFocus(gallery);

    document.addEventListener("keydown", onGalleryKeydown);
  }

  function closeGallery() {
    if (!gallery) return;

    // close lightbox too if open
    if (lightbox?.getAttribute("aria-hidden") === "false") closeLightbox();

    setAriaHidden(gallery, true);
    releaseGalleryTrap?.();
    releaseGalleryTrap = null;
    document.removeEventListener("keydown", onGalleryKeydown);

    if (lastFocusBeforeGallery && typeof lastFocusBeforeGallery.focus === "function") {
      lastFocusBeforeGallery.focus();
    }
  }

  function onGalleryKeydown(e) {
    if (e.key === "Escape") {
      // If lightbox open, close only that; otherwise close gallery
      if (lightbox?.getAttribute("aria-hidden") === "false") closeLightbox();
      else closeGallery();
    }
  }

  btnPhotos?.addEventListener("click", openGallery);
  closeGalleryBtns.forEach((b) => b.addEventListener("click", closeGallery));

  // Clicking the gallery backdrop closes it (but not when clicking inside content)
  gallery?.addEventListener("click", (e) => {
    if (e.target === gallery) closeGallery();
  });

  // Open lightbox from any frame
  galleryWall?.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button.frame[data-img]");
    if (!btn) return;
    const idx = frames.indexOf(btn);
    if (idx >= 0) openLightbox(idx);
  });

  function openLightbox(index) {
    if (!lightbox || !lightboxImg) return;

    lastFocusBeforeLightbox = document.activeElement;

    setAriaHidden(lightbox, false);
    currentIndex = clamp(index, 0, frames.length - 1);
    loadLightboxImage();

    // focus close (nice for keyboard)
    closeLightboxBtn?.focus();

    releaseLightboxTrap?.();
    releaseLightboxTrap = trapFocus(lightbox);

    document.addEventListener("keydown", onLightboxKeydown);
  }

  function closeLightbox() {
    if (!lightbox) return;
    setAriaHidden(lightbox, true);

    releaseLightboxTrap?.();
    releaseLightboxTrap = null;

    document.removeEventListener("keydown", onLightboxKeydown);

    if (lastFocusBeforeLightbox && typeof lastFocusBeforeLightbox.focus === "function") {
      lastFocusBeforeLightbox.focus();
    }
  }

  function loadLightboxImage() {
    const btn = frames[currentIndex];
    const src = btn?.getAttribute("data-img");
    if (!src || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = `Expanded photo ${currentIndex + 1}`;
  }

  function prevImage() {
    if (!frames.length) return;
    currentIndex = (currentIndex - 1 + frames.length) % frames.length;
    loadLightboxImage();
  }

  function nextImage() {
    if (!frames.length) return;
    currentIndex = (currentIndex + 1) % frames.length;
    loadLightboxImage();
  }

  function onLightboxKeydown(e) {
    if (e.key === "ArrowLeft") prevImage();
    if (e.key === "ArrowRight") nextImage();
    if (e.key === "Escape") closeLightbox();
  }

  prevBtn?.addEventListener("click", prevImage);
  nextBtn?.addEventListener("click", nextImage);
  closeLightboxBtn?.addEventListener("click", closeLightbox);

  // Click outside the image closes lightbox
  lightbox?.addEventListener("click", (e) => {
    const t = e.target;
    if (t === lightbox) closeLightbox();
  });

  // Touch swipe support for lightbox
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  lightbox?.addEventListener(
    "touchstart",
    (e) => {
      if (lightbox.getAttribute("aria-hidden") !== "false") return;
      if (!e.touches || e.touches.length !== 1) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  lightbox?.addEventListener(
    "touchend",
    (e) => {
      if (!touchActive) return;
      touchActive = false;
      if (!e.changedTouches || e.changedTouches.length !== 1) return;

      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // Only horizontal swipes
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;

      if (dx > 0) prevImage();
      else nextImage();
    },
    { passive: true }
  );

  // ---------- Sparks canvas (ambient particles) ----------
  const canvas = $("#sparks");
  const ctx = canvas?.getContext?.("2d", { alpha: true });

  let W = 0;
  let H = 0;
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let particles = [];
  let rafId = null;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    if (!W || !H) return;
    const count = clamp(Math.floor((W * H) / 38000), 14, 46);

    particles = new Array(count).fill(0).map(() => makeParticle(true));
  }

  function makeParticle(initial = false) {
    const y = initial ? Math.random() * H : H + 10 + Math.random() * 80;
    return {
      x: Math.random() * W,
      y,
      r: 0.8 + Math.random() * 1.8,
      a: 0.18 + Math.random() * 0.22,
      vx: (-0.25 + Math.random() * 0.5) * (0.6 + Math.random()),
      vy: -(0.45 + Math.random() * 1.2),
      tw: 0.8 + Math.random() * 1.4, // twinkle speed
      t: Math.random() * Math.PI * 2
    };
  }

  function draw() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, W, H);

    // subtle glow style
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      // movement
      p.x += p.vx;
      p.y += p.vy;

      // wrap
      if (p.y < -80) {
        Object.assign(p, makeParticle(false));
        p.y = H + 10 + Math.random() * 100;
      }
      if (p.x < -60) p.x = W + 60;
      if (p.x > W + 60) p.x = -60;

      // twinkle
      p.t += 0.035 * p.tw;
      const alpha = p.a * (0.65 + 0.35 * Math.sin(p.t));

      // draw spark
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 210, 160, ${alpha.toFixed(3)})`;
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    rafId = requestAnimationFrame(draw);
  }

  function startSparks() {
    if (!canvas || !ctx) return;
    resizeCanvas();
    seedParticles();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(draw);
  }

  function stopSparks() {
    cancelAnimationFrame(rafId);
    rafId = null;
    ctx?.clearRect?.(0, 0, W, H);
  }

  if (!prefersReducedMotion) {
    window.addEventListener("load", startSparks, { once: true });
    window.addEventListener("resize", () => {
      resizeCanvas();
      seedParticles();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopSparks();
      else startSparks();
    });
  } else {
    // Still keep canvas sized, just no animation
    window.addEventListener("load", resizeCanvas, { once: true });
    window.addEventListener("resize", resizeCanvas);
  }

  // ---------- Small UX polish ----------
  // Prevent body scroll when gallery/modal open (your CSS already uses overflow:hidden on body,
  // but on mobile it can still rubber-band).
  const lockScroll = () => (document.body.style.overflow = "hidden");
  const unlockScroll = () => (document.body.style.overflow = "");

  // Wrap open/close to lock scroll
  const _openFriends = openFriends;
  const _closeFriends = closeFriends;
  openFriends = function () { lockScroll(); _openFriends(); };
  closeFriends = function () { _closeFriends(); unlockScroll(); };

  const _openGallery = openGallery;
  const _closeGallery = closeGallery;
  openGallery = function () { lockScroll(); _openGallery(); };
  closeGallery = function () { _closeGallery(); unlockScroll(); };

  // Re-wire with wrapped functions
  btnFriends?.removeEventListener("click", _openFriends);
  btnFriends?.addEventListener("click", openFriends);

  btnPhotos?.removeEventListener("click", _openGallery);
  btnPhotos?.addEventListener("click", openGallery);

  closeGalleryBtns.forEach((b) => {
    b.removeEventListener("click", _closeGallery);
    b.addEventListener("click", closeGallery);
  });

  // Ensure cast modal close buttons use wrapped close
  modalFriends?.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.matches?.("[data-close]")) closeFriends();
    if (t === modalFriends) closeFriends();
  });

  // If user clicks "Friends" while gallery open, close gallery first (clean)
  btnFriends?.addEventListener("click", () => {
    if (gallery?.getAttribute("aria-hidden") === "false") closeGallery();
  });

  // If user clicks "Photos" while friends open, close friends first (clean)
  btnPhotos?.addEventListener("click", () => {
    if (modalFriends?.getAttribute("aria-hidden") === "false") closeFriends();
  });
})();

/* ===== Mini YouTube Player (audio) ===== */
(() => {
  const VIDEO_ID = "izGwDsrQ1eQ";

  const mpPlay = document.getElementById("mpPlay");
  const mpMute = document.getElementById("mpMute");
  const mpRoot = document.getElementById("miniPlayer");

  let ytPlayer = null;
  let isReady = false;
  let isMuted = true;

  function setPlayIcon(isPlaying) {
    if (!mpPlay) return;
    mpPlay.textContent = isPlaying ? "❚❚" : "▶";
  }

  function setMuteIcon(muted) {
    if (!mpMute) return;
    mpMute.textContent = muted ? "🔇" : "🔊";
  }

  // YouTube IFrame API calls this automatically
  window.onYouTubeIframeAPIReady = function () {
    const host = document.getElementById("miniYT");
    if (!host) return;

    ytPlayer = new YT.Player(host, {
      width: "1",
      height: "1",
      videoId: VIDEO_ID,
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        fs: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: () => {
          isReady = true;

          // start muted (autoplay policies are strict)
          ytPlayer.mute();
          isMuted = true;
          setMuteIcon(true);

          // restore last state (optional)
          try {
            const saved = JSON.parse(localStorage.getItem("miniPlayerState") || "{}");
            if (typeof saved.muted === "boolean") {
              isMuted = saved.muted;
              if (isMuted) ytPlayer.mute(); else ytPlayer.unMute();
              setMuteIcon(isMuted);
            }
            if (typeof saved.time === "number" && saved.time > 0) {
              ytPlayer.seekTo(saved.time, true);
            }
          } catch {}
        },
        onStateChange: (e) => {
          // 1 = playing, 2 = paused, 0 = ended
          if (e.data === YT.PlayerState.PLAYING) setPlayIcon(true);
          if (e.data === YT.PlayerState.PAUSED) setPlayIcon(false);
          if (e.data === YT.PlayerState.ENDED) setPlayIcon(false);
        }
      }
    });
  };

  // Play/Pause
  mpPlay?.addEventListener("click", () => {
    if (!isReady || !ytPlayer) return;

    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
      setPlayIcon(false);
    } else {
      // For best compatibility, user click starts playback
      ytPlayer.playVideo();
      setPlayIcon(true);
    }
  });

  // Mute/Unmute
  mpMute?.addEventListener("click", () => {
    if (!isReady || !ytPlayer) return;

    isMuted = !isMuted;
    if (isMuted) ytPlayer.mute();
    else ytPlayer.unMute();

    setMuteIcon(isMuted);

    try {
      const saved = JSON.parse(localStorage.getItem("miniPlayerState") || "{}");
      saved.muted = isMuted;
      localStorage.setItem("miniPlayerState", JSON.stringify(saved));
    } catch {}
  });

  // Save time occasionally so it resumes where it left off
  setInterval(() => {
    if (!isReady || !ytPlayer) return;
    try {
      const t = ytPlayer.getCurrentTime?.();
      if (typeof t === "number") {
        const saved = JSON.parse(localStorage.getItem("miniPlayerState") || "{}");
        saved.time = t;
        localStorage.setItem("miniPlayerState", JSON.stringify(saved));
      }
    } catch {}
  }, 4000);

  // Safety: if user closes tab, try saving time once more
  window.addEventListener("beforeunload", () => {
    if (!isReady || !ytPlayer) return;
    try {
      const t = ytPlayer.getCurrentTime?.();
      const saved = JSON.parse(localStorage.getItem("miniPlayerState") || "{}");
      saved.time = typeof t === "number" ? t : saved.time || 0;
      saved.muted = isMuted;
      localStorage.setItem("miniPlayerState", JSON.stringify(saved));
    } catch {}
  });

  // If someone wants to hide it later, you can toggle this:
  // mpRoot.style.display = "none";
})();

/* ===== Mini Audio Player (<audio>) ===== */
(() => {
  const audio = document.getElementById("miniAudio");
  const playBtn = document.getElementById("mpPlay");
  const muteBtn = document.getElementById("mpMute");

  if (!audio || !playBtn || !muteBtn) return;

  function setPlayIcon(playing){
    playBtn.textContent = playing ? "❚❚" : "▶";
  }

  function setMuteIcon(muted){
    muteBtn.textContent = muted ? "🔇" : "🔊";
  }

  // Restore previous state
  try {
    const saved = JSON.parse(localStorage.getItem("miniAudioState") || "{}");
    if (typeof saved.muted === "boolean") audio.muted = saved.muted;
    if (typeof saved.time === "number") audio.currentTime = saved.time;
    setMuteIcon(audio.muted);
  } catch {}

  // Play / Pause
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {});
      setPlayIcon(true);
    } else {
      audio.pause();
      setPlayIcon(false);
    }
  });

  // Mute / Unmute
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    setMuteIcon(audio.muted);
    saveState();
  });

  // Save playback state
  function saveState(){
    try {
      localStorage.setItem(
        "miniAudioState",
        JSON.stringify({
          muted: audio.muted,
          time: audio.currentTime
        })
      );
    } catch {}
  }

  setInterval(saveState, 4000);

  audio.addEventListener("ended", () => {
    setPlayIcon(false);
  });
})();
