# Attend AI — Smart Attendance Management System

**Take attendance with a camera instead of calling out names.**

Attend AI is a web-based attendance management system that automates classroom attendance using facial recognition. Teachers can record a short video of the classroom, process it through a Python backend, and generate a list of present and absent students.

The application also supports manual attendance corrections, attendance history, reports, and customizable settings, making classroom attendance faster and easier to manage.

## Features

### 🔐 Secure Authentication
- Teacher registration and login.
- Password hashing for secure credential storage.
- Firebase-backed data management.

### 👨‍🎓 Student Management
- Register students with their names, unique IDs, and reference photographs.
- View and manage student records.
- Remove student records when necessary.

### 📷 Camera-Based Attendance
- Select the class group, subject, and attendance date.
- Record a short classroom video directly through the browser.
- Submit the video to the backend for processing.

### 🤖 Automated Face Recognition
- Detect faces in video frames using OpenCV and DeepFace.
- Compare detected faces against registered student reference images.
- Generate present and absent student lists.
- Configure the face-matching threshold.

### ✏️ Manual Attendance Updates
- Mark students as present or absent manually.
- Correct recognition results when necessary.

### 📊 History and Reports
- View previous attendance records.
- Review attendance summaries and charts.
- Export attendance data as CSV files.

### ⚙️ Customizable Settings
- Adjust face-matching settings.
- Switch between light and dark themes.
- Manage application preferences.

## How It Works

1. **Register Students:** Teachers add student details and upload reference photographs.
2. **Record a Video:** The teacher selects the class details and records a short classroom video.
3. **Upload for Processing:** The frontend sends the recorded video to the Flask backend.
4. **Detect and Recognize Faces:** OpenCV and DeepFace process selected video frames and compare detected faces with registered student photographs.
5. **Generate Attendance:** The application identifies recognized students and prepares the present and absent lists.
6. **Review and Update:** Teachers can manually correct attendance statuses.
7. **Save Records:** Attendance information is stored in Firebase Firestore for future reference.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Data Visualization | Chart.js |
| Backend | Python, Flask |
| Face Detection and Recognition | OpenCV, DeepFace |
| Face Detector | RetinaFace |
| Database | Google Firebase Firestore |
| Authentication Security | Werkzeug password hashing |
| Cross-Origin Requests | Flask-CORS |

## Project Structure

```text
Attend-AI/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── serviceAccountKey.json   # Create locally; do not commit
│   ├── uploads/                 # Created as needed
│   └── known_faces/             # Created as needed
│
├── main/
│   ├── login.html
│   ├── ...                      # Frontend HTML, CSS and JS files
│
├── README.md
└── .gitignore
```

*Note: The structure above illustrates the main components. Actual filenames and directories may vary depending on your repository.*

## Prerequisites

Before installing Attend AI, ensure you have the following:

- **Python:** 3.9, 3.10, or 3.11, as specified by the project requirements.
- **Git:** To clone the repository.
- **Google account:** To create and configure a Firebase project.
- **Webcam:** For recording classroom videos.
- **RAM:** At least 8 GB recommended.
- **Web browser:** A recent version of Chrome, Firefox, or Edge.
- **Internet connection:** Required for Firebase access and initial dependency/model downloads.

Face recognition libraries can require additional system dependencies. Check the installation instructions for OpenCV, DeepFace, and RetinaFace if installation fails.

## Installation and Setup

### Step 1: Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/2007ankittiwari-star/Attend.AI.git
cd Attend.AI
```

### Step 2: Configure Firebase Firestore

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create a Firebase project.
3. Navigate to **Build → Firestore Database**.
4. Create a Firestore database and configure its security rules.
5. Open **Project settings → Service accounts**.
6. Generate a new private key.
7. Save the downloaded JSON file as `serviceAccountKey.json`.
8. Place the file inside the `backend/` directory.

Your backend directory should contain:

```text
backend/
├── app.py
├── requirements.txt
└── serviceAccountKey.json
```

**Important:** The Firebase service account key grants privileged access to your Firebase project. Never publish it, commit it to GitHub, or expose it through the frontend.

### Step 3: Set Up the Python Backend

Open a terminal in the project root and navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv venv
```

