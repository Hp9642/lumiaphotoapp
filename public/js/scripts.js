/* ==========================================================================
   LUMINA FILM — scripts.js
   Core variables, camera, gallery, and audio engine.
   ========================================================================== */

// ── State ──────────────────────────────────────────────────────────────────
let mediaStream       = null;
let currentFacingMode = 'environment'; // back camera default
let shotLimit         = 25;
let shotsTaken        = 0;
let currentFilmStock  = 'portra';      // default film stock
let isWound           = true;          // first shot is free – no winding needed
let windProgress      = 0;             // 0–100 progress towards fully wound

// ── Film Stock Filter Map ───────────────────────────────────────────────────
// These are applied to BOTH the live video preview AND the captured canvas.
// Values are intentionally strong so the difference is clearly visible.
const FILM_FILTERS = {
    portra:  'sepia(0.35) contrast(1.12) saturate(1.35) brightness(1.06) hue-rotate(-5deg)',
    superia: 'contrast(1.35) saturate(1.6)  hue-rotate(8deg)  brightness(0.95)',
    mono:    'grayscale(1)  contrast(1.4)  brightness(0.92)',
    noir:    'grayscale(1) contrast(1.8) brightness(0.8)',
    vintage: 'sepia(0.8) contrast(1.2) saturate(0.8) brightness(0.9)',
    cool:    'sepia(0.2) contrast(1.1) hue-rotate(180deg) saturate(1.5) brightness(1.1)',
    original: 'none'
};

// Apply the selected film stock CSS filter to the live camera preview
function applyFilmToPreview() {
    const vid = document.getElementById('cameraStream');
    if (!vid) return;
    vid.style.webkitFilter = FILM_FILTERS[currentFilmStock] || 'none';
    vid.style.filter = FILM_FILTERS[currentFilmStock] || 'none';
    // Also apply a colour-tinted vignette overlay based on the stock
    const overlayColors = {
        portra:  'rgba(255, 200, 120, 0.06)',
        superia: 'rgba(80,  200, 220, 0.06)',
        mono:    'rgba(0,   0,   0,   0.0)',
        noir:    'rgba(0,   0,   0,   0.2)',
        vintage: 'rgba(200, 140, 60, 0.1)',
        cool:    'rgba(50, 100, 255, 0.08)'
    };
    const wrapper = document.getElementById('viewfinderContainer');
    if (wrapper) {
        wrapper.style.setProperty('--film-tint', overlayColors[currentFilmStock] || 'transparent');
    }
}

// ── Global DOM refs (safe on all pages) ───────────────────────────────────
const galleryElement      = document.getElementById('gallery');
const spinnerElement      = document.getElementById('spinner');
const refreshLinkElement  = document.getElementById('refreshLink');
const galleryItemTemplate = document.getElementById('galleryItem')
    ? document.getElementById('galleryItem').content : null;
const toastElement        = document.getElementById('toast');

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(message) {
    if (!toastElement) return;
    const msgEl = toastElement.querySelector('.message');
    if (msgEl) msgEl.innerText = message;
    toastElement.classList.add('active');
    clearTimeout(toastElement._timer);
    toastElement._timer = setTimeout(() => toastElement.classList.remove('active'), 3500);
}

/* ==========================================================================
   AUDIO ENGINE  (Web Audio API — no external files needed)
   ========================================================================== */

function playShutterSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const bufSize = ctx.sampleRate * 0.12;
        const buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buf;

        const filter = ctx.createBiquadFilter();
        filter.type  = 'highpass';
        filter.frequency.value = 1200;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    } catch (e) { /* silently fail on browsers blocking audio */ }
}

function playCogClickSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.03);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
}

function playLatchSound() {
    try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g1   = ctx.createGain();
        const g2   = ctx.createGain();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(220, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);
        g1.gain.setValueAtTime(0.15, ctx.currentTime);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(900, ctx.currentTime);
        g2.gain.setValueAtTime(0.08, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc1.connect(g1); g1.connect(ctx.destination);
        osc2.connect(g2); g2.connect(ctx.destination);
        osc1.start(); osc2.start();
        osc1.stop(ctx.currentTime + 0.28);
        osc2.stop(ctx.currentTime + 0.28);
    } catch (e) {}
}

// Automatic winding sequence after a shot is taken
function playWindingSequenceSound() {
    windProgress = 0; // ← CRITICAL: reset progress each time winding starts
    let clickCount = 0;
    const interval = setInterval(() => {
        playCogClickSound();
        clickCount++;
        if (clickCount >= 8) {
            clearInterval(interval);
            setTimeout(() => {
                playLatchSound();
                isWound = true;
                windProgress = 100;
                updateWindingState();
                showToast('📸 Shutter Unlocked — ready for next shot!');
            }, 150);
        }
    }, 100);
}

