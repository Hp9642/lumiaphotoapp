document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('authSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const authForm = document.getElementById('authForm');
    const authToggleBtn = document.getElementById('authToggleBtn');
    const authToggleText = document.getElementById('authToggleText');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const eventsList = document.getElementById('eventsList');
    const createEventBtn = document.getElementById('createEventBtn');
    const createEventModal = document.getElementById('createEventModal');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const createEventForm = document.getElementById('createEventForm');
    const toast = document.getElementById('toast');

    let isLoginMode = true;

    function showToast(message) {
        toast.querySelector('.message').innerText = message;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3000);
    }

    // Auth Toggle
    authToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            authToggleText.innerText = 'Need an account?';
            authToggleBtn.innerText = 'Register';
        } else {
            authToggleText.innerText = 'Already have an account?';
            authToggleBtn.innerText = 'Login';
        }
    });

    // Check Auth Status
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    showDashboard();
                } else {
                    showAuth();
                }
            } else {
                showAuth();
            }
        } catch (err) {
            showAuth();
        }
    }

    function showAuth() {
        authSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        logoutBtn.style.display = 'none';
    }

    function showDashboard() {
        authSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        logoutBtn.style.display = 'block';
        fetchEvents();
    }

    // Auth Form Submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                showDashboard();
            } else {
                showToast(data.error || 'Authentication failed');
            }
        } catch (err) {
            showToast('Network error');
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        showAuth();
    });

    // Fetch Events with photo stats
    async function fetchEvents() {
        try {
            const res = await fetch('/api/events');
            if (!res.ok) throw new Error('Failed to fetch events');
            const data = await res.json();
            
            if (data.events.length === 0) {
                eventsList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 3rem 0; border: 1px dashed var(--border-low); border-radius: 12px;">No events yet. Create one above!</div>';
                return;
            }

            // Fetch stats for each event in parallel
            const statsResults = await Promise.allSettled(
                data.events.map(ev => fetch(`/api/events/${ev.id}/stats`).then(r => r.json()))
            );

            eventsList.innerHTML = data.events.map((ev, i) => {
                const stats = statsResults[i].status === 'fulfilled' ? statsResults[i].value : { total: 0, guests: [] };
                const topGuests = (stats.guests || []).slice(0, 3).map(g => 
                    `<span style="color:var(--text-light);">${g.uploader_name||'Guest'} (${g.photo_count})</span>`
                ).join(' | ');

                return `
                <div class="event-card" style="border: 1px solid var(--border-subtle); padding: 2rem; margin-bottom: 2rem; background: transparent;">
                    <div style="flex:1;min-width:0;">
                        <h3 style="color: var(--text-light); font-size: 1.2rem; margin-bottom: 0.5rem; letter-spacing: 0.15em; text-transform: uppercase; white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.name}</h3>
                        <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap:wrap; margin-bottom:1rem; font-family: var(--font-heading); font-size: 0.75rem; letter-spacing: 0.1em; color: var(--text-muted); text-transform: uppercase;">
                            <span>ID: ${ev.id}</span>
                            <span>${new Date(ev.created_at).toLocaleDateString()}</span>
                            <span>${stats.total || 0} PHOTOS</span>
                        </div>
                        ${topGuests ? `<div style="font-size: 0.75rem; color: var(--text-muted); letter-spacing: 0.1em; font-family: var(--font-heading); text-transform: uppercase;">GUESTS: ${topGuests}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 1rem; flex-shrink:0; flex-wrap:wrap; justify-content:flex-start; margin-top: 1.5rem;">
                        <a href="/${ev.id}/manage" style="background: transparent; border: 1px solid var(--text-light); color: var(--text-light); font-size: 0.7rem; padding: 0.8rem 1.5rem; text-decoration: none; text-transform: uppercase; letter-spacing: 0.15em; font-family: var(--font-body); font-weight: 600;">DASHBOARD</a>
                        <a href="/${ev.id}/slideshow" style="background: transparent; border: 1px solid var(--border-subtle); color: var(--text-light); font-size: 0.7rem; padding: 0.8rem 1.5rem; text-decoration: none; text-transform: uppercase; letter-spacing: 0.15em; font-family: var(--font-body); font-weight: 600;">SLIDESHOW</a>
                        <button onclick="deleteEvent('${ev.id}', '${ev.name.replace(/'/g, "\\'")}')" style="background: transparent; border: 1px solid rgba(220,50,50,0.5); color: #e55; font-size: 0.7rem; padding: 0.8rem 1.5rem; text-transform: uppercase; letter-spacing: 0.15em; font-family: var(--font-body); cursor: pointer; font-weight: 600;">DELETE</button>
                    </div>
                </div>
            `}).join('');

        } catch (err) {
            eventsList.innerHTML = '<div style="text-align: center; color: var(--accent-danger);">Failed to load events.</div>';
        }
    }

    // Delete event
    window.deleteEvent = async function(eventId, eventName) {
        if (!confirm(`Delete "${eventName}" and ALL its photos? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Event deleted.');
                fetchEvents();
            } else {
                showToast('Failed to delete event.');
            }
        } catch(e) {
            showToast('Network error');
        }
    };

    // Create Event UI
    createEventBtn.addEventListener('click', () => {
        createEventModal.style.display = 'flex';
        document.getElementById('eventName').focus();
    });

    cancelCreateBtn.addEventListener('click', () => {
        createEventModal.style.display = 'none';
        createEventForm.reset();
    });

    createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('eventName').value;
        
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Event created!');
                createEventModal.style.display = 'none';
                createEventForm.reset();
                fetchEvents();
            } else {
                showToast(data.error || 'Creation failed');
            }
        } catch (err) {
            showToast('Network error');
        }
    });

    // Start
    checkAuth();
});
