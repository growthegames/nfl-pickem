// assets/admin.js

const supaAdmin = window.supabaseClient;

// 👇 Same commissioner emails you used in the RLS policies
const ADMIN_EMAILS = [
  "aowynn2@gmail.com",
  "wesflanagan@gmail.com",
];

const NFL_TEAMS = [
  "Arizona Cardinals",
  "Atlanta Falcons",
  "Baltimore Ravens",
  "Buffalo Bills",
  "Carolina Panthers",
  "Chicago Bears",
  "Cincinnati Bengals",
  "Cleveland Browns",
  "Dallas Cowboys",
  "Denver Broncos",
  "Detroit Lions",
  "Green Bay Packers",
  "Houston Texans",
  "Indianapolis Colts",
  "Jacksonville Jaguars",
  "Kansas City Chiefs",
  "Las Vegas Raiders",
  "Los Angeles Chargers",
  "Los Angeles Rams",
  "Miami Dolphins",
  "Minnesota Vikings",
  "New England Patriots",
  "New Orleans Saints",
  "New York Giants",
  "New York Jets",
  "Philadelphia Eagles",
  "Pittsburgh Steelers",
  "San Francisco 49ers",
  "Seattle Seahawks",
  "Tampa Bay Buccaneers",
  "Tennessee Titans",
  "Washington Commanders",
];

const adminSection = document.getElementById("admin-section");
const unauthorizedSection = document.getElementById("admin-unauthorized");
const adminNotice = document.getElementById("admin-notice");

const weekInput = document.getElementById("admin-week-select");
const loadWeekBtn = document.getElementById("admin-load-week-btn");
const teamsContainer = document.getElementById("admin-teams-container");
const saveBtn = document.getElementById("admin-save-btn");
const adminControls = document.getElementById("admin-controls");

const hsContainer = document.getElementById("admin-highscore-container");
const hsTeamSelect = document.getElementById("admin-hs-team");
const hsPointsInput = document.getElementById("admin-hs-points");

// Comments UI
const commentsControls = document.getElementById("comments-controls");
const commentsWeekInput = document.getElementById("comments-week-input");
const commentsLoadBtn = document.getElementById("comments-load-btn");
const commentsContainer = document.getElementById("comments-table-container");

let currentWeek = null;
// teamRows: { team, currentResult, count, rowEl, selectEl }
let teamRows = [];
// high score result for current week
let currentHighScore = { team: "", points: null };

function setAdminNotice(text, isError = false) {
  if (!adminNotice) return;
  adminNotice.textContent = text || "";
  adminNotice.className = "message " + (isError ? "error" : "success");
}

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

function populateHighScoreTeamSelect() {
  if (!hsTeamSelect) return;
  hsTeamSelect.innerHTML = "";

  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Select team (or leave blank)";
  hsTeamSelect.appendChild(emptyOpt);

  NFL_TEAMS.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = team;
    hsTeamSelect.appendChild(opt);
  });
}

// Build a row for a single team with win/loss controls
function createTeamRow(team, currentResult, count) {
  const tr = document.createElement("tr");

  const teamCell = document.createElement("td");
  teamCell.textContent = team;
  tr.appendChild(teamCell);

  const countCell = document.createElement("td");
  countCell.textContent = String(count);
  tr.appendChild(countCell);

  const statusCell = document.createElement("td");
  const select = document.createElement("select");
  select.dataset.team = team;

  const options = [
    { value: "", label: "Unchanged / Clear" },
    { value: "WIN", label: "Win" },
    { value: "LOSS", label: "Loss" },
  ];

  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === currentResult) {
      o.selected = true;
    }
    select.appendChild(o);
  });

  statusCell.appendChild(select);
  tr.appendChild(statusCell);

  return { team, currentResult, count, rowEl: tr, selectEl: select };
}

