import os
import json
from datetime import date, timedelta
from flask import Flask, send_from_directory, request, jsonify, session

from db import (
    init_db, create_user, get_user_by_username,
    verify_password, update_password, update_username, is_admin,
    get_all_users, get_all_admins, delete_user_by_username,
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


# ── Static file serving ──────────────────────────────────────────────────────

@app.route("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(ROOT, filename)


# ── Auth helpers ─────────────────────────────────────────────────────────────

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


# ── Auth API ─────────────────────────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if len(username) > 40:
        return jsonify({"error": "Username too long"}), 400

    result = create_user(username, password)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 409

    session["user_username"] = username
    session.permanent = True
    return jsonify({"username": username, "is_admin": is_admin(username)})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    user = get_user_by_username(username)
    if not user or not verify_password(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    session["user_username"] = user["username"]
    session.permanent = True
    return jsonify({"username": user["username"], "is_admin": is_admin(user["username"])})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_username", None)
    return jsonify({"ok": True})


@app.route("/api/auth/me")
def me():
    username = current_user()
    if not username:
        return jsonify({"user": None})
    user = get_user_by_username(username)
    if not user:
        session.pop("user_username", None)
        return jsonify({"user": None})
    return jsonify({"user": {"username": user["username"], "is_admin": is_admin(username)}})


# ── Settings API ──────────────────────────────────────────────────────────────

@app.route("/api/settings/password", methods=["POST"])
def change_password():
    u, err = require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    current_pw = (data.get("current_password") or "").strip()
    new_pw     = (data.get("new_password") or "").strip()
    if not current_pw or not new_pw:
        return jsonify({"error": "Both current and new password are required"}), 400
    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    user = get_user_by_username(u)
    if not verify_password(user["password_hash"], current_pw):
        return jsonify({"error": "Current password is incorrect"}), 403
    update_password(u, new_pw)
    return jsonify({"ok": True})


@app.route("/api/settings/username-request", methods=["POST"])
def request_username_change():
    u, err = require_auth()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    new_username = (data.get("new_username") or "").strip()
    if not new_username:
        return jsonify({"error": "New username required"}), 400
    if len(new_username) > 40:
        return jsonify({"error": "Username too long"}), 400
    if new_username.lower() == u.lower():
        return jsonify({"error": "That is already your username"}), 400
    if get_user_by_username(new_username):
        return jsonify({"error": "Username already taken"}), 409
    result = submit_username_request(u, new_username)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 409
    return jsonify({"ok": True}), 201


# ── Username change requests (admin) ──────────────────────────────────────────

@app.route("/api/admin/username-requests", methods=["GET"])
def api_get_username_requests():
    _, err = require_admin_auth()
    if err:
        return err
    return jsonify(get_all_username_requests())


@app.route("/api/admin/username-requests/<int:req_id>", methods=["PATCH"])
def api_review_username_request(req_id):
    admin_user, err = require_admin_auth()
    if err:
        return err
    data        = request.get_json(silent=True) or {}
    status      = (data.get("status") or "").strip().lower()
    review_note = (data.get("review_note") or "").strip()
    if status not in ("approved", "denied"):
        return jsonify({"error": "status must be 'approved' or 'denied'"}), 400

    update_username_request(req_id, status, admin_user, review_note)

    if status == "approved":
        reqs = get_all_username_requests()
        req  = next((r for r in reqs if r["id"] == req_id), None)
        if req:
            result = update_username(req["username"], req["new_username"])
            if not result["success"]:
                return jsonify({"error": result["error"]}), 409
            session_user = current_user()
            if session_user and session_user.lower() == req["username"].lower():
                session["user_username"] = req["new_username"]
            create_notification(
                req["new_username"], "username_change",
                f"Your username change to '{req['new_username']}' was approved.",
                "settings.html"
            )

    return jsonify({"ok": True})


# ── Notifications API ─────────────────────────────────────────────────────────

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


# ── Chat API ──────────────────────────────────────────────────────────────────

@app.route("/api/admins")
def api_get_admins():
    return jsonify(get_all_admins())


@app.route("/api/chat/<other_user>", methods=["GET"])
def api_get_chat(other_user):
    u, err = require_auth()
    if err:
        return err
    # Regular user can only chat with admins; admins can chat with anyone
    if not is_admin(u) and not is_admin(other_user):
        return jsonify({"error": "You can only chat with admins"}), 403
    msgs = get_conversation(u, other_user)
    mark_conversation_read(u, other_user)
    return jsonify(msgs)


@app.route("/api/chat/<other_user>", methods=["POST"])
def api_send_message(other_user):
    u, err = require_auth()
    if err:
        return err
    if not is_admin(u) and not is_admin(other_user):
        return jsonify({"error": "You can only chat with admins"}), 403
    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "Message cannot be empty"}), 400
    if len(body) > 2000:
        return jsonify({"error": "Message too long (max 2000 chars)"}), 400
    send_message(u, other_user, body)
    # Create notification for recipient
    create_notification(
        other_user, "message",
        f"New message from {u}: {body[:80]}{'…' if len(body) > 80 else ''}",
        f"chat.html?with={u}"
    )
    return jsonify({"ok": True}), 201


@app.route("/api/chat/conversations/mine")
def api_my_conversations():
    u, err = require_auth()
    if err:
        return err
    if is_admin(u):
        return jsonify(get_admin_conversations())
    return jsonify(get_user_conversations(u))


# ── Players helpers ───────────────────────────────────────────────────────────

def load_players():
    with open(PLAYERS_FILE, "r") as f:
        return json.load(f)


def save_players(players):
    with open(PLAYERS_FILE, "w") as f:
        json.dump(players, f, indent=2)


def find_player_idx(players, username):
    return next(
        (i for i, p in enumerate(players) if p["username"].lower() == username.lower()),
        None,
    )


# ── Admin: Players API ────────────────────────────────────────────────────────

@app.route("/api/admin/players", methods=["GET"])
def api_get_players():
    _, err = require_admin_auth()
    if err:
        return err
    return jsonify(load_players())


@app.route("/api/admin/players", methods=["POST"])
def api_add_player():
    _, err = require_admin_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    new_name = (data.get("username") or "").strip()
    description = (data.get("description") or "").strip()

    if not new_name:
        return jsonify({"error": "Username required"}), 400

    players = load_players()
    if find_player_idx(players, new_name) is not None:
        return jsonify({"error": "Player already exists"}), 409

    new_id = max((p.get("id", 0) for p in players), default=0) + 1
    player = {"id": new_id, "username": new_name, "description": description, "titles": []}
    players.append(player)
    save_players(players)
    return jsonify({"ok": True, "player": player}), 201


@app.route("/api/admin/players/<player_username>", methods=["PUT"])
def api_edit_player(player_username):
    _, err = require_admin_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    players = load_players()
    idx = find_player_idx(players, player_username)
    if idx is None:
        return jsonify({"error": "Player not found"}), 404

    if "description" in data:
        players[idx]["description"] = data["description"]
    if "username" in data and data["username"].strip():
        players[idx]["username"] = data["username"].strip()

    save_players(players)
    return jsonify({"ok": True, "player": players[idx]})


@app.route("/api/admin/players/<player_username>", methods=["DELETE"])
def api_delete_player(player_username):
    _, err = require_admin_auth()
    if err:
        return err

    players = load_players()
    idx = find_player_idx(players, player_username)
    if idx is None:
        return jsonify({"error": "Player not found"}), 404

    players.pop(idx)
    save_players(players)
    return jsonify({"ok": True})


# ── Admin: Titles API ─────────────────────────────────────────────────────────

@app.route("/api/admin/players/<player_username>/titles", methods=["POST"])
def api_award_title(player_username):
    _, err = require_admin_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()
    title_date = (data.get("date") or date.today().isoformat()).strip()

    if not code:
        return jsonify({"error": "Title code required"}), 400

    players = load_players()
    idx = find_player_idx(players, player_username)
    if idx is None:
        return jsonify({"error": "Player not found"}), 404

    if any(t["code"] == code for t in players[idx]["titles"]):
        return jsonify({"error": "Player already has this title"}), 409

    players[idx]["titles"].append({"code": code, "date": title_date})
    save_players(players)

    # Notify player if they have a site account
    create_notification(
        player_username, "title",
        f"Congratulations! You have been awarded the {code} title.",
        "profile.html"
    )
    return jsonify({"ok": True})


@app.route("/api/admin/players/<player_username>/titles/<title_code>", methods=["DELETE"])
def api_revoke_title(player_username, title_code):
    _, err = require_admin_auth()
    if err:
        return err

    players = load_players()
    idx = find_player_idx(players, player_username)
    if idx is None:
        return jsonify({"error": "Player not found"}), 404

    code = title_code.upper()
    before = len(players[idx]["titles"])
    players[idx]["titles"] = [t for t in players[idx]["titles"] if t["code"] != code]
    if len(players[idx]["titles"]) == before:
        return jsonify({"error": "Title not found"}), 404

    save_players(players)
    return jsonify({"ok": True})


# ── Title Applications API ────────────────────────────────────────────────────

@app.route("/api/applications", methods=["POST"])
def api_submit_application():
    u, err = require_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    title_code  = (data.get("title_code") or "").strip().upper()
    message     = (data.get("message") or "").strip()
    games       = int(data.get("games") or 0)
    peak_rating = int(data.get("peak_rating") or 0)

    if not title_code:
        return jsonify({"error": "Title code required"}), 400

    result = submit_application(u, title_code, message, games, peak_rating)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 409

    return jsonify({"ok": True}), 201


@app.route("/api/applications", methods=["GET"])
def api_get_applications():
    _, err = require_admin_auth()
    if err:
        return err
    return jsonify(get_all_applications())


@app.route("/api/applications/mine", methods=["GET"])
def api_get_my_applications():
    u, err = require_auth()
    if err:
        return err
    return jsonify(get_user_applications(u))


@app.route("/api/applications/<int:app_id>", methods=["PATCH"])
def api_review_application(app_id):
    admin_user, err = require_admin_auth()
    if err:
        return err

    data        = request.get_json(silent=True) or {}
    status      = (data.get("status") or "").strip().lower()
    review_note = (data.get("review_note") or "").strip()

    if status not in ("approved", "denied"):
        return jsonify({"error": "status must be 'approved' or 'denied'"}), 400

    update_application(app_id, status, admin_user, review_note)

    if status == "approved":
        apps = get_all_applications()
        app_rec = next((a for a in apps if a["id"] == app_id), None)
        if app_rec:
            players = load_players()
            idx = find_player_idx(players, app_rec["username"])
            if idx is None:
                new_id = max((p.get("id", 0) for p in players), default=0) + 1
                players.append({"id": new_id, "username": app_rec["username"], "description": "", "titles": []})
                idx = len(players) - 1
            code = app_rec["title_code"]
            if not any(t["code"] == code for t in players[idx]["titles"]):
                players[idx]["titles"].append({"code": code, "date": date.today().isoformat()})
            save_players(players)
            create_notification(
                app_rec["username"], "title",
                f"Your application for {code} was approved! You have been awarded the title.",
                "profile.html"
            )
    else:
        apps = get_all_applications()
        app_rec = next((a for a in apps if a["id"] == app_id), None)
        if app_rec:
            create_notification(
                app_rec["username"], "application",
                f"Your application for {app_rec['title_code']} was reviewed: {status}." +
                (f" Note: {review_note}" if review_note else ""),
                "settings.html"
            )

    return jsonify({"ok": True})


# ── Admin: Users API ──────────────────────────────────────────────────────────

@app.route("/api/admin/users", methods=["GET"])
def api_get_users():
    _, err = require_admin_auth()
    if err:
        return err
    return jsonify(get_all_users())


@app.route("/api/admin/users/<target_username>", methods=["DELETE"])
def api_delete_user(target_username):
    _, err = require_admin_auth()
    if err:
        return err
    if target_username.lower() == "mysterious_past":
        return jsonify({"error": "Cannot delete admin account"}), 403
    delete_user_by_username(target_username)
    return jsonify({"ok": True})


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
