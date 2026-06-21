import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rk_titles.db")
ADMIN_USERNAME = "Mysterious_Past"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT    UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT  NOT NULL,
            is_admin    INTEGER DEFAULT 0,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS title_applications (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    NOT NULL COLLATE NOCASE,
            title_code   TEXT    NOT NULL,
            message      TEXT    DEFAULT '',
            status       TEXT    DEFAULT 'pending',
            games        INTEGER DEFAULT 0,
            peak_rating  INTEGER DEFAULT 0,
            submitted_at TEXT    DEFAULT (datetime('now')),
            reviewed_at  TEXT,
            reviewed_by  TEXT,
            review_note  TEXT
        )
    """)
    conn.commit()
    conn.close()


def create_user(username, password):
    conn = get_db()
    try:
        admin_flag = 1 if username.lower() == ADMIN_USERNAME.lower() else 0
        conn.execute(
            "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)",
            (username, generate_password_hash(password), admin_flag),
        )
        conn.commit()
        return {"success": True}
    except sqlite3.IntegrityError:
        return {"success": False, "error": "Username already registered"}
    finally:
        conn.close()


def get_user_by_username(username):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def verify_password(stored_hash, password):
    return check_password_hash(stored_hash, password)


def is_admin(username):
    if username is None:
        return False
    if username.lower() == ADMIN_USERNAME.lower():
        return True
    user = get_user_by_username(username)
    return bool(user and user.get("is_admin"))


def get_all_users():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_user_by_username(username):
    conn = get_db()
    conn.execute("DELETE FROM users WHERE username = ? COLLATE NOCASE", (username,))
    conn.commit()
    conn.close()


# ── Title applications ────────────────────────────────────────────────────────

def submit_application(username, title_code, message, games, peak_rating):
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM title_applications WHERE username = ? COLLATE NOCASE AND title_code = ? AND status = 'pending'",
            (username, title_code)
        ).fetchone()
        if existing:
            return {"success": False, "error": "You already have a pending application for this title"}
        conn.execute(
            "INSERT INTO title_applications (username, title_code, message, games, peak_rating) VALUES (?, ?, ?, ?, ?)",
            (username, title_code, message or "", games or 0, peak_rating or 0)
        )
        conn.commit()
        return {"success": True}
    finally:
        conn.close()


def get_all_applications():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM title_applications ORDER BY submitted_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_user_applications(username):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM title_applications WHERE username = ? COLLATE NOCASE ORDER BY submitted_at DESC",
        (username,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_application(app_id, status, reviewed_by, review_note=None):
    conn = get_db()
    conn.execute(
        """UPDATE title_applications
           SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
           WHERE id = ?""",
        (status, reviewed_by, review_note, app_id)
    )
    conn.commit()
    conn.close()
