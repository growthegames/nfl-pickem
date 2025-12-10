// assets/league-standings.js

const supaLeague = window.supabaseClient;

const leagueSection = document.getElementById("league-standings-section");
const leagueLoginReminder = document.getElementById("league-login-reminder");
const leagueMessage = document.getElementById("league-standings-message");
const leagueTableWrapper = document.getElementById("league-standings-table-wrapper");

// Entries remaining callout
const entriesRemainingCallout = document.getElementById("entries-remaining-callout");

// Weekly breakdown elements
const breakdownSection = document.getElementById("week-breakdown-section");
const breakdownWeekSelect = document.getElementById("breakdown-week-select");
const breakdownEmpty = document.getElementById("week-breakdown-empty");
const breakdownTableContainer = document.getElementById("week-breakdown-table");
const breakdownChartCanvas = document.getElementById("week-breakdown-chart");
const breakdownChartWrapper = document.getElementById("week-breakdown-chart-wrapper");
const toggleBreakdownBtn = document.getElementById("toggle-breakdown-btn");
const breakdownViewTableBtn = document.getElementById("breakdown-view-table-btn");
const breakdownViewChartBtn = document.getElementById("breakdown-view-chart-btn");

let leagueUser = null;
let leagueEntries = [];
let leaguePicks = [];      // all picks from Supabase
let leagueWeeks = [];      // list of weeks used in the table
let breakdownChart = null; // Chart.js instance
let currentBreakdownView = "table"; // "table" or "chart"

// ---------------------- NFL Team Colors ----------------------
// Primary brand-ish colors for each team (approx) for the pie chart.
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
  "Washington Commanders": "#5A1414"
};

const BASE_PALETTE = [
  "#013369",
  "#D50A0A",
  "#FFB612",
  "#203731",
  "#4F2683",
  "#002244",
  "#0085CA",
  "#A5ACAF",
  "#C60C30",
  "#006778"
];

// ---------------------- Helpers ----------------------

function setLeagueMessage(text, isError = false) {
  if (!leagueMessage) return;
  leagueMessage.textContent = text || "";
  leagueMessage.className = "message " + (isError ? "error" : "success");
}

// Update the "Entries remaining" callout
function updateEntriesRemainingCallout() {
  if (!entriesRemainingCallout) return;

  if (Array.isArray(leagueEntries) && leagueEntries.length > 0) {
    const total = leagueEntries.length;
    const alive = leagueEntries.filter((e) => e.is_active).length;

    entriesRemainingCallout.textContent =
      "Entries remaining: " + alive + " of " + total;
    return;
  }

  if (!leagueTableWrapper) {
    entriesRemainingCallout.textContent = "";
    return;
  }

  const rows = leagueTableWrapper.querySelectorAll("tbody tr");
  if (!rows.length) {
    entriesRemainingCallout.textContent = "Entries remaining: 0";
    return;
  }

  let total = 0;
  let alive = 0;

  rows.forEach((row) => {
    total++;
    const text = (row.textContent || "").toUpperCase();
    if (!text.includes("ELIMINATED")) {
      alive++;
    }
  });

  entriesRemainingCallout.textContent =
    "Entries remaining: " + alive + " of " + total;
}

// Populate the week <select> for the breakdown chart/table
function populateWeekSelect(weeks) {
  if (!breakdownWeekSelect) return;

  breakdownWeekSelect.innerHTML = "";

  weeks.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = "Week " + w;
    breakdownWeekSelect.appendChild(opt);
  });

  if (weeks.length > 0) {
    breakdownWeekSelect.value = String(weeks[weeks.length - 1]);
  }
}

function getCurrentBreakdownWeek() {
  if (!breakdownWeekSelect) return null;
  const val = breakdownWeekSelect.value;
  if (!val) return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return num;
}