/* ==========================================================================
   CAMERA HANDLERS  (/upload page)
   ========================================================================== */

const cameraStream        = document.getElementById('cameraStream');
const toggleCameraBtn     = document.getElementById('toggleCameraBtn');
const shutterBtn          = document.getElementById('shutterBtn');
const galleryUploadBtn    = document.getElementById('galleryUploadBtn');
const imageFilesElement   = document.getElementById('imageFiles');
const shotsCountElement   = document.getElementById('shotsCount');
const viewfinderContainer = document.getElementById('viewfinderContainer');
const viewfinderProgressBar = document.getElementById('viewfinderProgressBar');
const uploadStatusText    = document.getElementById('uploadStatusText');

// ── Camera init ────────────────────────────────────────────────────────────
function initUploadPage() {
    const eventId = window.location.pathname.split('/')[1] || '';

    // Show welcome screen first, then launch camera after guest taps "Start Shooting"
    fetch(`/api/config?eventId=${eventId}`)
        .then(r => r.json())
        .then(config => {
            shotLimit = parseInt(config.shotLimit) || 25;

            if (parseInt(config.enableUpload) !== 1) {
                showFullScreenMessage(
                    '🔒', 'Camera Closed',
                    'The host has temporarily closed the camera for this event.',
                    'Return Home', '/'
                );
                return;
            }

            // Show personalised welcome screen
            showGuestWelcome(config, eventId, () => {
                shotsTaken = parseInt(localStorage.getItem(`shotsTaken_${eventId}`) || '0');
                updateShotsCounter();
                startCamera();
                updateWindingState();
            });
        })
        .catch(() => {
            // Fallback: skip welcome, go straight to camera
            startCamera();
            updateWindingState();
        });

    setupCameraControls();
}

function showGuestWelcome(config, eventId, onStart) {
    // Don't show welcome if guest already dismissed it this session
    if (sessionStorage.getItem(`welcomed_${eventId}`)) {
        onStart();
        return;
    }

    const savedName = localStorage.getItem('guestName') || '';
    const eventName = config.eventName || 'This Event';
    const customMsg = config.customMessage || 'Capture the moments that matter. Every shot becomes part of the shared memory.';
    const shotsLeft = Math.max(0, (config.shotLimit || 25) - parseInt(localStorage.getItem(`shotsTaken_${eventId}`) || '0'));

    const welcome = document.createElement('div');
    welcome.id = 'guestWelcomeScreen';
    welcome.style.cssText = `
        position: fixed; inset: 0; z-index: 9000;
        background: linear-gradient(160deg, #0A0908 0%, #141210 60%, #1a1512 100%);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 2rem; text-align: center; overflow: hidden;
    `;

    welcome.innerHTML = `
        <!-- Ambient glow -->
        <div style="position:absolute;width:400px;height:400px;background:radial-gradient(circle,rgba(162,188,224,0.08) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-60%);pointer-events:none;"></div>

        <!-- Camera icon -->
        <div style="margin-bottom:1.5rem;position:relative;">
            <div style="width:80px;height:80px;border-radius:50%;background:rgba(162,188,224,0.08);border:1px solid rgba(162,188,224,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto;">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ice)" stroke-width="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                </svg>
            </div>
        </div>

        <!-- Event name -->
        <p style="font-size:0.7rem;color:var(--accent-ice);letter-spacing:3px;text-transform:uppercase;margin-bottom:0.5rem;font-family:var(--font-sans);opacity:0.8;">You're invited to shoot</p>
        <h1 style="font-family:var(--font-serif);font-size:clamp(1.6rem,6vw,2.4rem);color:#fff;font-weight:300;margin-bottom:1rem;line-height:1.2;max-width:380px;">${eventName}</h1>
        <p style="font-size:0.88rem;color:var(--text-secondary);max-width:320px;line-height:1.6;margin-bottom:2rem;">${customMsg}</p>

        <!-- Stats pill -->
        <div style="display:flex;gap:12px;margin-bottom:2rem;">
            <div style="background:rgba(162,188,224,0.08);border:1px solid rgba(162,188,224,0.15);border-radius:0; letter-spacing:0.15em; text-transform:uppercase;padding:6px 16px;font-size:0.75rem;color:var(--text-secondary);">
                🎞 ${shotsLeft} shots on your roll
            </div>
        </div>

        <!-- Name input -->
        <div style="width:100%;max-width:300px;margin-bottom:1.2rem;">
            <input type="text" id="welcomeNameInput" placeholder="Your name (optional)" 
                value="${savedName}"
                style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:0.85rem 1.2rem;color:#fff;font-size:0.95rem;text-align:center;outline:none;font-family:var(--font-sans);box-sizing:border-box;"
            >
        </div>

        <!-- CTA Button -->
        <button id="welcomeStartBtn" style="
            background: var(--accent-ice); color: #0A0908;
            border: none; border-radius: 0; letter-spacing:0.15em; text-transform:uppercase;
            padding: 0.9rem 2.5rem; font-size: 1rem; font-weight: 700;
            cursor: pointer; font-family: var(--font-sans);
            width: 100%; max-width: 300px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            box-shadow: 0 0 30px rgba(162,188,224,0.3);
        ">
            Start Shooting 📸
        </button>

        <p style="margin-top:1.5rem;font-size:0.72rem;color:var(--text-muted);max-width:280px;line-height:1.5;">
            Photos are shared with all guests after the event. Tap to allow camera access when prompted.
        </p>
    `;

    document.body.appendChild(welcome);

    const nameInput = welcome.querySelector('#welcomeNameInput');
    const startBtn = welcome.querySelector('#welcomeStartBtn');

    // Style input focus
    nameInput.addEventListener('focus', () => {
        nameInput.style.borderColor = 'rgba(162,188,224,0.4)';
        nameInput.style.background = 'rgba(162,188,224,0.05)';
    });
    nameInput.addEventListener('blur', () => {
        nameInput.style.borderColor = 'rgba(255,255,255,0.1)';
        nameInput.style.background = 'rgba(255,255,255,0.05)';
    });

    startBtn.addEventListener('mouseenter', () => {
        startBtn.style.transform = 'scale(1.03)';
        startBtn.style.boxShadow = '0 0 50px rgba(162,188,224,0.5)';
    });
    startBtn.addEventListener('mouseleave', () => {
        startBtn.style.transform = 'scale(1)';
        startBtn.style.boxShadow = '0 0 30px rgba(162,188,224,0.3)';
    });

    startBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            localStorage.setItem('guestName', name);
        }
        sessionStorage.setItem(`welcomed_${eventId}`, '1');

        // Fade out welcome screen
        welcome.style.transition = 'opacity 0.4s ease';
        welcome.style.opacity = '0';
        setTimeout(() => {
            welcome.remove();
            onStart();
        }, 400);
    });

    // Allow Enter key to start
    nameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') startBtn.click();
    });
}

