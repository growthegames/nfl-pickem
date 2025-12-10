// assets/schedule.js

const supaSchedule = window.supabaseClient;

// DOM elements
const scheduleWeekSelect = document.getElementById("schedule-week-select");
const scheduleTodayBtn = document.getElementById("schedule-today-btn");
const scheduleGrid = document.getElementById("schedule-grid");
const scheduleMessage = document.getElementById("schedule-message");

// Week 1 of the 2025 season starts on Thu, Sept 4, 2025
// (month is 0-based: 8 = September)
const SCHEDULE_SEASON_START_UTC = Date.UTC(2025, 8, 4);

// Simple cache so we don’t keep hitting Supabase for the same week
const scheduleCacheByWeek = new Map();

// Map full team name -> logo path.
const TEAM_LOGOS = {
  "Arizona Cardinals": "assets/logos/arizona-cardinals.png",
  "Atlanta Falcons": "assets/logos/atlanta-falcons.png",
  "Baltimore Ravens": "assets/logos/baltimore-ravens.png",
  "Buffalo Bills": "assets/logos/buffalo-bills.png",
  "Carolina Panthers": "assets/logos/carolina-panthers.png",
  "Chicago Bears": "assets/logos/chicago-bears.png",
  "Cincinnati Bengals": "assets/logos/cincinnati-bengals.png",
  "Cleveland Browns": "assets/logos/cleveland-browns.png",
  "Dallas Cowboys": "assets/logos/dallas-cowboys.png",
  "Denver Broncos": "assets/logos/denver-broncos.png",
  "Detroit Lions": "assets/logos/detroit-lions.png",
  "Green Bay Packers": "assets/logos/green-bay-packers.png",
  "Houston Texans": "assets/logos/houston-texans.png",
  "Indianapolis Colts": "assets/logos/indianapolis-colts.png",
  "Jacksonville Jaguars": "assets/logos/jacksonville-jaguars.png",
  "Kansas City Chiefs": "assets/logos/kansas-city-chiefs.png",
  "Las Vegas Raiders": "assets/logos/las-vegas-raiders.png",
  "Los Angeles Chargers": "assets/logos/los-angeles-chargers.png",
  "Los Angeles Rams": "assets/logos/los-angeles-rams.png",
  "Miami Dolphins": "assets/logos/miami-dolphins.png",
  "Minnesota Vikings": "assets/logos/minnesota-vikings.png",
  "New England Patriots": "assets/logos/new-england-patriots.png",
  "New Orleans Saints": "assets/logos/new-orleans-saints.png",
  "New York Giants": "assets/logos/new-york-giants.png",
  "New York Jets": "assets/logos/new-york-jets.png",
  "Philadelphia Eagles": "assets/logos/philadelphia-eagles.png",
  "Pittsburgh Steelers": "assets/logos/pittsburgh-steelers.png",
  "San Francisco 49ers": "assets/logos/san-francisco-49ers.png",
  "Seattle Seahawks": "assets/logos/seattle-seahawks.png",
  "Tampa Bay Buccaneers": "assets/logos/tampa-bay-buccaneers.png",
  "Tennessee Titans": "assets/logos/tennessee-titans.png",
  "Washington Commanders": "assets/logos/washington-commanders.png",
};

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

function computeCurrentScheduleWeek() {
  const now = new Date();
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor(
    (nowUtc - SCHEDULE_SEASON_START_UTC) / msPerDay
  );

  let week = Math.floor(diffDays / 7) + 1;
  if (week < 1) week = 1;
  if (week > 18) week = 18;

  return week;
}

