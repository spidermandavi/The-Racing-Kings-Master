import os
import json
import urllib.request
import urllib.error
from datetime import timedelta
from flask import Flask, send_from_directory, request, jsonify, session

from db import (
    init_db, get_user_by_username, is_admin,
    get_all_users, get_all_members, get_all_admins, delete_user_by_username,
    submit_application, get_all_applications, get_user_applications, update_application,
    send_message, get_conversation, mark_conversation_read,
    get_admin_conversations, get_user_conversations,
    submit_username_request, get_all_username_requests, update_username_request,
    create_notification, get_notifications, get_unread_notification_count,
    mark_notifications_read,
)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET") or os.environ.get("RK_SECRET_KEY") or "rk-titles-dev-secret-8b5cf6"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["SESSION_COOKIE_NAME"] = "rk_session"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = True

ROOT = os.path.dirname(os.path.abspath(__file__))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://oprfbthhvbqdiktnuqzz.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL")

init_db()

@app.route("/")
def home():
    return send_from_directory(ROOT, "index.html")

# Keep API routes before the catch-all static route.

def current_user():
    return session.get("user_username")

def require_auth():
    u = current_user()
    if not u:
        return None, (jsonify({"error": "Login required"}), 401)
    return u, None

def require_admin_auth():
    u, err = require_auth()
    if err:
        return None, err
    if not is_admin(u):
        return None, (jsonify({"error": "Admin only"}), 403)
    return u, None

@app.post("/api/auth/supabase-session")
def sync_supabase_session():
    """Exchange a valid Supabase access token for the legacy Flask session.
    This lets the existing Flask chat/application APIs keep working while Auth
    is owned by Supabase. The token is verified by Supabase itself, never decoded
    or trusted directly by this server.
    """
    data = request.get_json(silent=True) or {}
    token = (data.get("access_token") or "").strip()
    if not token:
        session.clear()
        return jsonify({"ok": False, "error": "Missing access token"}), 401

    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            user = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError):
        session.clear()
        return jsonify({"ok": False, "error": "Invalid or expired Supabase session"}), 401

    user_id = user.get("id")
    if not user_id:
        session.clear()
        return jsonify({"ok": False, "error": "Invalid Supabase user"}), 401

    # Profiles are the source of truth for the site username and admin flag.
    profile = None
    try:
        url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=id,username,is_admin"
        req2 = urllib.request.Request(url, headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req2, timeout=8) as response:
            rows = json.loads(response.read().decode("utf-8"))
            profile = rows[0] if rows else None
    except Exception:
        profile = None

    username = (profile or {}).get("username") or (user.get("user_metadata") or {}).get("username")
    if not username:
        session.clear()
        return jsonify({"ok": False, "error": "Your account has no profile username yet"}), 400

    session.permanent = True
    session["user_id"] = user_id
    session["user_username"] = username
    session["is_admin"] = bool((profile or {}).get("is_admin"))
    return jsonify({"ok": True, "user": {"id": user_id, "username": username, "is_admin": session["is_admin"]}})

@app.get("/api/auth/me")
def auth_me():
    u = current_user()
    if not u:
        return jsonify({"user": None})
    return jsonify({"user": {"id": session.get("user_id"), "username": u, "is_admin": bool(session.get("is_admin") or is_admin(u))}})

@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/admins")
def api_admins():
    admins = get_all_admins()
    if not any(a["username"].lower() == "mysterious_past" for a in admins):
        admins.insert(0, {"id": None, "username": "Mysterious_Past"})
    return jsonify(admins)

# Applications
@app.get("/api/applications/mine")
def applications_mine():
    u, err = require_auth()
    if err: return err
    return jsonify(get_user_applications(u))

@app.post("/api/applications")
def applications_create():
    u, err = require_auth()
    if err: return err
    data = request.get_json(silent=True) or {}
    result = submit_application(u, data.get("title_code", ""), data.get("message", ""), data.get("games", 0), data.get("peak_rating", 0))
    return jsonify(result), (200 if result.get("success") else 400)

@app.get("/api/admin/applications")
def admin_applications():
    _, err = require_admin_auth()
    if err: return err
    return jsonify(get_all_applications())

@app.post("/api/admin/applications/<int:app_id>")
def admin_application_update(app_id):
    u, err = require_admin_auth()
    if err: return err
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in {"pending", "approved", "denied"}:
        return jsonify({"error": "Invalid status"}), 400
    update_application(app_id, status, u, data.get("review_note"))
    return jsonify({"ok": True})

# Chat
@app.get("/api/chat/conversations/mine")
def chat_conversations():
    u, err = require_auth()
    if err: return err
    if is_admin(u):
        return jsonify(get_admin_conversations())
    return jsonify(get_user_conversations(u))

@app.get("/api/chat/<username>")
def chat_get(username):
    u, err = require_auth()
    if err: return err
    if not is_admin(u) and username.lower() != "mysterious_past":
        return jsonify({"error": "You may only chat with an admin"}), 403
    return jsonify(get_conversation(u, username))

@app.post("/api/chat/<username>")
def chat_send(username):
    u, err = require_auth()
    if err: return err
    if not is_admin(u) and username.lower() != "mysterious_past":
        return jsonify({"error": "You may only chat with an admin"}), 403
    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body: return jsonify({"error": "Message cannot be empty"}), 400
    send_message(u, username, body)
    return jsonify({"ok": True})

@app.post("/api/chat/<username>/read")
def chat_read(username):
    u, err = require_auth()
    if err: return err
    mark_conversation_read(u, username)
    return jsonify({"ok": True})

# Username changes
@app.post("/api/username-change")
def username_change():
    u, err = require_auth()
    if err: return err
    data = request.get_json(silent=True) or {}
    new_username = (data.get("new_username") or "").strip()
    if not new_username: return jsonify({"error": "New username is required"}), 400
    result = submit_username_request(u, new_username)
    return jsonify(result), (200 if result.get("success") else 400)

@app.get("/api/admin/username-requests")
def admin_username_requests():
    _, err = require_admin_auth()
    if err: return err
    return jsonify(get_all_username_requests())

@app.post("/api/admin/username-requests/<int:req_id>")
def admin_username_request_update(req_id):
    u, err = require_admin_auth()
    if err: return err
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in {"pending", "approved", "denied"}:
        return jsonify({"error": "Invalid status"}), 400
    update_username_request(req_id, status, u, data.get("review_note"))
    return jsonify({"ok": True})

# User/member administration
@app.get("/api/admin/users")
def admin_users():
    _, err = require_admin_auth()
    if err: return err
    return jsonify(get_all_users())

@app.delete("/api/admin/users/<username>")
def admin_delete_user(username):
    u, err = require_admin_auth()
    if err: return err
    if username.lower() == u.lower():
        return jsonify({"error": "You cannot delete yourself"}), 400
    delete_user_by_username(username)
    return jsonify({"ok": True})

# Notifications
@app.get("/api/notifications")
def api_get_notifications():
    u, err = require_auth()
    if err: return err
    return jsonify(get_notifications(u))

@app.get("/api/notifications/unread-count")
def api_unread_count():
    u = current_user()
    if not u: return jsonify({"count": 0})
    return jsonify({"count": get_unread_notification_count(u)})

@app.post("/api/notifications/read")
def api_mark_notifications_read():
    u, err = require_auth()
    if err: return err
    mark_notifications_read(u)
    return jsonify({"ok": True})

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(ROOT, filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
