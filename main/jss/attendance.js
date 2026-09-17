// Backend API Endpoint
const API_URL = "http://127.0.0.1:5000/api/process-attendance";

// DOM Elements
const cameraPreview = document.getElementById("cameraPreview");
const startCameraBtn = document.getElementById("startCamera");
const stopCameraBtn = document.getElementById("stopCamera");
const startAttendanceBtn = document.getElementById("startAttendanceBtn");
const aiStatusText = document.getElementById("aiStatusText");
const attendanceBody = document.getElementById("attendanceBody");

// Stat Elements
const presentCountEl = document.getElementById("presentCount");
const absentCountEl = document.getElementById("absentCount");
const unknownCountEl = document.getElementById("unknownCount");
const percentageEl = document.getElementById("percentage");

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];

// Initialize current Date and Time on page load
document.addEventListener("DOMContentLoaded", () => {
    const now = new Date();
    document.getElementById("attendanceDate").value = now.toISOString().split("T")[0];
    document.getElementById("attendanceTime").value = now.toTimeString().slice(0, 5);
});

// 1. Start Webcam Feed
startCameraBtn.addEventListener("click", async () => {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraPreview.srcObject = mediaStream;
        aiStatusText.textContent = "Camera active. Ready for attendance.";
        aiStatusText.style.color = "#10b981";
    } catch (err) {
        console.error("Camera access error:", err);
        aiStatusText.textContent = "Error: Camera access denied or unavailable.";
        aiStatusText.style.color = "#ef4444";
    }
});

// 2. Stop Webcam Feed
stopCameraBtn.addEventListener("click", () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        cameraPreview.srcObject = null;
        mediaStream = null;
        aiStatusText.textContent = "Camera stopped.";
        aiStatusText.style.color = "#6b7280";
    }
});

// 3. Record 3-Second Video Clip and Process Attendance
startAttendanceBtn.addEventListener("click", () => {
    if (!mediaStream) {
        alert("Please click 'Start Camera' before initiating attendance.");
        return;
    }

    recordedChunks = [];
    
    try {
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
    } catch (e) {
        console.error("MediaRecorder setup error:", e);
        alert("WebM video recording is not supported on this browser.");
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
        await sendVideoToBackend(videoBlob);
    };

    // Begin recording clip
    mediaRecorder.start();
    aiStatusText.textContent = "🎥 Recording 3-second video clip...";
    aiStatusText.style.color = "#f59e0b";
    startAttendanceBtn.disabled = true;

    // Automatically stop recording after 3 seconds
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }, 3000);
});

// 4. Send Video Blob to Flask Server
async function sendVideoToBackend(videoBlob) {
    aiStatusText.textContent = "🧠 Extracting video frames & evaluating faces...";
    aiStatusText.style.color = "#3b82f6";

    const formData = new FormData();
    formData.append("video", videoBlob, "attendance_clip.webm");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to process video clip.");
        }

        const data = await response.json();
        updateUIWithResults(data);
        aiStatusText.textContent = "✅ AI Attendance evaluation complete!";
        aiStatusText.style.color = "#10b981";

    } catch (err) {
        console.error("Attendance request failed:", err);
        aiStatusText.textContent = `❌ Error: ${err.message}`;
        aiStatusText.style.color = "#ef4444";
    } finally {
        startAttendanceBtn.disabled = false;
    }
}

// 5. Update Roster Table and Dashboard Stat Cards
function updateUIWithResults(data) {
    const results = data.results || [];
    attendanceBody.innerHTML = "";

    let presentCount = 0;
    let absentCount = 0;

    results.forEach((student, index) => {
        const isPresent = student.status === "Present";
        if (isPresent) presentCount++;
        else absentCount++;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td><img src="https://i.pravatar.cc/45?img=${(index % 70) + 1}" alt="Student"></td>
            <td>${student.roll_no}</td>
            <td>${student.name}</td>
            <td><span class="${isPresent ? 'present' : 'absent'}">${student.status}</span></td>
            <td>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        `;
        attendanceBody.appendChild(row);
    });

    // Update Numerical Indicators
    presentCountEl.textContent = presentCount;
    absentCountEl.textContent = absentCount;
    
    // Calculate unidentified faces
    const unknownFaces = Math.max(0, (data.detected_faces || 0) - presentCount);
    unknownCountEl.textContent = unknownFaces;

    // Calculate percentage
    const totalStudents = presentCount + absentCount;
    const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
    percentageEl.textContent = `${percentage}%`;
}