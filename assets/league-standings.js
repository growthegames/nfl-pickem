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

// Deadlines (week -> Date)
const weekDeadlineMap = new Map();

// Testing strategy:
// - Only enforce NO PICK starting from the latest week whose deadline has passed.
// - If an entry is eliminated by NO PICK in that window, keep the NO PICK cell forever.
let ENFORCE_NO_PICK_FROM_WEEK = null;

// Breakdown view mode
let breakdownMode = "table"; // "table" | "pie"

// Optional: team colors (only used for pie chart)
const TEAM_COLORS = {
  "Arizona Cardinals": "#97233F",
  "Atlanta Falcons": "#A71930",
  "Baltimore Ravens": "#241773",
  "Buffalo Bills": "#00338D",
  "Carolina Panthers": "#0085CA",
  "Chicago Bears": "#0B162A",
  "Cincinnati Bengals": "#FB4F14",
  "Cleveland Browns": "#311D00",
  "Dallas Cowboys": "#003594",
  "Denver Broncos": "#FB4F14",
  "Detroit Lions": "#0076B6",
  "Green Bay Packers": "#203731",
  "Houston Texans": "#03202F",
  "Indianapolis Colts": "#002C5F",
  "Jacksonville Jaguars": "#006778",
  "Kansas City Chiefs": "#E31837",
  "Las Vegas Raiders": "#000000",
  "Los Angeles Chargers": "#0080C6",
  "Los Angeles Rams": "#003594",
  "Miami Dolphins": "#008E97",
  "Minnesota Vikings": "#4F2683",
  "New England Patriots": "#002244",
  "New Orleans Saints": "#D3BC8D",
  "New York Giants": "#0B2265",
  "New York Jets": "#125740",
  "Philadelphia Eagles": "#004C54",
  "Pittsburgh Steelers": "#FFB612",
  "San Francisco 49ers": "#AA0000",
  "Seattle Seahawks": "#002244",
  "Tampa Bay Buccaneers": "#D50A0A",
  "Tennessee Titans": "#0C2340",
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

function safeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
}

function hasDeadlinePassed(week) {
  const dl = weekDeadlineMap.get(week) || null;
  if (!dl) return false;
  return new Date() > dl;
}

function computeEnforceNoPickFromWeek() {
  // Latest week with a passed deadline
  let latestClosed = null;
  weekDeadlineMap.forEach((dl, week) => {
    if (new Date() > dl) {
      if (latestClosed === null || week > latestClosed) latestClosed = week;
    }
  });
  ENFORCE_NO_PICK_FROM_WEEK = latestClosed; // can be null if nothing passed yet
}

function isNoPickEnforcementWeek(week) {
  if (!ENFORCE_NO_PICK_FROM_WEEK) return false;
  return week >= ENFORCE_NO_PICK_FROM_WEEK;
}

function entryExistedForWeek(entryCreatedAt, week) {
  // Only treat a week as “missable” if the entry existed before that week’s deadline.
  const dl = weekDeadlineMap.get(week) || null;
  if (!dl) return false;

  const created = safeDate(entryCreatedAt);
  if (!created) return true; // fallback: assume existed
  return created <= dl;
}

function getLossWeek(entryPicksMap) {
  const weeks = Array.from(entryPicksMap.keys()).sort((a, b) => a - b);
  for (const w of weeks) {
    const pick = entryPicksMap.get(w);
    if (pick?.result === "LOSS") return w;
  }
  return null;
}

function getMissedPickWeek(entry, entryPicksMap) {
  // Find earliest week where:
  // - deadline passed
  // - week is in enforcement window (testing strategy)
  // - entry existed before deadline
  // - no pick exists
  const weeks = Array.from(weekDeadlineMap.keys()).sort((a, b) => a - b);

  for (const w of weeks) {
    if (!isNoPickEnforcementWeek(w)) continue;
    if (!hasDeadlinePassed(w)) continue;
    if (!entryExistedForWeek(entry.created_at, w)) continue;
    if (!entryPicksMap.get(w)) return w;
  }
  return null;
}

