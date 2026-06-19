/* ============================================================
   Lumina Film — Live Venue Slideshow
   Auto-polls for new photos every 8s. Cinematic dark mode.
   ============================================================ */

const eventId = window.location.pathname.split('/')[1] || '';

let photoQueue    = [];
let photoUrls     = new Set();
let currentIndex  = -1;
let slideshowInterval = null;
let isPlaying     = true;
let SLIDE_SPEED   = 7000; // ms per slide
let activeSlot    = 'A'; // cross-fade between slot A and B
let eventName     = '';
let newPhotoQueue = []; // photos that arrived since slideshow started

// DOM
const statusEl    = document.getElementById('slideshowStatus');
const imgA        = document.getElementById('slideImg1');
const imgB        = document.getElementById('slideImg2');
const captionBox  = document.getElementById('slideCaption');
const captionWho  = document.getElementById('captionUploader');
const captionMsg  = document.getElementById('captionText');
const playBtn     = document.getElementById('playPauseBtn');
const playIcon    = document.getElementById('playPauseIcon');
const nextBtn     = document.getElementById('nextBtn');
const toastEl     = document.getElementById('toast');
const photoCounter = document.getElementById('photoCount');

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg) {
    if (!toastEl) return;
    toastEl.querySelector('.message').innerText = msg;
    toastEl.classList.add('active');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('active'), 2500);
}

// ─── Fetch event config (name) ────────────────────────────────────────────────
function fetchEventConfig() {
    if (!eventId) return;
    fetch(`/api/config?eventId=${eventId}`)
        .then(r => r.json())
        .then(cfg => {
            eventName = cfg.eventName || '';
            const nameEl = document.getElementById('slideshowEventName');
            if (nameEl && eventName) nameEl.textContent = eventName;

            // Handle Sponsor Link
            if (cfg.sponsorLink) {
                const sponsorContainer = document.getElementById('sponsorContainer');
                const sponsorText = document.getElementById('sponsorText');
                const qrContainer = document.getElementById('sponsorQRCode');
                
                if (sponsorContainer && sponsorText && qrContainer) {
                    sponsorContainer.style.display = 'flex';
                    sponsorText.textContent = cfg.sponsorText || 'Sponsor';
                    
                    // Generate QR code
                    qrContainer.style.display = 'block';
                    qrContainer.innerHTML = '';
                    new QRCode(qrContainer, {
                        text: cfg.sponsorLink,
                        width: 42,
                        height: 42,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.L
                    });
                }
            }
        })
        .catch(() => {});
}

// ─── Fetch photos from API ────────────────────────────────────────────────────
function fetchPhotos() {
    const fetchUrl = eventId 
        ? `/api/photos?eventId=${eventId}&pageSize=200&moderatedOnly=true`
        : '/api/photos?pageSize=200&moderatedOnly=true';

    fetch(fetchUrl)
        .then(r => r.json())
        .then(data => {
            if (!data.files || data.files.length === 0) {
                if (photoQueue.length === 0) {
                    statusEl.textContent = 'Waiting for first shots…';
                    statusEl.style.display = 'block';
                }
                return;
            }

            // Only images for slideshow
            const images = data.files.filter(f =>
                f.contentType && f.contentType.startsWith('image')
            );

            let newCount = 0;
            images.forEach(photo => {
                if (!photoUrls.has(photo.url)) {
                    photoUrls.add(photo.url);
                    photoQueue.push(photo);
                    newPhotoQueue.push(photo); // mark as "new arrival"
                    newCount++;
                }
            });

            // Update counter badge
            if (photoCounter) photoCounter.textContent = photoQueue.length;

            if (photoQueue.length > 0) {
                statusEl.style.display = 'none';
            }

            if (currentIndex === -1 && photoQueue.length > 0) {
                // First load — kick off slideshow
                nextSlide();
                startTimer();
            } else if (newCount > 0 && currentIndex !== -1) {
                // New photos arrived mid-slideshow — flash badge
                showNewPhotoBadge(newCount);
            }
        })
        .catch(err => {
            console.error('Slideshow fetch error:', err);
        });
}

