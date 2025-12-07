// assets/auth.js

const supa = window.supabaseClient;

const loginForm = document.getElementById("login-form");
const signupButton = document.getElementById("signup-button");
const logoutButton = document.getElementById("logout-button");
const loggedOutDiv = document.getElementById("auth-logged-out");
const loggedInDiv = document.getElementById("auth-logged-in");
const userEmailSpan = document.getElementById("user-email");
const authMessage = document.getElementById("auth-message");

// NEW: forgot password button + email input
const forgotPasswordButton = document.getElementById("forgot-password-btn");
const loginEmailInput = document.getElementById("login-email");

function setAuthMessage(text, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = text || "";
  authMessage.className = "message " + (isError ? "error" : "success");
}

async function refreshUserState() {
  const { data, error } = await supa.auth.getUser();

  if (error || !data.user) {
    // Not logged in
    if (loggedOutDiv) loggedOutDiv.style.display = "block";
    if (loggedInDiv) loggedInDiv.style.display = "none";
    if (userEmailSpan) userEmailSpan.textContent = "";
    return;
  }

  if (loggedOutDiv) loggedOutDiv.style.display = "none";
  if (loggedInDiv) loggedInDiv.style.display = "block";
  if (userEmailSpan) userEmailSpan.textContent = data.user.email || "";
}

// NEW: handle forgot password
async function handleForgotPassword() {
  if (!loginEmailInput) {
    setAuthMessage("Please enter your email address.", true);
    return;
  }

  const email = loginEmailInput.value.trim();
  if (!email) {
    setAuthMessage("Please enter your email address first.", true);
    return;
  }

  try {
   const { error } = await supa.auth.resetPasswordForEmail(email, {
  // Build a URL in the same folder as the current page
  redirectTo:
    window.location.origin +
    window.location.pathname.replace(/\/[^\/]*$/, "/reset-password.html"),
});


    if (error) throw error;

    setAuthMessage(
      "If an account exists for that email, a password reset link has been sent.",
      false
    );
  } catch (err) {
    console.error(err);
    setAuthMessage(
      "Error sending reset email. Please try again later.",
      true
    );
  }
}

// Handle login
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthMessage("");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      setAuthMessage("Please enter both email and password.", true);
      return;
    }

    const { data, error } = await supa.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthMessage(error.message || "Login failed.", true);
    } else {
      setAuthMessage("Logged in successfully!");
      await refreshUserState();
    }
  });
}

// Handle sign up
if (signupButton) {
  signupButton.addEventListener("click", async () => {
    setAuthMessage("");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      setAuthMessage("Enter email & password, then click Sign up.", true);
      return;
    }

    const { data, error } = await supa.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthMessage(error.message || "Sign up failed.", true);
    } else {
      setAuthMessage(
        "Sign up successful. If email confirmation is required, check your inbox."
      );
    }
  });
}

// Handle logout
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await supa.auth.signOut();
    setAuthMessage("Logged out.");
    await refreshUserState();
  });
}

// NEW: wire up "Forgot password?"
if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener("click", () => {
    handleForgotPassword();
  });
}

// Initialize on page load
refreshUserState();