function showFullScreenMessage(icon, title, message, btnText, btnHref) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#0A0908;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;padding:2rem;text-align:center;';
    el.innerHTML = `
        <div style="font-size:3rem;margin-bottom:1.5rem;">${icon}</div>
        <h2 style="font-family:var(--font-serif);color:#fff;font-size:1.8rem;margin-bottom:0.75rem;">${title}</h2>
        <p style="color:var(--text-secondary);font-size:0.9rem;max-width:300px;line-height:1.6;margin-bottom:2rem;">${message}</p>
        <a href="${btnHref}" style="background:var(--accent-ice);color:#0A0908;border:none;padding:0.75rem 2rem;border-radius:0; letter-spacing:0.15em; text-transform:uppercase;font-weight:700;font-size:0.9rem;text-decoration:none;">${btnText}</a>
    `;
    document.body.appendChild(el);
}

function setupCameraControls() {

    // ── Button bindings ────────────────────────────────────────────────────
    if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', () => {
            currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            startCamera();
        });
    }

    if (shutterBtn) {
        shutterBtn.addEventListener('click', takePhoto);
    }

    if (galleryUploadBtn && imageFilesElement) {
        galleryUploadBtn.addEventListener('click', () => imageFilesElement.click());
        imageFilesElement.addEventListener('change', uploadFromGallery);
    }

    // Film stock selector pills — also apply filter to live video preview
    document.querySelectorAll('.film-stock-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.film-stock-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilmStock = btn.dataset.stock;
            applyFilmToPreview(); // ← instantly updates the live viewfinder
            const labels = { portra: '🎞️ Portra 400 - warm skin tones', superia: '🎞️ Superia 200 - vivid & punchy', mono: '🎞️ Monochrome - high-contrast B&W', original: '✨ Original - no filter' };
            showToast(labels[currentFilmStock] || `🎞 Film: ${btn.innerText}`);
        });
    });
    // Apply default filter (Portra) to preview on startup
    applyFilmToPreview();

    // ── Sign-off modal bindings ────────────────────────────────────────────
    const signOffModal   = document.getElementById('signOffModal');
    const signNameInput  = document.getElementById('signNameInput');
    const signEmailInput = document.getElementById('signEmailInput');
    const signWishInput  = document.getElementById('signWishInput');
    const skipSignOffBtn = document.getElementById('skipSignOffBtn');
    const submitSignOffBtn = document.getElementById('submitSignOffBtn');

    function dismissSignOffAndUpload(name, email, wish) {
        if (signOffModal) signOffModal.style.display = 'none';
        if (name && name !== 'Guest') localStorage.setItem('guestName', name);
        if (email) localStorage.setItem('guestEmail', email);

        if (window.capturedImageBlob) {
            const eventId = window.location.pathname.split('/')[1] || 'default';
            shotsTaken++;
            localStorage.setItem(`shotsTaken_${eventId}`, shotsTaken);
            updateShotsCounter();

            // Send image — path is just the filename; API prepends 'original/'
            uploadSingleFile(window.capturedImageBlob, window.capturedFilename, false, name, email, wish);

            if (window.capturedVideoThumbBlob) {
                uploadSingleFile(window.capturedVideoThumbBlob,
                    'thumb-' + window.capturedFilename, true, name, email, wish);
                window.capturedVideoThumbBlob = null;
            }
            window.capturedImageBlob  = null;
            window.capturedFilename   = null;
        }
    }

    // Pre-fill name & email from localStorage
    if (signNameInput && localStorage.getItem('guestName')) {
        signNameInput.value = localStorage.getItem('guestName');
    }
    if (signEmailInput && localStorage.getItem('guestEmail')) {
        signEmailInput.value = localStorage.getItem('guestEmail');
    }

    if (skipSignOffBtn) {
        skipSignOffBtn.addEventListener('click', () => {
            const name = (signNameInput ? signNameInput.value.trim() : '') || 'Guest';
            const email = signEmailInput ? signEmailInput.value.trim() : '';
            dismissSignOffAndUpload(name, email, '');
        });
    }

    if (submitSignOffBtn) {
        submitSignOffBtn.addEventListener('click', () => {
            const name = (signNameInput ? signNameInput.value.trim() : '') || 'Guest';
            const email = signEmailInput ? signEmailInput.value.trim() : '';
            const wish = signWishInput ? signWishInput.value.trim() : '';
            dismissSignOffAndUpload(name, email, wish);
        });
    }

    // ── Hype screen "Take Another Shot" ────────────────────────────────────
    const hypeNextShotBtn  = document.getElementById('hypeNextShotBtn');
    const hypeScreenModal  = document.getElementById('hypeScreenModal');

    if (hypeNextShotBtn) {
        hypeNextShotBtn.addEventListener('click', () => {
            if (hypeScreenModal) hypeScreenModal.style.display = 'none';
            isWound = true;
            windProgress = 0; // reset before playing winding animation
            updateWindingState();
            playWindingSequenceSound();
        });
    }

    // ── Winding Cog interaction ────────────────────────────────────────────
    const windingCog = document.getElementById('windingCog');
    let isDragging = false;
    let cogRotation = 0;
    let startY = 0;

    if (windingCog) {
        windingCog.addEventListener('pointerdown', e => {
            if (isWound) return;
            isDragging = true;
            startY = e.clientY;
            windingCog.setPointerCapture(e.pointerId);
        });

        windingCog.addEventListener('pointermove', e => {
            if (!isDragging || isWound) return;
            const dy = e.clientY - startY;
            if (dy > 3) {
                cogRotation += dy * 0.5;
                windingCog.style.transform = `rotate(${cogRotation}deg)`;
                startY = e.clientY;
                windProgress += Math.abs(dy) * 0.5;
                playCogClickSound();
                if (navigator.vibrate) navigator.vibrate(10);
                if (windProgress >= 100) {
                    isWound = true;
                    isDragging = false;
                    playLatchSound();
                    updateWindingState();
                    showToast('📸 Shutter Unlocked!');
                }
            }
        });

        windingCog.addEventListener('pointerup', () => {
            isDragging = false;
        });

        // Click fallback – each click advances 25% of the wind
        windingCog.addEventListener('click', () => {
            if (isWound) return;
            cogRotation += 90;
            windingCog.style.transform = `rotate(${cogRotation}deg)`;
            windProgress += 25;
            playCogClickSound();
            if (windProgress >= 100) {
                isWound = true;
                playLatchSound();
                updateWindingState();
                showToast('📸 Shutter Unlocked!');
            }
        });
    }
}

