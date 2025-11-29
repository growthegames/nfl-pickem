// assets/standings.js

const supaStandings = window.supabaseClient;

const standingsSection = document.getElementById("standings-section");
const standingsLoginReminder = document.getElementById("standings-login-reminder");
const standingsMessage = document.getElementById("standings-message");
const standingsTableWrapper = document.getElementById("standings-table-wrapper");

let standingsUser = null;
let standingsEntries = [];
let standingsPicks = [];

function setStandingsMessage(text, isError = false) {
  if (!standingsMessage) return;
  standingsMessage.textContent = text || "";
  standingsMessage.className = "message " + (isError ? "error" : "success");
}

async function loadUser() {
  const { data } = await supaStandings.auth.getUser();
  standingsUser = data?.user ?? null;
}

async function loadEntries() {
  // For now: only this user's entries (My Standings)
  const { data, error } = await supaStandings
    .from("entries")
    .select("*")
    .eq("user_id", standingsUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    throw new Error("Error loading entries");
  }

  standingsEntries = data || [];
}

async function loadPicks() {
  if (!standingsEntries.length) {
    standingsPicks = [];
    return;
  }

  const entryIds = standingsEntries.map((e) => e.id);

  const { data, error } = await supaStandings
    .from("picks")
    .select("*")
    .in("entry_id", entryIds);

  if (error) {
    console.error(error);
    throw new Error("Error loading picks");
  }

  standingsPicks = data || [];
}

function buildStandingsTable() {
  standingsTableWrapper.innerHTML = "";

  if (!standingsEntries.length) {
    const p = document.createElement("p");
    p.textContent =
      "You don't have any entries yet. Go to the Home page to create entries first.";
    standingsTableWrapper.appendChild(p);
    return;
  }

  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

  // Map: entry_id -> { [weekNumber]: { team, result } }
  const pickMap = new Map();
  standingsEntries.forEach((entry) => {
    pickMap.set(entry.id, {});
  });

  standingsPicks.forEach((pick) => {
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
  entryHeader.textContent = "Entry";
  headerRow.appendChild(entryHeader);

  weeks.forEach((week) => {
    const th = document.createElement("th");
    th.textContent = `Week ${week}`;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  standingsEntries.forEach((entry) => {
    const tr = document.createElement("tr");

    const entryCell = document.createElement("td");
    entryCell.textContent = entry.label;
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
  standingsTableWrapper.appendChild(table);
}

async function initStandings() {
  await loadUser();

  if (!standingsUser) {
    if (standingsSection) standingsSection.style.display = "none";
    if (standingsLoginReminder) standingsLoginReminder.style.display = "block";
    return;
  }

  if (standingsSection) standingsSection.style.display = "block";
  if (standingsLoginReminder) standingsLoginReminder.style.display = "none";

  try {
    setStandingsMessage("Loading your standings...");
    await loadEntries();
    await loadPicks();
    buildStandingsTable();
    setStandingsMessage("");
  } catch (err) {
    console.error(err);
    setStandingsMessage("Error loading standings.", true);
  }
}

initStandings();
