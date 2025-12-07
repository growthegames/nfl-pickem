// assets/writeups.js

const supaW = window.supabaseClient;

const writeupsMessage = document.getElementById("writeups-message");
const writeupsContainer = document.getElementById("writeups-container");

function setWriteupsMessage(text, isError = false) {
  if (!writeupsMessage) return;
  writeupsMessage.textContent = text || "";
  writeupsMessage.className = "message " + (isError ? "error" : "success");
}

function renderWriteups(list) {
  writeupsContainer.innerHTML = "";

  if (!list.length) {
    const p = document.createElement("p");
    p.textContent = "No writeups posted yet. Check back after Week 1!";
    writeupsContainer.appendChild(p);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card"; // uses your existing styling

    const header = document.createElement("header");
    const h3 = document.createElement("h3");
    h3.textContent = item.title || `Week ${item.week}`;
    header.appendChild(h3);

    const meta = document.createElement("p");
    meta.style.fontSize = "0.8rem";
    meta.style.opacity = "0.8";

    const weekLabel = `Week ${item.week}`;
    const dateLabel = item.created_at
      ? new Date(item.created_at).toLocaleDateString()
      : "";
    meta.textContent = dateLabel ? `${weekLabel} • ${dateLabel}` : weekLabel;

    header.appendChild(meta);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "card-body";

    // Simple formatting: split on blank lines into paragraphs
    const text = item.content || "";
    const paragraphs = text.split(/\n\s*\n/);
    paragraphs.forEach((para) => {
      const p = document.createElement("p");
      p.textContent = para.trim();
      if (p.textContent) body.appendChild(p);
    });

    card.appendChild(body);
    writeupsContainer.appendChild(card);
  });
}

async function loadWriteups() {
  setWriteupsMessage("Loading writeups...");

  try {
    const { data, error } = await supaW
      .from("writeups")
      .select("week, title, content, created_at")
      .order("week", { ascending: false });

    if (error) throw error;

    renderWriteups(data || []);
    setWriteupsMessage("");
  } catch (err) {
    console.error(err);
    setWriteupsMessage(
      "Error loading writeups: " + (err.message || "Unknown error"),
      true
    );
  }
}

loadWriteups();
