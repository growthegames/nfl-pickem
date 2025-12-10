// assets/league-standings.js

const supaLeague = window.supabaseClient;

const leagueSection = document.getElementById("league-standings-section");
const leagueLoginReminder = document.getElementById("league-login-reminder");
const leagueMessage = document.getElementById("league-standings-message");
const leagueTableWrapper = document.getElementById("league-standings-table-wrapper");

// Entries remaining callout
const entriesRemainingCallout = document.getElementById("entries-remaining-callout");

// NEW: Weekly breakdown elements
const breakdownWeekSelect = document.getElementById("breakdown-week-select");
const breakdownEmpty = document.getElementById("week-breakdown-empty");
const breakdownChartCanvas = document.getElementById("week-breakdown-chart");

let leagueUser = null;
let leagueEntries = [];
let leaguePicks = [];      // all picks from Supabase
let leagueWeeks = [];      // list of weeks used in the table
let breakdownChart = null; // Chart.js instance

// ---------------------- Helpers ----------------------

function setLeagueMessage(text, isError = false) {
  if (!leagueMessage) return;
  leagueMessage.textContent = text || "";
  leagueMessage.className = "message " + (isError ? "error" : "success");
}

// Update the "Entries remaining" callout
function updateEntriesRemainingCallout() {
  if (!entriesRemainingCallout) return;

  // Preferred: use leagueEntries (raw entries from Supabase)
  if (Array.isArray(leagueEntries) && leagueEntries.length > 0) {
    const total = leagueEntries.length;
    const alive = leagueEntries.filter((e) => e.is_active).length;

    entriesRemainingCallout.textContent =
      "Entries remaining: " + alive + " of " + total;
    return;
  }

  // Fallback: derive from table rows if leagueEntries isn't set
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

// Populate the week <select> for the breakdown chart
function populateWeekSelect(weeks) {
  if (!breakdownWeekSelect) return;

  breakdownWeekSelect.innerHTML = "";

  weeks.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = "Week " + w;
    breakdownWeekSelect.appendChild(opt);
  });

  // Default to the latest week in the list
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

// Build / update the weekly pick breakdown pie chart
function updateWeekBreakdownChart() {
  if (!breakdownChartCanvas) return;

  const week = getCurrentBreakdownWeek();
  if (!week) {
    // No week selected
    if (breakdownEmpty) {
      breakdownEmpty.style.display = "block";
      breakdownEmpty.textContent = "Select a week to view pick breakdown.";
    }
    if (breakdownChart) {
      breakdownChart.destroy();
      breakdownChart = null;
    }
    return;
  }

  const picksThisWeek = (leaguePicks || []).filter(
    (p) => p.week === week && p.survivor_team
  );

  if (!picksThisWeek.length) {
    if (breakdownEmpty) {
      breakdownEmpty.style.display = "block";
      breakdownEmpty.textContent =
        "No picks submitted for Week " + week + " yet.";
    }
    if (breakdownChart) {
      breakdownChart.destroy();
      breakdownChart = null;
    }
    return;
  } else if (breakdownEmpty) {
    breakdownEmpty.style.display = "none";
  }

  // Aggregate counts by team
  const counts = {};
  picksThisWeek.forEach((p) => {
    const team = p.survivor_team;
    if (!team) return;
    counts[team] = (counts[team] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const data = labels.map((l) => counts[l]);

  // Simple color palette (looped) – you can customize later per team
  const basePalette = [
    "#013369", // navy
    "#D50A0A", // red
    "#FFB612", // gold
    "#203731", // green
    "#4F2683", // purple
    "#002244", // deep blue
    "#0085CA", // light blue
    "#A5ACAF", // silver
    "#C60C30", // bright red
    "#006778", // teal
  ];
  const colors = labels.map((_, i) => basePalette[i % basePalette.length]);

  if (breakdownChart) {
    breakdownChart.destroy();
  }

  breakdownChart = new Chart(breakdownChartCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const value = ctx.parsed || 0;
              const total = data.reduce((sum, v) => sum + v, 0);
              const pct = total ? ((value / total) * 100).toFixed(1) : "0.0";
              return `${label}: ${value} pick${
                value === 1 ? "" : "s"
              } (${pct}%)`;
            },
          },
        },
      },
    },
  });
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

      return;
    }

    // Keep entries for the callout helper
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

    // 3) Build stats, including active vs eliminated flag
    const stats = entries.map((entry) => {
      const entryPicks = picksByEntry.get(entry.id) || new Map();

      // Treat explicit false as eliminated; anything else as active
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
    //    - Active entries first
    //    - Then eliminated entries
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

    // Populate week dropdown & initial chart
    populateWeekSelect(weeks);
    updateWeekBreakdownChart();

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

// ---------------------- Rendering ----------------------

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

        if (pick.result === "WIN") {
          td.classList.add("cell-win");
          td.style.backgroundColor = "rgba(0, 128, 0, 0.2)";    // light green
        } else if (pick.result === "LOSS") {
          td.classList.add("cell-loss");
          td.style.backgroundColor = "rgba(220, 20, 60, 0.25)"; // light red
        } else {
          td.classList.add("cell-pending");
          td.style.backgroundColor = "rgba(255, 255, 255, 0.04)"; // subtle neutral
        }
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  leagueTableWrapper.appendChild(table);

  // Update the "Entries remaining" callout
  updateEntriesRemainingCallout();
}

// ---------------------- Events & Init ----------------------

// When the user changes the breakdown week, rebuild the chart
if (breakdownWeekSelect) {
  breakdownWeekSelect.addEventListener("change", () => {
    updateWeekBreakdownChart();
  });
}

// Initialize
loadLeagueUser();