// ── Start / restart camera stream ──────────────────────────────────────────
function startCamera() {
    if (!cameraStream) return;

    // Stop existing tracks
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }

    const constraints = {
        video: {
            facingMode: currentFacingMode,
            width:  { ideal: 1920 },
            height: { ideal: 1080 }
        },
        audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            mediaStream = stream;
            cameraStream.srcObject = stream;
            cameraStream.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
            // Re-apply the film filter to the new stream
            applyFilmToPreview();
            // Hide any previous error state
            const errScreen = document.getElementById('cameraPermissionError');
            if (errScreen) errScreen.style.display = 'none';
        })
        .catch(err => {
            console.error('Camera access failed:', err);
            // Show a full-screen error with instructions
            let errScreen = document.getElementById('cameraPermissionError');
            if (!errScreen) {
                errScreen = document.createElement('div');
                errScreen.id = 'cameraPermissionError';
                errScreen.style.cssText = 'position:fixed;inset:0;background:#0A0908;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;padding:2rem;text-align:center;';
                errScreen.innerHTML = `
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ice)" stroke-width="1.5" style="margin-bottom:1.5rem;opacity:0.8">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <line x1="1" y1="1" x2="23" y2="23" stroke="#e55" stroke-width="2"/>
                    </svg>
                    <h2 style="font-family:var(--font-serif);color:#fff;font-size:1.6rem;margin-bottom:0.75rem;">Camera Access Denied</h2>
                    <p style="color:var(--text-secondary);font-size:0.9rem;max-width:300px;line-height:1.6;margin-bottom:2rem;">Lumina needs camera access to capture photos. Please allow camera access in your browser settings, then refresh this page.</p>
                    <button onclick="location.reload()" style="background:var(--accent-ice);color:#0A0908;border:none;padding:0.75rem 2rem;border-radius:0; letter-spacing:0.15em; text-transform:uppercase;font-weight:700;font-size:0.9rem;cursor:pointer;margin-bottom:1rem;">Try Again</button>
                    <p style="color:var(--text-muted);font-size:0.75rem;">Or use the upload button ↑ to import from your photo library</p>
                `;
                document.body.appendChild(errScreen);
            } else {
                errScreen.style.display = 'flex';
            }
        });
}

