// assets/schedule.js

const supaSchedule = window.supabaseClient;

const scheduleWeekSelect = document.getElementById("schedule-week-select");
const scheduleTableContainer = document.getElementById(
  "schedule-table-container"
);
const scheduleJumpCurrentBtn = document.getElementById("schedule-jump-current");

// Week 1 of the 2025 season starts on Thu, Sept 4, 2025
// (month is 0-based: 8 = September)
const SCHEDULE_SEASON_START_UTC = Date.UTC(2025, 8, 4);

let scheduleCacheByWeek = new Map();

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
  if (!scheduleTableContainer) return;
  scheduleTableContainer.innerHTML = "";
  if (!text) return;
  const p = document.createElement("p");
  p.textContent = text;
  scheduleTableContainer.appendChild(p);
}

async function loadScheduleForWeek(week) {
  if (scheduleCacheByWeek.has(week)) {
    return scheduleCacheByWeek.get(week);
  }

  const { data, error } = await supaSchedule
    .from("schedule")
    .select(
      "id, week, kickoff_time_et, home_team, away_team, location, network"
    )
    .eq("week", week)
    .order("kickoff_time_et", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  const rows = data || [];
  scheduleCacheByWeek.set(week, rows);
  return rows;
}

function renderScheduleTable(rows, week) {
  if (!scheduleTableContainer) return;
  scheduleTableContainer.innerHTML = "";

  if (!rows.length) {
    const p = document.createElement("p");
    p.textContent =
      "No games found for Week " + week + ". The schedule may not be loaded yet.";
    scheduleTableContainer.appendChild(p);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Kickoff (ET)", "Away", "Home", "Network", "Location"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach((g) => {
    const tr = document.createElement("tr");

    const kickoffCell = document.createElement("td");
    if (g.kickoff_time_et) {
      const d = new Date(g.kickoff_time_et);
      kickoffCell.textContent = d.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
    } else {
      kickoffCell.textContent = "";
    }
    tr.appendChild(kickoffCell);

    const awayCell = document.createElement("td");
    awayCell.textContent = g.away_team || "";
    tr.appendChild(awayCell);

    const homeCell = document.createElement("td");
    homeCell.textContent = g.home_team || "";
    tr.appendChild(homeCell);

    const networkCell = document.createElement("td");
    networkCell.textContent = g.network || "";
    tr.appendChild(networkCell);

    const locCell = document.createElement("td");
    locCell.textContent = g.location || "";
    tr.appendChild(locCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  scheduleTableContainer.appendChild(table);
}

async function handleWeekChange() {
  const week = Number(scheduleWeekSelect.value);
  if (!week || week < 1 || week > 18) {
    setScheduleMessage(
      "Please select a valid week between 1 and 18 to view the schedule."
    );
    return;
  }

  try {
    setScheduleMessage("Loading schedule for Week " + week + "...");
    const rows = await loadScheduleForWeek(week);
    renderScheduleTable(rows, week);
  } catch (err) {
    console.error(err);
    setScheduleMessage("Error loading schedule for that week.");
  }
}

async function initSchedule() {
  if (!scheduleWeekSelect) return;

  // Week select is usually already populated with 1–18 in the HTML,
  // but we can still set its initial value to the current week.
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

// Event wiring
if (scheduleWeekSelect) {
  scheduleWeekSelect.addEventListener("change", () => {
    handleWeekChange();
  });
}

if (scheduleJumpCurrentBtn && scheduleWeekSelect) {
  scheduleJumpCurrentBtn.addEventListener("click", async () => {
    const currentWeek = computeCurrentScheduleWeek();
    scheduleWeekSelect.value = String(currentWeek);
    await handleWeekChange();
  });
}

initSchedule();
