// assets/league-standings.js

const supaLeague = window.supabaseClient;

const leagueSection = document.getElementById("league-standings-section");
const leagueLoginReminder = document.getElementById("league-login-reminder");
const leagueMessage = document.getElementById("league-standings-message");
const leagueTableWrapper = document.getElementById("league-standings-table-wrapper");

let leagueUser = null;

function setLeagueMessage(text, isError = false) {
  if (!leagueMessage) return;
  leagueMessage.textContent = text || "";
  leagueMessage.className = "message " + (isError ? "error" : "success");
}

async function loadLeagueUser() {
  const { data } = await supaLeague.auth.getUser();
  leagueUser = data?.user ?? null;

  if (!leagueUser) {
    if (leagueSection) leagueSection.style.display = "none";
    if (leagueLoginReminder) leagueLoginReminder.style.display = "block";
    return;
  }

  if (leagueSection) leagueSection.style.display = "block";
  if (leagueLoginReminder) leagueLoginReminder.style.display = "none";

  await loadLeagueStandings();
}

async function loadLeagueStandings() {
  setLeagueMessage("Loading league standings...");

  try {
    // 1) Load all entries
    const { data: entries, error: entriesError } = await supaLeague
      .from("entries")
      .select("id, label, display_name, is_active, created_at")
      .order("created_at", { ascending: true });

    if (entriesError) throw entriesError;

    if (!entries || !entries.length) {
      setLeagueMessage("No entries found yet.", false);
      return;
    }

    // 2) Load all picks
    const { data: picks, error: picksError } = await supaLeague
      .from("picks")
      .select("entry_id, week, survivor_team, result");

    if (picksError) throw picksError;

    const allPicks = picks || [];

    // Determine the max week used (fallback to 18)
    let maxWeek = 0;
    allPicks.forEach((p) => {
      if (p.week && p.week > maxWeek) maxWeek = p.week;
    });
    if (!maxWeek) maxWeek = 18;

    const weeks = [];
    for (let w = 1; w <= maxWeek; w++) weeks.push(w);

    // Build lookup: entryId -> { week -> pick }
    const picksByEntry = new Map();
    allPicks.forEach((p) => {
      if (!p.entry_id || !p.week) return;
      if (!picksByEntry.has(p.entry_id)) {
        picksByEntry.set(p.entry_id, new Map());
      }
      picksByEntry.get(p.entry_id).set(p.week, p);
    });

    // 3) Build stats, including active vs eliminated flag
    const stats = entries.map((entry) => {
      const entryPicks = picksByEntry.get(entry.id) || new Map();

      // Treat explicit false as eliminated; anything else is active
      const isActive = entry.is_active === false ? false : true;

      return {
        id: entry.id,
        label: entry.label || "",
        displayName: entry.display_name || "",
        isActive,
        picks: entryPicks,
      };
    });

    // 4) Sort:
    //    - Active entries (isActive = true) first
    //    - Then eliminated entries (isActive = false)
    //    - Within each group, sort by displayName then label
    stats.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1; // active first
      }
      const nameA = (a.displayName || "").toLowerCase();
      const nameB = (b.displayName || "").toLowerCase();
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      const labelA = (a.label || "").toLowerCase();
      const labelB = (b.label || "").toLowerCase();
      return labelA.localeCompare(labelB);
    });

    renderLeagueTable(stats, weeks);
    setLeagueMessage("");
  } catch (err) {
    console.error(err);
    setLeagueMessage(
      "Error loading league standings: " + (err.message || "Unknown error"),
      true
    );
  }
}

function renderLeagueTable(stats, weeks) {
  leagueTableWrapper.innerHTML = "";

  if (!stats.length) {
    const p = document.createElement("p");
    p.textContent = "No league standings to display.";
    leagueTableWrapper.appendChild(p);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  // First column header
  const thEntry = document.createElement("th");
  thEntry.textContent = "Entry";
  headerRow.appendChild(thEntry);

  // Week headers
  weeks.forEach((w) => {
    const th = document.createElement("th");
    th.textContent = "W" + w;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  stats.forEach((row) => {
    const tr = document.createElement("tr");

    // Optional class for eliminated rows (for CSS styling)
    if (!row.isActive) {
      tr.classList.add("eliminated-row");
    }

    const entryCell = document.createElement("td");
    const name = row.displayName || "Entry";
    const label = row.label || "";
    entryCell.textContent = `${name} – ${label}`;
    tr.appendChild(entryCell);

    const entryPicks = row.picks;

    weeks.forEach((week) => {
      const td = document.createElement("td");
      td.classList.add("week-cell");

      const pick = entryPicks.get(week);

      if (!pick) {
        td.textContent = "";
      } else {
        td.textContent = pick.survivor_team || "";

        // Use existing classes for coloring, if your CSS already defines these
        if (pick.result === "WIN") {
          td.classList.add("cell-win");
        } else if (pick.result === "LOSS") {
          td.classList.add("cell-loss");
        } else {
          td.classList.add("cell-pending");
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  leagueTableWrapper.appendChild(table);
}

// Initialize
loadLeagueUser();
