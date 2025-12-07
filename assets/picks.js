// assets/picks.js

const supaPicks = window.supabaseClient;

const weekInput = document.getElementById("week-input");
const loadWeekBtn = document.getElementById("load-week-btn");
const picksMessage = document.getElementById("picks-message");
const picksTableContainer = document.getElementById("picks-table-container");
const savePicksBtn = document.getElementById("save-picks-btn");
const loginReminder = document.getElementById("login-reminder");
const picksSection = document.getElementById("picks-section");
const currentWeekLabel = document.getElementById("current-week-label");

// Deadline banner elements
const deadlineBanner = document.getElementById("deadline-banner");
const deadlineText = document.getElementById("deadline-text");
const deadlineCountdown = document.getElementById("deadline-countdown");

let picksUser = null;
let userEntries = [];
let existingPicksByEntryId = new Map();
let activeWeek = null;

// Deadline countdown state
let currentDeadline = null;   // JS Date object
let countdownInterval = null; // setInterval handle

// 👇 SET THIS TO YOUR ACTUAL WEEK 1 START DATE (UTC)
const SEASON_START_UTC = Date.UTC(2025, 8, 4); // 2025-09-04 (month is 0-based: 8 = September)

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

  if (msg.includes("submission deadline for week")) {
    return "Picks for this week are closed. The 7:30pm ET deadline has passed.";
  }

  if (msg.includes("eliminated")) {
    return "That entry has been eliminated and cannot submit survivor picks after Week 3. You can still play the Highest Scoring Team game.";
  }

  return "Error saving picks. Please try again.";
}

// 👉 Compute current week on the client, based on SEASON_START_UTC
function computeCurrentWeek() {
  const now = new Date();
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((nowUtc - SEASON_START_UTC) / msPerDay);

  let week = Math.floor(diffDays / 7) + 1;

  if (week < 1) week = 1;
  if (week > 18) week = 18;

  return week;
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

// ---------- Deadline banner + countdown ----------

function clearDeadlineBanner() {
  currentDeadline = null;

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (deadlineText) deadlineText.textContent = "";
  if (deadlineCountdown) deadlineCountdown.textContent = "";
  if (deadlineBanner) deadlineBanner.style.display = "none";
}

function startCountdown() {
  if (!currentDeadline || !deadlineCountdown) return;

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  function tick() {
    const now = new Date();
    const diffMs = currentDeadline.getTime() - now.getTime();

    if (diffMs <= 0) {
      deadlineCountdown.textContent =
        "Deadline has passed for this week. Picks are closed.";
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(days + "d");
    parts.push(
      String(hours).padStart(2, "0") + "h",
      String(minutes).padStart(2, "0") + "m",
      String(seconds).padStart(2, "0") + "s"
    );

    deadlineCountdown.textContent = "Time remaining: " + parts.join(" ");
  }

  tick(); // initial render
  countdownInterval = setInterval(tick, 1000);
}

async function loadDeadlineForWeek(week) {
  if (!deadlineBanner || !deadlineText || !deadlineCountdown) return;

  if (!week || week < 1 || week > 18) {
    clearDeadlineBanner();
    return;
  }

  try {
    const { data, error } = await supaPicks
      .from("week_deadlines")
      .select("deadline")
      .eq("week", week)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error(error);
      clearDeadlineBanner();
      return;
    }

    if (!data || !data.deadline) {
      // No configured deadline for this week
      clearDeadlineBanner();
      return;
    }

    const dl = new Date(data.deadline);
    currentDeadline = dl;

    const options = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short",
    };

    const formatted = dl.toLocaleString("en-US", options);

    deadlineBanner.style.display = "block";
    deadlineText.textContent =
      "Week " + week + " picks close at " + formatted + ".";

    startCountdown();
  } catch (err) {
    console.error(err);
    clearDeadlineBanner();
  }
}

// ---------- Picks table rendering & data ----------

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
    let labelText = entry.label;

    // If entry is eliminated and we're past the rebuy window (Week > 3),
    // show that clearly in the label.
    if (entry.is_active === false && week > 3) {
      labelText += " (ELIMINATED)";
    }

    entryCell.textContent = labelText;
    tr.appendChild(entryCell);

    const survivorCell = document.createElement("td");
    const survivorSelect = buildTeamSelect("survivor");

    // If eliminated and Week > 3, disable survivor picks for this entry
    if (entry.is_active === false && week > 3) {
      survivorSelect.disabled = true;
      survivorSelect.title =
        "This entry has been eliminated and cannot submit survivor picks after Week 3.";
    }

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
    clearDeadlineBanner();
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

  // Load the deadline + start countdown for this week
  await loadDeadlineForWeek(week);

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

      const survivorTeam = survivorSelect ? survivorSelect.value : "";
      const highScoreTeam = highScoreSelect ? highScoreSelect.value : "";
      const comments = commentsInput ? commentsInput.value.trim() : "";

      if (!survivorTeam && !highScoreTeam && !comments) {
        continue;
      }

      const existing = existingPicksByEntryId.get(entryId);

      if (existing) {
        const { error } = await supaPicks
          .from("picks")
          .update({
            survivor_team: survivorTeam || null,
            highest_scoring_team: highScoreTeam || null,
            comments,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supaPicks.from("picks").insert({
          entry_id: entryId,
          week,
          survivor_team: survivorTeam || null,
          highest_scoring_team: highScoreTeam || null,
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

// Initialize & auto-load current week
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

  activeWeek = computeCurrentWeek();

  if (currentWeekLabel) {
    currentWeekLabel.textContent =
      "Now submitting picks for Week " + activeWeek + ".";
  }

  if (weekInput) {
    weekInput.value = activeWeek;
    weekInput.readOnly = true;
  }

  if (loadWeekBtn) {
    loadWeekBtn.style.display = "none"; // users no longer manually change weeks
  }

  await handleLoadWeek();
}

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