// Load distinct teams and their current survivor result for a given week
async function loadWeekTeams(week) {
  teamsContainer.innerHTML = "";
  saveBtn.style.display = "none";
  teamRows = [];

  const { data, error } = await supaAdmin
    .from("picks")
    .select("survivor_team, result")
    .eq("week", week);

  if (error) {
    console.error(error);
    setAdminNotice("Error loading teams for that week.", true);
    return;
  }

  if (!data || !data.length) {
    const p = document.createElement("p");
    p.textContent = "No picks found for this week yet.";
    teamsContainer.appendChild(p);
    return;
  }

  const teamMap = new Map();

  data.forEach((row) => {
    const team = row.survivor_team;
    const res = row.result || "";
    if (!team) return;

    if (!teamMap.has(team)) {
      teamMap.set(team, { result: res, count: 1 });
    } else {
      const current = teamMap.get(team);
      current.count += 1;
      if (current.result !== res) {
        current.result = "";
      }
      teamMap.set(team, current);
    }
  });

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["NFL Team", "# Entries", "Survivor Result"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  Array.from(teamMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([team, info]) => {
      const { result, count } = info;
      const row = createTeamRow(team, result, count);
      teamRows.push(row);
      tbody.appendChild(row.rowEl);
    });

  table.appendChild(tbody);
  teamsContainer.appendChild(table);

  if (teamRows.length) {
    saveBtn.style.display = "inline-flex";
  }
}

// Load existing high-score result for this week, if any
async function loadHighScoreForWeek(week) {
  if (!hsContainer) return;

  const { data, error } = await supaAdmin
    .from("high_score_results")
    .select("team, points")
    .eq("week", week)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    setAdminNotice("Error loading high score result for this week.", true);
    return;
  }

  currentHighScore = {
    team: data?.team || "",
    points: data?.points ?? null,
  };

  hsContainer.style.display = "block";

  if (hsTeamSelect) {
    hsTeamSelect.value = currentHighScore.team || "";
  }
  if (hsPointsInput) {
    hsPointsInput.value =
      currentHighScore.points !== null ? String(currentHighScore.points) : "";
  }
}

async function handleLoadWeekClicked() {
  setAdminNotice("");
  teamsContainer.innerHTML = "";

  const week = Number(weekInput.value);
  if (!week || week < 1 || week > 18) {
    setAdminNotice("Please enter a valid week number between 1 and 18.", true);
    return;
  }

  currentWeek = week;

  await Promise.all([
    loadWeekTeams(week),
    loadHighScoreForWeek(week),
  ]);

  if (teamRows.length) {
    setAdminNotice("Loaded teams and high-score info for Week " + week + ".", false);
  }
}

async function handleSaveClicked() {
  if (!currentWeek) {
    setAdminNotice("Please load a week first.", true);
    return;
  }

  setAdminNotice("Saving results...", false);

  try {
    // 1) Save survivor results for all teams
    for (const row of teamRows) {
      const team = row.team;
      const newVal = row.selectEl.value; // "", "WIN", "LOSS"

      if (newVal === "" && !row.currentResult) continue;

      if (newVal === "") {
        const { error } = await supaAdmin
          .from("picks")
          .update({ result: null })
          .eq("week", currentWeek)
          .eq("survivor_team", team);

        if (error) throw error;
        continue;
      }

      const { error } = await supaAdmin
        .from("picks")
        .update({ result: newVal })
        .eq("week", currentWeek)
        .eq("survivor_team", team);

      if (error) throw error;
    }

    // 2) Save highest-scoring team result
    if (hsContainer) {
      const hsTeam = hsTeamSelect ? hsTeamSelect.value : "";
      const hsPointsRaw = hsPointsInput ? hsPointsInput.value : "";
      const hsPoints = hsPointsRaw === "" ? null : Number(hsPointsRaw);

      if (hsTeam || hsPoints !== null) {
        const { error } = await supaAdmin
          .from("high_score_results")
          .upsert(
            {
              week: currentWeek,
              team: hsTeam || null,
              points: hsPoints,
            },
            { onConflict: "week" }
          );

        if (error) throw error;
      }
    }

    setAdminNotice("Results saved for Week " + currentWeek + "!", false);
    await Promise.all([
      loadWeekTeams(currentWeek),
      loadHighScoreForWeek(currentWeek),
    ]);
  } catch (err) {
    console.error(err);
    setAdminNotice("Error saving results. Please try again.", true);
  }
}

