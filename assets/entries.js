// assets/entries.js

const supaEntries = window.supabaseClient;

const entriesSection = document.getElementById("entries-section");
const entriesList = document.getElementById("entries-list");
const entriesMessage = document.getElementById("entries-message");
const addEntryBtn = document.getElementById("add-entry-btn");

let currentUser = null;
let currentEntries = [];

// Show/hide + enable/disable the "Add Entry" button
function updateAddEntryButtonState() {
  if (!addEntryBtn) return;
  const atMax = currentEntries.length >= 3;

  // Disable the button
  addEntryBtn.disabled = atMax;

  // Hide it completely when maxed
  addEntryBtn.style.display = atMax ? "none" : "inline-flex";
}

function setEntriesMessage(text, isError = false) {
  if (!entriesMessage) return;
  entriesMessage.textContent = text || "";
  entriesMessage.className = "message " + (isError ? "error" : "success");
}

function renderEntries() {
  if (!entriesList) return;

  entriesList.innerHTML = "";

  if (!currentEntries.length) {
    const li = document.createElement("li");
    li.textContent =
      "No entries yet. Click “Add Entry” to create your first one.";
    entriesList.appendChild(li);
    return;
  }

  currentEntries.forEach((entry) => {
    const li = document.createElement("li");
    li.style.marginBottom = "0.4rem";

    const labelSpan = document.createElement("span");
    const ownerText = entry.owner_email ? `${entry.owner_email} – ` : "";
    labelSpan.textContent = ownerText + entry.label;
    li.appendChild(labelSpan);

    if (!entry.is_active) {
      const badge = document.createElement("span");
      badge.textContent = " ELIMINATED";
      badge.style.fontSize = "0.75rem";
      badge.style.marginLeft = "0.4rem";
      badge.style.textTransform = "uppercase";
      badge.style.letterSpacing = "0.08em";
      li.appendChild(badge);
    }

    entriesList.appendChild(li);
  });
}

async function loadEntries() {
  if (!currentUser) {
    if (entriesSection) entriesSection.style.display = "none";
    updateAddEntryButtonState();
    return;
  }

  try {
    const { data, error } = await supaEntries
      .from("entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    currentEntries = data || [];
    if (entriesSection) entriesSection.style.display = "block";

    renderEntries();
    setEntriesMessage("");
    updateAddEntryButtonState();
  } catch (err) {
    console.error(err);
    setEntriesMessage("Error loading entries.", true);
    updateAddEntryButtonState();
  }
}

async function createEntry() {
  if (!currentUser) {
    setEntriesMessage("You must be logged in to create entries.", true);
    return;
  }

  if (currentEntries.length >= 3) {
    setEntriesMessage("You already have the maximum of 3 entries.", true);
    updateAddEntryButtonState();
    return;
  }

  const nextNumber = currentEntries.length + 1;
  const label = `Entry ${nextNumber}`;

  try {
    const { data, error } = await supaEntries
      .from("entries")
      .insert({
        user_id: currentUser.id,
        label,
        is_active: true,
        owner_email: currentUser.email ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    currentEntries.push(data);
    renderEntries();
    updateAddEntryButtonState();

    setEntriesMessage(`Created ${label}!`);
  } catch (err) {
    console.error(err);
    setEntriesMessage("Error creating entry.", true);
    updateAddEntryButtonState();
  }
}

// Hook up button
if (addEntryBtn) {
  addEntryBtn.addEventListener("click", () => {
    createEntry();
  });
}

// Listen for auth changes so we know when to load entries
async function initEntries() {
  // On first load, check current user
  const { data } = await supaEntries.auth.getUser();
  currentUser = data?.user ?? null;

  if (currentUser) {
    if (entriesSection) entriesSection.style.display = "block";
    await loadEntries();
  } else {
    currentEntries = [];
    if (entriesSection) entriesSection.style.display = "none";
    updateAddEntryButtonState();
  }

  // Subscribe to future auth changes
  supaEntries.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) {
      if (entriesSection) entriesSection.style.display = "block";
      loadEntries();
    } else {
      currentEntries = [];
      if (entriesSection) entriesSection.style.display = "none";
      updateAddEntryButtonState();
    }
  });
}

initEntries();
