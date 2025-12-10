// assets/schedule.js

const supaSchedule = window.supabaseClient;

// DOM elements
const scheduleSection = document.getElementById("schedule-section");
const scheduleMessage = document.getElementById("schedule-message");
const scheduleWeekSelect = document.getElementById("schedule-week-select");
const scheduleList = document.getElementById("schedule-list");
const scheduleJumpCurrentBtn = document.getElementById("schedule-jump-current-btn");

// Store all games grouped by week
let gamesByWeek = new Map();
let availableWeeks = [];

// 👇 MUST MATCH picks.js
// NFL 2025 regular season Week 1 start (Thursday night opener)
// Month is 0-based, so 8 = September
const SEASON_START_UTC = Date.UTC(2025, 8, 4); // 2025-09-04

// Same logic as in picks.js
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

function setScheduleMessage(text, isError = false) {
  if (!scheduleMessage) return;
  scheduleMessage.textContent = text || "";
  scheduleMessage.className = "message " + (isError ? "error" : "success");
}

function clearScheduleMessage() {
  if (!scheduleMessage) return;
  scheduleMessage.textContent = "";
  scheduleMessage.className = "message";
}

// Render a given week into the scheduleList
function renderWeek(weekNumber) {
  if (!scheduleList) return;

  scheduleList.innerHTML = "";

  const games = gamesByWeek.get(weekNumber) || [];

  if (!games.length) {
    const p = document.createElement("p");
    p.textContent = "No games found for Week " + weekNumber + ".";
    scheduleList.appendChild(p);
    return;
  }

  games.forEach((game) => {
    const item = document.createElement("div");
    item.classList.add("schedule-game");

    const matchup = document.createElement("div");
    matchup.classList.add("schedule-game-matchup");
    matchup.textContent = `${game.away_team} @ ${game.home_team}`;

    const time = document.createElement("div");
    time.classList.add("schedule-game-time");

    if (game.kickoff) {
      const dt = new Date(game.kickoff);
      const formatted = dt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        timeZoneName: "short"
      });
      time.textContent = formatted;
    } else {
      time.textContent = "";
    }

    item.appendChild(matchup);
    item.appendChild(time);
    scheduleList.appendChild(item);
  });
}

// After loading all games, populate the week dropdown
function populateWeekSelect() {
  if (!scheduleWeekSelect) return;

  scheduleWeekSelect.innerHTML = "";

  availableWeeks.sort((a, b) => a - b);

  availableWeeks.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = "Week " + w;
    scheduleWeekSelect.appendChild(opt);
  });

  // Choose a default:
  // - If currentWeek is within available weeks, use that
  // - Else fall back to the smallest week we have
  const currentWeek = computeCurrentWeek();
  let initialWeek = currentWeek;

  if (!availableWeeks.includes(currentWeek)) {
    if (availableWeeks.length) {
      initialWeek = availableWeeks[0];
    }
  }

  scheduleWeekSelect.value = String(initialWeek);
  renderWeek(initialWeek);
  clearScheduleMessage();
}

// Load all schedule data from Supabase
async function loadSchedule() {
  setScheduleMessage("Loading schedule...");

  try {
    const { data, error } = await supaSchedule
      .from("schedule")
      .select("week, kickoff, home_team, away_team")
      .order("week", { ascending: true })
      .order("kickoff", { ascending: true });

    if (error) throw error;

    const rows = data || [];

    gamesByWeek = new Map();
    availableWeeks = [];

    rows.forEach((row) => {
      const w = row.week;
      if (!w) return;

      if (!gamesByWeek.has(w)) {
        gamesByWeek.set(w, []);
        availableWeeks.push(w);
      }

      gamesByWeek.get(w).push(row);
    });

    if (!availableWeeks.length) {
      setScheduleMessage("No schedule data found yet.", false);
      return;
    }

    populateWeekSelect();
  } catch (err) {
    console.error(err);
    setScheduleMessage(
      "Error loading schedule: " + (err.message || "Unknown error"),
      true
    );
  }
}

// Initialize page
function initSchedule() {
  if (!scheduleSection) return;

  // Week dropdown changed
  if (scheduleWeekSelect) {
    scheduleWeekSelect.addEventListener("change", () => {
      const week = Number(scheduleWeekSelect.value);
      if (!Number.isFinite(week)) return;
      renderWeek(week);
    });
  }

  // "Jump to current week" button
  if (scheduleJumpCurrentBtn && scheduleWeekSelect) {
    scheduleJumpCurrentBtn.addEventListener("click", () => {
      const currentWeek = computeCurrentWeek();

      // Only jump to a week that exists in the schedule data
      const weekToUse = availableWeeks.includes(currentWeek)
        ? currentWeek
        : availableWeeks.length
        ? availableWeeks[0]
        : currentWeek;

      scheduleWeekSelect.value = String(weekToUse);
      renderWeek(weekToUse);
    });
  }

  loadSchedule();
}

initSchedule();