function setScheduleMessage(text) {
  if (!scheduleMessage) return;
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

/**
 * Given a row from the schedule table, return the best kickoff datetime string
 * we can find (works whether the column is named kickoff_et or kickoff_time_et).
 */
function getKickoffField(row) {
  return row.kickoff_et || row.kickoff_time_et || null;
}

// --------------------------------------------------------------
// Data loading
// --------------------------------------------------------------

async function loadScheduleForWeek(week) {
  if (scheduleCacheByWeek.has(week)) {
    return scheduleCacheByWeek.get(week);
  }

  // NOTE: we use select("*") so we don't care what the exact kickoff
  // column is called – we’ll sort & render based on whatever exists.
  const { data, error } = await supaSchedule
    .from("schedule")
    .select("*")
    .eq("week", week);

  if (error) {
    console.error(error);
    throw error;
  }

  const rows = (data || []).slice();

  // Sort client-side by kickoff time if available
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

// --------------------------------------------------------------
// Rendering
// --------------------------------------------------------------

function createTeamBlock(teamName, role) {
  const wrapper = document.createElement("div");
  wrapper.className = `schedule-team schedule-team-${role}`;

  const logoPath = TEAM_LOGOS[teamName] || "";
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
  nameSpan.textContent = teamName || "";
  textWrap.appendChild(nameSpan);

  const roleSpan = document.createElement("span");
  roleSpan.className = "schedule-team-role";
  roleSpan.textContent = role === "home" ? "HOME" : "AWAY";
  textWrap.appendChild(roleSpan);

  wrapper.appendChild(textWrap);

  return wrapper;
}

function renderScheduleGrid(rows, week) {
  if (!scheduleGrid) return;
  scheduleGrid.innerHTML = "";

  if (!rows.length) {
    const p = document.createElement("p");
    p.textContent =
      "No games found for Week " + week + ". The schedule may not be loaded yet.";
    scheduleGrid.appendChild(p);
    return;
  }

  rows.forEach((g) => {
    const card = document.createElement("div");
    card.className = "schedule-card";

    // Header: time + network
    const header = document.createElement("div");
    header.className = "schedule-card-header";

    const timeSpan = document.createElement("span");
    timeSpan.className = "schedule-card-kickoff";
    const kickoffValue = getKickoffField(g);
    timeSpan.textContent = formatKickoffET(kickoffValue);
    header.appendChild(timeSpan);

    if (g.network) {
      const netSpan = document.createElement("span");
      netSpan.className = "schedule-card-network";
      netSpan.textContent = g.network;
      header.appendChild(netSpan);
    }

    card.appendChild(header);

    // Body: away @ home
    const body = document.createElement("div");
    body.className = "schedule-card-body";

    const awayBlock = createTeamBlock(g.away_team, "away");
    const homeBlock = createTeamBlock(g.home_team, "home");

    const vsSpan = document.createElement("span");
    vsSpan.className = "schedule-card-vs";
    vsSpan.textContent = "@";

    body.appendChild(awayBlock);
    body.appendChild(vsSpan);
    body.appendChild(homeBlock);

    card.appendChild(body);

    // Footer: location
    if (g.location) {
      const footer = document.createElement("div");
      footer.className = "schedule-card-footer";

      const locSpan = document.createElement("span");
      locSpan.className = "schedule-card-location";
      locSpan.textContent = g.location;
      footer.appendChild(locSpan);

      card.appendChild(footer);
    }

    scheduleGrid.appendChild(card);
  });
}

// --------------------------------------------------------------
// Event handlers / init
// --------------------------------------------------------------

async function handleWeekChange() {
  if (!scheduleWeekSelect) return;

  const week = Number(scheduleWeekSelect.value);
  if (!week || week < 1 || week > 18) {
    setScheduleMessage(
      "Please select a valid week between 1 and 18 to view the schedule."
    );
    if (scheduleGrid) scheduleGrid.innerHTML = "";
    return;
  }

  try {
    setScheduleMessage("Loading schedule for Week " + week + "...");
    if (scheduleGrid) scheduleGrid.innerHTML = "";
    const rows = await loadScheduleForWeek(week);
    setScheduleMessage("");
    renderScheduleGrid(rows, week);
  } catch (err) {
    console.error(err);
    setScheduleMessage("Error loading schedule for that week.");
  }
}

function populateWeekSelect() {
  if (!scheduleWeekSelect) return;

  scheduleWeekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = "Week " + w;
    scheduleWeekSelect.appendChild(opt);
  }
}

async function initSchedule() {
  if (!scheduleWeekSelect || !scheduleGrid) {
    console.warn("Schedule: required DOM elements not found.");
    return;
  }

  populateWeekSelect();

  const currentWeek = computeCurrentScheduleWeek();
  if (currentWeek >= 1 && currentWeek <= 18) {
    scheduleWeekSelect.value = String(currentWeek);
  }

  await handleWeekChange();
}

// Wire events
if (scheduleWeekSelect) {
  scheduleWeekSelect.addEventListener("change", () => {
    handleWeekChange();
  });
}

if (scheduleTodayBtn && scheduleWeekSelect) {
  scheduleTodayBtn.addEventListener("click", async () => {
    const currentWeek = computeCurrentScheduleWeek();
    scheduleWeekSelect.value = String(currentWeek);
    await handleWeekChange();
  });
}

// Kick it off
initSchedule();
