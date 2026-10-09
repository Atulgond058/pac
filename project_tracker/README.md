# Student Project & Assignment Submission Tracker
Frontend: HTML, CSS, JavaScript | Backend: Python (Flask REST API) | Database: SQLite

## Run
    pip install -r requirements.txt
    python app.py
Open http://127.0.0.1:5000   (projects.db is created automatically)

Teacher login: teacher / admin123

## API
| Method | URL                    | SQL         |
|--------|------------------------|-------------|
| POST   | /api/projects          | INSERT      |
| GET    | /api/projects?status=  | SELECT ... WHERE status |
| GET    | /api/status/<roll_no>  | SELECT ... WHERE roll_no |
| PATCH  | /api/projects/<id>     | UPDATE      |
| DELETE | /api/projects/<id>     | DELETE (only Rejected) |
| POST   | /api/login, /api/logout|             |
