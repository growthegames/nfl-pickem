// assets/league-standings.js

const supaLeague = window.supabaseClient;

const leagueSection = document.getElementById("league-standings-section");
const leagueLoginReminder = document.getElementById("league-login-reminder");
const leagueMessage = document.getElementById("league-standings-message");
const leagueTableWrapper = document.getElementById("league-standings-table-wrapper");

let leagueUser = null;
let leagueEntries = [];
let leaguePicks = [];

function setLeagueMessage(text, isError = false) {
  if (!leagueMessage) return;
  leagueMessage.textContent = text || "";
  leagueMessage.className = "message " + (isError ? "error" : "success");
}

async function loadLeagueUser() {
  const { data } = await supaLeague.auth.getUser();
  leagueUser = data?.user ?? null;
}

async function loadAllEntries() {
  const { data, error } = await supaLeague
    .from("entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    throw new Error("Error loading entries");
  }

  leagueEntries = data || [];
}

async function loadAllPicks() {
  if (!leagueEntries.length) {
    leaguePicks = [];
    return;
  }

  const entryIds = leagueEntries.map((e) => e.id);

  const { data, error } = await supaLeague
    .from("picks")
    .select("*")
    .in("entry_id", entryIds);

  if (error) {
    console.error(error);
    throw new Error("Error loading picks");
  }

  leaguePicks = data || [];
}

function buildLeagueTable() {
  leagueTableWrapper.innerHTML = "";

  if (!leagueEntries.length) {
    const p = document.createElement("p");
    p.textContent = "No entries have been created yet.";
    leagueTableWrapper.appendChild(p);
    return;
  }

  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  // Map: entry_id -> { [weekNumber]: { team, result } }
  const pickMap = new Map();
  leagueEntries.forEach((entry) => {
    pickMap.set(entry.id, {});
  });

  leaguePicks.forEach((pick) => {
    const tableForEntry = pickMap.get(pick.entry_id);
    if (tableForEntry) {
      tableForEntry[pick.week] = {
        team: pick.survivor_team || "",
        result: pick.result || null,
      };
    }
  });

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const entryHeader = document.createElement("th");
  entryHeader.textContent = "Entry (Owner – Label)";
  headerRow.appendChild(entryHeader);

  weeks.forEach((week) => {
    const th = document.createElement("th");
    th.textContent = `Week ${week}`;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  leagueEntries.forEach((entry) => {
    const tr = document.createElement("tr");

    const entryCell = document.createElement("td");
    const ownerEmail = entry.owner_email || "Unknown";
    entryCell.textContent = `${ownerEmail} – ${entry.label}`;
    tr.appendChild(entryCell);

    const weekToPick = pickMap.get(entry.id) || {};

    weeks.forEach((week) => {
      const td = document.createElement("td");
      const cellData = weekToPick[week] || {};
      const team = cellData.team || "";
      const result = cellData.result;

      if (team) {
        td.textContent = team;

        if (result === "WIN") {
          td.classList.add("pick-win");
        } else if (result === "LOSS") {
          td.classList.add("pick-loss");
        } else {
          td.classList.add("pick-pending");
        }
      } else {
        td.textContent = "";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  leagueTableWrapper.appendChild(table);
}

async function initLeagueStandings() {
  await loadLeagueUser();

  if (!leagueUser) {
    if (leagueSection) leagueSection.style.display = "none";
    if (leagueLoginReminder) leagueLoginReminder.style.display = "block";
    return;
  }

  if (leagueSection) leagueSection.style.display = "block";
  if (leagueLoginReminder) leagueLoginReminder.style.display = "none";

  try {
    setLeagueMessage("Loading league standings...");
    await loadAllEntries();
    await loadAllPicks();
    buildLeagueTable();
    setLeagueMessage("");
  } catch (err) {
    console.error(err);
    setLeagueMessage("Error loading league standings.", true);
  }
}

initLeagueStandings();
