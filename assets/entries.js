// assets/entries.js

const supaEntries = window.supabaseClient;

const entriesSection = document.getElementById("entries-section");
const entriesList = document.getElementById("entries-list");
const entriesMessage = document.getElementById("entries-message");
const addEntryBtn = document.getElementById("add-entry-btn");

// Display name controls on the home page
const displayNameInput = document.getElementById("display-name-input");
const displayNameSaveBtn = document.getElementById("display-name-save-btn");

let currentUser = null;
let currentEntries = [];

function updateAddEntryButtonState() {
  if (!addEntryBtn) return;
  const atMax = currentEntries.length >= 3;

  addEntryBtn.disabled = atMax;
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
    const displayName = entry.display_name || "Entry";
    const label = entry.label || "";
    labelSpan.textContent = `${displayName} – ${label}`;
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

    // Determine if display_name is already set for this user
    let existingName = "";
    let anyDisplayName = false;
    if (currentEntries.length) {
      for (const e of currentEntries) {
        if (e.display_name) {
          existingName = e.display_name;
          anyDisplayName = true;
          break;
        }
      }
    }

    // Lock or unlock the display-name UI based on that
    if (displayNameInput) {
      if (existingName) displayNameInput.value = existingName;
      // If any display_name exists, make it read-only
      displayNameInput.readOnly = anyDisplayName;
    }

    if (displayNameSaveBtn) {
      // Hide the save button once a name is set
      displayNameSaveBtn.style.display = anyDisplayName
        ? "none"
        : "inline-flex";
    }

    updateAddEntryButtonState();
    renderEntries();
    setEntriesMessage("");
  } catch (err) {
    console.error(err);
    setEntriesMessage("Error loading entries.", true);
  }
}

async function createEntry() {
  if (!currentUser) {
    setEntriesMessage("You must be logged in to create entries.", true);
    return;
  }

  if (currentEntries.length >= 3) {
    setEntriesMessage("You already have the maximum of 3 entries.", true);
    return;
  }

  const nextNumber = currentEntries.length + 1;
  const label = `Entry ${nextNumber}`;

  // Use whatever display name is currently in the input (if any)
  const displayName =
    (displayNameInput && displayNameInput.value.trim()) || null;

  try {
    const { data, error } = await supaEntries
      .from("entries")
      .insert({
        user_id: currentUser.id,
        label,
        is_active: true,
        display_name: displayName,
      })
      .select()
      .single();

    if (error) throw error;

    currentEntries.push(data);
    updateAddEntryButtonState();
    renderEntries();

    setEntriesMessage(`Created ${label}!`);
  } catch (err) {
    console.error(err);
    setEntriesMessage("Error creating entry.", true);
  }
}

async function saveDisplayName() {
  if (!currentUser || !displayNameInput) return;

  // If any entry already has a display_name, block changes
  if (currentEntries.some((e) => e.display_name)) {
    setEntriesMessage(
      "Your display name is already set and cannot be changed. Contact the commissioner if this is an issue.",
      true
    );
    return;
  }

  const name = displayNameInput.value.trim();

  try {
    const { error } = await supaEntries
      .from("entries")
      .update({ display_name: name || null })
      .eq("user_id", currentUser.id);

    if (error) throw error;

    // Refresh entries so the on-page text updates too
    await loadEntries();
    setEntriesMessage("Display name set for all your entries.", false);
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

if (displayNameSaveBtn) {
  displayNameSaveBtn.addEventListener("click", () => {
    saveDisplayName();
  });
}

// Listen for auth changes so we know when to load entries
async function initEntries() {
  const { data } = await supaEntries.auth.getUser();
  currentUser = data?.user ?? null;

  if (currentUser) {
    if (entriesSection) entriesSection.style.display = "block";
    await loadEntries();
  } else {
    if (entriesSection) entriesSection.style.display = "none";
  }

  supaEntries.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) {
      if (entriesSection) entriesSection.style.display = "block";
      loadEntries();
    } else {
      currentEntries = [];
      if (entriesSection) entriesSection.style.display = "none";
    }
  });
}
  // If display name is already locked and non-empty,
  // hide the Save button so users can't try to change it.
  if (displayNameInput && saveDisplayNameBtn) {
    const hasValue = displayNameInput.value.trim() !== "";
    const isLocked =
      displayNameInput.disabled === true || displayNameInput.readOnly === true;

    if (hasValue && isLocked) {
      saveDisplayNameBtn.style.display = "none";
    }
  }

initEntries();
