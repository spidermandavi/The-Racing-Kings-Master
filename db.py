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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user   TEXT    NOT NULL COLLATE NOCASE,
            to_user     TEXT    NOT NULL COLLATE NOCASE,
            body        TEXT    NOT NULL,
            sent_at     TEXT    DEFAULT (datetime('now')),
            read_by_recipient INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS username_change_requests (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    NOT NULL COLLATE NOCASE,
            new_username TEXT    NOT NULL,
            status       TEXT    DEFAULT 'pending',
            requested_at TEXT    DEFAULT (datetime('now')),
            reviewed_at  TEXT,
            reviewed_by  TEXT,
            review_note  TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT    NOT NULL COLLATE NOCASE,
            type        TEXT    NOT NULL,
            body        TEXT    NOT NULL,
            link        TEXT    DEFAULT '',
            read        INTEGER DEFAULT 0,
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


def update_password(username, new_password):
    conn = get_db()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE username = ? COLLATE NOCASE",
        (generate_password_hash(new_password), username)
    )
    conn.commit()
    conn.close()


def update_username(old_username, new_username):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET username = ? WHERE username = ? COLLATE NOCASE",
            (new_username, old_username)
        )
        conn.commit()
        return {"success": True}
    except sqlite3.IntegrityError:
        return {"success": False, "error": "Username already taken"}
    finally:
        conn.close()


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


def get_all_members():
    """All registered users (members). Used for leaderboard integration."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username, is_admin, created_at FROM users ORDER BY username COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_admins():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username FROM users WHERE is_admin = 1 ORDER BY username"
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


# ── Chat ──────────────────────────────────────────────────────────────────────

def send_message(from_user, to_user, body):
    conn = get_db()
    conn.execute(
        "INSERT INTO chat_messages (from_user, to_user, body) VALUES (?, ?, ?)",
        (from_user, to_user, body)
    )
    conn.commit()
    conn.close()


def get_conversation(user_a, user_b):
    conn = get_db()
    rows = conn.execute(
        """SELECT * FROM chat_messages
           WHERE (from_user = ? COLLATE NOCASE AND to_user = ? COLLATE NOCASE)
              OR (from_user = ? COLLATE NOCASE AND to_user = ? COLLATE NOCASE)
           ORDER BY sent_at ASC""",
        (user_a, user_b, user_b, user_a)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mark_conversation_read(reader, other_user):
    """Mark all messages sent by other_user to reader as read."""
    conn = get_db()
    conn.execute(
        """UPDATE chat_messages SET read_by_recipient = 1
           WHERE from_user = ? COLLATE NOCASE AND to_user = ? COLLATE NOCASE
             AND read_by_recipient = 0""",
        (other_user, reader)
    )
    conn.commit()
    conn.close()


def get_unread_count(username):
    """Number of unread messages sent TO username."""
    conn = get_db()
    row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM chat_messages WHERE to_user = ? COLLATE NOCASE AND read_by_recipient = 0",
        (username,)
    ).fetchone()
    conn.close()
    return row["cnt"] if row else 0


def get_admin_conversations():
    """Return list of users who have ever messaged an admin, with unread count."""
    conn = get_db()
    rows = conn.execute(
        """SELECT from_user AS username,
                  MAX(sent_at) AS last_at,
                  SUM(CASE WHEN read_by_recipient = 0 THEN 1 ELSE 0 END) AS unread
           FROM chat_messages
           WHERE to_user = ? COLLATE NOCASE
           GROUP BY from_user
           ORDER BY last_at DESC""",
        (ADMIN_USERNAME,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_user_conversations(username):
    """All distinct admins this user has exchanged messages with."""
    conn = get_db()
    rows = conn.execute(
        """SELECT partner, MAX(last_at) AS last_at, SUM(unread) AS unread FROM (
             SELECT to_user AS partner, MAX(sent_at) AS last_at, 0 AS unread
               FROM chat_messages WHERE from_user = ? COLLATE NOCASE GROUP BY to_user
             UNION ALL
             SELECT from_user AS partner, MAX(sent_at) AS last_at,
                    SUM(CASE WHEN read_by_recipient=0 THEN 1 ELSE 0 END) AS unread
               FROM chat_messages WHERE to_user = ? COLLATE NOCASE GROUP BY from_user
           ) GROUP BY partner ORDER BY last_at DESC""",
        (username, username)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Username change requests ──────────────────────────────────────────────────

def submit_username_request(username, new_username):
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM username_change_requests WHERE username = ? COLLATE NOCASE AND status = 'pending'",
            (username,)
        ).fetchone()
        if existing:
            return {"success": False, "error": "You already have a pending username change request"}
        conn.execute(
            "INSERT INTO username_change_requests (username, new_username) VALUES (?, ?)",
            (username, new_username)
        )
        conn.commit()
        return {"success": True}
    finally:
        conn.close()


def get_all_username_requests():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM username_change_requests ORDER BY requested_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_username_request(req_id, status, reviewed_by, review_note=None):
    conn = get_db()
    conn.execute(
        """UPDATE username_change_requests
           SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
           WHERE id = ?""",
        (status, reviewed_by, review_note, req_id)
    )
    conn.commit()
    conn.close()


# ── Notifications ─────────────────────────────────────────────────────────────

def create_notification(username, ntype, body, link=""):
    conn = get_db()
    conn.execute(
        "INSERT INTO notifications (username, type, body, link) VALUES (?, ?, ?, ?)",
        (username, ntype, body, link)
    )
    conn.commit()
    conn.close()


def get_notifications(username, limit=50):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM notifications WHERE username = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT ?",
        (username, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_unread_notification_count(username):
    conn = get_db()
    msg_unread = conn.execute(
        "SELECT COUNT(*) AS cnt FROM chat_messages WHERE to_user = ? COLLATE NOCASE AND read_by_recipient = 0",
        (username,)
    ).fetchone()["cnt"]
    notif_unread = conn.execute(
        "SELECT COUNT(*) AS cnt FROM notifications WHERE username = ? COLLATE NOCASE AND read = 0",
        (username,)
    ).fetchone()["cnt"]
    conn.close()
    return msg_unread + notif_unread


def mark_notifications_read(username):
    conn = get_db()
    conn.execute(
        "UPDATE notifications SET read = 1 WHERE username = ? COLLATE NOCASE",
        (username,)
    )
    conn.commit()
    conn.close()
