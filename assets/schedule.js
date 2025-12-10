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

// Map full team name -> logo path (3-letter files in assets/logos).
const TEAM_LOGOS = {
  "Arizona Cardinals": "assets/logos/ARI.png",
  "Atlanta Falcons": "assets/logos/ATL.png",
  "Baltimore Ravens": "assets/logos/BAL.png",
  "Buffalo Bills": "assets/logos/BUF.png",
  "Carolina Panthers": "assets/logos/CAR.png",
  "Chicago Bears": "assets/logos/CHI.png",
  "Cincinnati Bengals": "assets/logos/CIN.png",
  "Cleveland Browns": "assets/logos/CLE.png",
  "Dallas Cowboys": "assets/logos/DAL.png",
  "Denver Broncos": "assets/logos/DEN.png",
  "Detroit Lions": "assets/logos/DET.png",
  "Green Bay Packers": "assets/logos/GB.png",
  "Houston Texans": "assets/logos/HOU.png",
  "Indianapolis Colts": "assets/logos/IND.png",
  "Jacksonville Jaguars": "assets/logos/JAX.png",
  "Kansas City Chiefs": "assets/logos/KC.png",
  "Las Vegas Raiders": "assets/logos/LV.png",
  "Los Angeles Chargers": "assets/logos/LAC.png",
  "Los Angeles Rams": "assets/logos/LAR.png",
  "Miami Dolphins": "assets/logos/MIA.png",
  "Minnesota Vikings": "assets/logos/MIN.png",
  "New England Patriots": "assets/logos/NE.png",
  "New Orleans Saints": "assets/logos/NO.png",
  "New York Giants": "assets/logos/NYG.png",
  "New York Jets": "assets/logos/NYJ.png",
  "Philadelphia Eagles": "assets/logos/PHI.png",
  "Pittsburgh Steelers": "assets/logos/PIT.png",
  "San Francisco 49ers": "assets/logos/SF.png",
  "Seattle Seahawks": "assets/logos/SEA.png",
  "Tampa Bay Buccaneers": "assets/logos/TB.png",
  "Tennessee Titans": "assets/logos/TEN.png",
  "Washington Commanders": "assets/logos/WAS.png",
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
  if (text) {
    scheduleMessage.style.display = "block";
  } else {
    scheduleMessage.style.display = "none";
  }
}

function formatKickoffET(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

// --------------------------------------------------------------
// Data loading
// --------------------------------------------------------------

async function loadScheduleForWeek(week) {
  if (scheduleCacheByWeek.has(week)) {
    return scheduleCacheByWeek.get(week);
  }

  // IMPORTANT: kickoff_et must match the real column name in Supabase
  const { data, error } = await supaSchedule
    .from("schedule")
    .select(
      "id, week, kickoff_et, home_team, away_team, location, network" // <-- kickoff_et
    )
    .eq("week", week)
    .order("kickoff_et", { ascending: true }); // <-- kickoff_et

  if (error) {
    console.error(error);
    throw error;
  }

  const rows = data || [];
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
    timeSpan.textContent = formatKickoffET(g.kickoff_et); // <-- kickoff_et
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
