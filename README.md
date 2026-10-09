# Attend AI

**Take attendance with a camera instead of calling out names.**

Attend AI is a web app that marks attendance automatically. A teacher films the class for a few seconds,
the app recognises the faces it already knows, and a list of **Present** and **Absent** students appears on the screen.
If the app makes a mistake, the teacher can fix it with one click.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.9%20to%203.11-3776AB?logo=python&logoColor=white)

---

## Screenshots

> Add your own pictures to the `docs/screenshots/` folder and keep the file names below.

| Take Attendance | Results |
|---|---|
| ![Take Attendance](docs/screenshots/take-attendance.png) | ![Results](docs/screenshots/results.png) |

| Students | Reports |
|---|---|
| ![Students](docs/screenshots/students.png) | ![Reports](docs/screenshots/reports.png) |

---

## What can it do?

- **Sign up and log in** as a teacher. Passwords are stored in a scrambled (hashed) form, never as plain text.
- **Add students** with their name, ID and one clear photo of their face.
- **Take attendance with the camera.** Choose the subject, class group and date, then record a short video.
- **See who is present and who is absent** right after the video is processed.
- **Fix mistakes by hand.** Click **Mark Absent** or **Mark Present** next to any student, and the change is saved.
- **Look back later.** Browse past attendance, see charts and download the data as a spreadsheet (CSV file).
- **Change settings**, such as how strict the face matching is, and switch between dark and light mode.

---

## How does it work? (in simple words)

1. You add each student once, with a photo of their face.
2. When you take attendance, your browser records a short video of the room (about 10 seconds).
3. The video is sent to the app's server, which picks out some pictures (frames) from it.
4. The server finds the faces in those pictures and compares each one with the student photos you saved.
5. Everyone it recognises is marked **Present**. Everyone else in that class group is marked **Absent**.
6. The result is saved online in a database (Google Firebase) so you can see it again later.

```text
Your browser  →  Server (Python)  →  Face matching  →  Saved in Firebase
   (video)         (Flask)          (OpenCV + DeepFace)     (database)
```

You don't need to train any AI. It uses ready-made face recognition tools.

---

## What you need before starting

| You need | Why |
|---|---|
| A computer with **Python 3.9, 3.10 or 3.11** | The app's server is written in Python. [Download Python](https://www.python.org/downloads/) |
| A **Google account** | To create a free Firebase database |
| A **webcam** and a browser (Chrome, Edge or Firefox) | To film the class |
| About **8 GB of memory (RAM)** | Face recognition works best with it |
| An internet connection | The first run downloads the face recognition models |

---

## Setup guide

### Step 1: Download the project

```bash
git clone https://github.com/<your-username>/Attend-AI.git
cd Attend-AI
```

### Step 2: Create your free Firebase database

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. In the menu, open **Build → Firestore Database** and click **Create database**.
3. Open **Project settings → Service accounts** and click **Generate new private key**.
4. A file will download. Rename it to **`serviceAccountKey.json`** and put it inside the **`backend`** folder.

> ⚠️ **Keep that file private.** Anyone who has it can read and change your database.
> Never upload it to GitHub or share it. This project's `.gitignore` is set up to keep it out.

### Step 3: Start the server (backend)

Open a terminal in the project folder and run:

```bash
cd backend
python3 -m venv venv
```

Then switch the virtual environment on:

- **Mac / Linux:** `source venv/bin/activate`
- **Windows:** `venv\Scripts\activate`

Then install what the app needs and start it:

```bash
pip install -r requirements.txt
python app.py
```

