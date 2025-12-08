// assets/schedule.js

const supaSchedule = window.supabaseClient;

const scheduleSection = document.getElementById("schedule-section");
const scheduleWeekSelect = document.getElementById("schedule-week-select");
const scheduleTodayBtn = document.getElementById("schedule-today-btn");
const scheduleMessage = document.getElementById("schedule-message");
const scheduleGrid = document.getElementById("schedule-grid");

// 🔁 Keep in sync with picks.js so "current week" matches
const SEASON_START_UTC_SCHEDULE = Date.UTC(2025, 8, 4); // 2025-09-04

// Map full team name -> logo path (using three-letter abbreviation files)
const TEAM_LOGOS = {
  "Arizona Cardinals": "assets/logos/ARI.png",
  "Atlanta Falcons": "assets/logos/ATL.png",
  "Baltimore Ravens": "assets/logos/BAL.png",
  "Buffalo Bills": "assets/logos/BUF.png",
  "Carolina Panthers": "assets/logos/CAR.png",
  "Chicago Bears": "assets/logos/CHI.png",
  "Cincinnati Bengals": "assets/logos/CIN.png",
  "Cleveland Browns": "assets/logos/CLE.png",
  "Dallas Cowboys": "assets/logos/DAL.png",
  "Denver Broncos": "assets/logos/DEN.png",
  "Detroit Lions": "assets/logos/DET.png",
  "Green Bay Packers": "assets/logos/GB.png",
  "Houston Texans": "assets/logos/HOU.png",
  "Indianapolis Colts": "assets/logos/IND.png",
  "Jacksonville Jaguars": "assets/logos/JAX.png",
  "Kansas City Chiefs": "assets/logos/KC.png",
  "Las Vegas Raiders": "assets/logos/LV.png",
  "Los Angeles Chargers": "assets/logos/LAC.png",
  "Los Angeles Rams": "assets/logos/LA.png",
  "Miami Dolphins": "assets/logos/MIA.png",
  "Minnesota Vikings": "assets/logos/MIN.png",
  "New England Patriots": "assets/logos/NE.png",
  "New Orleans Saints": "assets/logos/NO.png",
  "New York Giants": "assets/logos/NYG.png",
  "New York Jets": "assets/logos/NYJ.png",
  "Philadelphia Eagles": "assets/logos/PHI.png",
  "Pittsburgh Steelers": "assets/logos/PIT.png",
  "San Francisco 49ers": "assets/logos/SF.png",
  "Seattle Seahawks": "assets/logos/SEA.png",
  "Tampa Bay Buccaneers": "assets/logos/TB.png",
  "Tennessee Titans": "assets/logos/TEN.png",
  "Washington Commanders": "assets/logos/WAS.png",
};

function setScheduleMessage(text, isError = false) {
  if (!scheduleMessage) return;
  scheduleMessage.textContent = text || "";
  scheduleMessage.className = "message " + (isError ? "error" : "success");
}

function computeCurrentWeekForSchedule() {
  const now = new Date();
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((nowUtc - SEASON_START_UTC_SCHEDULE) / msPerDay);

  let week = Math.floor(diffDays / 7) + 1;
  if (week < 1) week = 1;
  if (week > 18) week = 18;
  return week;
}

function buildWeekOptions() {
  if (!scheduleWeekSelect) return;
  scheduleWeekSelect.innerHTML = "";

  for (let w = 1; w <= 18; w++) {
    const opt = document.createElement("option");
    opt.value = String(w);
    opt.textContent = "Week " + w;
    scheduleWeekSelect.appendChild(opt);
  }
}

function createLogoElement(teamName) {
  const wrapper = document.createElement("span");
  wrapper.className = "schedule-team-logo";

  const logoSrc = TEAM_LOGOS[teamName];
  if (logoSrc) {
    const img = document.createElement("img");
    img.src = logoSrc;
    img.alt = teamName + " logo";
    wrapper.appendChild(img);
  } else {
    // Fallback: initials circle if no logo defined
    const initials = document.createElement("span");
    initials.textContent = (teamName || "?")
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
    initials.style.fontSize = "0.7rem";
    initials.style.color = "#e5e7eb";
    wrapper.appendChild(initials);
  }

  return wrapper;
}

