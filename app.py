import os
import json
import urllib.request
import urllib.error
from datetime import timedelta
from flask import Flask, send_from_directory, request, jsonify, session

from db import (
    init_db, get_user_by_username, is_admin,
    get_all_users, get_all_admins, delete_user_by_username,
    submit_application, get_all_applications, get_user_applications, update_application,
    send_message, get_conversation, mark_conversation_read,
    get_admin_conversations, get_user_conversations,
    submit_username_request, get_all_username_requests, update_username_request,
    get_notifications, get_unread_notification_count, mark_notifications_read,
)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET") or os.environ.get("RK_SECRET_KEY") or "rk-titles-dev-secret-8b5cf6"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["SESSION_COOKIE_NAME"] = "rk_session"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"

ROOT = os.path.dirname(os.path.abspath(__file__))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://oprfbthhvbqdiktnuqzz.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL")
init_db()

@app.route("/")
def home(): return send_from_directory(ROOT, "index.html")

def current_user(): return session.get("user_username")
def require_auth():
    u=current_user()
    return (u,None) if u else (None,(jsonify({"error":"Login required"}),401))
def require_admin_auth():
    u,err=require_auth()
    if err:return None,err
    return (u,None) if is_admin(u) else (None,(jsonify({"error":"Admin only"}),403))

@app.post("/api/auth/supabase-session")
def sync_supabase_session():
    data=request.get_json(silent=True) or {}; token=(data.get("access_token") or "").strip()
    if not token: session.clear(); return jsonify({"ok":False,"error":"Missing access token"}),401
    req=urllib.request.Request(f"{SUPABASE_URL}/auth/v1/user",headers={"apikey":SUPABASE_ANON_KEY,"Authorization":f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req,timeout=8) as r:user=json.loads(r.read().decode())
    except Exception:
        session.clear(); return jsonify({"ok":False,"error":"Invalid or expired Supabase session"}),401
    uid=user.get("id")
    if not uid: session.clear(); return jsonify({"ok":False,"error":"Invalid Supabase user"}),401
    profile=None
    try:
        req2=urllib.request.Request(f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{uid}&select=id,username,is_admin",headers={"apikey":SUPABASE_ANON_KEY,"Authorization":f"Bearer {token}"})
        with urllib.request.urlopen(req2,timeout=8) as r:
            rows=json.loads(r.read().decode()); profile=rows[0] if rows else None
    except Exception: pass
    username=(profile or {}).get("username") or (user.get("user_metadata") or {}).get("username")
    if not username: session.clear(); return jsonify({"ok":False,"error":"Your account has no profile username yet"}),400
    session.permanent=True; session["user_id"]=uid; session["user_username"]=username; session["is_admin"]=bool((profile or {}).get("is_admin"))
    return jsonify({"ok":True,"user":{"id":uid,"username":username,"is_admin":session["is_admin"]}})

@app.get("/api/auth/me")
def auth_me():
    u=current_user()
    return jsonify({"user":None} if not u else {"user":{"id":session.get("user_id"),"username":u,"is_admin":bool(session.get("is_admin") or is_admin(u))}})

@app.post("/api/auth/logout")
def auth_logout(): session.clear(); return jsonify({"ok":True})

@app.get("/api/admins")
def api_admins():
    admins=get_all_admins()
    if not any(a["username"].lower()=="mysterious_past" for a in admins): admins.insert(0,{"id":None,"username":"Mysterious_Past"})
    return jsonify(admins)

@app.get("/api/applications/mine")
def applications_mine():
    u,e=require_auth(); return e or jsonify(get_user_applications(u))
@app.post("/api/applications")
def applications_create():
    u,e=require_auth()
    if e:return e
    d=request.get_json(silent=True) or {}; r=submit_application(u,d.get("title_code",""),d.get("message",""),d.get("games",0),d.get("peak_rating",0)); return jsonify(r),(200 if r.get("success") else 400)
@app.get("/api/admin/applications")
def admin_applications():
    _,e=require_admin_auth(); return e or jsonify(get_all_applications())
@app.post("/api/admin/applications/<int:app_id>")
def admin_application_update(app_id):
    u,e=require_admin_auth()
    if e:return e
    d=request.get_json(silent=True) or {}; status=d.get("status")
    if status not in {"pending","approved","denied"}:return jsonify({"error":"Invalid status"}),400
    update_application(app_id,status,u,d.get("review_note")); return jsonify({"ok":True})

@app.get("/api/chat/conversations/mine")
def chat_conversations():
    u,e=require_auth();
    if e:return e
    return jsonify(get_admin_conversations() if is_admin(u) else get_user_conversations(u))
@app.get("/api/chat/<username>")
def chat_get(username):
    u,e=require_auth()
    if e:return e
    if not is_admin(u) and username.lower()!="mysterious_past":return jsonify({"error":"You may only chat with an admin"}),403
    return jsonify(get_conversation(u,username))
@app.post("/api/chat/<username>")
def chat_send(username):
    u,e=require_auth()
    if e:return e
    if not is_admin(u) and username.lower()!="mysterious_past":return jsonify({"error":"You may only chat with an admin"}),403
    body=(request.get_json(silent=True) or {}).get("body","").strip()
    if not body:return jsonify({"error":"Message cannot be empty"}),400
    send_message(u,username,body); return jsonify({"ok":True})
@app.post("/api/chat/<username>/read")
def chat_read(username):
    u,e=require_auth();
    if e:return e
    mark_conversation_read(u,username); return jsonify({"ok":True})

@app.post("/api/username-change")
def username_change():
    u,e=require_auth()
    if e:return e
    n=(request.get_json(silent=True) or {}).get("new_username","").strip()
    if not n:return jsonify({"error":"New username is required"}),400
    r=submit_username_request(u,n); return jsonify(r),(200 if r.get("success") else 400)
@app.get("/api/admin/username-requests")
def admin_username_requests():
    _,e=require_admin_auth(); return e or jsonify(get_all_username_requests())
@app.post("/api/admin/username-requests/<int:req_id>")
def admin_username_request_update(req_id):
    u,e=require_admin_auth()
    if e:return e
    d=request.get_json(silent=True) or {}; status=d.get("status")
    if status not in {"pending","approved","denied"}:return jsonify({"error":"Invalid status"}),400
    update_username_request(req_id,status,u,d.get("review_note")); return jsonify({"ok":True})

@app.get("/api/admin/users")
def admin_users():
    _,e=require_admin_auth(); return e or jsonify(get_all_users())
@app.delete("/api/admin/users/<username>")
def admin_delete_user(username):
    u,e=require_admin_auth()
    if e:return e
    if username.lower()==u.lower():return jsonify({"error":"You cannot delete yourself"}),400
    delete_user_by_username(username); return jsonify({"ok":True})

@app.get("/api/notifications")
def api_get_notifications():
    u,e=require_auth(); return e or jsonify(get_notifications(u))
@app.get("/api/notifications/unread-count")
def api_unread_count():
    u=current_user(); return jsonify({"count":0 if not u else get_unread_notification_count(u)})
@app.post("/api/notifications/read")
def api_mark_notifications_read():
    u,e=require_auth();
    if e:return e
    mark_notifications_read(u); return jsonify({"ok":True})

@app.route("/<path:filename>")
def static_files(filename): return send_from_directory(ROOT,filename)
if __name__=="__main__": app.run(host="0.0.0.0",port=int(os.environ.get("PORT",5000)))
