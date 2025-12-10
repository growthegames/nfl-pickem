// assets/schedule.js

const supaSchedule = window.supabaseClient;

const scheduleWeekSelect = document.getElementById("schedule-week-select");
const scheduleTodayBtn = document.getElementById("schedule-today-btn");
const scheduleMessageEl = document.getElementById("schedule-message");
const scheduleGridEl = document.getElementById("schedule-grid");

// Week 1 of the 2025 season starts on Thu, Sept 4, 2025
// (month is 0-based: 8 = September)
const SCHEDULE_SEASON_START_UTC = Date.UTC(2025, 8, 4);

// Cache by week so we don’t keep hitting Supabase for the same data
const scheduleCacheByWeek = new Map();

// --------------------------------------------------
// Helpers
// --------------------------------------------------

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

function setScheduleMessage(text, isError = false) {
  if (!scheduleMessageEl) return;
  scheduleMessageEl.textContent = text || "";
  scheduleMessageEl.className = "message " + (isError ? "error" : "success");
}

function clearScheduleGrid() {
  if (scheduleGridEl) {
    scheduleGridEl.innerHTML = "";
  }
}

// --------------------------------------------------
// Supabase load
// --------------------------------------------------

async function loadScheduleForWeek(week) {
  if (scheduleCacheByWeek.has(week)) {
    return scheduleCacheByWeek.get(week);
  }

  // Be forgiving about columns: just select everything and filter by week.
  const { data, error } = await supaSchedule
    .from("schedule")
    .select("*")
    .eq("week", week);

  if (error) {
    console.error("Schedule query error:", error);
    throw error;
  }

  const rows = data || [];
  scheduleCacheByWeek.set(week, rows);
  return rows;
}

// --------------------------------------------------
// Render
// --------------------------------------------------

function renderScheduleGrid(rows, week) {
  clearScheduleGrid();

  if (!rows.length) {
    setScheduleMessage(
      "No games found for Week " +
        week +
        ". The schedule may not be loaded yet.",
      false
    );
    return;
  }

  setScheduleMessage(
    "Showing " + rows.length + " game(s) for Week " + week + ".",
    false
  );

  // Try to sort by kickoff_time_et if present
  const sorted = rows.slice().sort((a, b) => {
    if (!a.kickoff_time_et || !b.kickoff_time_et) return 0;
    return (
      new Date(a.kickoff_time_et).getTime() -
      new Date(b.kickoff_time_et).getTime()
    );
  });

  sorted.forEach((g) => {
    const card = document.createElement("div");
    card.className = "schedule-game";

    // Top: kickoff time (ET)
    const top = document.createElement("div");
    top.className = "schedule-game-top";
    if (g.kickoff_time_et) {
      const d = new Date(g.kickoff_time_et);
      top.textContent = d.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    } else {
      top.textContent = "";
    }

    // Middle: away @ home
    const middle = document.createElement("div");
    middle.className = "schedule-game-middle";
    const awayTeam = g.away_team || "";
    const homeTeam = g.home_team || "";
    middle.textContent = awayTeam && homeTeam
      ? `${awayTeam} @ ${homeTeam}`
      : awayTeam || homeTeam || "";

    // Bottom: network + location
    const bottom = document.createElement("div");
    bottom.className = "schedule-game-bottom";
    const pieces = [];
    if (g.network) pieces.push(g.network);
    if (g.location) pieces.push(g.location);
    bottom.textContent = pieces.join(" • ");

    card.appendChild(top);
    card.appendChild(middle);
    card.appendChild(bottom);

    scheduleGridEl.appendChild(card);
  });
}

// --------------------------------------------------
// Events / init
// --------------------------------------------------

async function handleWeekChange() {
  const week = Number(scheduleWeekSelect.value);
  if (!week || week < 1 || week > 18) {
    setScheduleMessage(
      "Please select a valid week between 1 and 18 to view the schedule.",
      true
    );
    clearScheduleGrid();
    return;
  }

  try {
    setScheduleMessage("Loading schedule for Week " + week + "...", false);
    const rows = await loadScheduleForWeek(week);
    renderScheduleGrid(rows, week);
  } catch (err) {
    console.error(err);
    clearScheduleGrid();
    setScheduleMessage("Error loading schedule for that week.", true);
  }
}

async function initSchedule() {
  if (!scheduleWeekSelect) return;

  // If the select isn't already populated in HTML, add 1–18
  if (!scheduleWeekSelect.options.length) {
    for (let w = 1; w <= 18; w++) {
      const opt = document.createElement("option");
      opt.value = String(w);
      opt.textContent = "Week " + w;
      scheduleWeekSelect.appendChild(opt);
    }
  }

  const currentWeek = computeCurrentScheduleWeek();
  if (
    currentWeek >= 1 &&
    currentWeek <= 18 &&
    Array.from(scheduleWeekSelect.options).some(
      (o) => Number(o.value) === currentWeek
    )
  ) {
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

// Kick things off
initSchedule();
