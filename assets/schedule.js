// assets/schedule.js

const supaSchedule = window.supabaseClient;

// DOM elements
const scheduleWeekSelect = document.getElementById("schedule-week-select");
const scheduleTodayBtn = document.getElementById("schedule-today-btn");
const scheduleGrid = document.getElementById("schedule-grid");
const scheduleMessage = document.getElementById("schedule-message");

// Week 1 of the 2025 season starts on Thu, Sept 4, 2025
const SCHEDULE_SEASON_START_UTC = Date.UTC(2025, 8, 4);

// Simple cache
const scheduleCacheByWeek = new Map();

/* -------------------------------------------------------------
   TEAM NAME → ABBREVIATION → LOGO FILE
------------------------------------------------------------- */
const TEAM_ABBREVIATIONS = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS",
};

function computeCurrentScheduleWeek() {
  const now = new Date();
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((nowUtc - SCHEDULE_SEASON_START_UTC) / (1000 * 60 * 60 * 24));
  let week = Math.floor(diffDays / 7) + 1;
  if (week < 1) week = 1;
  if (week > 18) week = 18;
  return week;
}

function setScheduleMessage(text) {
  scheduleMessage.textContent = text || "";
  scheduleMessage.style.display = text ? "block" : "none";
}

function formatKickoffET(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function getKickoffField(row) {
  return row.kickoff_et || row.kickoff_time_et || null;
}

/* -------------------------------------------------------------
   DATA LOADING
------------------------------------------------------------- */

async function loadScheduleForWeek(week) {
  if (scheduleCacheByWeek.has(week)) return scheduleCacheByWeek.get(week);

  const { data, error } = await supaSchedule
    .from("schedule")
    .select("*")
    .eq("week", week);

  if (error) {
    console.error(error);
    throw error;
  }

  const rows = (data || []).slice();

  rows.sort((a, b) => {
    const ka = getKickoffField(a);
    const kb = getKickoffField(b);
    if (!ka && !kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    return new Date(ka).getTime() - new Date(kb).getTime();
  });

  scheduleCacheByWeek.set(week, rows);
  return rows;
}

/* -------------------------------------------------------------
   RENDERING
------------------------------------------------------------- */

function createTeamBlock(teamName, role) {
  const wrapper = document.createElement("div");
  wrapper.className = `schedule-team schedule-team-${role}`;

  const abbr = TEAM_ABBREVIATIONS[teamName];
  const logoPath = abbr ? `assets/logos/${abbr}.png` : null;

  if (logoPath) {
    const img = document.createElement("img");
    img.src = logoPath;
    img.alt = `${teamName} logo`;
    img.className = "schedule-team-logo";
    wrapper.appendChild(img);
  }

  const textWrap = document.createElement("div");
  textWrap.className = "schedule-team-text";

  const nameSpan = document.createElement("span");
  nameSpan.className = "schedule-team-name";
  nameSpan.textContent = teamName;
  textWrap.appendChild(nameSpan);

  const roleSpan = document.createElement("span");
  roleSpan.className = "schedule-team-role";
  roleSpan.textContent = role.toUpperCase();
  textWrap.appendChild(roleSpan);

  wrapper.appendChild(textWrap);

  return wrapper;
}

function renderScheduleGrid(rows, week) {
  scheduleGrid.innerHTML = "";

  if (!rows.length) {
    const p = document.createElement("p");
    p.textContent = `No games found for Week ${week}.`;
    scheduleGrid.appendChild(p);
    return;
  }

  rows.forEach((g) => {
    const card = document.createElement("div");
    card.className = "schedule-card";

    // Header
    const header = document.createElement("div");
    header.className = "schedule-card-header";

    const timeSpan = document.createElement("span");
    timeSpan.className = "schedule-card-kickoff";
    timeSpan.textContent = formatKickoffET(getKickoffField(g));
    header.appendChild(timeSpan);

    if (g.network) {
      const netSpan = document.createElement("span");
      netSpan.className = "schedule-card-network";
      netSpan.textContent = g.network;
      header.appendChild(netSpan);
    }

    card.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "schedule-card-body";

    body.appendChild(createTeamBlock(g.away_team, "away"));

    const vsSpan = document.createElement("span");
    vsSpan.className = "schedule-card-vs";
    vsSpan.textContent = "@";
    body.appendChild(vsSpan);

    body.appendChild(createTeamBlock(g.home_team, "home"));

    card.appendChild(body);

    // Footer
    if (g.location) {
      const footer = document.createElement("div");
      footer.className = "schedule-card-footer";
      footer.textContent = g.location;
      card.appendChild(footer);
    }

    scheduleGrid.appendChild(card);
  });
}

/* -------------------------------------------------------------
   EVENT HANDLERS / INIT
------------------------------------------------------------- */

async function handleWeekChange() {
  const week = Number(scheduleWeekSelect.value);
  if (!week || week < 1 || week > 18) {
    setScheduleMessage("Please select a valid week.");
    scheduleGrid.innerHTML = "";
    return;
  }

  try {
    setScheduleMessage(`Loading schedule for Week ${week}...`);
    const rows = await loadScheduleForWeek(week);
    setScheduleMessage("");
    renderScheduleGrid(rows, week);
  } catch (err) {
    console.error(err);
    setScheduleMessage("Error loading schedule.");
  }
}

function populateWeekSelect() {
  scheduleWeekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = `Week ${w}`;
    scheduleWeekSelect.appendChild(opt);
  }
}

async function initSchedule() {
  populateWeekSelect();

  const currentWeek = computeCurrentScheduleWeek();
  scheduleWeekSelect.value = String(currentWeek);

  await handleWeekChange();
}

scheduleWeekSelect?.addEventListener("change", handleWeekChange);

scheduleTodayBtn?.addEventListener("click", async () => {
  const currentWeek = computeCurrentScheduleWeek();
  scheduleWeekSelect.value = String(currentWeek);
  await handleWeekChange();
});

// Start it up
initSchedule();