/**
 * Survivor elimination rules (with testing strategy):
 * - Any LOSS => eliminated
 * - Missed pick after deadline (ONLY in enforcement window) => eliminated
 * - entry.is_active === false => eliminated
 */
function computeIsActive(entry, entryPicksMap) {
  for (const [, p] of entryPicksMap.entries()) {
    if (p?.result === "LOSS") return false;
  }

  const missedWeek = getMissedPickWeek(entry, entryPicksMap);
  if (missedWeek !== null) return false;

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

async function loadWeekDeadlines() {
  weekDeadlineMap.clear();

  const { data, error } = await supaLeague
    .from("week_deadlines")
    .select("week, deadline");

  if (error) throw error;

  (data || []).forEach((row) => {
    if (!row.week || !row.deadline) return;
    const d = safeDate(row.deadline);
    if (!d) return;
    weekDeadlineMap.set(row.week, d);
  });

  computeEnforceNoPickFromWeek();
}

async function loadLeagueStandings() {
  setLeagueMessage("Loading league standings...");

  try {
    // 0) Week deadlines first (needed for NO PICK logic)
    await loadWeekDeadlines();

    // 1) All entries
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

    // 2) All picks (for standings + breakdown)
    const { data: picks, error: picksError } = await supaLeague
      .from("picks")
      .select("entry_id, week, survivor_team, result");

    if (picksError) throw picksError;

    const allPicks = picks || [];
    breakdownPicks = allPicks.slice();

    // Determine weeks to display (keep it consistent with your existing behavior)
    let maxWeek = 0;
    allPicks.forEach((p) => {
      if (p.week && p.week > maxWeek) maxWeek = p.week;
    });

    // If no picks yet, still show a reasonable range
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

    // Build per-entry stats
    const stats = entries.map((entry) => {
      const entryPicks = picksByEntry.get(entry.id) || new Map();
      const isActive = computeIsActive(entry, entryPicks);

      const lossWeek = getLossWeek(entryPicks);
      const missedWeek = getMissedPickWeek(entry, entryPicks);

      // Eliminated week = earliest of lossWeek or missedWeek
      let eliminatedWeek = null;
      if (lossWeek !== null && missedWeek !== null) {
        eliminatedWeek = Math.min(lossWeek, missedWeek);
      } else if (lossWeek !== null) {
        eliminatedWeek = lossWeek;
      } else if (missedWeek !== null) {
        eliminatedWeek = missedWeek;
      }

      return {
        id: entry.id,
        label: entry.label || "",
        displayName: entry.display_name || "",
        createdAt: entry.created_at || null,
        isActive,
        picks: entryPicks,
        lossWeek,
        missedWeek,
        eliminatedWeek,
      };
    });

    // Sort:
    // 1) Active first
    // 2) Eliminated
    // 3) Within group by name/label
    stats.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;

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
      entryCell.style.textDecoration = "line-through";
      entryCell.title =
        row.missedWeek
          ? `Eliminated (NO PICK in Week ${row.missedWeek})`
          : row.lossWeek
          ? `Eliminated (LOSS in Week ${row.lossWeek})`
          : "Eliminated";
    }

    tr.appendChild(entryCell);

    const entryPicks = row.picks;

    weeks.forEach((week) => {
      const td = document.createElement("td");
      td.classList.add("week-cell");

      const pick = entryPicks.get(week);

      if (!pick) {
        const deadlinePassed = hasDeadlinePassed(week);
        const existed = entryExistedForWeek(row.createdAt, week);

        // Permanent: always show NO PICK on the elimination week (forever)
        const isPermanentNoPickWeek = row.missedWeek === week;

        // Testing strategy: only show NO PICK generally starting from latest closed week
        const enforceNow = isNoPickEnforcementWeek(week);

        if (
          isPermanentNoPickWeek ||
          (deadlinePassed && existed && enforceNow && !row.isActive && row.eliminatedWeek === week)
        ) {
          td.textContent = "NO PICK";
          td.classList.add("cell-loss", "cell-missed-pick");
          td.style.backgroundColor = "rgba(220, 20, 60, 0.28)";
          td.style.fontWeight = "700";

          // Stronger emphasis if this was the eliminating week
          if (row.eliminatedWeek === week) td.style.textDecoration = "line-through";
        } else {
          td.textContent = "";
          td.classList.add("cell-pending");
          td.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
        }

        tr.appendChild(td);
        return;
      }

      // Pick exists
      td.textContent = pick.survivor_team || "";

      if (pick.result === "WIN") {
        td.classList.add("cell-win");
        td.style.backgroundColor = "rgba(0, 128, 0, 0.25)";
      } else if (pick.result === "LOSS") {
        td.classList.add("cell-loss", "cell-eliminating");
        td.style.backgroundColor = "rgba(220, 20, 60, 0.28)";
        td.style.fontWeight = "700";
        td.style.textDecoration = "line-through";
      } else {
        td.classList.add("cell-pending");
        td.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  leagueTableWrapper.appendChild(table);
}

// ------------------------------------------------------------------
// Weekly breakdown (table + pie chart) with proper view toggling
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
    clearBreakdownVisuals();
    return;
  }

  sortedWeeks.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = "Week " + w;
    breakdownWeekSelect.appendChild(opt);
  });

  // Default to latest week with picks
  breakdownWeekSelect.value = String(sortedWeeks[sortedWeeks.length - 1]);

  // Default mode = table
  breakdownMode = "table";
  if (breakdownTableBtn) breakdownTableBtn.classList.add("active");
  if (breakdownPieBtn) breakdownPieBtn.classList.remove("active");

  renderBreakdownForSelectedWeek();
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
  if (!breakdownChartCanvas || !window.Chart) return;

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

  const colors = labels.map((team) => TEAM_COLORS[team] || "#888888");

  const ctx = breakdownChartCanvas.getContext("2d");
  breakdownChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" },
      },
    },
  });
}