// Compute aggregated counts for a given week
function getWeekTeamCounts(week) {
  const picksThisWeek = (leaguePicks || []).filter(
    (p) => p.week === week && p.survivor_team
  );

  const counts = {};
  let total = 0;

  picksThisWeek.forEach((p) => {
    const team = p.survivor_team;
    if (!team) return;
    counts[team] = (counts[team] || 0) + 1;
    total++;
  });

  const labels = Object.keys(counts).sort((a, b) => {
    const diff = counts[b] - counts[a];
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  const orderedCounts = labels.map((l) => counts[l]);

  return { labels, counts: orderedCounts, total };
}

// Build the breakdown table from aggregated data
function updateWeekBreakdownTableWithData(labels, counts, total) {
  if (!breakdownTableContainer) return;

  breakdownTableContainer.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("breakdown-table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const thTeam = document.createElement("th");
  thTeam.textContent = "Team";
  headerRow.appendChild(thTeam);

  const thPicks = document.createElement("th");
  thPicks.textContent = "Picks";
  headerRow.appendChild(thPicks);

  const thPercent = document.createElement("th");
  thPercent.textContent = "% of entries";
  headerRow.appendChild(thPercent);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  labels.forEach((team, idx) => {
    const count = counts[idx];
    const pct = total ? ((count / total) * 100).toFixed(1) : "0.0";

    const tr = document.createElement("tr");

    const tdTeam = document.createElement("td");
    tdTeam.textContent = team;
    tr.appendChild(tdTeam);

    const tdPicks = document.createElement("td");
    tdPicks.textContent = String(count);
    tr.appendChild(tdPicks);

    const tdPct = document.createElement("td");
    tdPct.textContent = pct + "%";
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  breakdownTableContainer.appendChild(table);
}

// Build / update the pie chart from aggregated data
function updateWeekBreakdownChartWithData(labels, counts) {
  if (!breakdownChartCanvas) return;

  const colors = labels.map((team, i) => {
    return TEAM_COLORS[team] || BASE_PALETTE[i % BASE_PALETTE.length];
  });

  if (breakdownChart) {
    breakdownChart.destroy();
  }

  breakdownChart = new Chart(breakdownChartCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.1,
      layout: {
        padding: { top: 10, bottom: 10, left: 10, right: 10 }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            font: { size: 11 },
            padding: 8
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const value = ctx.parsed || 0;
              const dataArr = ctx.chart.data.datasets[0].data || [];
              const total = dataArr.reduce((sum, v) => sum + v, 0);
              const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${label}: ${value} pick${
                value === 1 ? "" : "s"
              } (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// Apply current view (table vs chart)
function applyBreakdownView() {
  if (breakdownTableContainer) {
    breakdownTableContainer.style.display =
      currentBreakdownView === "table" ? "block" : "none";
  }
  if (breakdownChartWrapper) {
    breakdownChartWrapper.style.display =
      currentBreakdownView === "chart" ? "block" : "none";
  }

  if (breakdownViewTableBtn) {
    breakdownViewTableBtn.classList.toggle(
      "active",
      currentBreakdownView === "table"
    );
  }
  if (breakdownViewChartBtn) {
    breakdownViewChartBtn.classList.toggle(
      "active",
      currentBreakdownView === "chart"
    );
  }
}

// High-level: update breakdown UI for the currently selected week
function updateWeeklyBreakdownUI() {
  if (!breakdownWeekSelect || !breakdownEmpty) return;

  const week = getCurrentBreakdownWeek();

  if (!week) {
    breakdownEmpty.style.display = "block";
    breakdownEmpty.textContent = "Select a week to view pick breakdown.";

    if (breakdownTableContainer) breakdownTableContainer.innerHTML = "";
    if (breakdownChart) {
      breakdownChart.destroy();
      breakdownChart = null;
    }
    applyBreakdownView();
    return;
  }

  const { labels, counts, total } = getWeekTeamCounts(week);

  if (!total) {
    breakdownEmpty.style.display = "block";
    breakdownEmpty.textContent =
      "No picks submitted for Week " + week + " yet.";

    if (breakdownTableContainer) breakdownTableContainer.innerHTML = "";
    if (breakdownChart) {
      breakdownChart.destroy();
      breakdownChart = null;
    }
    applyBreakdownView();
    return;
  }

  breakdownEmpty.style.display = "none";

  updateWeekBreakdownTableWithData(labels, counts, total);
  updateWeekBreakdownChartWithData(labels, counts);

  applyBreakdownView();
}

// ---------------------- Loading user + standings ----------------------

async function loadLeagueUser() {
  const { data } = await supaLeague.auth.getUser();
  leagueUser = data?.user ?? null;

  if (!leagueUser) {
    if (leagueSection) leagueSection.style.display = "none";
    if (leagueLoginReminder) leagueLoginReminder.style.display = "block";
    if (entriesRemainingCallout) {
      entriesRemainingCallout.textContent = "";
    }
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
      leagueEntries = [];
      leaguePicks = [];
      leagueWeeks = [];

      setLeagueMessage("No entries found yet.", false);
      if (entriesRemainingCallout) {
        entriesRemainingCallout.textContent = "Entries remaining: 0";
      }
      leagueTableWrapper.innerHTML = "";

      // Clear breakdown UI
      if (breakdownWeekSelect) breakdownWeekSelect.innerHTML = "";
      if (breakdownEmpty) {
        breakdownEmpty.style.display = "block";
        breakdownEmpty.textContent = "No picks to display yet.";
      }
      if (breakdownChart) {
        breakdownChart.destroy();
        breakdownChart = null;
      }
      if (breakdownTableContainer) breakdownTableContainer.innerHTML = "";

      return;
    }

    leagueEntries = entries;

    // 2) Load all picks
    const { data: picks, error: picksError } = await supaLeague
      .from("picks")
      .select("entry_id, week, survivor_team, result");

    if (picksError) throw picksError;

    const allPicks = picks || [];
    leaguePicks = allPicks;

    // Determine the max week used (fallback to 18)
    let maxWeek = 0;
    allPicks.forEach((p) => {
      if (p.week && p.week > maxWeek) maxWeek = p.week;
    });
    if (!maxWeek) maxWeek = 18;

    const weeks = [];
    for (let w = 1; w <= maxWeek; w++) weeks.push(w);
    leagueWeeks = weeks;

    // Build lookup: entryId -> { week -> pick }
    const picksByEntry = new Map();
    allPicks.forEach((p) => {
      if (!p.entry_id || !p.week) return;
      if (!picksByEntry.has(p.entry_id)) {
        picksByEntry.set(p.entry_id, new Map());
      }
      picksByEntry.get(p.entry_id).set(p.week, p);
    });

    // 3) Build stats for standings table
    const stats = entries.map((entry) => {
      const entryPicks = picksByEntry.get(entry.id) || new Map();
      const isActive = entry.is_active === false ? false : true;

      return {
        id: entry.id,
        label: entry.label || "",
        displayName: entry.display_name || "",
        isActive,
        picks: entryPicks
      };
    });

    // 4) Sort standings
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

    // Populate breakdown controls & default view
    populateWeekSelect(weeks);
    currentBreakdownView = "table";
    applyBreakdownView();
    updateWeeklyBreakdownUI();

    setLeagueMessage("");
  } catch (err) {
    console.error(err);
    setLeagueMessage(
      "Error loading league standings: " + (err.message || "Unknown error"),
      true
    );
    if (entriesRemainingCallout) {
      entriesRemainingCallout.textContent = "";
    }
  }
}

// ---------------------- Rendering standings table ----------------------

function renderLeagueTable(stats, weeks) {
  leagueTableWrapper.innerHTML = "";

  if (!stats.length) {
    const p = document.createElement("p");
    p.textContent = "No league standings to display.";
    leagueTableWrapper.appendChild(p);
    updateEntriesRemainingCallout();
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
          td.style.backgroundColor = "rgba(0, 128, 0, 0.2)";
        } else if (pick.result === "LOSS") {
          td.classList.add("cell-loss");
          td.style.backgroundColor = "rgba(220, 20, 60, 0.25)";
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

  updateEntriesRemainingCallout();
}

// ---------------------- Events & Init ----------------------

// Week changed for breakdown
if (breakdownWeekSelect) {
  breakdownWeekSelect.addEventListener("change", () => {
    updateWeeklyBreakdownUI();
  });
}

// Collapsible breakdown section
if (toggleBreakdownBtn && breakdownSection) {
  toggleBreakdownBtn.addEventListener("click", () => {
    const isHidden =
      breakdownSection.getAttribute("data-collapsed") === "true";

    if (isHidden) {
      breakdownSection.setAttribute("data-collapsed", "false");
      breakdownSection.style.maxHeight = "1000px";
      breakdownSection.style.opacity = "1";
      toggleBreakdownBtn.textContent = "Hide weekly breakdown";
    } else {
      breakdownSection.setAttribute("data-collapsed", "true");
      breakdownSection.style.maxHeight = "0";
      breakdownSection.style.opacity = "0";
      toggleBreakdownBtn.textContent = "Show weekly breakdown";
    }
  });
}

// View toggle: Table vs Chart
if (breakdownViewTableBtn) {
  breakdownViewTableBtn.addEventListener("click", () => {
    currentBreakdownView = "table";
    applyBreakdownView();
  });
}

if (breakdownViewChartBtn) {
  breakdownViewChartBtn.addEventListener("click", () => {
    currentBreakdownView = "chart";
    applyBreakdownView();
  });
}

// Initialize
loadLeagueUser();
