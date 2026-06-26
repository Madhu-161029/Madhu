/* ================= STATE ================= */

let currentUser = null;
let currentToken = null;

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
    // Try to restore session from localStorage
    const savedToken = localStorage.getItem("nc_token");
    const savedUser = localStorage.getItem("nc_user");

    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showLoggedInState();
        loadNotes();
    } else {
        showLoggedOutState();
    }

    // Button listeners
    document.getElementById("loginBtn").addEventListener("click", showLogin);
    document.getElementById("registerBtn").addEventListener("click", showRegister);
    document.getElementById("loginSubmit").addEventListener("click", handleLogin);
    document.getElementById("registerSubmit").addEventListener("click", handleRegister);
    document.getElementById("saveNote").addEventListener("click", handleSaveNote);
    document.getElementById("updateNote").addEventListener("click", handleUpdateNote);

    // Enter key on login email
    document.getElementById("loginEmail").addEventListener("keydown", e => {
        if (e.key === "Enter") handleLogin();
    });
});

/* ================= UI STATES ================= */

function showLoggedOutState() {
    document.getElementById("hero-section").classList.remove("hidden");
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("notesSection").classList.add("hidden");
    document.getElementById("nav-dashboard").style.display = "none";
    document.getElementById("nav-logout").style.display = "none";
    showLogin();
}

function showLoggedInState() {
    document.getElementById("hero-section").classList.add("hidden");
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("notesSection").classList.remove("hidden");
    document.getElementById("nav-dashboard").style.display = "";
    document.getElementById("nav-logout").style.display = "";
    document.getElementById("nav-username").textContent = currentUser.first_name;
    document.getElementById("notes-greeting").textContent =
        `Welcome back, ${currentUser.first_name} ${currentUser.last_name}`;
}

/* ================= AUTH FORM SWITCHING ================= */

function showLogin() {
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");
    document.getElementById("loginError").textContent = "";
}

function showRegister() {
    document.getElementById("registerForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("registerError").textContent = "";
}

/* ================= LOGIN ================= */

async function handleLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const errEl = document.getElementById("loginError");
    errEl.textContent = "";

    if (!email) {
        errEl.textContent = "Please enter your email.";
        return;
    }

    if (!isValidEmail(email)) {
        errEl.textContent = "Enter a valid email address.";
        return;
    }

    const btn = document.getElementById("loginSubmit");
    btn.textContent = "Checking...";
    btn.disabled = true;

    try {
        const res = await fetch("/api/user/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (data.success) {
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem("nc_token", currentToken);
            localStorage.setItem("nc_user", JSON.stringify(currentUser));
            showLoggedInState();
            loadNotes();
        } else {
            errEl.textContent = data.message || "No account found with that email. Register instead?";
        }
    } catch (err) {
        errEl.textContent = "Something went wrong. Try again.";
    }

    btn.textContent = "Login";
    btn.disabled = false;
}

/* ================= REGISTER ================= */

async function handleRegister() {
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const errEl = document.getElementById("registerError");
    errEl.textContent = "";

    if (!firstName || !lastName || !email) {
        errEl.textContent = "All fields are required.";
        return;
    }

    if (!isValidEmail(email)) {
        errEl.textContent = "Enter a valid email address.";
        return;
    }

    const btn = document.getElementById("registerSubmit");
    btn.textContent = "Creating account...";
    btn.disabled = true;

    try {
        const res = await fetch("/api/user/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, email })
        });

        const data = await res.json();

        if (data.success) {
            currentToken = data.token;
            currentUser = data.user;
            localStorage.setItem("nc_token", currentToken);
            localStorage.setItem("nc_user", JSON.stringify(currentUser));
            showLoggedInState();
            loadNotes();
        } else {
            errEl.textContent = data.message || "Could not create account. Try again.";
        }
    } catch (err) {
        errEl.textContent = "Something went wrong. Try again.";
    }

    btn.textContent = "Register";
    btn.disabled = false;
}

/* ================= LOGOUT ================= */

function logoutUser() {
    localStorage.removeItem("nc_token");
    localStorage.removeItem("nc_user");
    currentToken = null;
    currentUser = null;
    document.getElementById("notesContainer").innerHTML = "";
    document.getElementById("loginEmail").value = "";
    showLoggedOutState();
}

/* ================= NOTES - LOAD ================= */

