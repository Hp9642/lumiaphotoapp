/* 
   =============================================================================
   EDITORIAL HOMEPAGE INTERACTIONS
   ============================================================================= 
*/

document.addEventListener("DOMContentLoaded", () => {
    initFluidCursor();
    initMagneticButtons();
    initParallax();
});

/* ─── Fluid Cursor ───────────────────────────────────────────────────── */
function initFluidCursor() {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Lerp loop for the ring (fluid trailing effect)
    function render() {
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;

        dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        ring.style.transform = `translate(${ringX}px, ${ringY}px)`;

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // Hover effects for links/buttons
    const interactables = document.querySelectorAll('a, button, input');
    interactables.forEach(el => {
        el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
        el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
    });
}

/* ─── Magnetic Buttons ───────────────────────────────────────────────── */
function initMagneticButtons() {
    const magneticElements = document.querySelectorAll('.btn-magnetic');

    magneticElements.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const h = rect.width / 2;
            const v = rect.height / 2;
            
            // Calculate distance from center of button
            const x = e.clientX - rect.left - h;
            const y = e.clientY - rect.top - v;
            
            // Apply slight translation (magnetic pull)
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            // Snap back to original position
            btn.style.transform = `translate(0px, 0px)`;
            btn.style.transition = `transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)`;
        });
        
        btn.addEventListener('mouseenter', () => {
            btn.style.transition = `none`; // Remove transition for instant following
        });
    });
}

/* ─── Scroll-driven Parallax ─────────────────────────────────────────── */
function initParallax() {
    const parallaxImages = document.querySelectorAll('.parallax-img');
    
    // Using simple scroll listener (requestAnimationFrame could optimize further, but this is clean)
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                
                parallaxImages.forEach(img => {
                    const speed = img.dataset.speed || 0.15;
                    // Move the image inside its wrapper
                    img.style.transform = `translateY(${scrolled * speed}px)`;
                });
                
                ticking = false;
            });
            ticking = true;
        }
    });
}
