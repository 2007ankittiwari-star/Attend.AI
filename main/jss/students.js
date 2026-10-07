document.addEventListener('DOMContentLoaded', () => {
    if (!requireProfessor()) return;

    const modal = document.getElementById('studentModal');
    const form = document.getElementById('studentForm');
    const photo = document.getElementById('studentPhoto');
    const table = document.getElementById('studentTableBody');
    const search = document.getElementById('searchStudent');
    const status = document.getElementById('modalStatusMsg');
    const photoStatus = document.getElementById('photoStatusText');
    let allStudents = [];

    document.getElementById('openAddStudentModal')?.addEventListener('click', () => {
        form.reset();
        photoStatus.textContent = 'Upload Reference Face Image';
        status.textContent = '';
        modal.style.display = 'flex';
    });

    document.getElementById('closeModal')?.addEventListener('click', () => {
        modal.style.display = 'none';
        form.reset();
    });

    document.getElementById('captureFaceBtn')?.addEventListener('click', () => photo.click());
    photo?.addEventListener('change', () => {
        photoStatus.textContent = photo.files?.[0] ? `Selected: ${photo.files[0].name}` : 'Upload Reference Face Image';
    });

    async function loadStudents() {
        try {
            const response = await fetch(`${API_BASE}/students`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load students.');
            allStudents = data;
            render(allStudents);
            document.getElementById('totalStudentsCount').textContent = allStudents.length;
            document.getElementById('facesRegisteredCount').textContent = allStudents.filter(s => s.face_registered).length;
            document.getElementById('pendingCount').textContent = allStudents.filter(s => !s.face_registered).length;
        } catch (e) {
            table.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:25px;">${escapeHTML(e.message)}</td></tr>`;
        }
    }

    function render(list) {
        if (!list.length) {
            table.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:25px;">No students enrolled yet. Add students from this page.</td></tr>`;
            return;
        }
        table.innerHTML = list.map(s => `
            <tr>
                <td><img src="${API_BASE}/student-image/${encodeURIComponent(s.roll_no)}" style="border-radius:50%;width:45px;height:45px;object-fit:cover;" onerror="this.style.display='none'"></td>
                <td><strong>${escapeHTML(s.roll_no)}</strong></td>
                <td>${escapeHTML(s.name)}</td>
                <td>${escapeHTML(s.department || '')}</td>
                <td>${escapeHTML(s.section || '')}</td>
                <td><span class="registered" style="background:rgba(16,185,129,.1);color:#10b981;padding:4px 8px;border-radius:4px;font-weight:600;">Face Enrolled</span></td>
                <td><button class="delete" data-roll="${escapeHTML(s.roll_no)}"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('');
    }

    table?.addEventListener('click', async e => {
        const btn = e.target.closest('.delete');
        if (!btn) return;
        const roll = btn.dataset.roll;
        if (!confirm(`Delete student ${roll} and their face image from Firebase?`)) return;
        try {
            const response = await fetch(`${API_BASE}/students/${encodeURIComponent(roll)}`, {method:'DELETE'});
            const data = await response.json().catch(()=>({}));
            if (!response.ok) throw new Error(data.error || 'Delete failed.');
            await loadStudents();
        } catch (err) { alert(err.message); }
    });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        if (!photo.files?.length) return alert('Select a reference face image first.');

        const formData = new FormData();
        formData.append('name', document.getElementById('studentName').value.trim());
        formData.append('roll_no', document.getElementById('rollNo').value.trim());
        formData.append('email', document.getElementById('studentEmail').value.trim());
        formData.append('department', document.getElementById('department').value);
        formData.append('section', document.getElementById('section').value);
        formData.append('image', photo.files[0]);

        status.textContent = 'Uploading face image to Firebase Storage...';
        try {
            const response = await fetch(`${API_BASE}/students`, {method:'POST',body:formData});
            const data = await response.json().catch(()=>({}));
            if (!response.ok) throw new Error(data.error || 'Could not enroll student.');
            status.textContent = 'Student and face image saved to Firebase.';
            await loadStudents();
            setTimeout(() => { modal.style.display='none'; form.reset(); photoStatus.textContent='Upload Reference Face Image'; }, 700);
        } catch (err) {
            status.textContent = err.message;
        }
    });

    search?.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        render(allStudents.filter(s => `${s.name} ${s.roll_no}`.toLowerCase().includes(q)));
    });

    function escapeHTML(value) {
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    loadStudents();
});