// ─── "New photo" flash badge ──────────────────────────────────────────────────
function showNewPhotoBadge(count) {
    let badge = document.getElementById('newPhotoBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'newPhotoBadge';
        badge.style.cssText = `
            position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
            background: rgba(229,169,59,0.95); color: #0A0908;
            padding: 8px 20px; border-radius: 100px;
            font-size: 0.8rem; font-weight: 700; font-family: var(--font-sans);
            letter-spacing: 1px; text-transform: uppercase;
            z-index: 50; opacity: 0; transition: opacity 0.4s ease;
            box-shadow: 0 4px 20px rgba(229,169,59,0.4);
        `;
        document.body.appendChild(badge);
    }
    badge.textContent = `📸 +${count} new photo${count > 1 ? 's' : ''} developing`;
    badge.style.opacity = '1';
    clearTimeout(badge._t);
    badge._t = setTimeout(() => { badge.style.opacity = '0'; }, 3500);
}

// ─── Timer control ────────────────────────────────────────────────────────────
function startTimer() {
    stopTimer();
    if (isPlaying) {
        slideshowInterval = setInterval(nextSlide, SLIDE_SPEED);
    }
}

function stopTimer() {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
}

// ─── Core: advance to next slide ──────────────────────────────────────────────
function nextSlide() {
    if (photoQueue.length === 0) return;

    // Prefer showing a newly arrived photo first
    let photo;
    if (newPhotoQueue.length > 0) {
        photo = newPhotoQueue.shift();
        currentIndex = photoQueue.indexOf(photo);
    } else {
        currentIndex = (currentIndex + 1) % photoQueue.length;
        photo = photoQueue[currentIndex];
    }

    const isSlotA = activeSlot === 'A';
    const incoming = isSlotA ? imgA : imgB;
    const outgoing = isSlotA ? imgB : imgA;
    activeSlot = isSlotA ? 'B' : 'A';

    // Preload then transition
    const preloader = new Image();
    preloader.src = photo.thumbnail || photo.url;
    preloader.onload = () => {
        incoming.src = preloader.src;

        // Cross-fade
        incoming.classList.add('active');
        outgoing.classList.remove('active');

        // Caption
        captionBox.classList.remove('active');
        setTimeout(() => {
            const who = photo.uploaderName || extractUploader(photo.metaTags) || 'Guest';
            captionWho.textContent = who;

            if (photo.note && photo.note.trim()) {
                captionMsg.textContent = `"${photo.note}"`;
                captionMsg.style.display = 'block';
            } else {
                captionMsg.textContent = '';
                captionMsg.style.display = 'none';
            }

            captionBox.classList.add('active');
        }, 700);
    };
    preloader.onerror = () => {
        // Skip broken image, try next
        nextSlide();
    };
}

function extractUploader(metaTags) {
    try {
        const tags = JSON.parse(metaTags || '[]');
        const t = tags.find(t => t.startsWith('uploader:'));
        return t ? t.split(':')[1] : null;
    } catch { return null; }
}

// ─── Play / Pause ─────────────────────────────────────────────────────────────
function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
        playIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
        startTimer();
        showToast('▶ Slideshow running');
    } else {
        playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
        stopTimer();
        showToast('⏸ Slideshow paused');
    }
}

// ─── Keyboard controls ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'p') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight' || e.key === 'n') { nextSlide(); startTimer(); }
    if (e.key === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    }
});

// ─── Button bindings ──────────────────────────────────────────────────────────
if (playBtn) playBtn.addEventListener('click', togglePlay);
if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startTimer(); });

const fullscreenBtn = document.getElementById('fullscreenBtn');
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchEventConfig();
    fetchPhotos();
    // Poll every 8 seconds for new uploads
    setInterval(fetchPhotos, 8000);
});
