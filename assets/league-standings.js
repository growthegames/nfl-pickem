// assets/league-standings.js

const supaLeague = window.supabaseClient;

// Main UI
const leagueSection = document.getElementById("league-standings-section");
const leagueLoginReminder = document.getElementById("league-login-reminder");
const leagueMessage = document.getElementById("league-standings-message");
const leagueTableWrapper = document.getElementById(
  "league-standings-table-wrapper"
);

// Entries remaining callout
const entriesRemainingCallout = document.getElementById(
  "entries-remaining-callout"
);

// Weekly breakdown UI
const breakdownCard = document.getElementById("weekly-breakdown-card");
const breakdownToggleBtn = document.getElementById("weekly-breakdown-toggle");
const breakdownInner = document.getElementById("weekly-breakdown-inner");
const breakdownWeekSelect = document.getElementById("breakdown-week-select");
const breakdownTableBtn = document.getElementById("breakdown-table-btn");
const breakdownPieBtn = document.getElementById("breakdown-pie-btn");
const breakdownTableContainer = document.getElementById(
  "breakdown-table-container"
);
const breakdownChartCanvas = document.getElementById("breakdown-chart");
const breakdownChartWrapper = document.querySelector(
  ".breakdown-chart-wrapper"
);

// Chart.js instance
let breakdownChart = null;

// Cached data for breakdown
let breakdownWeeks = [];
let breakdownPicks = [];

// Team colors for pie chart (primary colors)
const TEAM_COLORS = {
  "Arizona Cardinals": "#97233F",
  "Atlanta Falcons": "#A71930",
  "Baltimore Ravens": "#241773",
  "Buffalo Bills": "#00338D",
  "Carolina Panthers": "#0085CA",
  "Chicago Bears": "#0B162A",
  "Cincinnati Bengals": "#FB4F14",
  "Cleveland Browns": "#311D00",
  "Dallas Cowboys": "#041E42",
  "Denver Broncos": "#FB4F14",
  "Detroit Lions": "#0076B6",
  "Green Bay Packers": "#203731",
  "Houston Texans": "#03202F",
  "Indianapolis Colts": "#002C5F",
  "Jacksonville Jaguars": "#006778",
  "Kansas City Chiefs": "#E31837",
  "Las Vegas Raiders": "#000000",
  "Los Angeles Chargers": "#002A5E",
  "Los Angeles Rams": "#003594",
  "Miami Dolphins": "#008E97",
  "Minnesota Vikings": "#4F2683",
  "New England Patriots": "#002244",
  "New Orleans Saints": "#D3BC8D",
  "New York Giants": "#0B2265",
  "New York Jets": "#125740",
  "Philadelphia Eagles": "#004C54",
  "Pittsburgh Steelers": "#101820",
  "San Francisco 49ers": "#AA0000",
  "Seattle Seahawks": "#002244",
  "Tampa Bay Buccaneers": "#D50A0A",
  "Tennessee Titans": "#4B92DB",
  "Washington Commanders": "#5A1414",
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function setLeagueMessage(text, isError = false) {
  if (!leagueMessage) return;
  leagueMessage.textContent = text || "";
  leagueMessage.className = "message " + (isError ? "error" : "success");
}

function updateEntriesRemainingCallout(stats) {
  if (!entriesRemainingCallout) return;
  if (!stats || !stats.length) {
    entriesRemainingCallout.textContent = "ENTRIES REMAINING: 0 / 0";
    return;
  }

  const activeCount = stats.filter((s) => s.isActive).length;
  entriesRemainingCallout.textContent =
    "ENTRIES REMAINING: " + activeCount + " / " + stats.length;
}

// Determine if an entry is still alive based on its picks & results.
// - If it has any LOSS, it is eliminated.
// - Otherwise, it is active unless entry.is_active === false.
function computeIsActive(entry, picksByEntry) {
  const entryPicks = picksByEntry.get(entry.id) || new Map();

  let hasLoss = false;
  entryPicks.forEach((p) => {
    if (p.result === "LOSS") {
      hasLoss = true;
    }
  });

  if (hasLoss) return false;
  if (entry.is_active === false) return false;
  return true;
}

// ------------------------------------------------------------------
// Load + render standings
// ------------------------------------------------------------------

async function loadLeagueUser() {
  const { data } = await supaLeague.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
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
    // 1. All entries
    const { data: entries, error: entriesError } = await supaLeague
      .from("entries")
      .select("id, label, display_name, is_active, created_at")
      .order("created_at", { ascending: true });

    if (entriesError) throw entriesError;

    if (!entries || !entries.length) {
      setLeagueMessage("No entries found yet.", false);
      leagueTableWrapper.innerHTML = "";
      updateEntriesRemainingCallout([]);
      initWeeklyBreakdown([], []);
      return;
    }

    // 2. All picks (for standings + breakdown)
    const { data: picks, error: picksError } = await supaLeague
      .from("picks")
      .select("entry_id, week, survivor_team, result");

    if (picksError) throw picksError;

    const allPicks = picks || [];

    // Cache for breakdown
    breakdownPicks = allPicks.slice();

    // Determine max week (for columns)
    let maxWeek = 0;
    allPicks.forEach((p) => {
      if (p.week && p.week > maxWeek) maxWeek = p.week;
    });
    if (!maxWeek) maxWeek = 18;

    const weeks = [];
    for (let w = 1; w <= maxWeek; w++) weeks.push(w);

    // Build lookup: entry_id -> Map(week -> pick)
    const picksByEntry = new Map();
    allPicks.forEach((p) => {
      if (!p.entry_id || !p.week) return;
      if (!picksByEntry.has(p.entry_id)) {
        picksByEntry.set(p.entry_id, new Map());
      }
      picksByEntry.get(p.entry_id).set(p.week, p);
    });

    // Build per-entry stats (including isActive)
    const stats = entries.map((entry) => {
      const entryPicks = picksByEntry.get(entry.id) || new Map();
      const isActive = computeIsActive(entry, picksByEntry);

      return {
        id: entry.id,
        label: entry.label || "",
        displayName: entry.display_name || "",
        createdAt: entry.created_at || null,
        isActive,
        picks: entryPicks,
      };
    });

    // Sort:
    // 1) Active first
    // 2) Then eliminated
    // 3) Within each group, by displayName then label
    stats.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      const nameA = (a.displayName || "").toLowerCase();
      const nameB = (b.displayName || "").toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      const labelA = (a.label || "").toLowerCase();
      const labelB = (b.label || "").toLowerCase();
      return labelA.localeCompare(labelB);
    });

    renderLeagueTable(stats, weeks);
    updateEntriesRemainingCallout(stats);
    initWeeklyBreakdown(weeks, allPicks);

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

  const thEntry = document.createElement("th");
  thEntry.textContent = "Entry";
  headerRow.appendChild(thEntry);

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

        if (pick.result === "WIN") {
          td.classList.add("cell-win");
          td.style.backgroundColor = "rgba(0, 128, 0, 0.25)";
        } else if (pick.result === "LOSS") {
          td.classList.add("cell-loss");
          td.style.backgroundColor = "rgba(220, 20, 60, 0.28)";
        } else {
          td.classList.add("cell-pending");
          td.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  leagueTableWrapper.appendChild(table);
}

