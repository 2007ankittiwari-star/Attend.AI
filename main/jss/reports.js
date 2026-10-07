
document.addEventListener('DOMContentLoaded', async () => {
    let history = [];
    try {
        const response = await fetch(`${API_BASE}/attendance-history`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load reports');
        history = data;
        } catch (e) {
        console.error(e);
        alert('Could not load attendance reports from the server. ' + (e.message || 'Please check your connection and try again.'));
    }

    let present = 0, absent = 0;
    history.forEach(s => (s.results || []).forEach(x => x.status === 'Present' ? present++ : absent++));
    const total = present + absent;
    const overall = total ? Math.round(present / total * 100) : 0;

    const cards = document.querySelectorAll('.cards .card');
    if (cards[0]?.querySelector('h2')) cards[0].querySelector('h2').textContent = `${overall}%`;
    if (cards[1]?.querySelector('h2')) cards[1].querySelector('h2').textContent = history.length;
    if (cards[2]?.querySelector('h2')) cards[2].querySelector('h2').textContent = present + absent;

    if (typeof Chart !== 'undefined') {
        const pie = document.getElementById('pieChart');
        if (pie) new Chart(pie, { type: 'doughnut', data: { labels: ['Present', 'Absent'], datasets: [{ data: [present, absent] }] }, options: { responsive: true } });

        const labels = [], values = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const sessions = history.filter(s => (s.date || s.timestamp?.slice(0,10)) === key);
            let p = 0, t = 0;
            sessions.forEach(s => (s.results || []).forEach(x => { t++; if (x.status === 'Present') p++; }));
            labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
            values.push(t ? Math.round(p / t * 100) : 0);
        }
        const bar = document.getElementById('barChart');
        if (bar) new Chart(bar, { type: 'bar', data: { labels, datasets: [{ label: 'Attendance %', data: values }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } } });

        const line = document.getElementById('lineChart');
        if (line) new Chart(line, { type: 'line', data: { labels, datasets: [{ label: 'Attendance %', data: values, tension: .3 }] }, options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } } });
    }

    const table = document.querySelector('.subject-table tbody');
    if (table) {
        const grouped = {};
        history.forEach(s => {
            const key = s.subject || 'Unknown Subject';
            grouped[key] ??= { present: 0, total: 0, faculty: s.faculty || 'Professor' };
            (s.results || []).forEach(x => { grouped[key].total++; if (x.status === 'Present') grouped[key].present++; });
        });
        table.innerHTML = Object.entries(grouped).map(([subject, v]) => `<tr><td>${escapeHTML(subject)}</td><td>${escapeHTML(v.faculty)}</td><td>${v.total ? Math.round(v.present/v.total*100) : 0}%</td><td>${history.filter(s => (s.subject || 'Unknown Subject') === subject).at(-1)?.accuracy ?? 0}%</td></tr>`).join('');
    }

    document.getElementById('excelBtn')?.addEventListener('click', () => {
        let csv = 'Subject,Faculty,Attendance,AI Accuracy\n';
        document.querySelectorAll('.subject-table tbody tr').forEach(row => {
            const cells = [...row.querySelectorAll('td')].map(c => c.textContent.trim().replaceAll('"', '""'));
            csv += `"${cells.join('","')}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `attendance_report_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('pdfBtn')?.addEventListener('click', () => window.print());

    function escapeHTML(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
});
