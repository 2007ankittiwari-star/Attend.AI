import os
import re
import uuid
import cv2
import numpy as np
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from deepface import DeepFace
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
KNOWN_FACES_FOLDER = os.path.join(BASE_DIR, "known_faces")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(KNOWN_FACES_FOLDER, exist_ok=True)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
VIDEO_EXTENSIONS = {"mp4", "webm", "avi", "mov", "mkv"}

db = None
firebase_error = None

try:
    cred_path = os.path.join(BASE_DIR, "serviceAccountKey.json")
    if not os.path.exists(cred_path):
        raise FileNotFoundError(
            "serviceAccountKey.json is missing. Put your Firebase service-account JSON in backend/serviceAccountKey.json."
        )

    cred = credentials.Certificate(cred_path)
    project_id = cred.project_id
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("Connected to Firebase Firestore.")
    print(f"Firebase project: {project_id}")
except Exception as e:
    firebase_error = str(e)
    print(f"Firebase initialization failed: {e}")


def require_firebase():
    if not db:
        raise RuntimeError(
            "Firebase is not ready. Check serviceAccountKey.json. "
            f"Details: {firebase_error or 'unknown initialization error'}"
        )


def invalidate_face_cache():
    """DeepFace caches face embeddings as a .pkl file inside the known_faces
    folder for speed. Delete it whenever the folder's contents change
    (student added/removed) so the next match rebuilds fresh embeddings
    instead of using stale ones."""
    for name in os.listdir(KNOWN_FACES_FOLDER):
        if name.endswith(".pkl"):
            try:
                os.remove(os.path.join(KNOWN_FACES_FOLDER, name))
            except OSError:
                pass


def allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in IMAGE_EXTENSIONS