async function loadNotes() {
    if (!currentToken) return;

    const container = document.getElementById("notesContainer");
    const emptyEl = document.getElementById("notesEmpty");
    container.innerHTML = `<div class="loading-spinner">Loading your notes...</div>`;
    emptyEl.classList.add("hidden");

    try {
        const res = await fetch("/api/history", {
            headers: { "Authorization": currentToken }
        });

        const data = await res.json();

        container.innerHTML = "";

        if (!data.success || data.notes.length === 0) {
            emptyEl.classList.remove("hidden");
            return;
        }

        data.notes.forEach(note => {
            container.innerHTML += buildNoteCard(note);
        });

    } catch (err) {
        container.innerHTML = `<p style="color:#dc3545;padding:20px">Could not load notes. Refresh to try again.</p>`;
    }
}

function buildNoteCard(note) {
    const escaped = note.message.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `
    <div class="note-card" id="note-${note.id}">
        <p>${note.message}</p>
        <div class="note-card-actions">
            <button class="edit-btn" onclick="showEdit(${note.id}, '${escaped}')">✏ Edit</button>
            <button class="delete-btn" onclick="deleteNote(${note.id})">🗑 Delete</button>
        </div>
    </div>`;
}

/* ================= NOTES - ADD ================= */

function toggleNoteInput() {
    const area = document.getElementById("noteInputArea");
    const isHidden = area.classList.contains("hidden");
    area.classList.toggle("hidden");
    document.getElementById("editInputArea").classList.add("hidden");
    if (isHidden) {
        document.getElementById("noteText").focus();
        document.getElementById("noteText").value = "";
    }
}

async function handleSaveNote() {
    const text = document.getElementById("noteText").value.trim();
    if (!text) {
        document.getElementById("noteText").focus();
        return;
    }

    const btn = document.getElementById("saveNote");
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        const res = await fetch("/api/history", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": currentToken
            },
            body: JSON.stringify({ message: text })
        });

        const data = await res.json();

        if (data.success) {
            document.getElementById("noteText").value = "";
            document.getElementById("noteInputArea").classList.add("hidden");
            document.getElementById("notesEmpty").classList.add("hidden");
            // Prepend the new note
            const container = document.getElementById("notesContainer");
            container.insertAdjacentHTML("afterbegin", buildNoteCard(data.note));
        }

    } catch (err) {
        alert("Could not save note. Try again.");
    }

    btn.textContent = "Save note";
    btn.disabled = false;
}

/* ================= NOTES - EDIT ================= */

function showEdit(id, message) {
    document.getElementById("noteInputArea").classList.add("hidden");
    const area = document.getElementById("editInputArea");
    area.classList.remove("hidden");
    document.getElementById("editNoteId").value = id;
    document.getElementById("editNoteText").value = message;
    document.getElementById("editNoteText").focus();
    area.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cancelEdit() {
    document.getElementById("editInputArea").classList.add("hidden");
    document.getElementById("editNoteText").value = "";
}

async function handleUpdateNote() {
    const id = document.getElementById("editNoteId").value;
    const text = document.getElementById("editNoteText").value.trim();

    if (!text) {
        document.getElementById("editNoteText").focus();
        return;
    }

    const btn = document.getElementById("updateNote");
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        const res = await fetch(`/api/history/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": currentToken
            },
            body: JSON.stringify({ message: text })
        });

        const data = await res.json();

        if (data.success) {
            cancelEdit();
            // Update the note card in place
            const card = document.getElementById(`note-${id}`);
            if (card) {
                card.querySelector("p").textContent = text;
            }
        }

    } catch (err) {
        alert("Could not update note. Try again.");
    }

    btn.textContent = "Save changes";
    btn.disabled = false;
}

/* ================= NOTES - DELETE ================= */

async function deleteNote(id) {
    if (!confirm("Delete this note?")) return;

    try {
        const res = await fetch(`/api/history/${id}`, {
            method: "DELETE",
            headers: { "Authorization": currentToken }
        });

        const data = await res.json();

        if (data.success) {
            const card = document.getElementById(`note-${id}`);
            if (card) card.remove();
            // Show empty state if no notes left
            if (document.getElementById("notesContainer").children.length === 0) {
                document.getElementById("notesEmpty").classList.remove("hidden");
            }
        }

    } catch (err) {
        alert("Could not delete note. Try again.");
    }
}

/* ================= HELPERS ================= */

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}