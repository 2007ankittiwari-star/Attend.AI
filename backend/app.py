import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from deepface import DeepFace

app = Flask(__name__)
CORS(app)

# Workspace Directories
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
KNOWN_FACES_DIR = os.path.join(UPLOAD_FOLDER, 'known_faces')
os.makedirs(KNOWN_FACES_DIR, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------------------------------
# 🔥 FIREBASE INITIALIZATION
# ---------------------------------------------------------
db = None
try:
    cred_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Connected to Firebase Cloud Firestore successfully!")
    else:
        print("⚠️ serviceAccountKey.json not found. Running without Firebase.")
except Exception as e:
    print(f"⚠️ Firebase initialization failed: {e}")

# ---------------------------------------------------------
# 👤 REGISTER STUDENT ROUTE
# ---------------------------------------------------------
@app.route('/api/register-student', methods=['POST'])
def register_student():
    roll_no = request.form.get('roll_no')
    name = request.form.get('name')
    email = request.form.get('email')
    department = request.form.get('department', 'CSE Core')
    section = request.form.get('section', 'A11+A12+A13')

    if not roll_no or not name:
        return jsonify({"error": "Roll number and Name are required"}), 400

    if 'image' not in request.files:
        return jsonify({"error": "Student reference face image is required"}), 400

    file = request.files['image']

    if file.filename == '':
        return jsonify({"error": "No image selected"}), 400

    # Save reference photo
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
    image_filename = f"{roll_no}.{ext}"
    filepath = os.path.join(KNOWN_FACES_DIR, image_filename)
    file.save(filepath)

    # 🧹 IMPORTANT: Delete DeepFace cache so it recognizes the new student instantly!
    for f in os.listdir(KNOWN_FACES_DIR):
        if f.endswith('.pkl'):
            try:
                os.remove(os.path.join(KNOWN_FACES_DIR, f))
            except:
                pass

    student_data = {
        'roll_no': roll_no,
        'name': name,
        'email': email,
        'department': department,
        'section': section,
        'image_file': image_filename
    }

    if db:
        try:
            db.collection('students').document(roll_no).set(student_data)
            print(f"✅ Registered Student {name} ({roll_no}) in Firebase!")
        except Exception as e:
            print(f"⚠️ Firebase student save error: {e}")

    return jsonify({
        "message": f"Student {name} registered successfully!",
        "student": student_data
    }), 201

# ---------------------------------------------------------
# 📋 GET ALL REGISTERED STUDENTS ROUTE
# ---------------------------------------------------------
@app.route('/api/students', methods=['GET'])
def get_students():
    students_list = []
    if db:
        try:
            docs = db.collection('students').stream()
            for doc in docs:
                students_list.append(doc.to_dict())
            return jsonify(students_list), 200
        except Exception as e:
            print(f"⚠️ Failed to fetch students from Firebase: {e}")
            return jsonify([]), 500
    return jsonify([]), 200

# ---------------------------------------------------------
# 📸 LIVE AI ATTENDANCE PROCESSOR ROUTE
# ---------------------------------------------------------
@app.route('/api/process-attendance', methods=['POST'])
def process_attendance():
    if 'video' not in request.files:
        return jsonify({"error": "No camera frame uploaded"}), 400

    file = request.files['video']

    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Invalid frame image format"}), 400

    # Save incoming frame snapshot locally
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_str = uuid.uuid4().hex[:6]
    unique_filename = f"capture_{timestamp}_{random_str}.jpg"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(filepath)

    present_roll_nos = set()
    detected_faces_count = 0

    print(f"🧠 DeepFace analyzing frame: {unique_filename}...")

    try:
        # 1. Search the captured image against the known faces database
        dfs = DeepFace.find(
            img_path=filepath, 
            db_path=KNOWN_FACES_DIR,
            detector_backend='ssd', 
            enforce_detection=False, # Don't crash if no face is found
            silent=True
        )
        
        detected_faces_count = len(dfs)

        # 2. Extract matched roll numbers
        for df in dfs:
            if not df.empty:
                # Get the file path of the closest matched known face
                matched_image_path = df.iloc[0]['identity']
                # Extract filename without extension (e.g., "25BCE10001" from "25BCE10001.jpg")
                filename = os.path.basename(matched_image_path)
                roll_no = os.path.splitext(filename)[0]
                present_roll_nos.add(roll_no)
                
    except Exception as e:
        print(f"⚠️ DeepFace processing error: {e}")

    # 3. Fetch registered students from Firestore to generate full attendance list
    attendance_results = []
    if db:
        try:
            student_docs = db.collection('students').stream()
            for doc in student_docs:
                s_data = doc.to_dict()
                r_no = s_data.get('roll_no')
                
                status = "Present" if r_no in present_roll_nos else "Absent"
                
                attendance_results.append({
                    "roll_no": r_no,
                    "name": s_data.get('name', 'Unknown'),
                    "department": s_data.get('department', 'CSE Core'),
                    "status": status
                })
        except Exception as e:
            print(f"⚠️ Error fetching student roster for evaluation: {e}")

    # 4. Log Attendance Session to Firebase Firestore
    if db:
        try:
            doc_ref = db.collection('attendance_logs').document()
            doc_ref.set({
                'timestamp': firestore.SERVER_TIMESTAMP,
                'captured_image': unique_filename,
                'detected_faces_count': detected_faces_count,
                'results': attendance_results
            })
            print(f"✅ AI Attendance logged to Firebase! Detected faces: {detected_faces_count}")
        except Exception as e:
            print(f"⚠️ Firebase logging error: {e}")

    return jsonify({
        "message": "AI face evaluation completed",
        "detected_faces": detected_faces_count,
        "results": attendance_results
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)