def allowed_video(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in VIDEO_EXTENSIONS


def safe_roll(roll_no):
    return re.sub(r"[^A-Za-z0-9_-]", "_", roll_no.strip())

def get_students():
    require_firebase()
    docs = db.collection("students").stream()
    students = []
    for doc in docs:
        item = doc.to_dict()
        item["roll_no"] = item.get("roll_no", doc.id)
        students.append(item)
    students.sort(key=lambda x: str(x.get("roll_no", "")))
    return students


@app.route("/api/health", methods=["GET"])
def health():
        return jsonify({
        "ok": bool(db),
        "firebase": bool(db),
        "error": firebase_error
    }), 200 if db else 503


# ---------------- PROFESSOR AUTH ONLY ----------------

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    try:
        require_firebase()
        data = request.get_json(silent=True) or {}
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        employee_id = str(data.get("employeeId", "")).strip()
        department = str(data.get("department", "")).strip()

        if not name or not email or not password or not employee_id:
            return jsonify({"error": "Name, employee ID, email and password are required."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must contain at least 6 characters."}), 400

        ref = db.collection("users").document(email)
        if ref.get().exists:
            return jsonify({"error": "An account with this email already exists."}), 409

        # Only professor accounts can be created from the public registration page.
        user = {
            "name": name,
            "email": email,
            "employeeId": employee_id,
            "department": department,
            "role": "professor",
            "password_hash": generate_password_hash(password, method="pbkdf2:sha256"),
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        ref.set(user)

        return jsonify({
            "message": "Professor account created successfully.",
            "user": {
                "name": name,
                "email": email,
                "employeeId": employee_id,
                "department": department,
                "role": "professor"
            }
        }), 201

    except Exception as e:
        print(f"Auth registration error: {repr(e)}")
        return jsonify({"error": f"Could not create account: {str(e)}"}), 500


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    try:
        require_firebase()
        data = request.get_json(silent=True) or {}
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        doc = db.collection("users").document(email).get()
        if not doc.exists:
            return jsonify({"error": "Invalid email or password."}), 401

        user = doc.to_dict()
        if user.get("role") != "professor":
            return jsonify({"error": "Only professor accounts can access this system."}), 403
        if not check_password_hash(user.get("password_hash", ""), password):
            return jsonify({"error": "Invalid email or password."}), 401

        return jsonify({
            "message": "Login successful.",
            "user": {
                "name": user.get("name", ""),
                "email": user.get("email", email),
                "employeeId": user.get("employeeId", ""),
                "department": user.get("department", ""),
                "role": "professor"
            }
        }), 200

    except Exception as e:
        print(f"Auth login error: {repr(e)}")
        return jsonify({"error": f"Could not log in: {str(e)}"}), 500


# ---------------- STUDENT ENROLLMENT ----------------

@app.route("/api/students", methods=["POST"])
def register_student():
    try:
        require_firebase()

        roll_no = str(request.form.get("roll_no", "")).strip()
        name = str(request.form.get("name", "")).strip()
        email = str(request.form.get("email", "")).strip().lower()
        department = str(request.form.get("department", "CSE Core")).strip()
        section = str(request.form.get("section", "A11+A12+A13")).strip()

        if not roll_no or not name:
            return jsonify({"error": "Registration number and name are required."}), 400
        if "image" not in request.files:
            return jsonify({"error": "A reference face image is required."}), 400

        file = request.files["image"]
        if not file.filename or not allowed_image(file.filename):
            return jsonify({"error": "Please upload JPG, JPEG, PNG or WEBP image."}), 400

        # Validate the image before touching Firebase.
        
               # Validate the image before touching Firebase.
                # Validate the image before touching Firebase.
        raw = file.read()
        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            return jsonify({"error": "The uploaded file is not a valid image."}), 400
        if len(raw) > 10 * 1024 * 1024:
            return jsonify({"error": "Face image must be 10 MB or smaller."}), 400

        try:
            faces = DeepFace.extract_faces(img_path=image, detector_backend="mtcnn", enforce_detection=True)
        except Exception:
            faces = []
        if not faces:
            return jsonify({"error": "No face was detected in this photo. Please upload a clear, front-facing photo."}), 400

        existing = db.collection("students").document(roll_no).get()
        if existing.exists:
            return jsonify({"error": f"Student {roll_no} already exists."}), 409

        ext = file.filename.rsplit(".", 1)[1].lower()
        stem = safe_roll(roll_no)
        face_filename = f"{stem}.{ext}"

        # Remove any leftover file for this roll number under a different extension.
        for existing_name in os.listdir(KNOWN_FACES_FOLDER):
            if os.path.splitext(existing_name)[0] == stem:
                try:
                    os.remove(os.path.join(KNOWN_FACES_FOLDER, existing_name))
                except OSError:
                    pass

        local_path = os.path.join(KNOWN_FACES_FOLDER, face_filename)
        with open(local_path, "wb") as f:
            f.write(raw)

        student_data = {
            "roll_no": roll_no,
            "name": name,
            "email": email,
            "department": department,
            "section": section,
            "face_filename": face_filename,
            "face_registered": True,
            "createdAt": firestore.SERVER_TIMESTAMP
        }

        try:
            db.collection("students").document(roll_no).set(student_data)
        except Exception:
            # Avoid orphaned face files if the Firestore write fails.
            if os.path.exists(local_path):
                os.remove(local_path)
            raise

        invalidate_face_cache()

        return jsonify({
            "message": f"Student {name} enrolled successfully.",
            "student": {**student_data, "face_registered": True}
        }), 201

    except Exception as e:
        print(f"Student enrollment error: {repr(e)}")
        return jsonify({"error": f"Could not enroll student: {str(e)}"}), 500


@app.route("/api/students", methods=["GET"])
def students():
    try:
        return jsonify(get_students()), 200
    except Exception as e:
        print(f"Student fetch error: {repr(e)}")
        return jsonify({"error": f"Could not load students: {str(e)}"}), 500


@app.route("/api/student-image/<roll_no>", methods=["GET"])
def student_image(roll_no):
    """Streams the locally stored reference face image."""
    try:
        require_firebase()
        doc = db.collection("students").document(roll_no).get()
        if not doc.exists:
            return jsonify({"error": "Student not found."}), 404

        filename = doc.to_dict().get("face_filename")
        if not filename:
            return jsonify({"error": "No face image registered."}), 404

        local_path = os.path.join(KNOWN_FACES_FOLDER, filename)
        if not os.path.exists(local_path):
            return jsonify({"error": "Face image not found in the known_faces folder."}), 404

        return send_file(local_path, max_age=300)

    except Exception as e:
        print(f"Student image error: {repr(e)}")
        return jsonify({"error": f"Could not load student image: {str(e)}"}), 500

@app.route("/api/students/<roll_no>", methods=["DELETE"])
def delete_student(roll_no):
    try:
        require_firebase()
        ref = db.collection("students").document(roll_no)
        doc = ref.get()
        if not doc.exists:
            return jsonify({"error": "Student not found."}), 404

        data = doc.to_dict()
        face_filename = data.get("face_filename")

        if face_filename:
            local_path = os.path.join(KNOWN_FACES_FOLDER, face_filename)
            if os.path.exists(local_path):
                os.remove(local_path)

        ref.delete()
        invalidate_face_cache()

        return jsonify({"message": "Student and face image deleted successfully."}), 200

    except Exception as e:
        print(f"Delete student error: {repr(e)}")
        return jsonify({"error": f"Failed to delete student: {str(e)}"}), 500


# ---------------- DASHBOARD / HISTORY / SETTINGS ----------------

@app.route("/api/dashboard", methods=["GET"])
def dashboard_stats():
    try:
        require_firebase()
        students_count = len(get_students())
        logs = list(
            db.collection("attendance_logs")
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(1).stream()
        )
        latest = logs[0].to_dict() if logs else {}
        results = latest.get("results", [])
        present = sum(1 for s in results if s.get("status") == "Present")
        total = len(results)
        percentage = round(present / total * 100) if total else 0

        return jsonify({
            "total_students": students_count,
            "attendance": percentage,
            "faces_registered": students_count,
            "latest_session": latest
        }), 200
    except Exception as e:
        print(f"Dashboard error: {repr(e)}")
        return jsonify({"error": f"Could not load dashboard: {str(e)}"}), 500


@app.route("/api/attendance-history", methods=["GET"])
def attendance_history():
    try:
        require_firebase()
        records = []
        docs = db.collection("attendance_logs").order_by(
            "created_at", direction=firestore.Query.DESCENDING
        ).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            ts = data.get("created_at")
            if hasattr(ts, "isoformat"):
                data["created_at"] = ts.isoformat()
            records.append(data)
        return jsonify(records), 200
    except Exception as e:
        print(f"History error: {repr(e)}")
        return jsonify({"error": f"Could not load attendance history: {str(e)}"}), 500


@app.route("/api/settings/<path:email>", methods=["GET"])
def get_settings(email):
    try:
        require_firebase()
        doc = db.collection("settings").document(email.lower()).get()
        if doc.exists:
            return jsonify(doc.to_dict()), 200
        return jsonify({
            "threshold": 85, "darkMode": True, "emailNotifications": True,
            "autoAttendanceSave": True, "unknownFaceAlert": False
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not load settings: {str(e)}"}), 500


@app.route("/api/settings/<path:email>", methods=["PUT"])
def save_settings(email):
    try:
        require_firebase()
        data = request.get_json(silent=True) or {}
        data["email"] = email.lower()
        data["updatedAt"] = firestore.SERVER_TIMESTAMP
        db.collection("settings").document(email.lower()).set(data, merge=True)
        return jsonify({"message": "Settings saved."}), 200
    except Exception as e:
        return jsonify({"error": f"Could not save settings: {str(e)}"}), 500


# ---------------- AI ATTENDANCE ----------------

@app.route("/api/process-attendance", methods=["POST"])
def process_attendance():
    try:
        require_firebase()

        if "video" not in request.files:
            return jsonify({"error": "No video clip uploaded."}), 400

        file = request.files["video"]
        if not file.filename or not allowed_video(file.filename):
            return jsonify({"error": "Invalid video format. Use MP4, WEBM, AVI, MOV or MKV."}), 400

        subject = request.form.get("subject", "Unknown Subject")
        attendance_date = request.form.get("date", "") or datetime.now().strftime("%Y-%m-%d")
        attendance_time = request.form.get("time", "") or datetime.now().strftime("%H:%M")
        section = request.form.get("section", "All")
        faculty = request.form.get("faculty", "Professor")
        user_email = request.form.get("user_email", "")

        # Load the professor's saved recognition threshold (defaults to 85%).
        saved_threshold = 85
        if user_email:
            settings_doc = db.collection("settings").document(user_email.lower()).get()
            if settings_doc.exists:
                saved_threshold = settings_doc.to_dict().get("threshold", 85)
        distance_threshold = 0.4+(100 - saved_threshold) / 100 * 0.6

        # Build the roster BEFORE processing so we can map the sanitized filenames
        # used in Firebase Storage / the local cache back to the real roll_no in
        # Firestore. Without this, any roll number containing a space, dot or
        # slash would never match during recognition and would always show as
        # "Absent" even when the face was correctly recognized.
        roster_all = get_students()
        roster = roster_all if not section or section == "All" else [s for s in roster_all if s.get("section") == section]
        safe_roll_map = {safe_roll(s.get("roll_no", "")): s.get("roll_no") for s in roster_all if s.get("roll_no")}

        known_images = [f for f in os.listdir(KNOWN_FACES_FOLDER) if allowed_image(f)]
        if not known_images:
            return jsonify({"error": "No reference face images found in the known_faces folder."}), 400

        ext = file.filename.rsplit(".", 1)[1].lower()
        video_path = os.path.join(UPLOAD_FOLDER, f"attendance_{uuid.uuid4().hex}.{ext}")
        file.save(video_path)

        present_roll_nos = set()
        unknown_detections = 0
        processed_frames = 0
        frame_errors = 0
        matched_confidences = []
        started = datetime.now()

        cap = cv2.VideoCapture(video_path)
        frame_index = 0

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # Sample roughly 2 frames/second for a manageable prototype.
                if frame_index % 15 == 0:
                    processed_frames += 1
                    frame_path = os.path.join(UPLOAD_FOLDER, f"frame_{uuid.uuid4().hex}.jpg")
                    cv2.imwrite(frame_path, frame)

                    try:
                        dfs = DeepFace.find(
                            img_path=frame_path,
                            db_path=KNOWN_FACES_FOLDER,
                            detector_backend="mtcnn",
                            enforce_detection=False,
                            silent=True
                        )

                        matched_in_frame = set()
                        any_face = False
                        frame_had_unknown = False

                        for df in dfs if isinstance(dfs, list) else [dfs]:
                            if df is None or getattr(df, "empty", True):
                                continue
                            any_face = True
                            row = df.iloc[0]
                            distance = float(row.get("distance", 1.0))
                            identity = str(row.get("identity", ""))
                            filename = os.path.basename(identity)
                            sanitized_roll = os.path.splitext(filename)[0]
                            # Translate the sanitized filename stem back to the real roll_no.
                            roll = safe_roll_map.get(sanitized_roll, sanitized_roll)

                            if sanitized_roll and distance <= distance_threshold:
                                matched_in_frame.add(roll)
                                matched_confidences.append(1 - distance)
                            else:
                                frame_had_unknown = True

                        present_roll_nos.update(matched_in_frame)

                        if any_face and frame_had_unknown:
                            unknown_detections += 1
                    except Exception as frame_error:
                        frame_errors += 1
                        print(f"Frame processing warning: {repr(frame_error)}")
                    finally:
                        if os.path.exists(frame_path):
                            os.remove(frame_path)

                frame_index += 1
        finally:
            cap.release()
            if os.path.exists(video_path):
                os.remove(video_path)

        recognition_warning = None
        if processed_frames > 0 and frame_errors == processed_frames:
            recognition_warning = ("Face recognition failed on every frame of this clip. Results below may be "
                                    "inaccurate — check that the backend's face-detection model is installed correctly.")

        attendance_results = []
        for s in roster:
            roll = s.get("roll_no")
            attendance_results.append({
                "roll_no": roll,
                "name": s.get("name", "Unknown"),
                "email": s.get("email", ""),
                "department": s.get("department", ""),
                "section": s.get("section", ""),
                "status": "Present" if roll in present_roll_nos else "Absent"
            })

        processing_time = round((datetime.now() - started).total_seconds(), 2)
        present_count = sum(x["status"] == "Present" for x in attendance_results)
        total = len(attendance_results)
        attendance_percentage = round(present_count / total * 100) if total else 0
        accuracy = round(sum(matched_confidences) / len(matched_confidences) * 100, 1) if matched_confidences else None

        log = {
            "created_at": firestore.SERVER_TIMESTAMP,
            "timestamp": datetime.now().isoformat(),
            "subject": subject,
            "date": attendance_date,
            "time": attendance_time,
            "section": section,
            "faculty": faculty,
            "user_email": user_email,
            "detected_students": sorted(list(present_roll_nos)),
            "detected_faces": len(present_roll_nos),
            "unknown_faces": unknown_detections,
            "accuracy": accuracy,
            "processing_time": processing_time,
            "results": attendance_results,
            "attendance_percentage": attendance_percentage,
            "processed_frames": processed_frames,
            "recognition_warning": recognition_warning
        }

        ref = db.collection("attendance_logs").document()
        ref.set(log)

        return jsonify({
            "message": "AI attendance processed and saved to Firebase.",
            "detected_faces": len(present_roll_nos),
            "unknown_faces": unknown_detections,
            "accuracy": accuracy,
            "processing_time": processing_time,
            "subject": subject,
            "date": attendance_date,
            "time": attendance_time,
            "section": section,
            "faculty": faculty,
            "results": attendance_results,
            "attendance_percentage": attendance_percentage,
            "id": ref.id,
            "recognition_warning": recognition_warning
        }), 200

    except Exception as e:
        print(f"Attendance processing error: {repr(e)}")
        return jsonify({"error": f"Could not process attendance: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=True)
