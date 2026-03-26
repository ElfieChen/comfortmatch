// ============================================================
//  FIREBASE CONFIG
// ============================================================
var firebaseConfig = {
  apiKey:            "AIzaSyDtkdksQFrkqJhgdATnVhntlhWevXvGVqs",
  authDomain:        "cct286-assignment6.firebaseapp.com",
  databaseURL:       "https://cct286-assignment6-default-rtdb.firebaseio.com",
  projectId:         "cct286-assignment6",
  storageBucket:     "cct286-assignment6.firebasestorage.app",
  messagingSenderId: "324964637343",
  appId:             "1:324964637343:web:0e6468cc8444a1ea3e20aa",
  measurementId:     "G-VJ38KMEEV0"
};

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db   = firebase.database();

// ============================================================
//  QUESTIONS
// ============================================================
var QUESTIONS = [
  {
    id: 0, field: "commuteType", optional: false,
    label: "How do you usually commute?",
    hint: "This shapes which functional features we prioritise.",
    type: "single",
    options: [
      { value: "Car",            label: "Car" },
      { value: "Bus",            label: "Bus" },
      { value: "Subway",         label: "Subway / Metro" },
      { value: "WalkingCycling", label: "Walking or Cycling" },
      { value: "WorkFromHome",   label: "Work from Home" }
    ]
  },
  {
    id: 1, field: "thermalSensitivity", optional: false,
    label: "How do you feel about temperature?",
    hint: "This affects insulation and breathability choices.",
    type: "single",
    options: [
      { value: "EasilyCold", label: "I get cold easily" },
      { value: "EasilyWarm", label: "I get warm easily" },
      { value: "InBetween",  label: "Somewhere in between" }
    ]
  },
  {
    id: 2, field: "maintenancePref", optional: false,
    label: "How much effort do you put into clothing care?",
    hint: "This determines whether delicate items appear in your results.",
    type: "single",
    options: [
      { value: "LowMaintenance", label: "Keep it easy — machine wash everything" },
      { value: "RegularCareOK",  label: "Fine with hand — washing or dry cleaning" }
    ]
  },
  {
    id: 3, field: "outingPurpose", optional: false,
    label: "What do you mainly wear these clothes for?",
    hint: "This steers the style and structure of recommendations.",
    type: "single",
    options: [
      { value: "Work",          label: "Work / Professional" },
      { value: "SchoolStudy",   label: "School or Studying" },
      { value: "LeisureSocial", label: "Leisure & Social" },
      { value: "MixedUse",      label: "Mixed — a bit of everything" }
    ]
  },
  {
    id: 4, field: "sensitivities", optional: false,
    label: "Any material sensitivities?",
    hint: "Select all that apply. Items with these materials will be excluded.",
    type: "multi",
    options: [
      { value: "None",            label: "None" },
      { value: "Wool",            label: "Wool" },
      { value: "SyntheticFibers", label: "Synthetic Fibers" },
      { value: "LatexElastic",    label: "Latex / Elastic" },
      { value: "RoughTextured",   label: "Rough Textures" }
    ]
  }
];

// ============================================================
//  STATE
// ============================================================
var state = {
  currentQuestion: 0,
  answers: { sensitivities: ["None"] },
  catalog: [],
  currentUser: null,
  savedSnapshots: {}   // keyed by profileKey → JSON string of answers at last save
};

// ============================================================
//  SESSION PERSISTENCE  (survives page refresh)
// ============================================================
var SESSION_KEY = "comfortmatch_session";

function saveSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      screen:          _currentScreen || "landing",
      currentQuestion: state.currentQuestion,
      answers:         state.answers
    }));
  } catch(e) {}
}

function loadSession() {
  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
}

var _currentScreen = "landing";

// ============================================================
//  INIT — load catalog then show landing
// ============================================================
// ============================================================
//  INIT — load catalog then restore session or show landing
// ============================================================
fetch("catalog.json")
  .then(function(r) { return r.json(); })
  .then(function(data) {
    state.catalog = data;
    var session = loadSession();
    if (session && session.screen && session.screen !== "landing") {
      // Restore answers and question progress
      if (session.answers) state.answers = session.answers;
      if (session.currentQuestion !== undefined) state.currentQuestion = session.currentQuestion;
      if (session.screen === "quiz") {
        showScreen("quiz");
        renderQuestion(state.currentQuestion);
      } else if (session.screen === "results") {
        showResults();
      } else {
        showScreen("landing");
      }
    } else {
      showScreen("landing");
    }
  })
  .catch(function() {
    document.getElementById("screen-landing").innerHTML =
      '<div style="text-align:center;padding:80px 20px;color:#8a8278">' +
      '<div style="font-size:32px;margin-bottom:14px">&#x26A0;&#xFE0F;</div>' +
      '<p style="font-size:14px">Could not load catalog.json.<br>Make sure all files are in the same folder.</p></div>';
    showScreen("landing");
  });

// ============================================================
//  FIREBASE AUTH OBSERVER
// ============================================================

// Stable JSON stringify — sorts keys so insertion order never causes
// a false "dirty" result when comparing sessionStorage vs Firebase data.
function stableJSON(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  return "{" + Object.keys(obj).sort().map(function(k) {
    return JSON.stringify(k) + ":" + stableJSON(obj[k]);
  }).join(",") + "}";
}

// Single source of truth for the save button state.
// Called by onAuthStateChanged, showResults, and markProfileDirty.
function resolveSaveButton() {
  var btn = document.getElementById("btn-save-profile");
  if (!btn) return;

  // Always keep the button visible — no hiding needed
  btn.style.visibility = "visible";

  if (!state.currentUser) {
    // Not logged in — solid green, clicking opens login modal
    updateSaveButton("unsaved");
    return;
  }

  var key  = activeProfileKey || "default";
  var snap = state.savedSnapshots[key];

  if (snap !== undefined) {
    // Snapshot in memory — compare immediately
    updateSaveButton(stableJSON(state.answers) === snap ? "saved" : "dirty");
  } else {
    // Post-refresh: show green while Firebase fetch resolves, then update
    updateSaveButton("unsaved");
    getProfileRef(state.currentUser.uid, key).get().then(function(dbSnap) {
      if (dbSnap.exists()) {
        var dbJson = stableJSON(dbSnap.val().answers);
        state.savedSnapshots[key] = dbJson;
        updateSaveButton(stableJSON(state.answers) === dbJson ? "saved" : "dirty");
      } else {
        updateSaveButton("unsaved");
      }
    }).catch(function() { updateSaveButton("unsaved"); });
  }
}

