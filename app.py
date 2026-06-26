from flask import Flask, request, jsonify, render_template
import uuid
from supabase import create_client

app = Flask(__name__)

SUPABASE_URL = "https://hzdvpopmngokjqjrlxgu.supabase.co"
SUPABASE_KEY = "sb_secret_qKGpZdtI0YXWm0IdXnYMxA_K_aa2Hyv"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

USER_TABLE = "user"
HISTORY_TABLE = "history"


# ─── PAGES ───────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    try:
        return render_template("index.html")
    except Exception:
        return "<h1>API is running</h1><p>No index.html template found in /templates folder.</p>", 200

@app.route("/contact")
def contact():
    return render_template("contact-us.html")


# ─── AUTH ────────────────────────────────────────────────────────────────────

@app.route("/api/user/register", methods=["POST"])
def register_user():
    try:
        data = request.get_json()
        first_name = data.get("first_name", "").strip()
        last_name  = data.get("last_name",  "").strip()
        email      = data.get("email",       "").strip().lower()

        if not first_name or not last_name or not email:
            return jsonify({"success": False, "message": "All fields required"}), 400

        existing = supabase.table(USER_TABLE).select("id").eq("email", email).execute()
        if existing.data:
            return jsonify({"success": False, "message": "An account with that email already exists"}), 409

        token = str(uuid.uuid4())

        result = supabase.table(USER_TABLE).insert({
            "first_name": first_name,
            "last_name":  last_name,
            "email":      email,
            "token":      token
        }).execute()

        return jsonify({"success": True, "token": token, "user": result.data[0]})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/user/login", methods=["POST"])
def login_user():
    try:
        data  = request.get_json()
        email = data.get("email", "").strip().lower()

        user = supabase.table(USER_TABLE).select("*").eq("email", email).execute()
        if not user.data:
            return jsonify({"success": False, "message": "No account found with that email"}), 404

        token = str(uuid.uuid4())
        supabase.table(USER_TABLE).update({"token": token}).eq("email", email).execute()

        return jsonify({"success": True, "token": token, "user": user.data[0]})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── NOTES ───────────────────────────────────────────────────────────────────

def get_user_from_token(token):
    if not token:
        return None
    result = supabase.table(USER_TABLE).select("*").eq("token", token).execute()
    return result.data[0] if result.data else None


@app.route("/api/history", methods=["POST"])
def save_note():
    try:
        token = request.headers.get("Authorization")
        user  = get_user_from_token(token)
        if not user:
            return jsonify({"success": False, "message": "Unauthorised"}), 401

        data    = request.get_json()
        message = data.get("message", "").strip()
        if not message:
            return jsonify({"success": False, "message": "Note cannot be empty"}), 400

        note = supabase.table(HISTORY_TABLE).insert({
            "user_id": user["id"],
            "message": message
        }).execute()

        return jsonify({"success": True, "note": note.data[0]})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/history", methods=["GET"])
def get_notes():
    try:
        token = request.headers.get("Authorization")
        user  = get_user_from_token(token)
        if not user:
            return jsonify({"success": False, "message": "Unauthorised"}), 401

        notes = (
            supabase.table(HISTORY_TABLE)
            .select("*")
            .eq("user_id", user["id"])
            .order("id", desc=True)
            .execute()
        )

        return jsonify({"success": True, "notes": notes.data})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/history/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    try:
        token = request.headers.get("Authorization")
        user  = get_user_from_token(token)
        if not user:
            return jsonify({"success": False, "message": "Unauthorised"}), 401

        data    = request.get_json()
        message = data.get("message", "").strip()
        if not message:
            return jsonify({"success": False, "message": "Note cannot be empty"}), 400

        check = (
            supabase.table(HISTORY_TABLE)
            .select("id")
            .eq("id", note_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            return jsonify({"success": False, "message": "Note not found"}), 404

        updated = (
            supabase.table(HISTORY_TABLE)
            .update({"message": message})
            .eq("id", note_id)
            .execute()
        )

        return jsonify({"success": True, "note": updated.data[0]})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/history/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    try:
        token = request.headers.get("Authorization")
        user  = get_user_from_token(token)
        if not user:
            return jsonify({"success": False, "message": "Unauthorised"}), 401

        check = (
            supabase.table(HISTORY_TABLE)
            .select("id")
            .eq("id", note_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not check.data:
            return jsonify({"success": False, "message": "Note not found"}), 404

        supabase.table(HISTORY_TABLE).delete().eq("id", note_id).execute()

        return jsonify({"success": True, "message": "Deleted"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ─── RUN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True)
