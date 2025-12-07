// assets/reset-password.js

const supaReset = window.supabaseClient;

const resetMessage = document.getElementById("reset-message");
const resetPasswordInput = document.getElementById("reset-password");
const resetPasswordConfirmInput = document.getElementById("reset-password-confirm");
const resetPasswordBtn = document.getElementById("reset-password-btn");

function setResetMessage(text, isError = false) {
  if (!resetMessage) return;
  resetMessage.textContent = text || "";
  resetMessage.className = "message " + (isError ? "error" : "success");
}

async function handleResetPassword() {
  const pw = resetPasswordInput.value.trim();
  const pw2 = resetPasswordConfirmInput.value.trim();

  if (!pw || !pw2) {
    setResetMessage("Please enter and confirm your new password.", true);
    return;
  }

  if (pw !== pw2) {
    setResetMessage("Passwords do not match. Please try again.", true);
    return;
  }

  if (pw.length < 8) {
    setResetMessage("Password must be at least 8 characters long.", true);
    return;
  }

  try {
    // Supabase knows which user to update because the user comes here
    // via the special reset link (creates a short-lived session)
    const { error } = await supaReset.auth.updateUser({
      password: pw,
    });

    if (error) throw error;

    setResetMessage(
      "Your password has been updated. You can now log in with your new password.",
      false
    );

    // Optional: redirect back to Home after a short delay
    setTimeout(() => {
      window.location.href = "index.html";
    }, 3000);
  } catch (err) {
    console.error(err);
    setResetMessage(
      "Error updating password. The link may have expired. Please request a new reset email.",
      true
    );
  }
}

if (resetPasswordBtn) {
  resetPasswordBtn.addEventListener("click", () => {
    handleResetPassword();
  });
}
