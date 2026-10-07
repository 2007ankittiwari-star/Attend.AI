document.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.querySelector('.filters input[type="date"]');
    const selects = document.querySelectorAll('.filters select');
    const subjectSelect = selects[0];
    const slotSelect = selects[1];
    const searchInput = document.querySelector('.filters input[type="text"]');
    const tableBody = document.querySelector('.history-table tbody');
    let history = [];

    try {
        const response = await fetch(`${API_BASE}/attendance-history`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load history');
        history = data;
        render(history);
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:25px;">Could not load Firebase attendance history.</td></tr>`;
    }

    function render(records) {
        tableBody.innerHTML = records.length ? '' : `<tr><td colspan="8" style="text-align:center;padding:25px;">No attendance records found.</td></tr>`;
        records.forEach(record => {
            const results = record.results || [];
            const present = results.filter(s => s.status === 'Present').length;
            const absent = results.length - present;
            const percent = results.length ? Math.round(present / results.length * 100) : 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHTML(formatDate(record.date || record.timestamp))}</td>
                <td>${escapeHTML(record.subject || 'Unknown Subject')}</td>
                <td>${escapeHTML(record.faculty || 'Professor')}</td>
                <td>${escapeHTML(record.section || 'All')}</td>
                <td>${present}</td>
                <td>${absent}</td>
                <td><span class="${percent >= 90 ? 'excellent' : percent >= 75 ? 'good' : 'average'}">${percent}%</span></td>
                <td>
                    <button class="view" data-id="${record.id}"><i class="fa-solid fa-eye"></i></button>
                    <button class="download" data-id="${record.id}"><i class="fa-solid fa-download"></i></button>
                </td>`;
            tableBody.appendChild(row);
        });
    }

    function applyFilters() {
        const date = dateInput?.value || '';
        const subject = subjectSelect?.value || 'All Subjects';
        const slot = slotSelect?.value || 'Slot';
        const query = (searchInput?.value || '').toLowerCase().trim();
        render(history.filter(record => {
            const dateValue = record.date || (record.timestamp || '').slice(0, 10);
            return (!date || dateValue === date)
                && (subject === 'All Subjects' || record.subject === subject)
                && (slot === 'Slot' || record.section === slot)
                && (!query || JSON.stringify(record).toLowerCase().includes(query));
        }));
    }

    dateInput?.addEventListener('change', applyFilters);
    subjectSelect?.addEventListener('change', applyFilters);
    slotSelect?.addEventListener('change', applyFilters);
    searchInput?.addEventListener('input', applyFilters);

    tableBody.addEventListener('click', e => {
        const button = e.target.closest('button');
        if (!button) return;
        const record = history.find(r => r.id === button.dataset.id);
        if (!record) return;
        if (button.classList.contains('view')) show(record);
        if (button.classList.contains('download')) download(record);
    });

    function show(record) {
        const results = record.results || [];
        const present = results.filter(s => s.status === 'Present').length;
        alert(`Subject: ${record.subject || 'N/A'}\nDate: ${record.date || 'N/A'}\nPresent: ${present}\nAbsent: ${results.length - present}\nAttendance: ${results.length ? Math.round(present / results.length * 100) : 0}%`);
    }

    function download(record) {
        let csv = 'Registration,Name,Status\n';
        (record.results || []).forEach(s => csv += `"${s.roll_no}","${s.name}","${s.status}"\n`);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${record.date || Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function formatDate(value) {
        if (!value) return 'Unknown';
        const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
        return isNaN(d) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
});
