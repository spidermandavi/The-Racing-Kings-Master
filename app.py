import os
import json
import re as _re
import urllib.request
import urllib.error
from datetime import date, timedelta
from flask import Flask, send_from_directory, request, jsonify, session

from db import (
    init_db, create_user, get_user_by_username,
    verify_password, update_password, update_username, is_admin,
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

ROOT = os.path.dirname(os.path.abspath(__file__))
PLAYERS_FILE = os.path.join(ROOT, "players.json")

init_db()

@app.route("/")
def home():
    return send_from_directory(ROOT, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(ROOT, filename)

# Authentication is handled exclusively by Supabase Auth on the frontend.
# The legacy Flask/SQLite authentication endpoints have intentionally been removed.

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

# The remaining application/admin APIs continue below.

@app.route("/api/settings/password", methods=["POST"])
def change_password():
    u, err = require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    current_pw = (data.get("current_password") or "").strip()
    new_pw = (data.get("new_password") or "").strip()
    if not current_pw or not new_pw:
        return jsonify({"error": "Both current and new password are required"}), 400
    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    user = get_user_by_username(u)
    if not user or not verify_password(user["password_hash"], current_pw):
        return jsonify({"error": "Current password is incorrect"}), 403
    update_password(u, new_pw)
    return jsonify({"ok": True})

@app.route("/api/notifications")
def api_get_notifications():
    u, err = require_auth()
    if err:
        return err
    return jsonify(get_notifications(u))

@app.route("/api/notifications/unread-count")
def api_unread_count():
    u = current_user()
    if not u:
        return jsonify({"count": 0})
    return jsonify({"count": get_unread_notification_count(u)})

@app.route("/api/notifications/read", methods=["POST"])
def api_mark_notifications_read():
    u, err = require_auth()
    if err:
        return err
    mark_notifications_read(u)
    return jsonify({"ok": True})

# NOTE: Legacy API handlers remain unavailable intentionally. Frontend Supabase
# authentication is the sole registration/login path.

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
