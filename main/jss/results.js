document.addEventListener('DOMContentLoaded', () => {
    const raw = sessionStorage.getItem('latestAttendance');
    if (!raw) {
        window.location.href = 'attendance.html';
        return;
    }
    let data;
    try { data = JSON.parse(raw); } catch { window.location.href = 'attendance.html'; return; }

        if (data.recognition_warning) alert(data.recognition_warning);

    const results = data.results || [];
    const present = results.filter(s => s.status === 'Present').length;
    const absent = results.length - present;
    const percent = results.length ? Math.round(present / results.length * 100) : 0;

    document.getElementById('totalStudents').textContent = results.length;
    document.getElementById('presentStudents').textContent = present;
    document.getElementById('absentStudents').textContent = absent;
    document.getElementById('attendancePercent').textContent = `${percent}%`;

    const table = document.getElementById('studentTable');
    table.innerHTML = results.map(s => `
        <tr>
            <td><img src="${(window.ATTEND_API_BASE || "http://127.0.0.1:5000/api")}/student-image/${encodeURIComponent(s.roll_no)}" alt="Student"></td>
            <td>${escapeHTML(s.roll_no)}</td>
            <td>${escapeHTML(s.name)}</td>
            <td><span class="${s.status === 'Present' ? 'present' : 'absent'}">${escapeHTML(s.status)}</span></td>
            <td>${s.status === 'Present' ? escapeHTML(data.time || '--') : '--'}</td>
        </tr>`).join('');

    const fill = document.querySelector('.progress-fill');
    if (fill) { fill.style.width = `${percent}%`; fill.textContent = `${percent}%`; }

    const stats = document.querySelectorAll('.analytics-card .stat strong');
    if (stats[0]) stats[0].textContent = `${data.accuracy ?? 0}%`;
    if (stats[1]) stats[1].textContent = data.detected_faces ?? 0;
    if (stats[2]) stats[2].textContent = data.unknown_faces ?? 0;
    if (stats[3]) stats[3].textContent = `${data.processing_time ?? 0}s`;

    const search = document.getElementById('searchStudent');
    search?.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        table.querySelectorAll('tr').forEach(row => row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none');
    });

    document.getElementById('saveAttendance')?.addEventListener('click', () => alert('This attendance session is already stored in Firebase.'));
    document.getElementById('sendReport')?.addEventListener('click', () => alert('The Firebase record is saved. Email delivery is not configured yet.'));
    document.getElementById('retakeAttendance')?.addEventListener('click', () => window.location.href = 'attendance.html');
    document.getElementById('goDashboard')?.addEventListener('click', () => window.location.href = 'dashboard.html');

    document.querySelector('.top-actions .excel')?.addEventListener('click', exportCSV);
    document.querySelector('.top-actions .pdf')?.addEventListener('click', () => window.print());

    function exportCSV() {
        let csv = 'Registration,Name,Status,Time\n';
        results.forEach(s => csv += `"${s.roll_no}","${s.name}","${s.status}","${s.status === 'Present' ? data.time || '' : ''}"\n`);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `attendance_${data.date || Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    }

    function escapeHTML(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
});