function renderScheduleCards(games, week) {
  if (!scheduleGrid) return;
  scheduleGrid.innerHTML = "";

  if (!games || games.length === 0) {
    const p = document.createElement("p");
    p.textContent =
      "No games have been entered for Week " +
      week +
      " yet. The commissioner may add them later.";
    scheduleGrid.appendChild(p);
    return;
  }

  games.forEach((game) => {
    const card = document.createElement("div");
    card.className = "schedule-card";

    // Kickoff
    const ko = document.createElement("div");
    ko.className = "schedule-kickoff";

    if (game.kickoff) {
      const dt = new Date(game.kickoff);
      ko.textContent = dt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
        timeZoneName: "short",
      });
    } else {
      ko.textContent = "Kickoff: TBA";
    }

    card.appendChild(ko);

    // Away row
    const awayRow = document.createElement("div");
    awayRow.className = "schedule-team-row";

    const awayLogo = createLogoElement(game.away_team || "");
    const awayText = document.createElement("div");

    const awayLabel = document.createElement("div");
    awayLabel.className = "schedule-team-label";
    awayLabel.textContent = "Away";

    const awayName = document.createElement("div");
    awayName.className = "schedule-team-name";
    awayName.textContent = game.away_team || "";

    awayText.appendChild(awayLabel);
    awayText.appendChild(awayName);

    awayRow.appendChild(awayLogo);
    awayRow.appendChild(awayText);
    card.appendChild(awayRow);

    // VS divider
    const vs = document.createElement("div");
    vs.className = "schedule-vs";
    vs.textContent = "vs";
    card.appendChild(vs);

    // Home row
    const homeRow = document.createElement("div");
    homeRow.className = "schedule-team-row";

    const homeLogo = createLogoElement(game.home_team || "");
    const homeText = document.createElement("div");

    const homeLabel = document.createElement("div");
    homeLabel.className = "schedule-team-label";
    homeLabel.textContent = "Home";

    const homeName = document.createElement("div");
    homeName.className = "schedule-team-name";
    homeName.textContent = game.home_team || "";

    homeText.appendChild(homeLabel);
    homeText.appendChild(homeName);

    homeRow.appendChild(homeLogo);
    homeRow.appendChild(homeText);
    card.appendChild(homeRow);

    // Location (optional)
    if (game.location) {
      const loc = document.createElement("div");
      loc.className = "schedule-location";
      loc.textContent = game.location;
      card.appendChild(loc);
    }

    scheduleGrid.appendChild(card);
  });
}

async function loadScheduleForWeek(week) {
  setScheduleMessage("");
  if (scheduleGrid) scheduleGrid.innerHTML = "";

  try {
    const { data, error } = await supaSchedule
      .from("schedule")
      .select("week, home_team, away_team, kickoff, location")
      .eq("week", week)
      .order("kickoff", { ascending: true });

    if (error) throw error;

    renderScheduleCards(data || [], week);
    setScheduleMessage("Showing games for Week " + week + ".");
  } catch (err) {
    console.error(err);
    setScheduleMessage("Error loading schedule for Week " + week + ".", true);
  }
}

async function handleWeekChange() {
  if (!scheduleWeekSelect) return;
  const week = Number(scheduleWeekSelect.value);
  if (!week || week < 1 || week > 18) {
    setScheduleMessage("Please choose a valid week between 1 and 18.", true);
    return;
  }
  await loadScheduleForWeek(week);
}

async function initSchedulePage() {
  if (!scheduleSection) return;

  buildWeekOptions();

  const currentWeek = computeCurrentWeekForSchedule();

  if (scheduleWeekSelect) {
    scheduleWeekSelect.value = String(currentWeek);
    scheduleWeekSelect.addEventListener("change", () => {
      handleWeekChange();
    });
  }

  if (scheduleTodayBtn) {
    scheduleTodayBtn.addEventListener("click", () => {
      const cw = computeCurrentWeekForSchedule();
      if (scheduleWeekSelect) {
        scheduleWeekSelect.value = String(cw);
      }
      handleWeekChange();
    });
  }

  await loadScheduleForWeek(currentWeek);
}

initSchedulePage();
