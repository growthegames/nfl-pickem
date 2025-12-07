// assets/nav.js

const supaNav = window.supabaseClient;
const adminLinks = document.querySelectorAll(".nav-admin-link");
const navToggleBtn = document.getElementById("nav-toggle");

// ⚠️ Replace these with your real commissioner/admin emails
const ADMIN_EMAILS = [
  "wesflanagan@gmail.com",
  "aowynn2@gmail.com",
];

async function showAdminLinksIfAuthorized() {
  if (!supaNav || !supaNav.auth) return;

  try {
    const { data, error } = await supaNav.auth.getUser();
    if (error || !data?.user) {
      // Not logged in, leave admin links hidden (CSS default)
      return;
    }

    const email = data.user.email || "";
    if (email && ADMIN_EMAILS.includes(email)) {
      adminLinks.forEach((link) => {
        link.style.display = "inline-block";
      });
    }
  } catch (err) {
    console.error("Error initializing nav:", err);
  }
}

function initNavToggle() {
  if (!navToggleBtn) return;

  navToggleBtn.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    navToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

// Initialize
showAdminLinksIfAuthorized();
initNavToggle();
