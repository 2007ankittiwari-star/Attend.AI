import os
import uuid
import cv2
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

# Supported image and video formats
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'mp4', 'webm', 'avi', 'mov'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

#Firebase initialisation
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

#  REGISTER STUDENT ROUTE
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

    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
    image_filename = f"{roll_no}.{ext}"
    filepath = os.path.join(KNOWN_FACES_DIR, image_filename)
    file.save(filepath)

    # Delete DeepFace cache representation files to update recognition index
    for f in os.listdir(KNOWN_FACES_DIR):
        if f.endswith('.pkl'):
            try:
                os.remove(os.path.join(KNOWN_FACES_DIR, f))
            except Exception:
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

#  GET ALL REGISTERED STUDENTS ROUTE
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

#  LIVE AI VIDEO ATTENDANCE PROCESSOR ROUTE
@app.route('/api/process-attendance', methods=['POST'])
def process_attendance():
    if 'video' not in request.files:
        return jsonify({"error": "No video clip uploaded"}), 400

    file = request.files['video']

    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Invalid video file format"}), 400

    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'webm'
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_str = uuid.uuid4().hex[:6]
    video_filename = f"vid_{timestamp}_{random_str}.{ext}"
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], video_filename)
    file.save(video_path)

    present_roll_nos = set()
    total_detected_faces = 0

    print(f"🎬 Processing video clip: {video_filename}...")

    # Open video file and process sampled frames
    cap = cv2.VideoCapture(video_path)
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Process 1 frame every 15 frames (~2 frames per second for 30fps video)
        if frame_count % 15 == 0:
            temp_frame_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{frame_count}.jpg")
            cv2.imwrite(temp_frame_path, frame)

            try:
                dfs = DeepFace.find(
                    img_path=temp_frame_path,
                    db_path=KNOWN_FACES_DIR,
                    detector_backend='mtcnn',
                    enforce_detection=False,
                    silent=True
                )

                for df in dfs:
                    if not df.empty:
                        total_detected_faces += len(df)
                        matched_image_path = df.iloc[0]['identity']
                        roll_no = os.path.splitext(os.path.basename(matched_image_path))[0]
                        present_roll_nos.add(roll_no)

            except Exception as e:
                print(f"⚠️ Frame processing warning: {e}")
            finally:
                if os.path.exists(temp_frame_path):
                    os.remove(temp_frame_path)

        frame_count += 1

    cap.release()

    # Clean up video file after processing
    if os.path.exists(video_path):
        os.remove(video_path)

    # Fetch registered roster and compile statuses
    attendance_results = []
    if db:
        try:
            student_docs = db.collection('students').stream()
            for doc in student_docs:
                s_data = doc.to_dict()
                r_no = s_data.get('roll_no')
                attendance_results.append({
                    "roll_no": r_no,
                    "name": s_data.get('name', 'Unknown'),
                    "department": s_data.get('department', 'CSE Core'),
                    "status": "Present" if r_no in present_roll_nos else "Absent"
                })
        except Exception as e:
            print(f"⚠️ Firestore roster fetch error: {e}")

    # Save attendance session log
    if db:
        try:
            db.collection('attendance_logs').document().set({
                'timestamp': firestore.SERVER_TIMESTAMP,
                'video_clip': video_filename,
                'detected_faces_count': total_detected_faces,
                'results': attendance_results
            })
            print(f"✅ AI Video Attendance logged! Present students: {len(present_roll_nos)}")
        except Exception as e:
            print(f"⚠️ Firebase logging error: {e}")

    return jsonify({
        "message": "AI video attendance processing completed",
        "detected_faces": total_detected_faces,
        "results": attendance_results
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