auth.onAuthStateChanged(function(user) {
  state.currentUser = user || null;
  refreshLoginStatus();
  resolveSaveButton();
});

// ============================================================
//  SCREEN SWITCHING
// ============================================================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(function(el) { el.classList.remove("active"); });
  document.getElementById("screen-" + name).classList.add("active");
  document.body.classList.toggle("on-landing", name === "landing");
  var label = document.getElementById("header-label");
  if (name === "results") label.textContent = "Your recommendations";
  else if (name === "quiz") label.textContent = "Style quiz";
  else label.textContent = "";
  _currentScreen = name;
  saveSession();
}

function startQuiz() {
  showScreen("quiz");
  renderQuestion(0);
}

// ============================================================
//  QUIZ RENDERING
// ============================================================
function renderQuestion(index) {
  state.currentQuestion = index;
  var q = QUESTIONS[index];
  var total = QUESTIONS.length;
  document.getElementById("progress-fill").style.width = Math.round(((index + 1) / total) * 100) + "%";

  var optHTML = "";
  if (q.type === "single") {
    optHTML = '<div class="options-list">';
    q.options.forEach(function(opt) {
      var sel = state.answers[q.field] === opt.value;
      optHTML += '<button class="option-btn' + (sel ? " selected" : "") +
        '" onclick="selectSingle(\'' + q.field + '\',\'' + opt.value + '\')">' +
        '<span>' + opt.label + '</span>' +
        '<span class="opt-dot"></span></button>';
    });
    optHTML += '</div>';
  } else {
    var cur = state.answers[q.field] || ["None"];
    optHTML = '<div class="options-chips">';
    q.options.forEach(function(opt) {
      var sel = cur.includes(opt.value);
      optHTML += '<button class="chip-btn' + (sel ? " selected" : "") +
        '" onclick="toggleMulti(\'' + q.field + '\',\'' + opt.value + '\')">' +
        '<span>' + opt.label + '</span></button>';
    });
    optHTML += '</div>';
  }

  var canGo = q.optional || hasAnswer(q.field);
  var isLast = index === QUESTIONS.length - 1;

  document.getElementById("question-card").innerHTML =
    '<div class="q-step">Question ' + (index + 1) + ' of ' + total + '</div>' +
    '<div class="q-text">' + q.label + (q.optional ? '<span class="optional-tag">optional</span>' : '') + '</div>' +
    '<div class="q-hint">' + q.hint + '</div>' +
    optHTML +
    '<div class="q-nav">' +
      '<button class="btn-back" onclick="goBack()" ' + (index === 0 ? "disabled" : "") + '>&#8592; Back</button>' +
      '<button class="btn-next" onclick="goNext()" ' + (canGo ? "" : "disabled") + '>' +
        (isLast ? "See my recommendations &#8594;" : "Next &#8594;") +
      '</button>' +
    '</div>';

  // (animation removed)
}

function hasAnswer(field) {
  var v = state.answers[field];
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
}
function selectSingle(field, value) { state.answers[field] = value; saveSession(); renderQuestion(state.currentQuestion); }
function toggleMulti(field, value) {
  var cur = state.answers[field] ? state.answers[field].slice() : ["None"];
  if (value === "None") { cur = ["None"]; }
  else {
    cur = cur.filter(function(v) { return v !== "None"; });
    var i = cur.indexOf(value);
    if (i >= 0) cur.splice(i, 1); else cur.push(value);
    if (cur.length === 0) cur = ["None"];
  }
  state.answers[field] = cur;
  saveSession();
  renderQuestion(state.currentQuestion);
}
function goNext() {
  var q = QUESTIONS[state.currentQuestion];
  if (!q.optional && !hasAnswer(q.field)) return;
  if (state.currentQuestion < QUESTIONS.length - 1) renderQuestion(state.currentQuestion + 1);
  else showResults();
  saveSession();
}
function goBack() { if (state.currentQuestion > 0) { renderQuestion(state.currentQuestion - 1); saveSession(); } }

// ============================================================
//  FIREBASE AUTH & PROFILE
// ============================================================

function refreshLoginStatus() {
  var user = state.currentUser;
  var el = document.getElementById("logged-in-status");
  var logoutBtn = document.getElementById("btn-logout");
  if (user) {
    var shortEmail = user.email.length > 22 ? user.email.substring(0, 20) + "\u2026" : user.email;
    el.textContent = shortEmail;
    el.classList.add("visible");
    if (logoutBtn) logoutBtn.style.display = "block";
  } else {
    el.textContent = "";
    el.classList.remove("visible");
    if (logoutBtn) logoutBtn.style.display = "none";
  }
}

// ── Multi-profile support ─────────────────────────────────
var activeProfileKey = "default";

function getAllProfilesRef(uid) { return db.ref("profiles/" + uid + "/saved"); }
function getProfileRef(uid, key) { return db.ref("profiles/" + uid + "/saved/" + key); }

function saveProfileToDb(profileKey) {
  var user = state.currentUser;
  if (!user) return Promise.reject(new Error("Not signed in"));
  var key = profileKey || activeProfileKey || "default";
  var label = key === "default" ? "Default" : key;
  var data = {
    savedAt: new Date().toISOString(),
    label: label,
    answers: state.answers,
    profile: buildUserProfile()
  };
  return getProfileRef(user.uid, key).set(data)
    .then(function() { return { ok: true }; })
    .catch(function(e) {
      console.warn("DB save error:", e.code, e.message);
      return { ok: false, code: e.code };
    });
}

function loadProfileFromDb() {
  var user = state.currentUser;
  if (!user) return Promise.resolve(false);
  var key = activeProfileKey || "default";
  return getProfileRef(user.uid, key).get()
    .then(function(snap) {
      if (snap.exists()) {
        var data = snap.val();
        if (data && data.answers) {
          state.answers = data.answers;
          state.savedSnapshots[key] = stableJSON(data.answers);
          return true;
        }
      }
      return false;
    })
    .catch(function() { return false; });
}

