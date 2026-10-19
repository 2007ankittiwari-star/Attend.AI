# Attend AI

Take attendance with a camera instead of calling out names.

**Attend AI** is a web application that automates classroom attendance. A teacher records a short video of the room, the backend processes the frames to recognise known faces, and an organised list of **Present** and **Absent** students appears instantly. If any adjustments are needed, teachers can manually update a student's status with a single click.

---

## What Can It Do?

* **Secure Authentication:** Register and log in securely as a teacher with hashed password storage.
* **Student Management:** Add students with their name, unique ID, and a clear reference photo.
* **Camera Attendance:** Select a subject, class group, and date, then record a short video clip directly from the browser.
* **Automated Recognition:** Instantly view **Present** and **Absent** breakdowns after video processing.
* **Manual Overrides:** Easily toggle a student's status using **Mark Present** or **Mark Absent** buttons.
* **History & Reports:** Browse past attendance records, view summary charts, and export data as a CSV spreadsheet.
* **Customisable Settings:** Adjust face-matching thresholds and switch between light and dark themes.

---

## How It Works

1. **Register Students:** Add student profiles along with a clear face image into the system.
2. **Record Video:** The teacher selects the class details and records a ~10-second video of the classroom.
3. **Server Processing:** The frontend sends the video to the Python backend server.
4. **Face Matching:** OpenCV and DeepFace extract frames, detect faces, and compare them against saved student reference images.
5. **Database Sync:** Attendance results are automatically saved to Google Firebase Firestore.

---

## Tech Stack

* **Frontend:** HTML, CSS, JavaScript, Chart.js
* **Backend:** Python, Flask
* **Face Recognition:** OpenCV, DeepFace (RetinaFace face detector)
* **Database:** Google Firebase Firestore

---

## Prerequisites

* **Python:** Version 3.9, 3.10, or 3.11
* **Database:** A Google account to configure a free Firebase project
* **Hardware:** A webcam and at least 8 GB of RAM
* **Browser:** Chrome, Edge, or Firefox

---

## Setup Guide

### Step 1: Clone the Repository
```bash
git clone [https://github.com/2007ankittiwari-star/Attend.AI.git](https://github.com/2007ankittiwari-star/Attend.AI.git)
cd Attend-AI
