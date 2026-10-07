
document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('smartAttendanceCurrentUser') || 'null');
    const email = user?.email;
    const threshold = document.getElementById('threshold');
    const value = document.getElementById('value');
    const saveBtn = document.getElementById('saveSettings');
    const resetBtn = document.getElementById('resetSettings');
    const checkboxes = document.querySelectorAll('.setting-row input[type="checkbox"]');
    const profileInputs = document.querySelectorAll('.profile input');

    if (!email) {
        alert('Please log in first.');
        window.location.href = 'login.html';
        return;
    }

    const defaults = { threshold: 75, darkMode: true, emailNotifications: true, autoAttendanceSave: true, unknownFaceAlert: false };

    try {
        const response = await fetch(`${API_BASE}/settings/${encodeURIComponent(email)}`);
        const settings = response.ok ? await response.json() : defaults;
        apply(settings);
    } catch (e) { apply(defaults); }

        function apply(settings) {
        if (threshold) threshold.value = settings.threshold ?? 85;
        if (value) value.textContent = `${threshold?.value ?? 85}%`;
        if (checkboxes[0]) checkboxes[0].checked = settings.darkMode ?? true;
        if (checkboxes[1]) checkboxes[1].checked = settings.emailNotifications ?? true;
        if (checkboxes[2]) checkboxes[2].checked = settings.autoAttendanceSave ?? true;
        if (checkboxes[3]) checkboxes[3].checked = settings.unknownFaceAlert ?? false;
        document.documentElement.classList.toggle('light-mode', !(settings.darkMode ?? true));
        localStorage.setItem('smartAttendanceDarkMode', settings.darkMode ?? true);
    }

    threshold?.addEventListener('input', () => { if (value) value.textContent = `${threshold.value}%`; });
        checkboxes[0]?.addEventListener('change', () => {
        document.documentElement.classList.toggle('light-mode', !checkboxes[0].checked);
        localStorage.setItem('smartAttendanceDarkMode', checkboxes[0].checked);
    });

    saveBtn?.addEventListener('click', async () => {
        const payload = {
            threshold: Number(threshold?.value || 85),
            darkMode: checkboxes[0]?.checked ?? true,
            emailNotifications: checkboxes[1]?.checked ?? true,
            autoAttendanceSave: checkboxes[2]?.checked ?? true,
            unknownFaceAlert: checkboxes[3]?.checked ?? false,
            name: profileInputs[0]?.value?.trim() || '',
            profileEmail: profileInputs[1]?.value?.trim() || email,
            department: profileInputs[2]?.value?.trim() || ''
        };
        try {
            const response = await fetch(`${API_BASE}/settings/${encodeURIComponent(email)}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save settings');
            alert('Settings saved to Firebase.');
        } catch (e) { alert(e.message); }
    });

    resetBtn?.addEventListener('click', async () => {
        apply(defaults);
        alert('Settings reset to defaults. Click Save Settings to store them in Firebase.');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear(); sessionStorage.clear(); window.location.href = 'login.html';
    });
});