function checkIfProfileSaved(uid) {
  return getAllProfilesRef(uid).get()
    .then(function(snap) { return snap.exists(); })
    .catch(function() { return false; });
}

// ── Account modal ────────────────────────────────────────────
function openAccountModal() {
  if (!state.currentUser) { openLoginModal(); return; }
  var modal = document.getElementById("account-modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  document.getElementById("account-email-line").textContent = state.currentUser.email;

  var content = document.getElementById("account-profile-content");
  content.innerHTML = '<div class="account-loading">Loading\u2026</div>';
  document.getElementById("profile-tabs").innerHTML = "";

  getAllProfilesRef(state.currentUser.uid).get()
    .then(function(snap) {
      if (!snap.exists()) {
        content.innerHTML = '<p class="account-no-profile">No profile saved yet. Complete the quiz and save your profile first.</p>';
        document.getElementById("profile-tabs").innerHTML = "";
        return;
      }
      var allProfiles = snap.val();
      var keys = Object.keys(allProfiles);
      if (!activeProfileKey || !allProfiles[activeProfileKey]) activeProfileKey = keys[0];
      renderProfileTabs(allProfiles, activeProfileKey);
      renderAccountProfileContent(allProfiles[activeProfileKey]);
      // Ensure state.answers reflects the active profile
      if (allProfiles[activeProfileKey] && allProfiles[activeProfileKey].answers) {
        state.answers = JSON.parse(stableJSON(allProfiles[activeProfileKey].answers));
        if (!state.savedSnapshots[activeProfileKey]) {
          state.savedSnapshots[activeProfileKey] = stableJSON(allProfiles[activeProfileKey].answers);
        }
      }
    })
    .catch(function() {
      content.innerHTML = '<p class="account-no-profile">Could not load profiles. Check your Firebase rules.</p>';
    });
}

function renderProfileTabs(allProfiles, currentKey) {
  var tabs = document.getElementById("profile-tabs");
  tabs.innerHTML = "";
  var keys = Object.keys(allProfiles);
  keys.forEach(function(key) {
    var p = allProfiles[key];
    var displayLabel = p.label || (key === "default" ? "Default" : key);
    var btn = document.createElement("button");
    btn.className = "profile-tab" + (key === currentKey ? " active" : "");

    // Label span (never shows the raw key)
    var labelSpan = document.createElement("span");
    labelSpan.textContent = displayLabel;
    btn.appendChild(labelSpan);

    // Delete × only if more than one profile
    if (keys.length > 1) {
      var del = document.createElement("button");
      del.className = "profile-tab-delete";
      del.title = "Delete this profile";
      del.textContent = "\u00d7";
      del.onclick = function(e) { e.stopPropagation(); deleteProfile(key); };
      btn.appendChild(del);
    }

    btn.onclick = function() { switchAccountProfile(key); };
    tabs.appendChild(btn);
  });
}

function switchAccountProfile(key) {
  var user = state.currentUser;
  if (!user) return;
  activeProfileKey = key;
  getAllProfilesRef(user.uid).get().then(function(snap) {
    if (!snap.exists()) return;
    var all = snap.val();
    renderProfileTabs(all, key);
    renderAccountProfileContent(all[key]);
    // Load this profile's answers into state so "Edit Profile" works correctly
    if (all[key] && all[key].answers) {
      state.answers = JSON.parse(stableJSON(all[key].answers));
      // Record the snapshot for this profile key so dirty-tracking works
      if (!state.savedSnapshots[key]) {
        state.savedSnapshots[key] = stableJSON(all[key].answers);
      }
    }
  });
}

function deleteProfile(key) {
  var user = state.currentUser;
  if (!user) return;
  if (!confirm("Delete this profile?")) return;
  getProfileRef(user.uid, key).remove().then(function() {
    if (activeProfileKey === key) activeProfileKey = "default";
    openAccountModal();
  });
}

function createNewProfile() {
  var name = prompt("Name for this new profile (e.g. \"Work\", \"Weekend\"):");
  if (!name || !name.trim()) return;
  var key = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 30);
  var user = state.currentUser;
  if (!user) { openLoginModal(); return; }
  var data = {
    savedAt: new Date().toISOString(),
    label: name.trim(),
    answers: state.answers,
    profile: buildUserProfile()
  };
  getProfileRef(user.uid, key).set(data).then(function() {
    activeProfileKey = key;
    state.savedSnapshots[key] = stableJSON(state.answers);
    openAccountModal();
  });
}