// ------------------------------------------------------------------
// Weekly breakdown (table + pie chart)
// ------------------------------------------------------------------

function initWeeklyBreakdown(weeks, picks) {
  breakdownWeeks = weeks.slice();
  breakdownPicks = picks.slice();

  if (!breakdownCard || !breakdownWeekSelect) return;

  // Populate week dropdown with only weeks that actually have picks
  const weeksWithPicks = new Set();
  breakdownPicks.forEach((p) => {
    if (p.week) weeksWithPicks.add(p.week);
  });

  const sortedWeeks = Array.from(weeksWithPicks).sort((a, b) => a - b);

  breakdownWeekSelect.innerHTML = "";
  if (!sortedWeeks.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No weeks with picks yet";
    breakdownWeekSelect.appendChild(opt);
  } else {
    sortedWeeks.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = String(w);
      opt.textContent = "Week " + w;
      breakdownWeekSelect.appendChild(opt);
    });
  }

  // Default to latest week with picks, table view visible
  if (sortedWeeks.length) {
    breakdownWeekSelect.value = String(sortedWeeks[sortedWeeks.length - 1]);
    renderBreakdownForSelectedWeek("table");
  } else {
    clearBreakdownVisuals();
  }
}

function clearBreakdownVisuals() {
  if (breakdownTableContainer) {
    breakdownTableContainer.innerHTML = "";
    breakdownTableContainer.style.display = "block";
  }
  if (breakdownChartWrapper) {
    breakdownChartWrapper.style.display = "none";
  }
  if (breakdownChart && typeof breakdownChart.destroy === "function") {
    breakdownChart.destroy();
    breakdownChart = null;
  }
  if (breakdownChartCanvas) {
    const ctx = breakdownChartCanvas.getContext("2d");
    ctx.clearRect(
      0,
      0,
      breakdownChartCanvas.width,
      breakdownChartCanvas.height
    );
  }
}

