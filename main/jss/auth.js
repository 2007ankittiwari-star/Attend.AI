const API_BASE = window.ATTEND_API_BASE || 'http://127.0.0.1:5000/api';

function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('smartAttendanceCurrentUser') || 'null'); }
    catch { return null; }
}

function requireProfessor() {
    const user = getCurrentUser();
    if (!user || user.role !== 'professor') {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        const passwordInput = document.getElementById('password');
        document.getElementById('togglePassword')?.addEventListener('click', () => {
            const hidden = passwordInput.type === 'password';
            passwordInput.type = hidden ? 'text' : 'password';
        });

        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value.trim().toLowerCase();
            const password = passwordInput.value;
            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({email, password})
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Login failed');
                localStorage.setItem('smartAttendanceCurrentUser', JSON.stringify(data.user));
                localStorage.setItem('smartAttendanceLoggedIn', 'true');
                window.location.href = 'dashboard.html';
            } catch (error) { alert(error.message); }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async e => {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const employeeId = document.getElementById('employeeId').value.trim();
            const department = document.getElementById('department').value;
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (!name || !employeeId || !email || !password || !confirmPassword) return alert('Please fill all required fields.');
            if (password.length < 6) return alert('Password must contain at least 6 characters.');
            if (password !== confirmPassword) return alert('Passwords do not match.');
            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({name, email, password, role:'professor', employeeId, department})
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not create account');
                alert('Professor account created successfully. You can now sign in.');
                window.location.href = 'login.html';
            } catch (error) { alert(error.message); }
        });
    }

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
});

function logout() {
    localStorage.removeItem('smartAttendanceCurrentUser');
    localStorage.removeItem('smartAttendanceLoggedIn');
    sessionStorage.clear();
    window.location.href = 'login.html';
}
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        const linkPage = link.getAttribute('href');
        const li = link.querySelector('li');
        if (!li) return;
        li.classList.toggle('active', linkPage === currentPage);
    });

    const savedTheme = localStorage.getItem('smartAttendanceDarkMode');
    document.documentElement.classList.toggle('light-mode', savedTheme === 'false');
});