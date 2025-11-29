// assets/entries.js

const supaEntries = window.supabaseClient;

const entriesSection = document.getElementById("entries-section");
const entriesList = document.getElementById("entries-list");
const entriesMessage = document.getElementById("entries-message");
const addEntryBtn = document.getElementById("add-entry-btn");
const displayNameInput = document.getElementById("display-name-input");
const saveDisplayNameBtn = document.getElementById("save-display-name-btn");

let currentUser = null;
let currentEntries = [];
let currentDisplayName = "";

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
  entriesMessage.className = "message " + (isError ? "error" : "success";
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
    const namePart =
      entry.owner_display_name ||
      entry.owner_email ||
      "Unnamed player";
    labelSpan.textContent = `${namePart} – ${entry.label}`;
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

    // If we have a display name on any entry, prefer that in the input
    const existingName =
      currentEntries.find((e) => e.owner_display_name)?.owner_display_name ||
      "";
    currentDisplayName = existingName;
    if (displayNameInput) {
      displayNameInput.value = currentDisplayName;
    }

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
        owner_display_name: currentDisplayName || null,
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

async function saveDisplayName() {
  if (!currentUser) {
    setEntriesMessage("You must be logged in to set a display name.", true);
    return;
  }

  if (!displayNameInput) return;

  const newName = displayNameInput.value.trim();
  currentDisplayName = newName;

  try {
    if (!currentEntries.length) {
      // No entries yet; we'll just keep the name in memory for when they create entries
      setEntriesMessage("Display name saved. Create an entry to see it applied.");
      return;
    }

    const entryIds = currentEntries.map((e) => e.id);

    const { error } = await supaEntries
      .from("entries")
      .update({ owner_display_name: newName || null })
      .in("id", entryIds);

    if (error) throw error;

    // Update local copies
    currentEntries = currentEntries.map((e) => ({
      ...e,
      owner_display_name: newName || null,
    }));

    renderEntries();
    setEntriesMessage("Display name updated for your entries.");
  } catch (err) {
    console.error(err);
    setEntriesMessage("Error updating display name.", true);
  }
}

// Hook up buttons
if (addEntryBtn) {
  addEntryBtn.addEventListener("click", () => {
    createEntry();
  });
}

if (saveDisplayNameBtn) {
  saveDisplayNameBtn.addEventListener("click", () => {
    saveDisplayName();
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
