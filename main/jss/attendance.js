document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const cameraPreview = document.getElementById('cameraPreview');
    const startCameraBtn = document.getElementById('startCamera');
    const stopCameraBtn = document.getElementById('stopCamera');
    const captureBtn = document.getElementById('capture');
    const startAttendanceBtn = document.getElementById('startAttendanceBtn');
    
    const attendanceDate = document.getElementById('attendanceDate');
    const attendanceTime = document.getElementById('attendanceTime');
    const aiStatusText = document.getElementById('aiStatusText');
    
    const attendanceBody = document.getElementById('attendanceBody');
    const presentCountEl = document.getElementById('presentCount');
    const absentCountEl = document.getElementById('absentCount');
    const unknownCountEl = document.getElementById('unknownCount');
    const percentageEl = document.getElementById('percentage');

    let stream = null;

    // Set default Date and Time to Current
    const now = new Date();
    if (attendanceDate) attendanceDate.value = now.toISOString().split('T')[0];
    if (attendanceTime) attendanceTime.value = now.toTimeString().slice(0, 5);

    // ==========================================
    // 1. CAMERA CONTROLS
    // ==========================================
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            cameraPreview.srcObject = stream;
            if (aiStatusText) aiStatusText.textContent = "Camera Active - Ready to Detect";
        } catch (err) {
            console.error("Camera access error:", err);
            alert("Could not access camera. Please check browser permissions.");
            if (aiStatusText) aiStatusText.textContent = "Camera Error";
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            cameraPreview.srcObject = null;
            stream = null;
            if (aiStatusText) aiStatusText.textContent = "Camera Stopped";
        }
    }

    if (startCameraBtn) startCameraBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startCamera();
    });
    
    if (stopCameraBtn) stopCameraBtn.addEventListener('click', (e) => {
        e.preventDefault();
        stopCamera();
    });

    // ==========================================
    // 2. CAPTURE & SEND TO FLASK (CAMERA STAYS ON)
    // ==========================================

    async function captureAndSend(e) {
        if (e) e.preventDefault(); // <--- Stops browser page refresh

        if (!stream) {
        alert("Please click 'Start Camera' first!");
        return;
        }

        if (aiStatusText) aiStatusText.textContent = "Processing Face Recognition...";

        // Capture snapshot frame
        const canvas = document.createElement('canvas');
        canvas.width = cameraPreview.videoWidth || 640;
        canvas.height = cameraPreview.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('video', blob, 'frame.jpg');

            try {
                const response = await fetch('http://127.0.0.1:5000/api/process-attendance', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    if (aiStatusText) aiStatusText.textContent = "Attendance Recorded!";
                    (data.results || []);
                } else {
                if (aiStatusText) aiStatusText.textContent = `Error: ${data.error || 'Failed'}`;
                }
            } catch (err) {
                console.error("Fetch Error:", err);
                if (aiStatusText) aiStatusText.textContent = "Error connecting to Flask server!";
            }
        }, 'image/jpeg');
    }

// Attach event listener safely
    if (startAttendanceBtn) {
        startAttendanceBtn.addEventListener('click', (e) => captureAndSend(e));
    }

    // ==========================================
    // 3. UPDATE TABLE & STATS CARDS
    // ==========================================
    function updateAttendanceUI(students) {
        if (!attendanceBody) return;

        attendanceBody.innerHTML = ''; // Clear existing static rows

        let present = 0;
        let absent = 0;
        let unknown = 0;

        students.forEach(student => {
            if (student.status === 'Present') present++;
            else if (student.status === 'Absent') absent++;
            else unknown++;

            const row = document.createElement('tr');
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            row.innerHTML = `
                <td><img src="https://i.pravatar.cc/45?u=${student.roll_no}" style="border-radius:50%;"></td>
                <td>${student.roll_no}</td>
                <td>${student.name}</td>
                <td>
                    <span class="${student.status.toLowerCase()}" style="padding: 4px 8px; border-radius: 4px; font-weight: 600; color: ${student.status === 'Present' ? '#10b981' : '#ef4444'};">
                        ${student.status}
                    </span>
                </td>
                <td>${timeStr}</td>
            `;
            attendanceBody.appendChild(row);
        });

        // Update Statistics Cards
        const total = students.length;
        if (presentCountEl) presentCountEl.textContent = present;
        if (absentCountEl) absentCountEl.textContent = absent;
        if (unknownCountEl) unknownCountEl.textContent = unknown;
        if (percentageEl) percentageEl.textContent = total > 0 ? `${Math.round((present / total) * 100)}%` : '0%';
    }
});