// ---------- Weekly comments viewer ----------

async function loadCommentsForWeek(rawWeek) {
  if (!commentsContainer) return;

  commentsContainer.innerHTML = "";

  const week = Number(rawWeek);
  if (!week || week < 1 || week > 18) {
    setAdminNotice(
      "Please enter a valid week number between 1 and 18 to load comments.",
      true
    );
    return;
  }

  try {
    // Get all entries for name/label lookup
    const { data: entries, error: entriesError } = await supaAdmin
      .from("entries")
      .select("id, display_name, label");

    if (entriesError) throw entriesError;

    const entryMap = new Map();
    (entries || []).forEach((e) => {
      entryMap.set(e.id, e);
    });

    // Get picks with comments for that week
    const { data: picks, error: picksError } = await supaAdmin
      .from("picks")
      .select("entry_id, week, comments, created_at")
      .eq("week", week)
      .not("comments", "is", null)
      .order("created_at", { ascending: true });

    if (picksError) throw picksError;

    const rows = (picks || []).filter(
      (p) => p.comments && p.comments.trim() !== ""
    );

    if (!rows.length) {
      const p = document.createElement("p");
      p.textContent = "No comments for this week.";
      commentsContainer.appendChild(p);
      return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    ["Entry", "Comment", "Submitted"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      const info = entryMap.get(row.entry_id);
      const displayName = info?.display_name || "Entry";
      const label = info?.label || "";
      const entryText = `${displayName} – ${label}`;

      const entryCell = document.createElement("td");
      entryCell.textContent = entryText;
      tr.appendChild(entryCell);

      const commentCell = document.createElement("td");
      commentCell.textContent = row.comments;
      tr.appendChild(commentCell);

      const submittedCell = document.createElement("td");
      if (row.created_at) {
        const d = new Date(row.created_at);
        submittedCell.textContent = d.toLocaleString();
      } else {
        submittedCell.textContent = "";
      }
      tr.appendChild(submittedCell);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    commentsContainer.appendChild(table);

    setAdminNotice(
      "Loaded " + rows.length + " comment(s) for Week " + week + ".",
      false
    );
  } catch (err) {
    console.error(err);
    setAdminNotice("Error loading comments for that week.", true);
  }
}

// ---------- Init & event wiring ----------

async function initAdmin() {
  const { data } = await supaAdmin.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    adminSection.style.display = "none";
    if (unauthorizedSection) unauthorizedSection.style.display = "block";
    return;
  }

  const email = user.email || user.user_metadata?.email;

  if (!isAdminEmail(email)) {
    adminSection.style.display = "none";
    if (unauthorizedSection) unauthorizedSection.style.display = "block";
    return;
  }

  adminSection.style.display = "block";
  if (unauthorizedSection) unauthorizedSection.style.display = "none";
  adminControls.style.display = "block";

  populateHighScoreTeamSelect();

  setAdminNotice(
    "Logged in as admin: " + email + ". Select a week and grade results.",
    false
  );
}

if (loadWeekBtn) {
  loadWeekBtn.addEventListener("click", () => {
    handleLoadWeekClicked();
  });
}

if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    handleSaveClicked();
  });
}

if (commentsLoadBtn) {
  commentsLoadBtn.addEventListener("click", () => {
    if (commentsWeekInput) {
      loadCommentsForWeek(commentsWeekInput.value);
    }
  });
}

initAdmin();
