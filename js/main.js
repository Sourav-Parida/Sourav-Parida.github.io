// ============================================================
// PORTFOLIO — shared behaviour
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- theme toggle (dark / light) ---------- */
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.className = theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    localStorage.setItem('portfolio-theme', theme);
  };

  applyTheme(localStorage.getItem('portfolio-theme') || 'dark');

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(current);
    });
  }

  /* ---------- sound control: mute + track selector ---------- */
  const soundBtn   = document.getElementById('soundToggle');
  const soundPanel = document.getElementById('soundPanel');
  const soundIcon  = document.getElementById('soundIcon');
  const muteBtn    = document.getElementById('muteBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const trackItems = document.querySelectorAll('#trackList li');
  const audio      = document.getElementById('bgAudio');
  const audioStateKey = 'portfolio-audio-state';
  const audioOwnerKey = 'portfolio-audio-owner';
  const audioChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('portfolio-audio-sync') : null;
  const pageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const readAudioState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(audioStateKey) || '{}');
      const savedVolume = Number(parsed.volume);
      return {
        track: parsed.track || (trackItems[0] ? trackItems[0].dataset.track : ''),
        muted: parsed.muted ?? false,
        volume: Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.4,
        currentTime: Number(parsed.currentTime) || 0,
        isPlaying: parsed.isPlaying ?? true,
        ownerId: parsed.ownerId || null
      };
    } catch (error) {
      return {
        track: trackItems[0] ? trackItems[0].dataset.track : '',
        muted: false,
        volume: 0.4,
        currentTime: 0,
        isPlaying: true,
        ownerId: null
      };
    }
  };

  const claimAudioOwner = () => {
    localStorage.setItem(audioOwnerKey, pageId);
    saveAudioState({ ownerId: pageId });
  };

  const saveAudioState = (nextState = {}) => {
    const state = { ...readAudioState(), ...nextState, ownerId: nextState.ownerId || localStorage.getItem(audioOwnerKey) || pageId };
    try {
      localStorage.setItem(audioStateKey, JSON.stringify(state));
      localStorage.setItem(audioOwnerKey, state.ownerId || pageId);
      if (audioChannel) {
        audioChannel.postMessage({ type: 'audio-state', state });
      }
    } catch (error) {
      // ignore storage errors from privacy-restricted contexts
    }
  };

  const applyTrackSelection = (trackUrl, shouldPlay = true) => {
    let selectedItem = null;
    trackItems.forEach(item => {
      const isMatch = item.dataset.track === trackUrl;
      item.classList.toggle('active', isMatch);
      if (isMatch) selectedItem = item;
    });

    if (audio && trackUrl) {
      const currentSrc = audio.getAttribute('src') || audio.currentSrc || '';
      if (!currentSrc.endsWith(trackUrl)) {
        audio.src = trackUrl;
      }
      audio.loop = true;
      audio.muted = !!readAudioState().muted;
      if (shouldPlay && !audio.muted) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }

    if (selectedItem && soundBtn) {
      soundBtn.setAttribute('aria-label', `Sound control: ${selectedItem.textContent.trim()}`);
    }
  };

  const setMuted = (muted) => {
    if (audio) audio.muted = muted;
    if (soundIcon) soundIcon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    if (muteBtn) {
      muteBtn.textContent = muted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', muted);
    }
    saveAudioState({ muted, ownerId: pageId });
  };

  const setVolume = (value) => {
    const rawValue = Number(value);
    const safeValue = Number.isFinite(rawValue) ? Math.min(1, Math.max(0, rawValue)) : 0.4;
    const shouldMute = safeValue <= 0;
    if (audio) {
      audio.volume = safeValue;
      audio.muted = shouldMute;
    }
    if (volumeSlider) volumeSlider.value = safeValue;
    saveAudioState({ volume: safeValue, muted: shouldMute, ownerId: pageId });
    if (soundIcon) soundIcon.className = shouldMute ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    if (muteBtn) {
      muteBtn.textContent = shouldMute ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', shouldMute);
    }
  };

  const syncStateFromStorage = (incomingState = readAudioState()) => {
    const ownerId = localStorage.getItem(audioOwnerKey) || incomingState.ownerId || pageId;
    const isOwner = ownerId === pageId;
    const track = incomingState.track || (trackItems[0] ? trackItems[0].dataset.track : '');
    const muted = !!incomingState.muted;
    const volume = Number.isFinite(Number(incomingState.volume)) ? Math.min(1, Math.max(0, Number(incomingState.volume))) : 0.4;
    const currentTime = Number(incomingState.currentTime) || 0;
    const shouldPlay = isOwner && !!incomingState.isPlaying && !muted;

    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
      audio.loop = true;
      if (track) {
        const currentSrc = audio.getAttribute('src') || audio.currentSrc || '';
        if (!currentSrc.endsWith(track)) {
          audio.src = track;
        }
      }
      if (currentTime > 0 && Math.abs(audio.currentTime - currentTime) > 1) {
        audio.currentTime = currentTime;
      }
      if (shouldPlay) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }

    if (volumeSlider) volumeSlider.value = volume;
    if (soundIcon) soundIcon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    if (muteBtn) {
      muteBtn.textContent = muted ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('muted', muted);
    }

    trackItems.forEach(item => {
      item.classList.toggle('active', item.dataset.track === track);
    });
  };

  claimAudioOwner();
  const initialState = readAudioState();
  syncStateFromStorage(initialState);

  if (audio) {
    audio.addEventListener('timeupdate', () => {
      saveAudioState({ currentTime: audio.currentTime, ownerId: pageId });
    });

    audio.addEventListener('play', () => {
      saveAudioState({ isPlaying: true, ownerId: pageId });
    });

    audio.addEventListener('pause', () => {
      saveAudioState({ isPlaying: false, ownerId: pageId });
    });
  }

  if (soundBtn && soundPanel) {
    const hint = document.createElement('div');
    hint.className = 'sound-tip';
    hint.textContent = 'Choose a soundtrack';
    soundBtn.parentElement.appendChild(hint);

    const showSoundHint = () => {
      hint.classList.add('show');
      window.setTimeout(() => {
        hint.classList.remove('show');
      }, 2600);
    };

    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = soundPanel.classList.toggle('open');
      soundBtn.setAttribute('aria-expanded', isOpen);
      if (isOpen) {
        hint.classList.remove('show');
      }
    });
    document.addEventListener('click', (e) => {
      if (!soundPanel.contains(e.target) && e.target !== soundBtn) {
        soundPanel.classList.remove('open');
        soundBtn.setAttribute('aria-expanded', 'false');
        hint.classList.remove('show');
      }
    });

    window.setTimeout(showSoundHint, 350);
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const nextMuted = !(audio ? audio.muted : true);
      setMuted(nextMuted);
      if (audio && !nextMuted) {
        const currentState = readAudioState();
        if (currentState.track) {
          applyTrackSelection(currentState.track, true);
        }
        audio.play().catch(() => { /* autoplay may be blocked until a user gesture — this click counts */ });
      }
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (event) => {
      const nextVolume = Number(event.target.value);
      setVolume(nextVolume);
      if (audio && !audio.muted) {
        audio.play().catch(() => {});
      }
    });
  }

  trackItems.forEach(item => {
    item.addEventListener('click', () => {
      const trackUrl = item.dataset.track;
      const currentState = readAudioState();
      const nextMuted = !!currentState.muted;
      saveAudioState({ track: trackUrl, isPlaying: !nextMuted, currentTime: 0, ownerId: pageId });
      applyTrackSelection(trackUrl, !nextMuted);
      if (audio && !nextMuted) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    });
  });

  if (audioChannel) {
    audioChannel.onmessage = (event) => {
      const incoming = event.data && event.data.state;
      if (!incoming) return;
      const current = readAudioState();
      if (incoming.ownerId !== pageId && incoming.track) {
        syncStateFromStorage(incoming);
        saveAudioState({ ...incoming, ownerId: incoming.ownerId || pageId });
      }
      if (incoming.ownerId === pageId && current.ownerId !== pageId) {
        syncStateFromStorage(current);
      }
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key === audioStateKey && event.newValue) {
      try {
        const incoming = JSON.parse(event.newValue);
        if (incoming.ownerId !== pageId) {
          syncStateFromStorage(incoming);
        }
      } catch (error) {
        // ignore invalid stored data
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      claimAudioOwner();
      const state = readAudioState();
      syncStateFromStorage(state);
      if (!state.muted && state.track) {
        saveAudioState({ isPlaying: true, ownerId: pageId });
        if (audio) audio.play().catch(() => {});
      }
    }
  });

  window.addEventListener('focus', () => {
    claimAudioOwner();
    const state = readAudioState();
    syncStateFromStorage(state);
  });

  /* ---------- mobile nav toggle ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      const isOpen = links.classList.contains('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.innerHTML = isOpen ? '&#10005;' : '&#9776;';
    });
    links.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.innerHTML = '&#9776;';
      })
    );
  }

  /* ---------- reveal-on-scroll transitions ---------- */
  const revealItems = document.querySelectorAll('main .section, .skill-group, .card-project, .timeline-card, .research-card, .ach-card, .cert-badge, .about-visual-card, .contact-card, .mini-card');
  revealItems.forEach(item => item.classList.add('reveal'));

  if (revealItems.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        entry.target.classList.toggle('visible', entry.isIntersecting);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealItems.forEach(item => revealObserver.observe(item));
  }

  /* ---------- scrollspy: nav links + pipeline rail ---------- */
  const sections = [...document.querySelectorAll('main [id]')];
  const footerTarget = document.querySelector('footer[data-nav-target]');
  if (footerTarget) sections.push(footerTarget);

  const navAnchors  = document.querySelectorAll('.nav-links a[href*="#"]');
  const railNodes    = document.querySelectorAll('.rail-node[data-target]');

  if (sections.length) {
    const spy = new IntersectionObserver((entries) => {
      let activeId = null;
      let bestRatio = 0;

      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.dataset.navTarget || entry.target.id;
        if (entry.intersectionRatio > bestRatio) {
          bestRatio = entry.intersectionRatio;
          activeId = id;
        }
      });

      if (!activeId) return;

      navAnchors.forEach(a => {
        const hrefId = a.getAttribute('href').split('#').pop();
        a.classList.toggle('active', hrefId === activeId);
      });

      railNodes.forEach(n => {
        n.classList.toggle('active', n.dataset.target === activeId);
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.2, 0.5, 0.8] });

    sections.forEach(s => spy.observe(s));
  }

  if (railNodes.length) {
    railNodes.forEach(n => {
      n.addEventListener('click', () => {
        const target = document.getElementById(n.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  /* ---------- generic pill/tab filter ----------
     Works for both the Projects tech filter and the
     Certifications company filter via [data-filter-group] */
  document.querySelectorAll('[data-filter-group]').forEach(group => {
    const targetSelector = group.dataset.filterGroup;
    const items = document.querySelectorAll(targetSelector);
    const emptyMsg = document.querySelector(group.dataset.emptyTarget || '');

    group.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.filter;
        let visibleCount = 0;

        items.forEach(item => {
          const tags = (item.dataset.tags || '').split(',');
          const show = val === 'all' || tags.includes(val);
          item.style.display = show ? '' : 'none';
          if (show) visibleCount++;
        });

        if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
      });
    });
  });

  /* ---------- code mock language toggle (Python / Java) ---------- */
  const codeTabs = document.querySelectorAll('.code-tab');
  const codeBlocks = document.querySelectorAll('.code-block');
  const applyCodeLang = (lang) => {
    codeTabs.forEach(t => {
      const is = t.dataset.lang === lang;
      t.classList.toggle('on', is);
      t.setAttribute('aria-selected', is ? 'true' : 'false');
    });
    codeBlocks.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
    localStorage.setItem('portfolio-code-lang', lang);
  };
  if (codeTabs && codeTabs.length) {
    const saved = localStorage.getItem('portfolio-code-lang') || 'python';
    applyCodeLang(saved);
    codeTabs.forEach(tab => tab.addEventListener('click', () => applyCodeLang(tab.dataset.lang)));
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll('.js-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- copy email on click ---------- */
  document.querySelectorAll('.copy-email-btn').forEach(button => {
    const tip = button.querySelector('.copy-email-tip');
    const originalText = tip ? tip.textContent : '';

    button.addEventListener('click', async () => {
      const email = button.dataset.email || '';
      if (!email) return;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(email);
        } else {
          const temp = document.createElement('textarea');
          temp.value = email;
          temp.setAttribute('readonly', '');
          temp.style.position = 'fixed';
          temp.style.left = '-9999px';
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
        }

        if (tip) {
          tip.textContent = 'Copied!';
        }
        button.classList.add('is-copied');
        button.setAttribute('aria-label', 'Email copied to clipboard');

        window.setTimeout(() => {
          if (tip) tip.textContent = originalText;
          button.classList.remove('is-copied');
          button.setAttribute('aria-label', 'Copy email address');
        }, 1400);
      } catch (error) {
        if (tip) {
          tip.textContent = 'Copy failed';
        }
        button.classList.add('is-copied');
        window.setTimeout(() => {
          if (tip) tip.textContent = originalText;
          button.classList.remove('is-copied');
        }, 1400);
      }
    });
  });

  /* ---------- certificate preview modal ---------- */
  const certModal = document.getElementById('certModal');
  const certModalImg = certModal ? certModal.querySelector('.cert-modal-img') : null;
  const certModalClose = certModal ? certModal.querySelector('.cert-modal-close') : null;
  const certModalContent = certModal ? certModal.querySelector('.cert-modal-content') : null;

  document.querySelectorAll('.show-badge').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const card = btn.closest('.cert-badge');
      if (!card || !certModal || !certModalImg || !certModalContent) return;
      const img = card.dataset.certImg;
      const title = card.querySelector('.cert-title') ? card.querySelector('.cert-title').textContent.trim() : '';
      const code = card.querySelector('.cert-code') ? card.querySelector('.cert-code').textContent.trim() : '';
      const issuer = card.querySelector('.cert-issuer') ? card.querySelector('.cert-issuer').textContent.trim() : '';

      const captionEl = certModal.querySelector('.cert-modal-caption');

      // Compute target modal size to match the originating card, but constrain to viewport
      const cardRect = card.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      // On small screens, keep responsive modal (do not match card)
      if (viewportW > 720) {
        const maxW = Math.floor(viewportW * 0.92);
        const maxH = Math.floor(viewportH * 0.8);
        const targetW = Math.min(Math.max(260, Math.round(cardRect.width)), maxW); // min 260 for usability
        const targetH = Math.min(Math.max(180, Math.round(cardRect.height)), maxH); // min 180 for usability
        certModalContent.style.width = targetW + 'px';
        certModalContent.style.height = targetH + 'px';
      } else {
        // mobile: let CSS handle sizing
        certModalContent.style.width = '';
        certModalContent.style.height = '';
      }

      if (!img) {
        // no preview image provided — show caption instead
        if (captionEl) {
          captionEl.textContent = title + (code ? ' · ' + code : '') + (issuer ? ' · ' + issuer : '');
          captionEl.style.display = 'block';
        }
        if (certModalImg) certModalImg.style.display = 'none';
        certModal.classList.add('open');
        certModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        return;
      }

      // show image and hide caption initially
      if (captionEl) captionEl.style.display = 'none';
      certModalImg.style.display = 'block';
      certModalImg.src = img;

      // handle image load error gracefully
      certModalImg.onerror = () => {
        certModalImg.style.display = 'none';
        if (captionEl) {
          captionEl.textContent = title + (code ? ' · ' + code : '') + (issuer ? ' · ' + issuer : '');
          captionEl.style.display = 'block';
        }
      };

      certModalImg.onload = () => {
        if (captionEl) captionEl.style.display = 'none';
      };

      certModal.classList.add('open');
      certModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeCertModal = () => {
    if (!certModal) return;
    certModal.classList.remove('open');
    certModal.setAttribute('aria-hidden', 'true');
    if (certModalImg) { certModalImg.src = ''; certModalImg.style.display = 'block'; }
    const captionEl = certModal.querySelector('.cert-modal-caption');
    if (captionEl) captionEl.style.display = 'none';
    if (certModalContent) certModalContent.style.width = '';
    document.body.style.overflow = '';
  };

  if (certModalClose) certModalClose.addEventListener('click', closeCertModal);
  if (certModal) certModal.addEventListener('click', (e) => { if (e.target === certModal) closeCertModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && certModal && certModal.classList.contains('open')) closeCertModal(); });

});
