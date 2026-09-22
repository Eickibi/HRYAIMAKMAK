import csv
import io
import json
import os
import random

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB upload limit

# Vercel's serverless filesystem is read-only except /tmp, and /tmp is
# wiped between cold starts. Locally we keep a real file under data/ so
# uploaded data survives while you develop.
if os.environ.get("VERCEL"):
    DATA_FILE = "/tmp/students.json"
else:
    DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "students.json")

# Maps the Thai/English column names we accept in the uploaded CSV to our
# internal field names, so the file's header row can be in either language.
FIELD_MAP = {
    "รหัสนักศึกษา": "id", "id": "id", "student_id": "id", "รหัส": "id",
    "ชื่อ": "name", "name": "name", "ชื่อ-นามสกุล": "name",
    "คณะ": "faculty", "faculty": "faculty",
    "สาขา": "major", "major": "major",
    "ชั้นปี": "year", "year": "year",
    "เกรดเฉลี่ย": "gpa", "gpa": "gpa", "เกรด": "gpa",
}


def load_students():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_students(students):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(students, f, ensure_ascii=False, indent=2)


def normalize_row(row):
    out = {"id": "", "name": "", "faculty": "", "major": "", "year": 0, "gpa": 0.0}
    for key, value in row.items():
        if key is None:
            continue
        mapped = FIELD_MAP.get(key.strip())
        if mapped:
            out[mapped] = value.strip() if isinstance(value, str) else value
    try:
        out["year"] = int(out["year"])
    except (ValueError, TypeError):
        out["year"] = 0
    try:
        out["gpa"] = round(float(out["gpa"]), 2)
    except (ValueError, TypeError):
        out["gpa"] = 0.0
    return out


@app.route("/")
def index():
    """Dashboard page."""
    students = load_students()
    faculties = sorted({s["faculty"] for s in students if s["faculty"]})
    years = sorted({s["year"] for s in students if s["year"]})
    return render_template("index.html", faculties=faculties, years=years, has_data=bool(students))


@app.route("/upload", methods=["POST"])
def upload():
    """Accepts a CSV file and stores its rows as the current dataset."""
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"ok": False, "message": "ไม่พบไฟล์ที่อัปโหลด"}), 400
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"ok": False, "message": "รองรับเฉพาะไฟล์ .csv เท่านั้น"}), 400

    raw = file.stream.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    rows = [normalize_row(row) for row in reader if row]
    rows = [r for r in rows if r["name"] or r["id"]]

    if not rows:
        return jsonify({"ok": False, "message": "อ่านไฟล์ไม่สำเร็จ หรือไม่มีข้อมูลในไฟล์"}), 400

    save_students(rows)
    return jsonify({"ok": True, "count": len(rows)})


@app.route("/api/students")
def api_students():
    """Filter endpoint — this is the 'Module' filter from the dashboard.

    Query params: faculty, year, q (search by name or id)
    """
    students = load_students()
    faculty = request.args.get("faculty", "").strip()
    year = request.args.get("year", "").strip()
    q = request.args.get("q", "").strip().lower()

    def matches(s):
        if faculty and s["faculty"] != faculty:
            return False
        if year and str(s["year"]) != year:
            return False
        if q and q not in s["name"].lower() and q not in s["id"].lower():
            return False
        return True

    filtered = [s for s in students if matches(s)]

    total = len(students)
    avg_gpa = round(sum(s["gpa"] for s in students) / total, 2) if total else 0

    faculty_counts = {}
    for s in students:
        faculty_counts[s["faculty"]] = faculty_counts.get(s["faculty"], 0) + 1

    gpa_by_year = {}
    for y in (1, 2, 3, 4):
        group = [s["gpa"] for s in students if s["year"] == y]
        gpa_by_year[y] = round(sum(group) / len(group), 2) if group else 0

    return jsonify({
        "students": filtered,
        "total": total,
        "avg_gpa": avg_gpa,
        "faculty_count": len(faculty_counts),
        "faculty_counts": faculty_counts,
        "gpa_by_year": gpa_by_year,
        "honors": sum(1 for s in students if s["gpa"] >= 3.5),
    })


@app.route("/api/sample", methods=["POST"])
def api_sample():
    """Generates sample data so the dashboard can be demoed without a file."""
    faculties = {
        "วิศวกรรมศาสตร์": ["วิศวกรรมคอมพิวเตอร์", "วิศวกรรมไฟฟ้า", "วิศวกรรมโยธา"],
        "วิทยาศาสตร์": ["วิทยาการคอมพิวเตอร์", "เคมี", "ชีววิทยา"],
        "บริหารธุรกิจ": ["การตลาด", "การเงิน", "การจัดการ"],
        "ศิลปศาสตร์": ["ภาษาอังกฤษ", "รัฐศาสตร์"],
    }
    first = ["สมชาย", "สุดา", "วิชัย", "นภา", "ธนกร", "อรวรรณ", "ปิยะ", "กมลวรรณ"]
    last = ["ใจดี", "ศรีสุข", "แสงทอง", "รักเรียน", "บุญมี", "ทองแท้"]

    rows = []
    for i in range(60):
        fac = random.choice(list(faculties.keys()))
        rows.append({
            "id": f"64{1000 + i}",
            "name": f"{random.choice(first)} {random.choice(last)}",
            "faculty": fac,
            "major": random.choice(faculties[fac]),
            "year": random.randint(1, 4),
            "gpa": round(random.uniform(1.8, 4.0), 2),
        })

    save_students(rows)
    return jsonify({"ok": True, "count": len(rows)})


if __name__ == "__main__":
    app.run(debug=True)
