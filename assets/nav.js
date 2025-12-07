// assets/nav.js

const supaNav = window.supabaseClient;
const adminLinks = document.querySelectorAll(".nav-admin-link");

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
      // Not logged in, leave admin links hidden
      return;
    }

    const email = data.user.email || "";
    if (email && ADMIN_EMAILS.includes(email)) {
      adminLinks.forEach((link) => {
        // CSS hides it by default; we explicitly show it here
        link.style.display = "inline-block";
      });
    }
  } catch (err) {
    console.error("Error initializing nav:", err);
  }
}

// Run immediately after script load (scripts are at bottom of body)
showAdminLinksIfAuthorized();