// ── Shots remaining counter ────────────────────────────────────────────────
function updateShotsCounter() {
    if (shotsCountElement) {
        shotsCountElement.innerText = Math.max(0, shotLimit - shotsTaken);
    }
}

// ── Winding state: enable / disable shutter based on isWound ──────────────
function updateWindingState() {
    const shutter = document.getElementById('shutterBtn');
    const prompt  = document.getElementById('windingStatusPrompt');
    const cog     = document.getElementById('windingCog');

    if (isWound) {
        if (shutter) { shutter.style.opacity = '1'; shutter.style.pointerEvents = 'auto'; }
        if (prompt)  prompt.style.display = 'none';
    } else {
        if (shutter) { shutter.style.opacity = '0.25'; shutter.style.pointerEvents = 'none'; }
        if (prompt)  { prompt.innerText = 'Wind film cog to unlock shutter'; prompt.style.display = 'block'; }
        if (cog)     cog.style.transform = 'rotate(0deg)';
    }
}

// ── Take a photo from the live video stream ────────────────────────────────
function takePhoto() {
    if (!isWound) {
        showToast('⚙️ Wind the film cog first!');
        return;
    }
    if (shotLimit - shotsTaken <= 0) {
        // Show Roll Full screen
        let rollFullScreen = document.getElementById('rollFullScreen');
        if (!rollFullScreen) {
            rollFullScreen = document.createElement('div');
            rollFullScreen.id = 'rollFullScreen';
            rollFullScreen.style.cssText = 'position:fixed;inset:0;background:rgba(10,9,8,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;padding:2rem;text-align:center;backdrop-filter:blur(10px);';
            rollFullScreen.innerHTML = `
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ice)" stroke-width="1.5" style="margin-bottom:1.5rem;">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                    <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <h2 style="font-family:var(--font-serif);color:var(--accent-ice);font-size:1.8rem;margin-bottom:0.75rem;letter-spacing:1px;">Roll Complete!</h2>
                <p style="color:var(--text-secondary);font-size:0.9rem;max-width:300px;line-height:1.6;margin-bottom:2rem;">You've used all your shots on this roll. Your photos are being developed in the darkroom!</p>
                <a href="/${eventId}/thankyou" style="background:var(--accent-ice);color:#0A0908;border:none;padding:0.75rem 2rem;border-radius:0; letter-spacing:0.15em; text-transform:uppercase;font-weight:700;font-size:0.9rem;cursor:pointer;text-decoration:none;">View Status</a>
            `;
            document.body.appendChild(rollFullScreen);
        } else {
            rollFullScreen.style.display = 'flex';
        }
        return;
    }
    if (!cameraStream || !mediaStream) {
        showToast('❌ Camera not active.');
        return;
    }

    // Flash effect
    playShutterSound();
    if (viewfinderContainer) {
        viewfinderContainer.classList.add('camera-flash-active');
        setTimeout(() => viewfinderContainer.classList.remove('camera-flash-active'), 180);
    }

    // Capture frame to hidden canvas
    const canvas = document.getElementById('photoCanvas');
    const ctx    = canvas.getContext('2d');
    const vW     = cameraStream.videoWidth  || 640;
    const vH     = cameraStream.videoHeight || 480;

    canvas.width  = vW;
    canvas.height = vH;
    ctx.clearRect(0, 0, vW, vH);

    // Mirror front camera
    if (currentFacingMode === 'user') {
        ctx.save();
        ctx.translate(vW, 0);
        ctx.scale(-1, 1);
    }

    // Apply the current film stock filter (same values shown in live preview)
    ctx.filter = FILM_FILTERS[currentFilmStock] || 'none';
    ctx.drawImage(cameraStream, 0, 0, vW, vH);

    if (currentFacingMode === 'user') ctx.restore();

    // Build a descending-index filename so newest shows first
    const idx      = Number.MAX_SAFE_INTEGER - Date.now();
    const safeName = (localStorage.getItem('guestName') || 'Guest').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${idx}-snap-${safeName}.jpg`;

    canvas.toBlob(blob => {
        if (!blob) { showToast('❌ Failed to capture photo.'); return; }

        window.capturedImageBlob = blob;
        window.capturedFilename  = filename;

        // Pre-fill name from localStorage
        const nameInput = document.getElementById('signNameInput');
        const wishInput = document.getElementById('signWishInput');
        if (nameInput) nameInput.value = localStorage.getItem('guestName') || '';
        if (wishInput) wishInput.value = '';

        const modal = document.getElementById('signOffModal');
        if (modal) modal.style.display = 'flex';
    }, 'image/jpeg', 0.88);
}

// ── Upload a file from phone gallery / file picker ─────────────────────────
function uploadFromGallery(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (shotLimit - shotsTaken <= 0) { showToast('🎞 Roll full!'); return; }

    const file     = files[0];
    const idx      = Number.MAX_SAFE_INTEGER - Date.now();
    const safeName = (localStorage.getItem('guestName') || 'Guest').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${idx}-${safeName}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const filter = FILM_FILTERS[currentFilmStock] || 'none';

    function openSignOff(blob) {
        window.capturedImageBlob = blob;
        window.capturedFilename  = filename;
        const nameInput = document.getElementById('signNameInput');
        const wishInput = document.getElementById('signWishInput');
        if (nameInput) nameInput.value = localStorage.getItem('guestName') || '';
        if (wishInput) wishInput.value = '';
        const modal = document.getElementById('signOffModal');
        if (modal) modal.style.display = 'flex';
    }

    if (file.type.startsWith('image/')) {
        applyFilterToImageFile(file, filter, openSignOff);
    } else {
        // Video — no filter, but capture thumbnail
        window.capturedImageBlob = file;
        window.capturedFilename  = filename;
        openSignOff(file);
        captureVideoThumbnail(file).then(tb => { window.capturedVideoThumbBlob = tb; }).catch(() => {});
    }

    imageFilesElement.value = ''; // reset so same file can be re-selected
}

// ── Single file upload XHR ─────────────────────────────────────────────────
function uploadSingleFile(blob, targetFilename, isSilent = false, uploaderName = 'Guest', email = '', wishText = '') {
    if (!isSilent) {
        if (viewfinderProgressBar) viewfinderProgressBar.style.width = '5%';
        if (uploadStatusText) { uploadStatusText.innerText = 'Developing…'; uploadStatusText.style.display = 'block'; }
    }

    // targetFilename should be a bare filename (no path prefix). API adds "original/".
    const safeFilename = targetFilename.replace(/^(original|video_thumbnails)\//i, '');
    const encoded = encodeURIComponent(safeFilename);

    const xhr = new XMLHttpRequest();
    const eventId = window.location.pathname.split('/')[1];
    xhr.open('POST', `/api/photos?eventId=${eventId}&targetFilename=${encoded}`, true);
    xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg');
    xhr.setRequestHeader('x-meta-uploader', uploaderName || 'Guest');
    if (email) xhr.setRequestHeader('x-meta-email', email);
    if (wishText) xhr.setRequestHeader('x-meta-note', encodeURIComponent(wishText));

    xhr.upload.onprogress = e => {
        if (e.lengthComputable && !isSilent && viewfinderProgressBar) {
            viewfinderProgressBar.style.width = `${Math.round((e.loaded / e.total) * 90) + 5}%`;
        }
    };

    xhr.onload = () => {
        if (!isSilent) {
            if (viewfinderProgressBar) viewfinderProgressBar.style.width = '100%';
            setTimeout(() => {
                if (viewfinderProgressBar) viewfinderProgressBar.style.width = '0%';
                if (uploadStatusText) uploadStatusText.style.display = 'none';
            }, 600);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
            if (!isSilent) showHypeScreen();
        } else {
            console.error('Upload failed:', xhr.status, xhr.responseText);
            if (!isSilent) showToast('❌ Upload failed — please try again.');
            // Revert shot count on failure
            shotsTaken = Math.max(0, shotsTaken - 1);
            localStorage.setItem('shotsTaken_session', shotsTaken);
            updateShotsCounter();
        }
    };

    xhr.onerror = () => {
        if (!isSilent) {
            if (viewfinderProgressBar) viewfinderProgressBar.style.width = '0%';
            if (uploadStatusText) uploadStatusText.style.display = 'none';
            showToast('❌ Network error — check your connection.');
        }
        shotsTaken = Math.max(0, shotsTaken - 1);
        localStorage.setItem('shotsTaken_session', shotsTaken);
        updateShotsCounter();
    };

    xhr.send(blob);
}

// ── Hype screen display ────────────────────────────────────────────────────
function showHypeScreen() {
    const modal = document.getElementById('hypeScreenModal');
    const status = document.getElementById('hypeRollStatus');
    if (modal) {
        if (status) {
            const remaining = Math.max(0, shotLimit - shotsTaken);
            if (remaining > 0) {
                status.innerText = `Shot #${shotsTaken} captured! ${remaining} frame${remaining !== 1 ? 's' : ''} left on your roll.`;
            } else {
                status.innerText = `Shot #${shotsTaken} captured! Roll complete. 🎉`;
            }
        }
        modal.style.display = 'flex';
    }
}

