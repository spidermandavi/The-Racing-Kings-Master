import os
import json
from datetime import date, timedelta
from flask import Flask, send_from_directory, request, jsonify, session

from db import (
    init_db, create_user, get_user_by_username,
    verify_password, is_admin, get_all_users, delete_user_by_username,
    submit_application, get_all_applications, get_user_applications, update_application,
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

    # If approving, also ensure player exists and title is awarded
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
