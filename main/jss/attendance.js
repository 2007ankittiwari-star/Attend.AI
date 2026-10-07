document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user || user.role !== 'professor') { window.location.href = 'login.html'; return; }
    

    const video = document.getElementById('cameraPreview');
    const startCameraBtn = document.getElementById('startCamera');
    const captureBtn = document.getElementById('capture');
    const stopCameraBtn = document.getElementById('stopCamera');
    const startAttendanceBtn = document.getElementById('startAttendanceBtn');
    const finishBtn = document.getElementById('finishAttendanceBtn');
    const attendanceBody = document.getElementById('attendanceBody');
    const aiStatus = document.getElementById('aiStatusText');
    const subject = document.getElementById('subject');
    const selects = document.querySelectorAll('.form-group select');
    const sectionSelect = selects[1];
    const facultyInput = document.querySelector('.form-group input[readonly]');
    const dateInput = document.getElementById('attendanceDate');
    const timeInput = document.getElementById('attendanceTime');

    let stream = null;
    let latestAttendance = null;
    let recorder = null;
    let chunks = [];
    let recordingTimer = null;

    const savedAttendance = sessionStorage.getItem('latestAttendance');
    if (savedAttendance) {
        try {
            latestAttendance = JSON.parse(savedAttendance);
            updateUI(latestAttendance);
        } catch { /* ignore corrupted/old saved data */ }
    }

    const today = new Date();
    dateInput.value = today.toISOString().slice(0,10);
    timeInput.value = today.toTimeString().slice(0,5);
    if (facultyInput) facultyInput.value = user.name || 'Professor';

    function setStatus(text) { if (aiStatus) aiStatus.textContent = text; }

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
            video.srcObject = stream;
            setStatus('Camera ready. Start attendance when the class is visible.');
        } catch (e) {
            setStatus('Camera permission denied or unavailable.');
            alert('Could not access the camera. Check macOS/browser camera permission.');
        }
    }

    function stopCamera() {
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        if (video) video.srcObject = null;
        setStatus('Camera stopped.');
    }

    function captureFrame() {
        if (!stream || !video.videoWidth) return alert('Start the camera first.');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `attendance_snapshot_${Date.now()}.jpg`;
            a.click();
            URL.revokeObjectURL(a.href);
        }, 'image/jpeg', .92);
    }

    async function processAttendance() {
        if (!stream) return alert('Start the camera first.');
        if (!subject.value || subject.value === 'Select Subject') return alert('Select a subject first.');

        startAttendanceBtn.disabled = true;
        chunks = [];
        setStatus('Recording attendance clip...');

        const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? { mimeType: 'video/webm;codecs=vp8' }
            : { mimeType: 'video/webm' };

        try {
            recorder = new MediaRecorder(stream, options);
        } catch {
            recorder = new MediaRecorder(stream);
        }

        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

        recorder.onstop = async () => {
            clearTimeout(recordingTimer);
            const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
            const formData = new FormData();
            formData.append('video', blob, 'attendance_clip.webm');
            formData.append('subject', subject.value);
            formData.append('date', dateInput.value);
            formData.append('time', timeInput.value);
            formData.append('section', sectionSelect?.value || 'All');
            formData.append('faculty', facultyInput?.value || user.name || 'Professor');
            formData.append('user_email', user.email || '');

            setStatus('Uploading clip and running face recognition...');
            try {
                const response = await fetch(`${API_BASE}/process-attendance`, { method:'POST', body:formData });
                const data = await response.json().catch(() => ({}));
                console.log('ATTENDANCE RESULT:', data);
                if (!response.ok) throw new Error(data.error || 'Attendance processing failed.');
                latestAttendance = data;
                sessionStorage.setItem('latestAttendance', JSON.stringify(data));
                updateUI(data);
                setStatus('Attendance posted.');
                document.querySelector('.attendance-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

                if (data.recognition_warning) {
                    alert(data.recognition_warning);
                }
                if (data.unknown_faces > 0) {
                    const settings = await fetch(`${API_BASE}/settings/${encodeURIComponent(user.email)}`).then(r => r.json()).catch(() => ({}));
                    if (settings.unknownFaceAlert) {
                        alert(`${data.unknown_faces} unrecognized face(s) were detected in this session.`);
                    }
                }

                if (data.unknown_faces > 0) {
                    const settings = await fetch(`${API_BASE}/settings/${encodeURIComponent(user.email)}`).then(r => r.json()).catch(() => ({}));
                    if (settings.unknownFaceAlert) {
                        alert(`${data.unknown_faces} unrecognized face(s) were detected in this session.`);
                    }
                }
            } catch (e) {
                console.error(e);
                setStatus('Attendance processing failed.');
                alert(e.message);
            } finally {
                startAttendanceBtn.disabled = false;
            }
        };

        recorder.start();
        recordingTimer = setTimeout(() => {
            if (recorder && recorder.state !== 'inactive') recorder.stop();
        }, 10000);
    }

    function updateUI(data) {
        const results = data.results || [];
        const present = results.filter(s => s.status === 'Present').length;
        const absent = results.filter(s => s.status === 'Absent').length;
        const percent = results.length ? Math.round(present / results.length * 100) : 0;

        document.getElementById('presentCount').textContent = present;
        document.getElementById('absentCount').textContent = absent;
        document.getElementById('unknownCount').textContent = data.unknown_faces ?? 0;
        document.getElementById('percentage').textContent = `${percent}%`;

               attendanceBody.innerHTML = results.length ? results.map(s => `
            <tr>
                <td><img src="${API_BASE}/student-image/${encodeURIComponent(s.roll_no)}" alt="Student" onerror="this.style.visibility='hidden'"></td>
                <td>${escapeHTML(s.roll_no)}</td>
                <td>${escapeHTML(s.name)}</td>
                <td><span class="${s.status === 'Present' ? 'present' : 'absent'}">${s.status}</span></td>
                <td>${s.status === 'Present' ? escapeHTML(data.time || '--') : '--'}</td>
                <td><button type="button" class="toggle-status-btn" data-roll="${escapeHTML(s.roll_no)}">${s.status === 'Present' ? 'Mark Absent' : 'Mark Present'}</button></td>
            </tr>`).join('') :
            `<tr><td colspan="6" style="text-align:center;padding:25px;">No students are enrolled in this section.</td></tr>`;
    }

        attendanceBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.toggle-status-btn');
        if (!btn || !latestAttendance?.id) return;
        const roll = btn.dataset.roll;
        const student = latestAttendance.results.find(s => s.roll_no === roll);
        if (!student) return;
        const newStatus = student.status === 'Present' ? 'Absent' : 'Present';
        btn.disabled = true;
        try {
            const response = await fetch(`${API_BASE}/attendance-logs/${encodeURIComponent(latestAttendance.id)}/mark`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_no: roll, status: newStatus })
            });
            const resData = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(resData.error || 'Could not update attendance.');

            latestAttendance.results = resData.results || latestAttendance.results;
            latestAttendance.detected_faces = resData.detected_faces ?? latestAttendance.detected_faces;
            latestAttendance.attendance_percentage = resData.attendance_percentage ?? latestAttendance.attendance_percentage;
            sessionStorage.setItem('latestAttendance', JSON.stringify(latestAttendance));
            updateUI(latestAttendance);
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
        }
    });

    startCameraBtn?.addEventListener('click', startCamera);
    startCameraBtn?.addEventListener('click', startCamera);
    captureBtn?.addEventListener('click', captureFrame);
    stopCameraBtn?.addEventListener('click', stopCamera);
    startAttendanceBtn?.addEventListener('click', processAttendance);
    finishBtn?.addEventListener('click', () => {
        if (!latestAttendance) return alert('Process attendance first before finishing.');
        window.location.href = 'results.html';
    });
    document.querySelector('.pause-btn')?.addEventListener('click', () => {
        if (recorder?.state === 'recording') {
            recorder.pause();
            setStatus('Recording paused.');
        } else if (recorder?.state === 'paused') {
            recorder.resume();
            setStatus('Recording resumed.');
        }
    });

    function escapeHTML(value) {
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    window.addEventListener('beforeunload', stopCamera);
});
