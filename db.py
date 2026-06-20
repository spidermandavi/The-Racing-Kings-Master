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