Activate the environment.

**macOS / Linux**

```bash
source venv/bin/activate
```

**Windows (Command Prompt)**

```bat
venv\Scripts\activate.bat
```

**Windows (PowerShell)**

```powershell
.\venv\Scripts\Activate.ps1
```

Install the required dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Ensure that `serviceAccountKey.json` is present in the location expected by `app.py`.

### Step 4: Configure the Frontend API URL

Before running the frontend, verify the API base URL in the JavaScript files.

For local development, the backend will typically be available at:

```text
http://127.0.0.1:5000
```

Ensure that the frontend sends API requests to the correct backend address. If you deploy the frontend and backend separately, configure the frontend to use the deployed backend URL instead.

Do not use `127.0.0.1` as the API URL for a remotely hosted frontend: it refers to the visitor's own device, not your backend server.

### Step 5: Start the Backend Server

From the `backend/` directory, run:

```bash
python app.py
```

Keep this terminal open while using the application.

By default, the Flask development server is expected to run at:

```text
http://127.0.0.1:5000
```

The actual host and port depend on the configuration in `app.py`.

### Step 6: Launch the Frontend

Open a **second terminal window** and navigate to the project root.

Then run:

```bash
cd main
python3 -m http.server 5500
```

On Windows, if `python3` is not recognized, use:

```bat
python -m http.server 5500
```

Open the following address in your browser:

**http://127.0.0.1:5500/login.html**

You should now be able to access the Attend AI login page.

Keep both terminal windows running during local development.

## API Health Check

To verify that the backend is responding, open:

**http://127.0.0.1:5000/api/health**

A successful response should indicate that the API is running. The exact response depends on the implementation of the health endpoint.

If the endpoint does not respond, check the backend terminal for startup errors and confirm that the server is running on the expected port.

## Security Notes

- Never commit `serviceAccountKey.json` or other private credentials.
- Add sensitive files, virtual environments, uploaded images, and generated data to `.gitignore` where appropriate.
- Do not rely on unrestricted Firestore security rules in a production application.
- Restrict access to teacher-only operations on the backend, not just in the frontend.
- Configure CORS to allow only trusted frontend origins in production.
- Use HTTPS when deploying the application.
- Protect student photographs and facial-recognition data because they contain sensitive personal information.
- Set appropriate data-retention and access-control policies for attendance records.
- Do not deploy Flask's development server as a production server.

## Troubleshooting

### 1. Failed to Fetch

**Possible causes:**
- The Flask backend is not running.
- The frontend uses an incorrect API URL.
- CORS is misconfigured.
- The backend is hosted on a different address or port.

**What to check:**
1. Start the backend using `python app.py`.
2. Open the API health-check URL.
3. Verify the API base URL in the frontend JavaScript.
4. Check the browser console and backend terminal for errors.

### 2. Firebase Authentication or Database Errors

- Confirm that the service account JSON file exists.
- Verify that the file path matches the backend configuration.
- Check that Firestore is enabled in the correct Firebase project.
- Review Firebase IAM permissions and Firestore configuration.
- Never fix permission errors by making the database publicly accessible.

### 3. Python Dependency Installation Errors

- Confirm that the active Python version is compatible with the project.
- Activate the virtual environment before installing packages.
- Review the error message for missing system libraries or incompatible package versions.
- Follow the installation requirements for DeepFace, OpenCV, and RetinaFace.

### 4. Camera Access Problems

- Grant camera permission to your browser.
- Use `localhost` or HTTPS, since browsers generally require a secure context for camera access.
- Ensure that no other application is exclusively using the webcam.

### 5. Incorrect Face Recognition Results

- Use clear, well-lit reference photographs.
- Ensure that faces are visible in the recorded video.
- Review the configured face-matching threshold.
- Manually correct attendance records when recognition results are uncertain.

## Contributors

Thanks to everyone who contributed to the development of Attend AI.

- Anindita Pattanayak
- Ankit Tiwari
- Patel Hetanshi Mineshkumar
- Chauhan Vishwa Pradeepkumar
- Devansh Dubey
---

**Attend AI — Making classroom attendance smarter, faster, and easier.**