/* ==========================================================================
   GALLERY HANDLERS  (/view page)
   ========================================================================== */

function renderPhotoThumbnails(pageSize, specificPage, prepend = false) {
    if (!galleryElement) return;
    pageSize = pageSize || parseInt(galleryElement.dataset.pageSize) || 12;

    let pageMarker;
    if (typeof specificPage === 'undefined') {
        pageMarker = galleryElement.dataset.nextPage || '';
    } else {
        pageMarker = specificPage;
    }

    if (galleryElement.dataset.done === 'true' && !prepend) return;
    if (spinnerElement) spinnerElement.classList.remove('hidden');
    window.fetchIsRunning = true;

    const eventId = window.location.pathname.split('/')[1];
    fetch(`/api/photos?eventId=${eventId}&pageSize=${pageSize}&pageMarker=${pageMarker}`)
        .then(r => { if (r.ok) return r.json(); throw new Error('Gallery load failed'); })
        .then(data => {
            if (typeof specificPage === 'undefined') {
                galleryElement.dataset.nextPage = data.nextPage || '';
                galleryElement.dataset.done     = data.done ? 'true' : 'false';
            }

            if (!data.files || data.files.length === 0) {
                setRefreshMessages('No photos yet.', 'Check back soon!');
                showRefreshLink();
                return;
            }

            data.files.forEach(file => {
                if (!galleryItemTemplate) return;
                const { url, contentType } = file;
                const isVideo  = contentType && contentType.startsWith('video');
                const lbType   = isVideo ? 'customVideo' : 'image';

                const clone    = galleryItemTemplate.cloneNode(true);
                const li       = clone.querySelector('li');
                const linkEl   = clone.querySelector('a');

                const thumb    = new Image();
                thumb.src      = file.thumbnail || url;
                thumb.alt      = 'Guest photo';
                thumb.loading  = 'lazy';
                thumb.onerror  = () => { thumb.src = ''; };

                if (isVideo) {
                    const vidNum = (parseInt(galleryElement.dataset.numVideos) || 0) + 1;
                    galleryElement.dataset.numVideos = vidNum;
                    const vidEl  = document.createElement('video');
                    vidEl.src    = url;
                    vidEl.id     = `video${vidNum}`;
                    vidEl.preload = 'none';
                    vidEl.poster  = file.thumbnail || '';
                    vidEl.height  = window.innerHeight - 100;
                    vidEl.width   = window.innerWidth  - 100;
                    const tpl    = document.createElement('template');
                    tpl.appendChild(vidEl);
                    linkEl.href  = `#video${vidNum}`;
                    linkEl.appendChild(tpl);
                } else {
                    linkEl.href = url;
                }

                linkEl.dataset.type = lbType;
                linkEl.appendChild(thumb);

                // Extract uploader name
                let uploaderName = 'Guest';
                try {
                    const tags = JSON.parse(file.metaTags || '[]');
                    const tag  = tags.find(t => t.startsWith('uploader:'));
                    if (tag) uploaderName = tag.split(':')[1];
                } catch (e) {}

                // Hover info overlay
                const info  = document.createElement('div');
                info.className = 'gallery-item-info';

                const nameEl = document.createElement('span');
                nameEl.className = 'gallery-item-uploader';
                nameEl.innerText = uploaderName;
                info.appendChild(nameEl);

                if (file.note) {
                    const noteEl = document.createElement('p');
                    noteEl.className = 'gallery-item-note';
                    noteEl.innerText = `"${file.note}"`;
                    info.appendChild(noteEl);
                }

                li.appendChild(info);

                if (prepend) galleryElement.prepend(clone);
                else         galleryElement.append(clone);
            });

            if (galleryElement.dataset.done === 'true') {
                setRefreshMessages('No more photos to show.', 'Refresh to see new uploads');
                showRefreshLink();
            }
        })
        .catch(err => {
            console.error(err);
            setRefreshMessages('Could not load gallery.', 'Tap to try again');
            showRefreshLink();
            galleryElement.dataset.done = 'true';
        })
        .finally(() => {
            if (spinnerElement) spinnerElement.classList.add('hidden');
            window.fetchIsRunning = false;
            if (window.refreshFsLightbox) refreshFsLightbox();
        });
}

