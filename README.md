Step 2: Configure Firebase Database
Go to the Firebase Console and create a new project.

Navigate to Build → Firestore Database and click Create database.

Go to Project settings → Service accounts and click Generate new private key.

Rename the downloaded file to serviceAccountKey.json and place it inside the backend/ folder.

⚠️ Keep this file secure and private. Never commit it to GitHub.

Step 3: Start the Backend Server
Open a terminal in the project root folder:

Bash
cd backend
python3 -m venv venv

# Activate virtual environment
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies and start the server
pip install -r requirements.txt
python app.py
Verify the server is running by opening http://127.0.0.1:5000/api/health in your browser.

Step 4: Launch the Frontend
Open a second terminal window:

Bash
cd main
python3 -m http.server 5500
Open http://127.0.0.1:5500/login.html in your browser to access the application.

Contributors
Anindita Pattanayak

Ankit Tiwari

Patel Hetanshi Mineshkumar

Chauhan Vishwa Pradeepkumar

Devansh Dubey