function renderAccountProfileContent(data) {
  var content = document.getElementById("account-profile-content");
  if (!data) { content.innerHTML = '<p class="account-no-profile">Profile data not found.</p>'; return; }
  var answers = data.answers || {};
  var savedAt = data.savedAt ? new Date(data.savedAt).toLocaleDateString("en-CA", { year:"numeric", month:"long", day:"numeric" }) : "";
  var rows = [
    { label: "Commute",      value: fmtCommute(answers.commuteType) || "\u2014" },
    { label: "Temperature",  value: fmtThermal(answers.thermalSensitivity) || "\u2014" },
    { label: "Maintenance",  value: answers.maintenancePref === "LowMaintenance" ? "Low maintenance" : answers.maintenancePref === "RegularCareOK" ? "Regular care OK" : "\u2014" },
    { label: "Purpose",      value: fmtPurpose(answers.outingPurpose) || "\u2014" },
    { label: "Sensitivities",value: (answers.sensitivities && !answers.sensitivities.includes("None")) ? answers.sensitivities.join(", ") : "None" }
  ];
  var html = '<div class="account-saved-at">Saved on ' + savedAt + '</div><div class="account-rows">';
  rows.forEach(function(r) {
    html += '<div class="account-row"><span class="account-row-label">' + r.label + '</span><span class="account-row-value">' + r.value + '</span></div>';
  });
  html += '</div>';
  content.innerHTML = html;
}
function closeAccountModal() {
  var modal = document.getElementById("account-modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function openLoginModal() {
  var modal = document.getElementById("login-modal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("login-email").value = "";
  document.getElementById("login-password").value = "";
  document.getElementById("modal-error").textContent = "";
  document.getElementById("login-email").classList.remove("error");
  document.getElementById("login-password").classList.remove("error");
  setTimeout(function() { document.getElementById("login-email").focus(); }, 80);
}
function closeLoginModal() {
  var modal = document.getElementById("login-modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

// ── Login modal ──────────────────────────────────────────────
function validateModalFields() {
  var emailEl    = document.getElementById("login-email");
  var passwordEl = document.getElementById("login-password");
  var email      = emailEl.value.trim();
  var password   = passwordEl.value.trim();
  emailEl.classList.remove("error");
  passwordEl.classList.remove("error");
  if (!email && !password) { emailEl.classList.add("error"); passwordEl.classList.add("error"); return "Please enter your email and password."; }
  if (!email)  { emailEl.classList.add("error"); emailEl.focus(); return "Email is required."; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailEl.classList.add("error"); emailEl.focus(); return "Please enter a valid email address."; }
  if (!password) { passwordEl.classList.add("error"); passwordEl.focus(); return "Password is required."; }
  return null;
}
function setModalLoading(loading) {
  var loginBtn  = document.getElementById("modal-login-btn");
  var signupBtn = document.getElementById("modal-signup-btn");
  if (loginBtn)  { loginBtn.disabled  = loading; loginBtn.textContent  = loading ? "Logging in..." : "Log in & save profile"; }
  if (signupBtn) { signupBtn.disabled = loading; signupBtn.textContent = loading ? "Creating account..." : "Create account & save"; }
}
function friendlyAuthError(code) {
  var map = {
    "auth/user-not-found":          "No account found with this email. Try creating an account instead.",
    "auth/wrong-password":          "Incorrect password. Try again, or create a new account.",
    "auth/invalid-credential":      "No account found with these details. Please sign up first.",
    "auth/email-already-in-use":    "An account already exists with this email — try logging in.",
    "auth/weak-password":           "Password must be at least 6 characters.",
    "auth/too-many-requests":       "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed":  "Network error — check your connection.",
    "auth/configuration-not-found": "Email/password sign-in is not enabled in Firebase Console."
  };
  return map[code] || ("Error: " + (code || "unknown") + ". Please try again.");
}

// ── handleLogin ──────────────────────────────────────────────
function handleLogin() {
  var errorEl = document.getElementById("modal-error");
  var err = validateModalFields();
  if (err) { errorEl.textContent = err; return; }
  var email    = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-password").value.trim();
  setModalLoading(true);
  errorEl.textContent = "";
  auth.signInWithEmailAndPassword(email, password)
    .then(function(cred) {
      state.currentUser = cred.user;
      return saveProfileToDb();
    })
    .then(function(result) {
      setModalLoading(false);
      refreshLoginStatus();
      if (result && !result.ok) {
        updateSaveButton("unsaved");
        errorEl.textContent = "Signed in, but profile cloud-save was blocked. Check your Firebase Database rules.";
      } else {
        state.savedSnapshots[activeProfileKey || "default"] = stableJSON(state.answers);
        updateSaveButton("saved");
        closeLoginModal();
      }
    })
    .catch(function(e) {
      setModalLoading(false);
      errorEl.textContent = friendlyAuthError(e.code);
    });
}

// ── handleSignUp ─────────────────────────────────────────────
function handleSignUp() {
  var errorEl = document.getElementById("modal-error");
  var err = validateModalFields();
  if (err) { errorEl.textContent = err; return; }
  var email    = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-password").value.trim();
  setModalLoading(true);
  errorEl.textContent = "";
  auth.createUserWithEmailAndPassword(email, password)
    .then(function(cred) {
      state.currentUser = cred.user;
      return saveProfileToDb();
    })
    .then(function(result) {
      setModalLoading(false);
      refreshLoginStatus();
      if (result && !result.ok) {
        updateSaveButton("unsaved");
        errorEl.textContent = "Account created, but profile cloud-save was blocked. Check your Firebase Database rules.";
      } else {
        state.savedSnapshots[activeProfileKey || "default"] = stableJSON(state.answers);
        updateSaveButton("saved");
        closeLoginModal();
      }
    })
    .catch(function(e) {
      setModalLoading(false);
      errorEl.textContent = friendlyAuthError(e.code);
    });
}

// ── handleLogout ─────────────────────────────────────────────
function handleLogout() {
  auth.signOut().then(function() {
    state.currentUser = null;
    state.answers = { sensitivities: ["None"] };
    state.currentQuestion = 0;
    state.savedSnapshots = {};
    clearSession();
    refreshLoginStatus();
    updateSaveButton("unsaved");
    showScreen("landing");
  });
}

// ── handleSaveProfile ────────────────────────────────────────
function handleSaveProfile() {
  var user = state.currentUser;
  if (!user) { openLoginModal(); return; }
  var btn = document.getElementById("btn-save-profile");
  if (btn) { btn.disabled = true; btn.innerHTML = "Saving&hellip;"; btn.className = "btn-save"; }
  saveProfileToDb(activeProfileKey)
    .then(function(result) {
      if (result && result.ok) {
        state.savedSnapshots[activeProfileKey || "default"] = stableJSON(state.answers);
        updateSaveButton("saved");
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = "Save profile"; btn.className = "btn-save"; }
        alert("Profile save was blocked. Check your Firebase Realtime Database rules.");
      }
    });
}

function updateSaveButton(state_) {
  var btn = document.getElementById("btn-save-profile");
  if (!btn) return;
  if (state_ === "saved") {
    btn.innerHTML = "&#10003;&nbsp; Profile saved";
    btn.disabled = true;
    btn.className = "btn-save saved";
    btn.onclick = null;
  } else if (state_ === "dirty") {
    btn.innerHTML = "&#9888;&nbsp; Save changes";
    btn.disabled = false;
    btn.className = "btn-save unsaved-changes";
    btn.onclick = handleSaveProfile;
  } else {
    btn.innerHTML = "Save profile";
    btn.disabled = false;
    btn.className = "btn-save";
    btn.onclick = handleSaveProfile;
  }
}

function markProfileDirty() {
  var btn = document.getElementById("btn-save-profile");
  if (btn) btn.style.visibility = "visible";
  resolveSaveButton();
}

// Close modals on backdrop click
document.getElementById("login-modal").addEventListener("click", function(e) { if (e.target === this) closeLoginModal(); });
document.getElementById("account-modal").addEventListener("click", function(e) { if (e.target === this) closeAccountModal(); });
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") { closeLoginModal(); closeAccountModal(); }
});

// ============================================================
//  USER PROFILE
// ============================================================
function buildUserProfile() {
  return {
    commuteType:        state.answers.commuteType        || "",
    thermalSensitivity: state.answers.thermalSensitivity || "",
    maintenancePref:    state.answers.maintenancePref    || "",
    outingPurpose:      state.answers.outingPurpose      || "",
    sensitivities:      state.answers.sensitivities      || ["None"]
  };
}

// ============================================================
//  RULE TABLES
// ============================================================
var COMMUTE_TAGS = {
  Bus:            ["layering-friendly","easy-remove","breathable"],
  Subway:         ["layering-friendly","easy-remove","breathable"],
  WalkingCycling: ["breathable","moisture-wicking","stretch","weather-resistant"],
  Car:            ["comfortable","low-friction","easy-care"],
  WorkFromHome:   ["soft","low-friction","relaxed-fit"]
};
var THERMAL_TAGS = {
  EasilyWarm: { prioritize: ["breathable","lightweight","moisture-wicking"], avoid: ["insulated"] },
  EasilyCold: { prioritize: ["insulated","layering-friendly","warm"],        avoid: [] },
  InBetween:  { prioritize: ["balanced","layering-friendly"],                avoid: [] }
};
var MAINTENANCE_TAGS = {
  LowMaintenance: { prioritize: ["easy-care","machine-wash","wrinkle-resistant"], exclude: ["dry-clean-only","delicate-care"] },
  RegularCareOK:  { prioritize: [], exclude: [] }
};
var SENSITIVITY_EXCLUSIONS = {
  Wool:           { tags: ["wool"],                          fibers: ["wool","cashmere"] },
  SyntheticFibers:{ tags: ["polyester-heavy","nylon-heavy"], fibers: [] },
  LatexElastic:   { tags: ["latex","tight-elastic"],         fibers: [] },
  RoughTextured:  { tags: ["textured","coarse","rough"],     fibers: [] }
};
var PURPOSE_TAGS = {
  Work:          ["structured","polished","layering-friendly"],
  SchoolStudy:   ["comfortable","long-wear","easy-care"],
  LeisureSocial: ["breathable","soft","flexible"],
  MixedUse:      ["versatile","layering-friendly"]
};
var MATCH_THRESHOLD = 2;
var MAX_RESULTS     = 50; // show all matches, filtered by category tab

function dedupe(arr) { return arr.filter(function(v,i) { return arr.indexOf(v) === i; }); }
function buildRules(profile) {
  var p = [], avoid = [], excT = [], excF = [];
  if (COMMUTE_TAGS[profile.commuteType]) p = p.concat(COMMUTE_TAGS[profile.commuteType]);
  if (THERMAL_TAGS[profile.thermalSensitivity]) {
    var t = THERMAL_TAGS[profile.thermalSensitivity];
    p = p.concat(t.prioritize); avoid = avoid.concat(t.avoid);
  }
  if (MAINTENANCE_TAGS[profile.maintenancePref]) {
    var m = MAINTENANCE_TAGS[profile.maintenancePref];
    p = p.concat(m.prioritize); excT = excT.concat(m.exclude);
  }
  if (!profile.sensitivities.includes("None")) {
    profile.sensitivities.forEach(function(s) {
      if (SENSITIVITY_EXCLUSIONS[s]) {
        excT = excT.concat(SENSITIVITY_EXCLUSIONS[s].tags);
        excF = excF.concat(SENSITIVITY_EXCLUSIONS[s].fibers);
      }
    });
  }
  if (PURPOSE_TAGS[profile.outingPurpose]) p = p.concat(PURPOSE_TAGS[profile.outingPurpose]);
  return { priorityTags: dedupe(p), avoidTags: dedupe(avoid), excludeTags: dedupe(excT), excludeFibers: dedupe(excF) };
}
function scoreAndFilter(catalog, rules) {
  var results = [];
  catalog.forEach(function(item) {
    if (rules.excludeTags.some(function(t)   { return item.tags.includes(t); }))         return;
    if (rules.excludeFibers.some(function(f) { return item.fiberContent.includes(f); })) return;
    if (rules.avoidTags.some(function(t)     { return item.tags.includes(t); }))         return;
    var matched = item.tags.filter(function(t) { return rules.priorityTags.includes(t); });
    if (matched.length < MATCH_THRESHOLD) return;
    results.push({ item: item, matchedTags: matched, score: matched.length });
  });
  results.sort(function(a, b) { return b.score - a.score; });
  return results.slice(0, MAX_RESULTS);
}

// ============================================================
//  FORMAT HELPERS
// ============================================================
function fmtCommute(v) { return { Car:"Car", Bus:"Bus", Subway:"Subway", WalkingCycling:"Walking/Cycling", WorkFromHome:"Work from Home" }[v] || v || "—"; }
function fmtThermal(v) { return { EasilyCold:"Runs cold", EasilyWarm:"Runs warm", InBetween:"In between" }[v] || v || "—"; }
function fmtPurpose(v) { return { Work:"Work", SchoolStudy:"School / Study", LeisureSocial:"Leisure & Social", MixedUse:"Mixed use" }[v] || v || "—"; }

// ============================================================
//  WHY THIS FITS
// ============================================================
function buildWhy(result, profile) {
  var tags = result.item.tags || [];
  var sentences = [];

  // Commute reasons
  var commuteReasons = {
    WalkingCycling: function() {
      if (tags.includes("moisture-wicking") && tags.includes("breathable")) return "Handles sweat and airflow well — ideal for walking or cycling to your destination.";
      if (tags.includes("weather-resistant")) return "Stands up to the elements on an outdoor commute.";
      if (tags.includes("stretch")) return "Moves freely with you on an active commute.";
      if (tags.includes("breathable")) return "Keeps you comfortable during an active journey on foot or bike.";
      return null;
    },
    Bus: function() {
      if (tags.includes("layering-friendly") && tags.includes("easy-remove")) return "Easy to layer and peel off as temperatures shift from outdoors to a packed bus.";
      if (tags.includes("layering-friendly")) return "Layers well for the changing conditions of a bus commute.";
      if (tags.includes("wrinkle-resistant")) return "Arrives looking fresh even after a long sit on the bus.";
      return null;
    },
    Subway: function() {
      if (tags.includes("layering-friendly") && tags.includes("easy-remove")) return "Easy to add or shed layers as the subway goes from freezing platforms to stuffy carriages.";
      if (tags.includes("breathable")) return "Helps you stay comfortable in a warm, crowded subway car.";
      if (tags.includes("wrinkle-resistant")) return "Stays presentable through a cramped underground commute.";
      return null;
    },
    Car: function() {
      if (tags.includes("low-friction") || tags.includes("comfortable")) return "Comfortable for sitting in a car — no stiff seams or restrictive cuts.";
      if (tags.includes("wrinkle-resistant")) return "Keeps its shape through a long drive, so you step out looking sharp.";
      return null;
    },
    WorkFromHome: function() {
      if (tags.includes("soft") && tags.includes("comfortable")) return "Soft and relaxed enough to wear at home all day without feeling sloppy.";
      if (tags.includes("relaxed-fit")) return "A relaxed fit that keeps you comfortable through long hours at your desk.";
      if (tags.includes("polished")) return "Polished enough for video calls while staying comfortable at home.";
      return null;
    }
  };

  var commuteMsg = commuteReasons[profile.commuteType] ? commuteReasons[profile.commuteType]() : null;
  if (commuteMsg) sentences.push(commuteMsg);

  // Thermal reasons
  var thermalReasons = {
    EasilyWarm: function() {
      if (tags.includes("moisture-wicking") && tags.includes("breathable")) return "The breathable, moisture-wicking fabric keeps you cool even when you tend to overheat.";
      if (tags.includes("lightweight") && tags.includes("breathable")) return "Lightweight and airy — a good pick for someone who runs warm.";
      if (tags.includes("breathable")) return "Breathable construction helps prevent overheating.";
      return null;
    },
    EasilyCold: function() {
      if (tags.includes("insulated") && tags.includes("warm")) return "Well-insulated to keep you properly warm throughout the day.";
      if (tags.includes("layering-friendly") && tags.includes("warm")) return "Works as a warm base or mid-layer for someone who feels the cold easily.";
      if (tags.includes("warm")) return "Offers genuine warmth for someone who tends to run cold.";
      return null;
    },
    InBetween: function() {
      if (tags.includes("layering-friendly") && tags.includes("balanced")) return "Versatile layering piece — easy to adjust as the temperature shifts throughout the day.";
      if (tags.includes("balanced")) return "Well-balanced for someone whose temperature comfort sits in the middle.";
      if (tags.includes("layering-friendly")) return "Layers easily so you can adapt as conditions change.";
      return null;
    }
  };

  var thermalMsg = thermalReasons[profile.thermalSensitivity] ? thermalReasons[profile.thermalSensitivity]() : null;
  if (thermalMsg) sentences.push(thermalMsg);

  // Maintenance reasons
  if (profile.maintenancePref === "LowMaintenance") {
    if (tags.includes("machine-wash") && tags.includes("wrinkle-resistant")) sentences.push("Machine washable and wrinkle-resistant — zero fuss after a long day.");
    else if (tags.includes("machine-wash") && tags.includes("easy-care")) sentences.push("Fully machine washable and easy to care for — no special treatment needed.");
    else if (tags.includes("machine-wash")) sentences.push("Machine washable, which suits your preference for low-effort clothing care.");
  } else if (profile.maintenancePref === "RegularCareOK") {
    if (tags.includes("delicate-care") || tags.includes("dry-clean-only")) sentences.push("Requires a bit of extra care, but the quality and feel make it worthwhile.");
  }

  // Purpose reasons
  var purposeReasons = {
    Work: function() {
      if (tags.includes("structured") && tags.includes("polished")) return "Structured and polished — exactly what you need for a professional setting.";
      if (tags.includes("wrinkle-resistant") && tags.includes("polished")) return "Stays sharp and presentable through a full day at the office.";
      if (tags.includes("polished")) return "Has the polished look expected in a professional environment.";
      return null;
    },
    SchoolStudy: function() {
      if (tags.includes("comfortable") && tags.includes("long-wear")) return "Comfortable enough to sit in for long lectures or study sessions without fidgeting.";
      if (tags.includes("easy-care") && tags.includes("comfortable")) return "Practical and comfortable — suited to busy days on campus.";
      if (tags.includes("comfortable")) return "Comfortable for long hours of studying or attending class.";
      return null;
    },
    LeisureSocial: function() {
      if (tags.includes("soft") && tags.includes("flexible")) return "Soft and flexible — moves with you whether you're out with friends or just relaxing.";
      if (tags.includes("versatile") && tags.includes("comfortable")) return "Casual enough for leisure, and versatile enough to wear almost anywhere.";
      if (tags.includes("breathable") && tags.includes("comfortable")) return "Light and breathable for leisure outings and social occasions.";
      return null;
    },
    MixedUse: function() {
      if (tags.includes("versatile") && tags.includes("polished")) return "Versatile enough to take you from a work setting to a casual outing without changing.";
      if (tags.includes("versatile")) return "A versatile pick that adapts across different settings in your day.";
      if (tags.includes("balanced")) return "Well-balanced for a lifestyle that mixes different contexts throughout the week.";
      return null;
    }
  };

  var purposeMsg = purposeReasons[profile.outingPurpose] ? purposeReasons[profile.outingPurpose]() : null;
  if (purposeMsg) sentences.push(purposeMsg);

  // Sensitivity note
  var sens = profile.sensitivities || ["None"];
  if (!sens.includes("None")) {
    var safe = !sens.some(function(s) {
      var ex = SENSITIVITY_EXCLUSIONS[s];
      return ex && (ex.tags.some(function(t) { return tags.includes(t); }));
    });
    if (safe) sentences.push("Contains no materials that conflict with your sensitivities.");
  }

  // Fallback
  if (!sentences.length) sentences.push("A well-rounded match for your overall lifestyle and preferences.");

  return sentences.join(" ");
}

// ============================================================
//  SHOPPING LINK (Google Shopping only)
// ============================================================
function buildShoppingLink(item) {
  var parts = [item.name].concat((item.fiberContent || []).slice(0, 2));
  return "https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(parts.join(" "));
}

// ============================================================
//  CLOTHING CATEGORY CLASSIFIER
// ============================================================
var CATEGORY_RULES = [
  { cat: "Tops",      keywords: ["tee","shirt","blouse","polo","tank","henley","turtleneck","hoodie","breton"] },
  { cat: "Bottoms",   keywords: ["chino","trouser","jogger","jean","shorts","culotte","skirt","tights","pants"] },
  { cat: "Dresses",   keywords: ["dress"] },
  { cat: "Outerwear", keywords: ["jacket","coat","parka","blazer","windbreaker","vest","cardigan","sweater","fleece","zip-up","base layer"] },
  { cat: "Footwear",  keywords: ["sneaker","boot","shoe","derby"] }
];

function getItemCategory(item) {
  var name = item.name.toLowerCase();
  for (var i = 0; i < CATEGORY_RULES.length; i++) {
    var rule = CATEGORY_RULES[i];
    for (var j = 0; j < rule.keywords.length; j++) {
      if (name.indexOf(rule.keywords[j]) !== -1) return rule.cat;
    }
  }
  return "Other";
}

// ============================================================
//  FILTER BAR
// ============================================================
var activeCategory = "All";
var lastResults    = [];
var lastProfile    = null;

function getFilteredResults(cat) {
  if (cat === "All") return lastResults;
  return lastResults.filter(function(r) { return getItemCategory(r.item) === cat; });
}

function renderFilterBar(results) {
  var tabs = [{ cat: "All", icon: "", count: results.length }];
  CATEGORY_RULES.forEach(function(rule) {
    var count = results.filter(function(r) { return getItemCategory(r.item) === rule.cat; }).length;
    if (count > 0) tabs.push({ cat: rule.cat, icon: rule.icon, count: count });
  });
  if (tabs.length <= 1) return "";
  var html = '<div class="filter-bar">';
  tabs.forEach(function(tab) {
    var isActive = activeCategory === tab.cat;
    html += '<button class="filter-chip' + (isActive ? " active" : "") +
      '" onclick="filterBy(\'' + tab.cat + '\')">' +
      '<span class="filter-chip-label">' + tab.cat + '</span>' +
      '<span class="filter-chip-count">' + tab.count + '</span>' +
      '</button>';
  });
  return html + '</div>';
}

function filterBy(cat) {
  activeCategory = cat;
  var profile = buildUserProfile();
  var toShow  = getFilteredResults(cat);
  document.getElementById("recs-feed").innerHTML =
    renderFilterBar(lastResults) +
    '<div class="recs-grid">' + toShow.map(function(r, i) { return renderRecCard(r, profile, i); }).join("") + '</div>';
}

// ============================================================
//  INLINE-EDITABLE PROFILE CARD
// ============================================================
var editingField = null;

var PROFILE_ROWS = [
  { label: "Commute",      field: "commuteType",         fmt: fmtCommute },
  { label: "Temperature",  field: "thermalSensitivity",  fmt: fmtThermal },
  { label: "Maintenance",  field: "maintenancePref",     fmt: function(v) { return v === "LowMaintenance" ? "Low maintenance" : v === "RegularCareOK" ? "Regular care OK" : "\u2014"; } },
  { label: "Purpose",      field: "outingPurpose",       fmt: fmtPurpose },
  { label: "Sensitivities",field: "sensitivities",       fmt: function(v) { if (!v || (Array.isArray(v) && v.includes("None"))) return "None"; return Array.isArray(v) ? v.join(", ") : v; } }
];

function renderProfileCard(profile) {
  var html = '<div class="profile-title">Your Style Profile</div><div class="profile-rows">';
  PROFILE_ROWS.forEach(function(row) {
    var qDef   = QUESTIONS.find(function(q) { return q.field === row.field; });
    var isOpen = editingField === row.field;
    var rawVal = state.answers[row.field];
    var display = row.fmt(rawVal) || "\u2014";
    html += '<div class="profile-row-item' + (isOpen ? " editing" : "") + '">';
    html += '<div class="profile-row-header" onclick="toggleEditField(\'' + row.field + '\')">' +
      '<div><div class="profile-row-label">' + row.label + '</div><div class="profile-row-value">' + display + '</div></div>' +
      '<span class="profile-edit-icon">' + (isOpen ? '&#9650;' : '&#x270E;') + '</span>' +
      '</div>';
    if (isOpen && qDef) {
      html += '<div class="profile-row-picker">';
      if (qDef.type === 'single') {
        qDef.options.forEach(function(opt) {
          var sel = state.answers[row.field] === opt.value;
          html += '<button class="picker-opt' + (sel ? ' selected' : '') + '" onclick="inlineSelectSingle(\'' + row.field + '\',\'' + opt.value + '\')">' +
            '<span>' + opt.label + '</span>' +
            (sel ? '<span class="picker-check">&#x2713;</span>' : '') + '</button>';
        });
      } else {
        var cur = state.answers[row.field] || ["None"];
        qDef.options.forEach(function(opt) {
          var sel = cur.includes(opt.value);
          html += '<button class="picker-opt' + (sel ? ' selected' : '') + '" onclick="inlineToggleMulti(\'' + row.field + '\',\'' + opt.value + '\')">' +
            '<span>' + opt.label + '</span>' +
            (sel ? '<span class="picker-check">&#x2713;</span>' : '') + '</button>';
        });
        html += '<button class="picker-done" onclick="closeEditField()">Done &#x2713;</button>';
      }
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  document.getElementById("profile-card").innerHTML = html;
}

function toggleEditField(field) { editingField = editingField === field ? null : field; renderProfileCard(buildUserProfile()); }
function closeEditField()       { editingField = null; renderProfileCard(buildUserProfile()); }
function inlineSelectSingle(field, value) {
  state.answers[field] = value;
  editingField = null;
  renderProfileCard(buildUserProfile());
  refreshRecs();
  markProfileDirty();
  saveSession();
}
function inlineToggleMulti(field, value) {
  var cur = state.answers[field] ? state.answers[field].slice() : ["None"];
  if (value === "None") { cur = ["None"]; }
  else {
    cur = cur.filter(function(v) { return v !== "None"; });
    var i = cur.indexOf(value);
    if (i >= 0) cur.splice(i, 1); else cur.push(value);
    if (cur.length === 0) cur = ["None"];
  }
  state.answers[field] = cur;
  renderProfileCard(buildUserProfile());
  refreshRecs();
  markProfileDirty();
  saveSession();
}

function refreshRecs() {
  var profile = buildUserProfile();
  var rules   = buildRules(profile);
  lastResults = scoreAndFilter(state.catalog, rules);
  lastProfile = profile;
  activeCategory = "All";
  var count = document.getElementById("recs-count");
  if (!lastResults.length) {
    count.textContent = "0 matches";
    document.getElementById("recs-feed").innerHTML =
      '<div class="no-results"><div class="no-results-icon">&#x25CB;</div><p>No items matched your filters.<br>Try editing your answers to broaden results.</p></div>';
    return;
  }
  count.textContent = lastResults.length + (lastResults.length === 1 ? " match" : " matches");
  document.getElementById("recs-feed").innerHTML =
    renderFilterBar(lastResults) +
    '<div class="recs-grid">' + lastResults.map(function(r, i) { return renderRecCard(r, profile, i); }).join("") + '</div>';
}

// ============================================================
//  REC CARD  (shopping link only, no web-search button)
// ============================================================
function renderRecCard(result, profile, index) {
  var item   = result.item;
  var cardId = "card-" + item.id;
  var why    = buildWhy(result, profile);
  var shopUrl = buildShoppingLink(item);
  var imgs   = (item.images && item.images.length) ? item.images : ["images/" + item.id + "-1.jpg", "images/" + item.id + "-2.jpg"];

  var slides = imgs.map(function(src, i) {
    return '<img class="carousel-slide' + (i === 0 ? " active" : "") + '" src="' + src + '" alt="' + item.name + '" loading="lazy">';
  }).join("");

  var dots = imgs.length > 1
    ? '<div class="carousel-dots">' + imgs.map(function(_, i) {
        return '<span class="carousel-dot' + (i === 0 ? " active" : "") + '" onclick="carouselGo(\'' + cardId + '\',' + i + ')"></span>';
      }).join("") + '</div>' : "";

  var arrows = imgs.length > 1
    ? '<button class="carousel-arrow prev" onclick="carouselStep(\'' + cardId + '\',-1)">&#8249;</button>' +
      '<button class="carousel-arrow next" onclick="carouselStep(\'' + cardId + '\',1)">&#8250;</button>' : "";

  var catLabel = getItemCategory(item);
  var catRule  = CATEGORY_RULES.find(function(r) { return r.cat === catLabel; });
  var catIcon  = catRule ? catRule.icon : "";

  var tags = item.tags.slice().sort().map(function(tag) {
    return '<span class="rec-tag' + (result.matchedTags.includes(tag) ? " match" : "") + '">' + tag + '</span>';
  }).join("");

  return '<div class="rec-card" id="' + cardId + '" data-img-index="0" style="animation-delay:' + (index * 30) + 'ms">' +
    '<div class="rec-name">' +
      '<span class="rec-cat-badge">' + catLabel + '</span>' +
      item.name +
    '</div>' +
    '<div class="rec-img-wrap">' + slides + arrows + '<span class="score-badge">' + result.score + ' match</span>' + dots + '</div>' +
    '<div class="rec-body">' +
      '<div class="rec-desc">' + item.description + '</div>' +
      '<div class="why-box"><div class="why-label">Why this fits</div><div class="why-text">' + why + '</div></div>' +
      '<a class="search-btn search-btn--shop" href="' + shopUrl + '" target="_blank" rel="noopener">Shop on Google</a>' +
      '<div class="rec-tags">' + tags + '</div>' +
    '</div></div>';
}

// ============================================================
//  CAROUSEL
// ============================================================
function carouselGo(cardId, target) {
  var card   = document.getElementById(cardId);
  var slides = card.querySelectorAll(".carousel-slide");
  var dots   = card.querySelectorAll(".carousel-dot");
  var cur    = parseInt(card.getAttribute("data-img-index"), 10);
  var next   = ((target % slides.length) + slides.length) % slides.length;
  slides[cur].classList.remove("active");
  if (dots[cur]) dots[cur].classList.remove("active");
  slides[next].classList.add("active");
  if (dots[next]) dots[next].classList.add("active");
  card.setAttribute("data-img-index", next);
}
function carouselStep(cardId, dir) {
  carouselGo(cardId, parseInt(document.getElementById(cardId).getAttribute("data-img-index"), 10) + dir);
}

// ============================================================
//  SHOW RESULTS
// ============================================================
function showResults() {
  showScreen("results");
  editingField = null;
  activeCategory = "All";

  var profile = buildUserProfile();
  var rules   = buildRules(profile);
  lastResults = scoreAndFilter(state.catalog, rules);
  lastProfile = profile;

  renderProfileCard(profile);
  refreshLoginStatus();
  resolveSaveButton();

  var feed  = document.getElementById("recs-feed");
  var count = document.getElementById("recs-count");
  if (!lastResults.length) {
    count.textContent = "0 matches";
    feed.innerHTML = '<div class="no-results"><div class="no-results-icon">&#x25CB;</div><p>No items matched your filters.<br>Try editing your answers to broaden results.</p></div>';
    return;
  }
  count.textContent = lastResults.length + (lastResults.length === 1 ? " match" : " matches");
  feed.innerHTML = renderFilterBar(lastResults) +
    '<div class="recs-grid">' + lastResults.map(function(r, i) { return renderRecCard(r, profile, i); }).join("") + '</div>';
}
