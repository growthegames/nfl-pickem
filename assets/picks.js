// assets/picks.js

const supaPicks = window.supabaseClient;

const weekInput = document.getElementById("week-input");
const loadWeekBtn = document.getElementById("load-week-btn");
const picksMessage = document.getElementById("picks-message");
const picksTableContainer = document.getElementById("picks-table-container");
const savePicksBtn = document.getElementById("save-picks-btn");
const loginReminder = document.getElementById("login-reminder");
const picksSection = document.getElementById("picks-section");

let picksUser = null;
let userEntries = [];
let existingPicksByEntryId = new Map();
let activeWeek = null;

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

function setPicksMessage(text, isError = false) {
  if (!picksMessage) return;
  picksMessage.textContent = text || "";
  picksMessage.className = "message " + (isError ? "error" : "success");
}

function getFriendlyPicksErrorMessage(error) {
  if (!error || !error.message) {
    return "Error saving picks. Please try again.";
  }

  const msg = error.message.toLowerCase();

  if (msg.includes("duplicate key value") || msg.includes("unique constraint")) {
    return "It looks like this entry has already used that team earlier this season. Each entry can only use a team once.";
  }

  return "Error saving picks. Please try again.";
}

function buildTeamSelect(name, selectedValue = "") {
  const select = document.createElement("select");
  select.name = name;

  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Select a team";
  select.appendChild(emptyOpt);

  NFL_TEAMS.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team;
    opt.textContent = team;
    if (team === selectedValue) opt.selected = true;
    select.appendChild(opt);
  });

  return select;
}

function renderPicksTable(week) {
  picksTableContainer.innerHTML = "";
  existingPicksByEntryId = new Map();

  if (!userEntries.length) {
    const p = document.createElement("p");
    p.textContent =
      "You don't have any entries yet. Go to the Home page to create entries first.";
    picksTableContainer.appendChild(p);
    if (savePicksBtn) savePicksBtn.style.display = "none";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Entry", "Survivor Pick", "Highest Scoring Team", "Comments"].forEach(
    (label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    }
  );

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  userEntries.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.dataset.entryId = entry.id;

    const entryCell = document.createElement("td");
    entryCell.textContent = entry.label;
    tr.appendChild(entryCell);

    const survivorCell = document.createElement("td");
    const survivorSelect = buildTeamSelect("survivor");
    survivorCell.appendChild(survivorSelect);
    tr.appendChild(survivorCell);

    const highScoreCell = document.createElement("td");
    const highScoreSelect = buildTeamSelect("highscore");
    highScoreCell.appendChild(highScoreSelect);
    tr.appendChild(highScoreCell);

    const commentsCell = document.createElement("td");
    const commentsInput = document.createElement("input");
    commentsInput.type = "text";
    commentsInput.name = "comments";
    commentsInput.style.width = "100%";
    commentsCell.appendChild(commentsInput);
    tr.appendChild(commentsCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  picksTableContainer.appendChild(table);

  if (savePicksBtn) savePicksBtn.style.display = "inline-flex";
}

async function loadEntriesForUser() {
  const { data, error } = await supaPicks
    .from("entries")
    .select("*")
    .eq("user_id", picksUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setPicksMessage("Error loading entries.", true);
    return;
  }

  userEntries = data || [];
}

async function loadExistingPicks(week) {
  if (!userEntries.length) return;

  const entryIds = userEntries.map((e) => e.id);

  const { data, error } = await supaPicks
    .from("picks")
    .select("*")
    .eq("week", week)
    .in("entry_id", entryIds);

  if (error) {
    console.error(error);
    setPicksMessage("Error loading existing picks.", true);
    return;
  }

  (data || []).forEach((p) => {
    existingPicksByEntryId.set(p.entry_id, p);
  });
}

async function handleLoadWeek() {
  setPicksMessage("");
  picksTableContainer.innerHTML = "";

  const week = Number(weekInput.value);
  if (!week || week < 1 || week > 18) {
    setPicksMessage("Please enter a valid week number between 1 and 18.", true);
    return;
  }

  await loadEntriesForUser();
  renderPicksTable(week);
  await loadExistingPicks(week);

  const rows = picksTableContainer.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    const entryId = row.dataset.entryId;
    const existing = existingPicksByEntryId.get(entryId);
    if (!existing) return;

    const survivorSelect = row.querySelector('select[name="survivor"]');
    const highScoreSelect = row.querySelector('select[name="highscore"]');
    const commentsInput = row.querySelector('input[name="comments"]');

    if (survivorSelect) survivorSelect.value = existing.survivor_team || "";
    if (highScoreSelect)
      highScoreSelect.value = existing.highest_scoring_team || "";
    if (commentsInput) commentsInput.value = existing.comments || "";
  });

  setPicksMessage("Entries loaded for Week " + week + ".");
}

