// assets/highscore.js

const supaHS = window.supabaseClient;

const hsMessage = document.getElementById("highscore-message");
const hsTableContainer = document.getElementById("highscore-table-container");

function setHSMessage(text, isError = false) {
  if (!hsMessage) return;
  hsMessage.textContent = text || "";
  hsMessage.className = "message " + (isError ? "error" : "success");
}

async function loadHighScoreLeaderboard() {
  setHSMessage("Loading leaderboard...");

  try {
    // 1) Get all entries
    const { data: entries, error: entriesError } = await supaHS
      .from("entries")
      .select("id, label, display_name, created_at")
      .order("display_name", { ascending: true })
      .order("created_at", { ascending: true });

    if (entriesError) throw entriesError;

    if (!entries || !entries.length) {
      setHSMessage("No entries found yet.", false);
      return;
    }

    // 2) Get all picks (for highest scoring team guesses)
    const { data: picks, error: picksError } = await supaHS
      .from("picks")
      .select("entry_id, week, highest_scoring_team");

    if (picksError) throw picksError;

    // 3) Get all high_score_results (actual answers)
    const { data: results, error: resultsError } = await supaHS
      .from("high_score_results")
      .select("week, team, points");

    if (resultsError) throw resultsError;

    if (!results || !results.length) {
      setHSMessage(
        "No high-score results have been graded yet. Check back after the first week is completed.",
        false
      );
      return;
    }

    // Build lookup maps
    const resultByWeek = new Map(); // week -> { team, points }
    results.forEach((r) => {
      if (!r.week) return;
      resultByWeek.set(r.week, {
        team: r.team,
        points: r.points ?? 0,
      });
    });

    const picksByEntryWeek = new Map(); // `${entry_id}-${week}` -> highest_scoring_team
    (picks || []).forEach((p) => {
      if (!p.entry_id || !p.week) return;
      const key = `${p.entry_id}-${p.week}`;
      picksByEntryWeek.set(key, p.highest_scoring_team || "");
    });

    // 4) Accumulate stats per entry
    const stats = entries.map((entry) => {
      let correctCount = 0;
      let totalPoints = 0;

      resultByWeek.forEach((result, week) => {
        const key = `${entry.id}-${week}`;
        const guess = picksByEntryWeek.get(key);
        if (!guess) return;

        if (
          result.team &&
          guess &&
          guess.toLowerCase() === result.team.toLowerCase()
        ) {
          correctCount += 1;
          totalPoints += result.points || 0;
        }
      });

      const displayName = entry.display_name || "Entry";
      const label = entry.label || "";

      return {
        entryId: entry.id,
        displayName,
        label,
        correctCount,
        totalPoints,
      };
    });

    // 5) Sort: most correct, then most points, then name
    stats.sort((a, b) => {
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      const nameA = `${a.displayName} ${a.label}`.toLowerCase();
      const nameB = `${b.displayName} ${b.label}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    renderLeaderboard(stats);
    setHSMessage("");
  } catch (err) {
    console.error(err);
    setHSMessage("Error loading leaderboard. Please try again later.", true);
  }
}

function renderLeaderboard(stats) {
  hsTableContainer.innerHTML = "";

  if (!stats.length) {
    const p = document.createElement("p");
    p.textContent = "No data yet.";
    hsTableContainer.appendChild(p);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Rank", "Entry", "Correct Weeks", "Total Points"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  stats.forEach((row, index) => {
    const tr = document.createElement("tr");

    const rankCell = document.createElement("td");
    rankCell.textContent = String(index + 1);
    tr.appendChild(rankCell);

    const entryCell = document.createElement("td");
    entryCell.textContent = `${row.displayName} – ${row.label}`;
    tr.appendChild(entryCell);

    const correctCell = document.createElement("td");
    correctCell.textContent = String(row.correctCount);
    tr.appendChild(correctCell);

    const pointsCell = document.createElement("td");
    pointsCell.textContent = String(row.totalPoints);
    tr.appendChild(pointsCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  hsTableContainer.appendChild(table);
}

loadHighScoreLeaderboard();