function getPickCountsForWeek(week) {
  const counts = new Map();
  breakdownPicks.forEach((p) => {
    if (p.week === week && p.survivor_team) {
      const team = p.survivor_team;
      counts.set(team, (counts.get(team) || 0) + 1);
    }
  });

  return Array.from(counts.entries())
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count);
}

function renderBreakdownTable(week) {
  if (!breakdownTableContainer) return;
  breakdownTableContainer.innerHTML = "";

  const rows = getPickCountsForWeek(week);

  if (!rows.length) {
    const p = document.createElement("p");
    p.textContent = "No survivor picks submitted for this week yet.";
    breakdownTableContainer.appendChild(p);
    return;
  }

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Team", "# Picks", "% of Entries"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const teamCell = document.createElement("td");
    teamCell.textContent = row.team;
    tr.appendChild(teamCell);

    const countCell = document.createElement("td");
    countCell.textContent = String(row.count);
    tr.appendChild(countCell);

    const pctCell = document.createElement("td");
    const pct = total ? ((row.count / total) * 100).toFixed(1) : "0.0";
    pctCell.textContent = pct + "%";
    tr.appendChild(pctCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  breakdownTableContainer.appendChild(table);
}

function renderBreakdownPieChart(week) {
  if (!breakdownChartCanvas) return;

  const rows = getPickCountsForWeek(week);
  const labels = rows.map((r) => r.team);
  const counts = rows.map((r) => r.count);

  if (breakdownChart && typeof breakdownChart.destroy === "function") {
    breakdownChart.destroy();
    breakdownChart = null;
  }

  if (!labels.length) {
    const ctx = breakdownChartCanvas.getContext("2d");
    ctx.clearRect(
      0,
      0,
      breakdownChartCanvas.width,
      breakdownChartCanvas.height
    );
    return;
  }

  const colors = labels.map(
    (team) => TEAM_COLORS[team] || "#888888" // fallback neutral
  );

  const ctx = breakdownChartCanvas.getContext("2d");
  breakdownChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: "#f5f5f5",
          },
        },
      },
    },
  });
}

function renderBreakdownForSelectedWeek(mode) {
  if (!breakdownWeekSelect) return;
  const selected = Number(breakdownWeekSelect.value);
  if (!selected || selected < 1 || selected > 18) {
    clearBreakdownVisuals();
    return;
  }

  const viewMode = mode === "pie" ? "pie" : "table";

  // Button active states
  if (breakdownTableBtn) {
    breakdownTableBtn.classList.toggle("active", viewMode === "table");
  }
  if (breakdownPieBtn) {
    breakdownPieBtn.classList.toggle("active", viewMode === "pie");
  }

  if (viewMode === "table") {
    if (breakdownTableContainer) breakdownTableContainer.style.display = "block";
    if (breakdownChartWrapper) breakdownChartWrapper.style.display = "none";
    renderBreakdownTable(selected);
  } else {
    if (breakdownTableContainer) breakdownTableContainer.style.display = "none";
    if (breakdownChartWrapper) breakdownChartWrapper.style.display = "block";
    renderBreakdownPieChart(selected);
  }
}

// ------------------------------------------------------------------
// Event wiring
// ------------------------------------------------------------------

function wireBreakdownEvents() {
  if (breakdownToggleBtn && breakdownInner) {
    breakdownToggleBtn.addEventListener("click", () => {
      const isHidden =
        breakdownInner.style.display === "none" ||
        breakdownInner.style.display === "";
      breakdownInner.style.display = isHidden ? "block" : "none";
      breakdownToggleBtn.textContent = isHidden
        ? "HIDE WEEKLY BREAKDOWN"
        : "SHOW WEEKLY BREAKDOWN";
    });
  }

  if (breakdownWeekSelect) {
    breakdownWeekSelect.addEventListener("change", () => {
      // When changing week, default back to table view
      renderBreakdownForSelectedWeek("table");
    });
  }

  if (breakdownTableBtn) {
    breakdownTableBtn.addEventListener("click", () => {
      renderBreakdownForSelectedWeek("table");
    });
  }

  if (breakdownPieBtn) {
    breakdownPieBtn.addEventListener("click", () => {
      renderBreakdownForSelectedWeek("pie");
    });
  }
}

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------

wireBreakdownEvents();
loadLeagueUser();