Leave this window open. To check that it works, open
[http://127.0.0.1:5000/api/health](http://127.0.0.1:5000/api/health) in your browser. It should say Firebase is connected.

### Step 4: Start the website (frontend)

Open a **second** terminal window and run:

```bash
cd main
python3 -m http.server 5500
```

Now open **[http://127.0.0.1:5500/login.html](http://127.0.0.1:5500/login.html)** in your browser. You're in!

> **Using the VS Code "Live Server" extension?** It refreshes the page whenever a file changes, and the server saves
> small files while it works, so your results can suddenly disappear. The `python3 -m http.server` command above avoids this.

---

## How to use it

1. **Create a teacher account** on the register page, then log in.
2. Go to **Students** and add each student: ID, name, class group and a clear photo of their face.
3. Go to **Take Attendance**. Pick the subject, class group and date, then click **Start Camera**.
4. Click **Start Attendance**. The app records a short video, shows *Processing attendance…*, and then the **Present** and **Absent** lists.
5. Check the list. If someone is wrong, click **Mark Absent** or **Mark Present** next to their name. The new status is saved to the database straight away.
6. Use **History** and **Reports** later to see past attendance, charts and downloads.

### Tips for good results

- Use a **clear, front-facing photo** of each student: good light, one face, no sunglasses.
- Film in **good lighting**, with faces visible and not too far from the camera.
- The **class group** you pick when taking attendance must match the group you gave the students when you added them.
- If it gets someone wrong, just click the **Mark Absent / Mark Present** button next to their name.

---

## Common problems

| What you see | What to try |
|---|---|
| "Firebase initialization failed" | The file `backend/serviceAccountKey.json` is missing or wrong. Do Step 2 again. |
| Everyone is marked Absent | No students have the same class group as the one you picked, or the faces weren't clear. Check the student photos and look at the messages in the server window. |
| The page refreshes by itself after attendance | Use `python3 -m http.server 5500` instead of Live Server (see Step 4). |
| The first attendance takes a very long time | Normal. The app is downloading its face models. Later runs are faster. |
| Network error in the browser | The server (Step 3) isn't running, or the address in `main/js/config.js` is wrong. |
| The camera won't start | Allow camera access when the browser asks. |
| "Port 5000 is already in use" (common on Macs, where AirPlay uses it) | Start the server on another port: `PORT=5001 python app.py`, then change the address in `main/js/config.js` to `http://127.0.0.1:5001/api`. |

---

## Good to know

- **It isn't perfect.** Dark rooms, small faces, people looking away or hidden faces can be missed. That's why manual fixing is built in.
- **It can be fooled by a photo.** Someone holding up a picture of another person might be recognised. There's no "live person" check yet.
- **It's a development version.** It's meant for trying out and learning. Before putting it on the public internet, add stronger login security and turn off debug mode.
- **Student photos are personal data.** They're stored in `backend/known_faces/` on your computer. Keep that folder private and out of GitHub.

---

## Technology used

| Part | Tools |
|---|---|
| Website | HTML, CSS, JavaScript, Chart.js |
| Server | Python, Flask |
| Face recognition | OpenCV, DeepFace (with the RetinaFace face finder) |
| Database | Google Firebase Firestore |

The full list of Python packages is in [`backend/requirements.txt`](backend/requirements.txt).

### Project folders

```text
Attend-AI/   (the folder you cloned; it is called Attend-AI-Fixed in the zip)
├── backend/          The server: app.py, requirements.txt, your serviceAccountKey.json
│                     (folders known_faces/, uploads/ and cache/ are created automatically)
├── main/             The website: pages (.html), styles (css/) and scripts (js/)
├── docs/screenshots/ Pictures for this README
└── README.md
```

---

## Ideas for the future

- Compare other face finders (such as MTCNN) for better accuracy
- Check that a real person is in front of the camera (not a photo)
- Stronger login security
- Email or text alerts for absent students
- Support for several cameras and rooms
- A page where students can see their own attendance

---

## Versions

This project uses version numbers like `1.0.0` ([Semantic Versioning](https://semver.org/)):
the first number changes for big updates, the second for new features, the third for small fixes.

| Version | What's included |
|---|---|
| **1.0.0** | Login, adding students, camera attendance, present/absent lists, manual fixing, history, reports and settings |

To mark a release on GitHub:

```bash
git tag -a v1.0.0 -m "Attend AI v1.0.0"
git push origin v1.0.0
```

---

## Made by

Anindita Patanayak, Ankit Tiwari, Patel Hetanshi Mineshkumar, Chauhan Vishwa Pradeepkumar and Devansh Dubey.

## Thanks to

[DeepFace](https://github.com/serengil/deepface), [OpenCV](https://opencv.org/),
[Flask](https://flask.palletsprojects.com/) and [Firebase](https://firebase.google.com/).

## License

Add a license file (for example [MIT](https://choosealicense.com/licenses/mit/)) and mention it here.
