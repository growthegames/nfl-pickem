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

// Chart.js instance
let breakdownChart = null;

// Cached data for breakdown
let breakdownWeeks = [];
let breakdownPicks = [];

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

/**
 * Survivor elimination rules:
 * - Any LOSS => eliminated
 * - Missing a pick for any week that has league activity (requiredWeeks) => eliminated
 * - entry.is_active === false => eliminated
 */
function computeIsActive(entry, picksByEntry, requiredWeeks) {
  const entryPicks = picksByEntry.get(entry.id) || new Map();

  // Any LOSS eliminates
  let hasLoss = false;
  entryPicks.forEach((p) => {
    if (p.result === "LOSS") hasLoss = true;
  });
  if (hasLoss) return false;

  // Missing pick in any required week eliminates
  if (Array.isArray(requiredWeeks) && requiredWeeks.length) {
    for (const w of requiredWeeks) {
      if (!entryPicks.get(w)) return false;
    }
  }

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

    // Determine weeks to display
    let maxWeek = 0;
    const weeksWithAnyPicks = new Set();

    allPicks.forEach((p) => {
      if (p.week && p.week > maxWeek) maxWeek = p.week;
      if (p.week) weeksWithAnyPicks.add(p.week);
    });

    if (!maxWeek) maxWeek = 18;

    const weeks = [];
    for (let w = 1; w <= maxWeek; w++) weeks.push(w);

    // Required weeks = weeks that have any picks in the league
    // (If a week has started/been played and people picked, missing pick => eliminated)
    const requiredWeeks = Array.from(weeksWithAnyPicks).sort((a, b) => a - b);

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
      const isActive = computeIsActive(entry, picksByEntry, requiredWeeks);

      return {
        id: entry.id,
        label: entry.label || "",
        displayName: entry.display_name || "",
        createdAt: entry.created_at || null,
        isActive,
        picks: entryPicks,
        requiredWeeks,
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
    if (!row.isActive) tr.classList.add("eliminated-row");

    const entryCell = document.createElement("td");
    entryCell.classList.add("entry-cell");

    const name = row.displayName || "Entry";
    const label = row.label || "";
    entryCell.textContent = `${name} – ${label}`;

    if (!row.isActive) {
      entryCell.classList.add("entry-eliminated");
      entryCell.title =
        "Eliminated (loss or missed pick in an active week)";
    }

    tr.appendChild(entryCell);

    const entryPicks = row.picks;
    const requiredWeeks = row.requiredWeeks || [];

    weeks.forEach((week) => {
      const td = document.createElement("td");
      td.classList.add("week-cell");

      const pick = entryPicks.get(week);

      // Missing pick in a required week => treat like a LOSS visually
      const isRequiredWeek = requiredWeeks.includes(week);

      if (!pick) {
        td.textContent = "";

        if (!row.isActive && isRequiredWeek) {
          td.textContent = "NO PICK";
          td.classList.add("cell-loss", "cell-missed-pick");
          td.style.backgroundColor = "rgba(220, 20, 60, 0.28)";
        }
      } else {
        td.textContent = pick.survivor_team || "";

        if (pick.result === "WIN") {
          td.classList.add("cell-win");
          td.style.backgroundColor = "rgba(0, 128, 0, 0.25)";
        } else if (pick.result === "LOSS") {
          td.classList.add("cell-loss", "cell-eliminating");
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

  // Default to latest week with picks
  if (sortedWeeks.length) {
    breakdownWeekSelect.value = String(sortedWeeks[sortedWeeks.length - 1]);
    renderBreakdownForSelectedWeek("table");
  } else {
    clearBreakdownVisuals();
  }
}

function clearBreakdownVisuals() {
  if (breakdownTableContainer) breakdownTableContainer.innerHTML = "";
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

  const ctx = breakdownChartCanvas.getContext("2d");
  breakdownChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: counts }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } },
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

  if (mode === "pie") {
    renderBreakdownTable(selected);
    renderBreakdownPieChart(selected);
  } else {
    renderBreakdownTable(selected);
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
      renderBreakdownForSelectedWeek("table");
    });
  }

  if (breakdownTableBtn) {
    breakdownTableBtn.addEventListener("click", () => {
      breakdownTableBtn.classList.add("active");
      breakdownPieBtn && breakdownPieBtn.classList.remove("active");
      renderBreakdownForSelectedWeek("table");
    });
  }

  if (breakdownPieBtn) {
    breakdownPieBtn.addEventListener("click", () => {
      breakdownPieBtn.classList.add("active");
      breakdownTableBtn && breakdownTableBtn.classList.remove("active");
      renderBreakdownForSelectedWeek("pie");
    });
  }
}

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------

wireBreakdownEvents();
loadLeagueUser();