function loadMoreOnScroll() {
    if (!galleryElement) return;
    throttle(() => {
        if (window.innerHeight + window.pageYOffset >= document.body.offsetHeight - 300) {
            if (!window.fetchIsRunning) renderPhotoThumbnails();
        }
    }, 500);
}

function refreshPhotoThumbnails() {
    if (!galleryElement) return;
    galleryElement.replaceChildren();
    galleryElement.dataset.done      = 'false';
    galleryElement.dataset.nextPage  = '';
    galleryElement.dataset.numVideos = 0;
    renderPhotoThumbnails();
}

function setRefreshMessages(msg, action) {
    const m = document.querySelector('#refreshLink .message');
    const a = document.querySelector('#refreshLink .action');
    if (m) m.innerHTML = msg;
    if (a) a.innerHTML = action;
}

function showRefreshLink() {
    if (refreshLinkElement) refreshLinkElement.classList.remove('hidden');
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

// Apply a CSS filter string to an image File object via canvas
function applyFilterToImageFile(file, filter, callback) {
    if (!filter || filter === 'none') { callback(file); return; }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        const c   = document.createElement('canvas');
        c.width   = img.naturalWidth;
        c.height  = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.filter = filter;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);
        c.toBlob(blob => callback(blob || file), file.type || 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); callback(file); };
}

