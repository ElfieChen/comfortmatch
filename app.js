// ═══════════════════════════════════════════════════
//  QUESTIONS
// ═══════════════════════════════════════════════════
var QUESTIONS = [
  {
    id: 0, field: "ageRange", optional: true,
    label: "How old are you?",
    hint: "Optional — your age won't affect recommendations.",
    type: "single",
    options: [
      { value: "18-24",        label: "18–24",              icon: "🎓" },
      { value: "25-34",        label: "25–34",              icon: "💼" },
      { value: "35-44",        label: "35–44",              icon: "🌿" },
      { value: "45+",          label: "45+",                icon: "✨" },
      { value: "PreferNotSay", label: "Prefer not to say",  icon: "🔒" }
    ]
  },
  {
    id: 1, field: "gender", optional: true,
    label: "How do you identify?",
    hint: "Optional — used only for profile display.",
    type: "single",
    options: [
      { value: "Female",       label: "Female",             icon: "♀" },
      { value: "Male",         label: "Male",               icon: "♂" },
      { value: "Other",        label: "Other / Non-binary", icon: "⚧" },
      { value: "PreferNotSay", label: "Prefer not to say",  icon: "🔒" }
    ]
  },
  {
    id: 2, field: "commuteType", optional: false,
    label: "How do you usually commute?",
    hint: "This shapes which functional features we prioritise.",
    type: "single",
    options: [
      { value: "Car",            label: "Car",                icon: "🚗" },
      { value: "Bus",            label: "Bus",                icon: "🚌" },
      { value: "Subway",         label: "Subway / Metro",     icon: "🚇" },
      { value: "WalkingCycling", label: "Walking or Cycling", icon: "🚴" },
      { value: "WorkFromHome",   label: "Work from Home",     icon: "🏠" }
    ]
  },
  {
    id: 3, field: "thermalSensitivity", optional: false,
    label: "How do you feel about temperature?",
    hint: "This affects insulation and breathability choices.",
    type: "single",
    options: [
      { value: "EasilyCold", label: "I get cold easily",    icon: "🥶" },
      { value: "EasilyWarm", label: "I get warm easily",    icon: "🥵" },
      { value: "InBetween",  label: "Somewhere in between", icon: "😌" }
    ]
  },
  {
    id: 4, field: "maintenancePref", optional: false,
    label: "How much effort do you put into clothing care?",
    hint: "This determines whether delicate items appear in your results.",
    type: "single",
    options: [
      { value: "LowMaintenance", label: "Keep it easy — machine wash everything", icon: "🫧" },
      { value: "RegularCareOK",  label: "Fine with hand-washing or dry cleaning", icon: "👌" }
    ]
  },
  {
    id: 5, field: "outingPurpose", optional: false,
    label: "What do you mainly wear these clothes for?",
    hint: "This steers the style and structure of recommendations.",
    type: "single",
    options: [
      { value: "Work",          label: "Work / Professional",        icon: "💼" },
      { value: "SchoolStudy",   label: "School or Studying",         icon: "📚" },
      { value: "LeisureSocial", label: "Leisure & Social",           icon: "🎉" },
      { value: "MixedUse",      label: "Mixed — a bit of everything", icon: "🔀" }
    ]
  },
  {
    id: 6, field: "sensitivities", optional: true,
    label: "Any material sensitivities?",
    hint: "Select all that apply. Items with these materials will be excluded.",
    type: "multi",
    options: [
      { value: "None",            label: "None",             icon: "✅" },
      { value: "Wool",            label: "Wool",             icon: "🐑" },
      { value: "SyntheticFibers", label: "Synthetic Fibers", icon: "🧪" },
      { value: "LatexElastic",    label: "Latex / Elastic",  icon: "🩺" },
      { value: "RoughTextured",   label: "Rough Textures",   icon: "📦" }
    ]
  }
];

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
var state = {
  currentQuestion: 0,
  answers: { ageRange: "PreferNotSay", gender: "PreferNotSay", sensitivities: ["None"] },
  catalog: []
};

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
fetch("catalog.json")
  .then(function(r) { return r.json(); })
  .then(function(data) {
    state.catalog = data;
    showScreen("quiz");
    renderQuestion(0);
  })
  .catch(function() {
    document.getElementById("screen-quiz").innerHTML =
      '<div style="text-align:center;padding:80px 20px;color:#8a8278">' +
      '<div style="font-size:32px;margin-bottom:14px">⚠️</div>' +
      '<p style="font-size:14px">Could not load catalog.json.<br>Make sure all files are in the same folder.</p></div>';
    showScreen("quiz");
  });

