
document.addEventListener('DOMContentLoaded', async () => {
    const user = getCurrentUser();
    if (!user || user.role !== 'professor') { window.location.href = 'login.html'; return; }

    try {
        const response = await fetch(`${API_BASE}/dashboard`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Dashboard failed');
        const cards = document.querySelectorAll('.cards .card');
        if (cards[0]?.querySelector('h2')) cards[0].querySelector('h2').textContent = data.total_students;
        if (cards[1]?.querySelector('h2')) cards[1].querySelector('h2').textContent = `${data.attendance}%`;
        if (cards[2]?.querySelector('h2')) cards[2].querySelector('h2').textContent = data.faces_registered;
        const status = document.querySelector('.status.online');
        if (status) status.textContent = '● Firebase Connected';
    } catch (e) {
        console.error(e);
        const status = document.querySelector('.status.online');
        if (status) { status.textContent = '● Backend Offline'; status.style.color = '#ef4444'; }
    }

    document.querySelectorAll('.logout, #logoutBtn').forEach(btn => btn.addEventListener('click', () => {
        localStorage.clear(); sessionStorage.clear(); window.location.href = 'login.html';
    }));
});
