document.addEventListener("DOMContentLoaded", (event) => {
    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // 1. Dynamic Navbar (Glassmorphism on Scroll)
    const navbar = document.querySelector('.navbar');
    // Initially, let's make it transparent
    gsap.set(navbar, { backgroundColor: "rgba(10, 10, 10, 0)", backdropFilter: "blur(0px)", borderBottom: "1px solid rgba(162, 188, 224, 0)" });
    
    ScrollTrigger.create({
        start: "top -50",
        end: 99999,
        toggleClass: { className: "navbar-scrolled", targets: ".navbar" },
        onEnter: () => {
            gsap.to(navbar, { backgroundColor: "rgba(10, 10, 10, 0.75)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(162, 188, 224, 0.15)", duration: 0.3 });
        },
        onLeaveBack: () => {
            gsap.to(navbar, { backgroundColor: "rgba(10, 10, 10, 0)", backdropFilter: "blur(0px)", borderBottom: "1px solid rgba(162, 188, 224, 0)", duration: 0.3 });
        }
    });

    // 2. Hero Section Entrance Animation
    const heroTimeline = gsap.timeline();
    heroTimeline.from(".section-subtitle", { y: 20, opacity: 0, duration: 0.6, ease: "power2.out", delay: 0.2 })
                .from(".hero-title", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, "-=0.4")
                .from(".hero-description", { y: 20, opacity: 0, duration: 0.8, ease: "power2.out" }, "-=0.5")
                .from(".hero-action-input", { y: 20, opacity: 0, duration: 0.5, ease: "back.out(1.5)" }, "-=0.4");

    // 3. Parallax Background Elements
    gsap.to(".bokeh-glow-1", {
        y: 200,
        ease: "none",
        scrollTrigger: {
            trigger: "body",
            start: "top top",
            end: "bottom top",
            scrub: true
        }
    });

    gsap.to(".bokeh-glow-2", {
        y: -150,
        ease: "none",
        scrollTrigger: {
            trigger: "body",
            start: "top top",
            end: "bottom top",
            scrub: true
        }
    });

    // Blueprint parallax
    gsap.to(".bg-lens-blueprint", {
        y: 150,
        rotation: 15,
        ease: "none",
        scrollTrigger: {
            trigger: ".section-wrapper",
            start: "top top",
            end: "bottom top",
            scrub: 1
        }
    });

    // 4. Floating Tilted Polaroids (Mockup Showcase)
    // Parallax scrolling up while floating
    gsap.to(".screenshot-left", {
        yPercent: -30,
        ease: "none",
        scrollTrigger: {
            trigger: ".mockup-showcase",
            start: "top bottom",
            end: "bottom top",
            scrub: 1
        }
    });

    gsap.to(".screenshot-right", {
        yPercent: -45,
        ease: "none",
        scrollTrigger: {
            trigger: ".mockup-showcase",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5
        }
    });

    // Add continuous gentle float animation to them
    gsap.to(".screenshot-left", {
        y: "-=15",
        rotation: "-=2",
        duration: 3,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
    });

    gsap.to(".screenshot-right", {
        y: "+=20",
        rotation: "+=3",
        duration: 4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
    });

    // 5. Staggered Mockup Indicators removed for debugging

    // 6. Central Phone Pop-in
    gsap.from(".phone-wrapper", {
        scrollTrigger: {
            trigger: ".mockup-showcase",
            start: "top 65%",
            toggleActions: "play none none reverse"
        },
        y: 80,
        opacity: 0,
        scale: 0.95,
        duration: 1,
        ease: "back.out(1.2)"
    });

    // 7. "Moments You Never Saw" Section Reveals
    gsap.from(".stats-bar span", {
        scrollTrigger: {
            trigger: ".staggered-phones-section",
            start: "top 80%",
            toggleActions: "play none none reverse"
        },
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power1.out"
    });

    gsap.from(".staggered-phones-section .section-title", {
        scrollTrigger: {
            trigger: ".staggered-phones-section",
            start: "top 75%",
            toggleActions: "play none none reverse"
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out"
    });

    // Staggered Phones Overlapping Animation
    const tlPhones = gsap.timeline({
        scrollTrigger: {
            trigger: ".staggered-phones-container",
            start: "top 70%",
            toggleActions: "play none none reverse"
        }
    });

    // The back phone starts a bit left and rotated
    tlPhones.from(".device-back", {
        x: -100,
        y: 50,
        opacity: 0,
        rotation: -10,
        duration: 1,
        ease: "power3.out"
    })
    // The front phone starts a bit right and lower
    .from(".device-front", {
        x: 100,
        y: 80,
        opacity: 0,
        rotation: 15,
        duration: 1,
        ease: "power3.out"
    }, "-=0.6");
    
    // 8. Dynamic Ambient Glow Particles
    const heroSection = document.querySelector('.section-wrapper');
    if (heroSection) {
        for (let i = 0; i < 15; i++) {
            let particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = Math.random() * 4 + 1 + 'px';
            particle.style.height = particle.style.width;
            particle.style.background = 'rgba(162, 188, 224, ' + (Math.random() * 0.5 + 0.2) + ')';
            particle.style.borderRadius = '50%';
            particle.style.boxShadow = '0 0 10px rgba(162, 188, 224, 0.8)';
            particle.style.pointerEvents = 'none';
            
            // Random start position within the hero
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            
            heroSection.appendChild(particle);
            
            // Float upwards infinitely with random speed and sway
            gsap.to(particle, {
                y: "-=300",
                x: "+=" + (Math.random() * 100 - 50),
                opacity: 0,
                duration: Math.random() * 5 + 5,
                repeat: -1,
                ease: "none",
                delay: Math.random() * 5
            });
        }
    }

    // 9. Mouse Tracking Flashlight Effect for Cards
    const cards = document.querySelectorAll('.step-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const flashlight = card.querySelector('.flashlight-glow');
            if (flashlight) {
                flashlight.style.left = `${x}px`;
                flashlight.style.top = `${y}px`;
            }
        });
    });
});