// Capture a thumbnail from a video File at the first frame
function captureVideoThumbnail(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src   = URL.createObjectURL(file);
        video.muted = true;
        video.load();
        video.addEventListener('loadedmetadata', () => {
            if (video.duration < 0.01) { reject('No frames'); return; }
            video.currentTime = Math.min(0.5, video.duration * 0.1);
        });
        video.addEventListener('seeked', () => {
            const c   = document.createElement('canvas');
            c.width   = video.videoWidth;
            c.height  = video.videoHeight;
            c.getContext('2d').drawImage(video, 0, 0);
            URL.revokeObjectURL(video.src);
            c.toBlob(blob => blob ? resolve(blob) : reject('Blob empty'), 'image/jpeg', 0.7);
        });
        video.onerror = () => { URL.revokeObjectURL(video.src); reject('Video load error'); };
    });
}

// Simple throttle utility
let _throttleTimer;
function throttle(fn, ms) {
    if (_throttleTimer) return;
    _throttleTimer = setTimeout(() => { fn(); _throttleTimer = null; }, ms);
}

/* ==========================================================================
   PAGE INITIALISATION
   ========================================================================== */

function _initPage() {
    // Camera / upload page
    if (cameraStream) {
        initUploadPage();
    }
    // Gallery page (or any page with a gallery element but no camera)
    if (galleryElement && !cameraStream) {
        renderPhotoThumbnails();
    }
}

// The script tag is at the end of <body>, so DOMContentLoaded may have
// already fired by the time this script is parsed.  Guard against both cases:
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initPage);
} else {
    _initPage(); // DOM is already fully loaded — run immediately
}


// Infinite-scroll listener
document.addEventListener('scroll', loadMoreOnScroll);

// Refresh link
if (refreshLinkElement) {
    refreshLinkElement.addEventListener('click', e => {
        e.preventDefault();
        refreshLinkElement.classList.add('hidden');
        refreshPhotoThumbnails();
    });
}
