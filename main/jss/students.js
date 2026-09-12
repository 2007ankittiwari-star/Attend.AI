document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const studentModal = document.getElementById('studentModal');
    const openAddStudentModal = document.getElementById('openAddStudentModal');
    const closeModal = document.getElementById('closeModal');
    const studentForm = document.getElementById('studentForm');
    
    const captureFaceBtn = document.getElementById('captureFaceBtn');
    const studentPhoto = document.getElementById('studentPhoto');
    const photoStatusText = document.getElementById('photoStatusText');
    const modalStatusMsg = document.getElementById('modalStatusMsg');
    
    const studentTableBody = document.getElementById('studentTableBody');
    const searchStudentInput = document.getElementById('searchStudent');

    const totalStudentsEl = document.getElementById('totalStudentsCount');
    const facesRegisteredEl = document.getElementById('facesRegisteredCount');
    const pendingEl = document.getElementById('pendingCount');

    let allStudents = [];

    // 1. MODAL OPEN / CLOSE
    if (openAddStudentModal) {
        openAddStudentModal.addEventListener('click', () => {
            studentModal.style.display = 'flex';
            if (modalStatusMsg) modalStatusMsg.textContent = '';
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            studentModal.style.display = 'none';
            studentForm.reset();
            if (photoStatusText) photoStatusText.textContent = 'Upload Reference Face Image';
        });
    }

    // 2. TRIGGER PHOTO FILE SELECTOR
    if (captureFaceBtn && studentPhoto) {
        captureFaceBtn.addEventListener('click', () => studentPhoto.click());

        studentPhoto.addEventListener('change', () => {
            if (studentPhoto.files && studentPhoto.files[0]) {
                photoStatusText.textContent = `Selected: ${studentPhoto.files[0].name}`;
                photoStatusText.style.color = '#10b981';
            }
        });
    }

    // 3. LOAD STUDENTS FROM FLASK / FIREBASE
    async function loadStudents() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/students');
            allStudents = await response.json();

            renderTable(allStudents);
            updateStats(allStudents);
        } catch (err) {
            console.error("Error loading students:", err);
        }
    }

    function renderTable(students) {
        if (!studentTableBody) return;
        studentTableBody.innerHTML = '';

        if (students.length === 0) {
            studentTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No students registered yet. Click "Add Student" to create one.</td></tr>`;
            return;
        }

        students.forEach(s => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="https://i.pravatar.cc/45?u=${s.roll_no}" style="border-radius: 50%;"></td>
                <td><strong>${s.roll_no}</strong></td>
                <td>${s.name}</td>
                <td>${s.department || 'CSE Core'}</td>
                <td>${s.section || 'A11+A12+A13'}</td>
                <td>
                    <span class="registered" style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                        Registered
                    </span>
                </td>
                <td>
                    <button class="edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            studentTableBody.appendChild(row);
        });
    }

    function updateStats(students) {
        const count = students.length;
        if (totalStudentsEl) totalStudentsEl.textContent = count;
        if (facesRegisteredEl) facesRegisteredEl.textContent = count;
        if (pendingEl) pendingEl.textContent = 0;
    }

    // 4. SUBMIT FORM & SAVE STUDENT
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('studentName').value.trim();
            const rollNo = document.getElementById('rollNo').value.trim();
            const email = document.getElementById('studentEmail').value.trim();
            const department = document.getElementById('department').value;
            const section = document.getElementById('section').value;

            if (!studentPhoto.files || studentPhoto.files.length === 0) {
                alert("Please select a reference face image for the student!");
                return;
            }

            const formData = new FormData();
            formData.append('roll_no', rollNo);
            formData.append('name', name);
            formData.append('email', email);
            formData.append('department', department);
            formData.append('section', section);
            formData.append('image', studentPhoto.files[0]);

            if (modalStatusMsg) {
                modalStatusMsg.textContent = "Saving to Firebase...";
                modalStatusMsg.style.color = "#3b82f6";
            }

            try {
                const response = await fetch('http://127.0.0.1:5000/api/register-student', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    if (modalStatusMsg) {
                        modalStatusMsg.textContent = "✅ " + data.message;
                        modalStatusMsg.style.color = "#10b981";
                    }
                    setTimeout(() => {
                        studentModal.style.display = 'none';
                        studentForm.reset();
                        photoStatusText.textContent = 'Upload Reference Face Image';
                        photoStatusText.style.color = '';
                        loadStudents(); // Refresh table live!
                    }, 1200);
                } else {
                    if (modalStatusMsg) {
                        modalStatusMsg.textContent = "❌ " + (data.error || "Registration failed");
                        modalStatusMsg.style.color = "#ef4444";
                    }
                }
            } catch (err) {
                console.error("Fetch Error:", err);
                if (modalStatusMsg) {
                    modalStatusMsg.textContent = "❌ Error connecting to Flask server!";
                    modalStatusMsg.style.color = "#ef4444";
                }
            }
        });
    }

    // 5. LIVE SEARCH FILTER
    if (searchStudentInput) {
        searchStudentInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allStudents.filter(s => 
                s.name.toLowerCase().includes(query) || 
                s.roll_no.toLowerCase().includes(query)
            );
            renderTable(filtered);
        });
    }

    // Initial Load
    loadStudents();
});