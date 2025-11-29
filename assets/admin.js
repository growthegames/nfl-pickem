// assets/admin.js

// Reuse the global supabase client
const supaAdmin = window.supabaseClient;

// 👇 Update this to your real commissioner email
const ADMIN_EMAILS = [
  "wesflanagan@gmail.com",
];

const adminSection = document.getElementById("admin-section");
const unauthorizedSection = document.getElementById("admin-unauthorized");
const adminNotice = document.getElementById("admin-notice");

const weekInput = document.getElementById("admin-week-select");
const loadWeekBtn = document.getElementById("admin-load-week-btn");
const teamsContainer = document.getElementById("admin-teams-container");
const saveBtn = document.getElementById("admin-save-btn");
const adminControls = document.getElementById("admin-controls");

// We’ll store the current set of teams for the loaded week in memory
let currentWeek = null;
let teamRows = []; // { team, currentResult, rowEl }

function setAdminNotice(text, isError = false) {
  if (!adminNotice) return;
  adminNotice.textContent = text || "";
  adminNotice.className = "message " + (isError ? "error" : "success");
}

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

// Build a row for a single team with win/loss controls
function createTeamRow(team, currentResult) {
  const tr = document.createElement("tr");

  const teamCell = document.createElement("td");
  teamCell.textContent = team;
  tr.appendChild(teamCell);

  const statusCell = document.createElement("td");
  const select = document.createElement("select");
  select.dataset.team = team;

  const options = [
    { value: "", label: "Unchanged / Clear" },
    { value: "WIN", label: "Win" },
    { value: "LOSS", label: "Loss" },
  ];

  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === currentResult) {
      o.selected = true;
    }
    select.appendChild(o);
  });

  statusCell.appendChild(select);
  tr.appendChild(statusCell);

  return { team, currentResult, rowEl: tr, selectEl: select };
}

// Load distinct teams and their current result for a given week
async function loadWeekTeams(week) {
  teamsContainer.innerHTML = "";
  saveBtn.style.display = "none";
  teamRows = [];

  // Get distinct survivor_team + result for that week
  const { data, error } = await supaAdmin
    .from("picks")
    .select("survivor_team, result")
    .eq("week", week);

  if (error) {
    console.error(error);
    setAdminNotice("Error loading teams for that week.", true);
    return;
  }

  if (!data || !data.length) {
    const p = document.createElement("p");
    p.textContent = "No picks found for this week yet.";
    teamsContainer.appendChild(p);
    return;
  }

  // Build a map: team -> currentResult (if mixed, leave blank)
  const teamMap = new Map();

  data.forEach((row) => {
    const team = row.survivor_team;
    const res = row.result || "";
    if (!team) return;

    if (!teamMap.has(team)) {
      teamMap.set(team, res);
    } else {
      const existing = teamMap.get(team);
      if (existing !== res) {
        // Mixed results; treat as "unset" so the admin decides
        teamMap.set(team, "");
      }
    }
  });

  // Build table
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["NFL Team", "Result (this week)"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  Array.from(teamMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([team, result]) => {
      const row = createTeamRow(team, result);
      teamRows.push(row);
      tbody.appendChild(row.rowEl);
    });

  table.appendChild(tbody);
  teamsContainer.appendChild(table);

  if (teamRows.length) {
    saveBtn.style.display = "inline-flex";
  }
}

async function handleLoadWeekClicked() {
  setAdminNotice("");
  teamsContainer.innerHTML = "";

  const week = Number(weekInput.value);
  if (!week || week < 1 || week > 18) {
    setAdminNotice("Please enter a valid week number between 1 and 18.", true);
    return;
  }

  currentWeek = week;
  await loadWeekTeams(week);
  if (teamRows.length) {
    setAdminNotice("Loaded teams for Week " + week + ".");
  }
}

async function handleSaveClicked() {
  if (!currentWeek) {
    setAdminNotice("Please load a week first.", true);
    return;
  }

  setAdminNotice("Saving results...", false);

  try {
    for (const row of teamRows) {
      const team = row.team;
      const newVal = row.selectEl.value; // "", "WIN", "LOSS"

      // If unchanged (blank and no previous result), skip
      if (newVal === "" && !row.currentResult) continue;

      // If set to blank, clear result for that team/week
      if (newVal === "") {
        const { error } = await supaAdmin
          .from("picks")
          .update({ result: null })
          .eq("week", currentWeek)
          .eq("survivor_team", team);

        if (error) throw error;
        continue;
      }

      // Set WIN or LOSS for that team/week
      const { error } = await supaAdmin
        .from("picks")
        .update({ result: newVal })
        .eq("week", currentWeek)
        .eq("survivor_team", team);

      if (error) throw error;
    }

    setAdminNotice("Results saved for Week " + currentWeek + "!", false);
    // Reload to reflect consistent state
    await loadWeekTeams(currentWeek);
  } catch (err) {
    console.error(err);
    setAdminNotice("Error saving results. Please try again.", true);
  }
}

async function initAdmin() {
  // Check who is logged in
  const { data } = await supaAdmin.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    adminSection.style.display = "none";
    unauthorizedSection.style.display = "block";
    return;
  }

  const email = user.email || user.user_metadata?.email;

  if (!isAdminEmail(email)) {
    adminSection.style.display = "none";
    unauthorizedSection.style.display = "block";
    return;
  }

  // Admin is allowed
  adminSection.style.display = "block";
  unauthorizedSection.style.display = "none";
  adminControls.style.display = "block";

  setAdminNotice(
    "Logged in as admin: " + email + ". Select a week and grade teams.",
    false
  );
}

if (loadWeekBtn) {
  loadWeekBtn.addEventListener("click", () => {
    handleLoadWeekClicked();
  });
}

if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    handleSaveClicked();
  });
}

initAdmin();
