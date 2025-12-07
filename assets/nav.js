// assets/nav.js

const supaNav = window.supabaseClient;
const adminLinks = document.querySelectorAll(".nav-admin-link");

// Hide admin links by default
adminLinks.forEach((link) => {
  link.style.display = "none";
});

// ⚠️ Replace these with your real commissioner/admin emails
const ADMIN_EMAILS = [
  "wesflanagan@gmail.com",
  "aowynn2@gmail.com",
];

async function initNav() {
  if (!supaNav || !supaNav.auth) return;

  try {
    const { data, error } = await supaNav.auth.getUser();
    if (error || !data?.user) return;

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

initNav();