async function handleSavePicks() {
  setPicksMessage("");
  const week = Number(weekInput.value);
  if (!week || week < 1 || week > 18) {
    setPicksMessage("Please enter a valid week number between 1 and 18.", true);
    return;
  }

  const rows = picksTableContainer.querySelectorAll("tbody tr");
  if (!rows.length) {
    setPicksMessage("No entries to save picks for.", true);
    return;
  }

  try {
    for (const row of rows) {
      const entryId = row.dataset.entryId;
      const survivorSelect = row.querySelector('select[name="survivor"]');
      const highScoreSelect = row.querySelector('select[name="highscore"]');
      const commentsInput = row.querySelector('input[name="comments"]');

      const survivorTeam = survivorSelect.value;
      const highScoreTeam = highScoreSelect.value;
      const comments = commentsInput.value.trim();

      if (!survivorTeam && !highScoreTeam && !comments) {
        continue;
      }

      const existing = existingPicksByEntryId.get(entryId);

      if (existing) {
        const { error } = await supaPicks
          .from("picks")
          .update({
            survivor_team: survivorTeam,
            highest_scoring_team: highScoreTeam,
            comments,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supaPicks.from("picks").insert({
          entry_id: entryId,
          week,
          survivor_team: survivorTeam,
          highest_scoring_team: highScoreTeam,
          comments,
        });

        if (error) throw error;
      }
    }

    setPicksMessage("Picks saved for Week " + week + "!");
  } catch (err) {
    console.error(err);
    const friendly = getFriendlyPicksErrorMessage(err);
    setPicksMessage(friendly, true);
  }
}

// Load current_week from league_settings and auto-load that week
async function loadActiveWeekAndPicks() {
  try {
    const { data, error } = await supaPicks
      .from("league_settings")
      .select("current_week")
      .eq("id", 1)
      .single();

    if (error) throw error;

    activeWeek = data?.current_week ?? null;

    if (!activeWeek || activeWeek < 1 || activeWeek > 18) {
      setPicksMessage(
        "League settings error: current week is not set correctly.",
        true
      );
      return;
    }

    // Set the input to the active week and make it read-only
    if (weekInput) {
      weekInput.value = activeWeek;
      weekInput.readOnly = true;
    }

    // Hide the manual "Load" button; we auto-load
    if (loadWeekBtn) {
      loadWeekBtn.style.display = "none";
    }

    await handleLoadWeek();
  } catch (err) {
    console.error(err);
    setPicksMessage("Error loading current league week.", true);
  }
}

async function initPicks() {
  const { data } = await supaPicks.auth.getUser();
  picksUser = data?.user ?? null;

  if (!picksUser) {
    if (picksSection) picksSection.style.display = "none";
    if (loginReminder) loginReminder.style.display = "block";
    return;
  }

  if (picksSection) picksSection.style.display = "block";
  if (loginReminder) loginReminder.style.display = "none";

  await loadActiveWeekAndPicks();
}

// Listeners (loadWeekBtn is hidden now but listener is harmless)
if (loadWeekBtn) {
  loadWeekBtn.addEventListener("click", () => {
    handleLoadWeek();
  });
}

if (savePicksBtn) {
  savePicksBtn.addEventListener("click", () => {
    handleSavePicks();
  });
}

initPicks();
