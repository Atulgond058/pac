import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, session, g, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = "change-this-secret"
DB = "projects.db"
TEACHER = ("teacher", "admin123")  # demo credentials


# ---------- database ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db:
        db.close()


def init_db():
    db = sqlite3.connect(DB)
    db.execute("""CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_name TEXT NOT NULL,
        roll_no TEXT NOT NULL UNIQUE,
        project_title TEXT NOT NULL,
        tech_stack TEXT,
        status TEXT DEFAULT 'Pending'
            CHECK (status IN ('Pending','Approved','Rejected')))""")
    db.commit()
    db.close()


def teacher_only(f):
    @wraps(f)
    def wrap(*a, **k):
        if not session.get("teacher"):
            return jsonify(error="Teacher login required"), 401
        return f(*a, **k)
    return wrap


# ---------- pages ----------
@app.get("/")
def home(): 
    return send_from_directory(".", "index.html")


# ---------- auth ----------
@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    if (d.get("username"), d.get("password")) == TEACHER:
        session["teacher"] = True
        return jsonify(ok=True)
    return jsonify(error="Wrong username or password"), 401


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    return jsonify(teacher=bool(session.get("teacher")))


# ---------- projects (CRUD) ----------
@app.post("/api/projects")                      # CREATE
def create_project():
    d = request.get_json(silent=True) or {}
    name, roll, title = (d.get(k, "").strip() for k in ("student_name", "roll_no", "project_title"))
    if not (name and roll and title):
        return jsonify(error="Name, roll number and title are required"), 400
    try:
        db = get_db()
        db.execute("INSERT INTO projects (student_name, roll_no, project_title, tech_stack) VALUES (?,?,?,?)",
                   (name, roll.upper(), title, d.get("tech_stack", "").strip()))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify(error="This roll number has already submitted a project"), 409
    return jsonify(ok=True), 201


@app.get("/api/projects")                       # READ (filter)
@teacher_only
def list_projects():
    status = request.args.get("status", "Pending")
    db = get_db()
    if status == "All":
        rows = db.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
    else:
        rows = db.execute("SELECT * FROM projects WHERE status = ? ORDER BY id DESC", (status,)).fetchall()
    stats = {r["status"]: r["n"] for r in db.execute("SELECT status, COUNT(*) AS n FROM projects GROUP BY status")}
    return jsonify(projects=[dict(r) for r in rows], stats=stats)


@app.get("/api/status/<roll_no>")               # READ (student)
def project_status(roll_no):
    r = get_db().execute("SELECT student_name, roll_no, project_title, tech_stack, status "
                         "FROM projects WHERE roll_no = ?", (roll_no.strip().upper(),)).fetchone()
    return (jsonify(dict(r)) if r else (jsonify(error="No project found for this roll number"), 404))


@app.patch("/api/projects/<int:pid>")           # UPDATE
@teacher_only
def update_status(pid):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in ("Approved", "Rejected"):
        return jsonify(error="Status must be Approved or Rejected"), 400
    db = get_db()
    db.execute("UPDATE projects SET status = ? WHERE id = ?", (status, pid))
    db.commit()
    return jsonify(ok=True)


@app.delete("/api/projects/<int:pid>")          # DELETE
@teacher_only
def delete_project(pid):
    db = get_db()
    cur = db.execute("DELETE FROM projects WHERE id = ? AND status = 'Rejected'", (pid,))
    db.commit()
    if cur.rowcount == 0:
        return jsonify(error="Only rejected projects can be deleted"), 400
    return jsonify(ok=True)


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