function setBreakdownView(mode) {
  breakdownMode = mode;

  if (breakdownTableBtn) breakdownTableBtn.classList.toggle("active", mode === "table");
  if (breakdownPieBtn) breakdownPieBtn.classList.toggle("active", mode === "pie");

  // Only show the relevant container
  if (breakdownTableContainer) {
    breakdownTableContainer.style.display = mode === "table" ? "block" : "none";
  }
  if (breakdownChartCanvas) {
    // Canvas needs a container height in CSS; we just hide/show it here
    breakdownChartCanvas.style.display = mode === "pie" ? "block" : "none";
  }

  renderBreakdownForSelectedWeek();
}

function renderBreakdownForSelectedWeek() {
  if (!breakdownWeekSelect) return;
  const selected = Number(breakdownWeekSelect.value);

  if (!selected || selected < 1 || selected > 18) {
    clearBreakdownVisuals();
    return;
  }

  // Always refresh the underlying content for the chosen mode
  if (breakdownMode === "table") {
    renderBreakdownTable(selected);
    if (breakdownChart && typeof breakdownChart.destroy === "function") {
      breakdownChart.destroy();
      breakdownChart = null;
    }
  } else {
    // Pie
    if (breakdownTableContainer) breakdownTableContainer.innerHTML = "";
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
      renderBreakdownForSelectedWeek();
    });
  }

  if (breakdownTableBtn) {
    breakdownTableBtn.addEventListener("click", () => {
      setBreakdownView("table");
    });
  }

  if (breakdownPieBtn) {
    breakdownPieBtn.addEventListener("click", () => {
      setBreakdownView("pie");
    });
  }
}

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------

wireBreakdownEvents();
loadLeagueUser();