// ═══════════════════════════════════════════════════
//  SCREEN SWITCHING
// ═══════════════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(function(el) { el.classList.remove("active"); });
  document.getElementById("screen-" + name).classList.add("active");
  document.getElementById("header-label").textContent = name === "results" ? "Your recommendations" : "";
}

// ═══════════════════════════════════════════════════
//  QUIZ RENDERING
// ═══════════════════════════════════════════════════
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
      optHTML += '<button class="option-btn' + (sel ? " selected" : "") + '" onclick="selectSingle(\'' + q.field + '\',\'' + opt.value + '\')">' +
        '<span class="opt-icon">' + opt.icon + '</span><span>' + opt.label + '</span><span class="opt-dot"></span></button>';
    });
    optHTML += '</div>';
  } else {
    var cur = state.answers[q.field] || ["None"];
    optHTML = '<div class="options-chips">';
    q.options.forEach(function(opt) {
      var sel = cur.includes(opt.value);
      optHTML += '<button class="chip-btn' + (sel ? " selected" : "") + '" onclick="toggleMulti(\'' + q.field + '\',\'' + opt.value + '\')">' +
        '<span>' + opt.icon + '</span><span>' + opt.label + '</span></button>';
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
      '<button class="btn-back" onclick="goBack()" ' + (index === 0 ? "disabled" : "") + '>← Back</button>' +
      '<button class="btn-next" onclick="goNext()" ' + (canGo ? "" : "disabled") + '>' + (isLast ? "See my recommendations →" : "Next →") + '</button>' +
    '</div>';

  var card = document.getElementById("question-card");
  card.style.animation = "none";
  void card.offsetHeight;
  card.style.animation = "";
}

function hasAnswer(field) {
  var v = state.answers[field];
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
}

function selectSingle(field, value) {
  state.answers[field] = value;
  renderQuestion(state.currentQuestion);
}

function toggleMulti(field, value) {
  var cur = state.answers[field] ? state.answers[field].slice() : ["None"];
  if (value === "None") {
    cur = ["None"];
  } else {
    cur = cur.filter(function(v) { return v !== "None"; });
    var i = cur.indexOf(value);
    if (i >= 0) cur.splice(i, 1); else cur.push(value);
    if (cur.length === 0) cur = ["None"];
  }
  state.answers[field] = cur;
  renderQuestion(state.currentQuestion);
}

function goNext() {
  var q = QUESTIONS[state.currentQuestion];
  if (!q.optional && !hasAnswer(q.field)) return;
  if (state.currentQuestion < QUESTIONS.length - 1) renderQuestion(state.currentQuestion + 1);
  else showResults();
}

function goBack() {
  if (state.currentQuestion > 0) renderQuestion(state.currentQuestion - 1);
}

function editAnswers() {
  showScreen("quiz");
  renderQuestion(0);
}

// ═══════════════════════════════════════════════════
//  USER PROFILE
// ═══════════════════════════════════════════════════
function buildUserProfile() {
  return {
    ageRange:           state.answers.ageRange           || "PreferNotSay",
    gender:             state.answers.gender             || "PreferNotSay",
    commuteType:        state.answers.commuteType        || "",
    thermalSensitivity: state.answers.thermalSensitivity || "",
    maintenancePref:    state.answers.maintenancePref    || "",
    outingPurpose:      state.answers.outingPurpose      || "",
    sensitivities:      state.answers.sensitivities      || ["None"]
  };
}

// ═══════════════════════════════════════════════════
//  RULE TABLES
// ═══════════════════════════════════════════════════
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
var MAX_RESULTS     = 15;

// ═══════════════════════════════════════════════════
//  RULE ENGINE
// ═══════════════════════════════════════════════════
function dedupe(arr) { return arr.filter(function(v,i) { return arr.indexOf(v) === i; }); }

function buildRules(profile) {
  var p = [], avoid = [], excT = [], excF = [];
  if (COMMUTE_TAGS[profile.commuteType])    p = p.concat(COMMUTE_TAGS[profile.commuteType]);
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

// ═══════════════════════════════════════════════════
//  FORMAT HELPERS
// ═══════════════════════════════════════════════════
function fmtCommute(v) { return {Car:"car",Bus:"bus",Subway:"subway",WalkingCycling:"walking/cycling",WorkFromHome:"work-from-home"}[v]||v; }
function fmtThermal(v) { return {EasilyCold:"running cold",EasilyWarm:"running warm",InBetween:"moderate thermal"}[v]||v; }
function fmtPurpose(v) { return {Work:"work",SchoolStudy:"school/study",LeisureSocial:"leisure & social",MixedUse:"mixed-use"}[v]||v; }

// ═══════════════════════════════════════════════════
//  WHY THIS FITS
// ═══════════════════════════════════════════════════
function buildWhy(result, profile) {
  var top = result.matchedTags.slice(0, 3);
  var reasons = [];
  var ct = COMMUTE_TAGS[profile.commuteType] || [];
  if (top.some(function(t) { return ct.includes(t); })) reasons.push("your " + fmtCommute(profile.commuteType) + " commute");
  var tt = (THERMAL_TAGS[profile.thermalSensitivity] || {}).prioritize || [];
  if (top.some(function(t) { return tt.includes(t); })) reasons.push(fmtThermal(profile.thermalSensitivity));
  var mt = (MAINTENANCE_TAGS[profile.maintenancePref] || {}).prioritize || [];
  if (top.some(function(t) { return mt.includes(t); })) reasons.push(profile.maintenancePref === "LowMaintenance" ? "low-maintenance preference" : "flexibility with garment care");
  var pt = PURPOSE_TAGS[profile.outingPurpose] || [];
  if (top.some(function(t) { return pt.includes(t); })) reasons.push("your " + fmtPurpose(profile.outingPurpose) + " context");
  if (!reasons.length) reasons.push("your overall profile");
  var tagStr = top.map(function(t) { return "«" + t + "»"; }).join(", ");
  var reasonStr = reasons.length > 1 ? reasons.slice(0,-1).join(", ") + " and " + reasons[reasons.length-1] : reasons[0];
  return "Matched on " + tagStr + " — suited to " + reasonStr + ".";
}

// ═══════════════════════════════════════════════════
//  SEARCH LINKS
// ═══════════════════════════════════════════════════
function buildSearchLinks(item, matchedTags) {
  var parts = [item.name].concat((item.fiberContent||[]).slice(0,2)).concat((matchedTags||[]).slice(0,2));
  var q = encodeURIComponent(parts.join(" "));
  return { web: "https://www.google.com/search?q=" + q, shopping: "https://www.google.com/search?tbm=shop&q=" + q };
}

// ═══════════════════════════════════════════════════
//  PROFILE CARD
// ═══════════════════════════════════════════════════
function renderProfileCard(profile) {
  var sens = profile.sensitivities.includes("None")
    ? '<span class="pchip neutral">None</span>'
    : profile.sensitivities.map(function(s) { return '<span class="pchip">' + s + '</span>'; }).join("");
  var rows = [
    { label: "Age",           value: profile.ageRange === "PreferNotSay" ? "—" : profile.ageRange },
    { label: "Gender",        value: profile.gender   === "PreferNotSay" ? "—" : profile.gender },
    { label: "Commute",       value: fmtCommute(profile.commuteType) || "—" },
    { label: "Temperature",   value: fmtThermal(profile.thermalSensitivity) || "—" },
    { label: "Maintenance",   value: profile.maintenancePref === "LowMaintenance" ? "Low maintenance" : profile.maintenancePref === "RegularCareOK" ? "Regular care OK" : "—" },
    { label: "Purpose",       value: fmtPurpose(profile.outingPurpose) || "—" },
    { label: "Sensitivities", value: sens }
  ];
  document.getElementById("profile-card").innerHTML =
    '<div class="profile-title">Your Style Profile</div>' +
    '<div class="profile-rows">' +
    rows.map(function(r) {
      return '<div class="profile-row-item"><div class="profile-row-label">' + r.label + '</div><div class="profile-row-value">' + r.value + '</div></div>';
    }).join("") + '</div>';
}

// ═══════════════════════════════════════════════════
//  REC CARD
// ═══════════════════════════════════════════════════
function renderRecCard(result, profile, index) {
  var item   = result.item;
  var cardId = "card-" + item.id;
  var why    = buildWhy(result, profile);
  var links  = buildSearchLinks(item, result.matchedTags);
  var imgs   = (item.images && item.images.length) ? item.images : ["images/" + item.id + "-1.jpg","images/" + item.id + "-2.jpg"];

  var slides = imgs.map(function(src, i) {
    return '<img class="carousel-slide' + (i === 0 ? " active" : "") + '" src="' + src + '" alt="' + item.name + ' view ' + (i+1) + '" loading="lazy">';
  }).join("");

  var dots = imgs.length > 1
    ? '<div class="carousel-dots">' + imgs.map(function(_, i) {
        return '<span class="carousel-dot' + (i === 0 ? " active" : "") + '" onclick="carouselGo(\'' + cardId + '\',' + i + ')"></span>';
      }).join("") + '</div>' : "";

  var arrows = imgs.length > 1
    ? '<button class="carousel-arrow prev" onclick="carouselStep(\'' + cardId + '\',-1)">&#8249;</button>' +
      '<button class="carousel-arrow next" onclick="carouselStep(\'' + cardId + '\',1)">&#8250;</button>' : "";

  var tags = item.tags.slice().sort().map(function(tag) {
    return '<span class="rec-tag' + (result.matchedTags.includes(tag) ? " match" : "") + '">' + tag + '</span>';
  }).join("");

  return '<div class="rec-card" id="' + cardId + '" data-img-index="0" style="animation-delay:' + (index * 35) + 'ms">' +
    '<div class="rec-name">' + item.name + '</div>' +
    '<div class="rec-img-wrap">' + slides + arrows + '<span class="score-badge">' + result.score + ' tags</span>' + dots + '</div>' +
    '<div class="rec-body">' +
      '<div class="rec-desc">' + item.description + '</div>' +
      '<div class="why-box"><div class="why-label">Why this fits</div><div class="why-text">' + why + '</div></div>' +
      '<div class="search-links">' +
        '<a class="search-btn search-btn--web" href="' + links.web + '" target="_blank" rel="noopener">🔍 Search</a>' +
        '<a class="search-btn search-btn--shop" href="' + links.shopping + '" target="_blank" rel="noopener">🛍 Shop</a>' +
      '</div>' +
      '<div class="rec-tags">' + tags + '</div>' +
    '</div></div>';
}

// ═══════════════════════════════════════════════════
//  CAROUSEL
// ═══════════════════════════════════════════════════
function carouselGo(cardId, target) {
  var card = document.getElementById(cardId);
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
  var cur = parseInt(document.getElementById(cardId).getAttribute("data-img-index"), 10);
  carouselGo(cardId, cur + dir);
}

// ═══════════════════════════════════════════════════
//  SHOW RESULTS
// ═══════════════════════════════════════════════════
function showResults() {
  showScreen("results");
  var profile = buildUserProfile();
  var rules   = buildRules(profile);
  var results = scoreAndFilter(state.catalog, rules);
  renderProfileCard(profile);
  var feed  = document.getElementById("recs-feed");
  var count = document.getElementById("recs-count");
  if (!results.length) {
    count.textContent = "0 matches";
    feed.innerHTML = '<div class="no-results"><div class="icon">🔍</div><p>No items matched your filters.<br>Try editing your answers to broaden results.</p></div>';
    return;
  }
  count.textContent = results.length + (results.length === 1 ? " match" : " matches");
  feed.innerHTML = '<div class="recs-grid">' + results.map(function(r, i) { return renderRecCard(r, profile, i); }).join("") + '</div>';
}