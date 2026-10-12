import { el, setPending } from "../ui.js";
import { authErrorMessage } from "../lib/auth-errors.js";

function errorNode(message) {
  return message ? el("p", { className: "field-error", textContent: message }) : null;
}

function authForm(mode, actions) {
  const isForgot = mode === "forgot";
  const email = el("input", {
    type: "email",
    required: true,
    autocomplete: "email",
    placeholder: "you@example.com",
  });
  const password = el("input", {
    type: "password",
    required: !isForgot,
    minLength: 6,
    autocomplete: mode === "create" ? "new-password" : "current-password",
  });
  const errorHolder = el("div", { className: "field-error-holder", attrs: { "aria-live": "polite" } });
  const submit = el("button", {
    type: "submit",
    className: "btn btn-primary sign-in-submit",
    textContent: isForgot ? "Send reset email" : mode === "create" ? "Create account" : "Sign in",
  });
  const form = el("form", { className: "sign-in-form" }, [
    el("label", { className: "field" }, [el("span", { textContent: "Email" }), email]),
    isForgot ? null : el("label", { className: "field" }, [el("span", { textContent: "Password" }), password]),
    submit,
    errorHolder,
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setPending(submit, true, isForgot ? "Sending…" : mode === "create" ? "Creating…" : "Signing in…");
    errorHolder.replaceChildren();
    try {
      const message = isForgot
        ? await actions.reset(email.value)
        : mode === "create"
          ? await actions.create(email.value, password.value)
          : await actions.signIn(email.value, password.value);
      if (message) errorHolder.replaceChildren(el("p", { className: "sign-in-note", textContent: message }));
    } catch (error) {
      errorHolder.replaceChildren(errorNode(authErrorMessage(error)));
    } finally {
      setPending(submit, false);
    }
  });
  return form;
}

export function renderSignIn(actions, initialError = "") {
  let mode = "sign-in";
  const formHolder = el("div");
  const modeLinks = el("p", { className: "sign-in-options" });
  const googleButton = el("button", { type: "button", className: "btn btn-secondary sign-in-google", textContent: "Continue with Google" });
  const errorHolder = el("div", { className: "field-error-holder", attrs: { "aria-live": "polite" } }, errorNode(initialError));

  function showMode(nextMode) {
    mode = nextMode;
    const label = mode === "sign-in" ? "Sign in with email" : mode === "create" ? "Create an account" : "Reset your password";
    const other = mode === "sign-in"
      ? ["Create account", "create", "Forgot password?", "forgot"]
      : ["Sign in", "sign-in"];
    const switchButton = el("button", { type: "button", className: "btn btn-link", textContent: other[0] });
    switchButton.addEventListener("click", () => showMode(other[1]));
    const forgotButton = mode === "sign-in"
      ? el("button", { type: "button", className: "btn btn-link", textContent: other[2] })
      : null;
    if (forgotButton) forgotButton.addEventListener("click", () => showMode(other[3]));
    formHolder.replaceChildren(el("h2", { className: "sign-in-heading", textContent: label }), authForm(mode, actions));
    modeLinks.replaceChildren(switchButton, forgotButton);
  }

  googleButton.addEventListener("click", async () => {
    setPending(googleButton, true, "Opening Google…");
    errorHolder.replaceChildren();
    try {
      await actions.google();
    } catch (error) {
      errorHolder.replaceChildren(errorNode(authErrorMessage(error)));
      setPending(googleButton, false);
    }
  });
  showMode(mode);
  return el("div", { className: "center-card sign-in-card" }, [
    el("img", { className: "center-card-logo", src: "./img/logo.svg", alt: "", width: 64, height: 64 }),
    el("h1", { textContent: "Trip Planner" }),
    el("p", { textContent: "Plan trips with your friends — from \"where should we go?\" to the recap." }),
    googleButton,
    errorHolder,
    el("div", { className: "sign-in-divider", textContent: "or" }),
    formHolder,
    modeLinks,
  ]);
}

export function renderEmailConfirmation(user, actions, initialError = "") {
  const errorHolder = el("div", { className: "field-error-holder", attrs: { "aria-live": "polite" } }, errorNode(initialError));
  const continueButton = el("button", { type: "button", className: "btn btn-primary", textContent: "Continue" });
  const resendButton = el("button", { type: "button", className: "btn btn-link", textContent: "Send it again" });
  const run = async (button, pendingText, action) => {
    setPending(button, true, pendingText);
    errorHolder.replaceChildren();
    try {
      const message = await action();
      if (message) errorHolder.replaceChildren(el("p", { className: "sign-in-note", textContent: message }));
    } catch (error) {
      errorHolder.replaceChildren(errorNode(authErrorMessage(error)));
    } finally {
      setPending(button, false);
    }
  };
  continueButton.addEventListener("click", () => run(continueButton, "Checking…", actions.continue));
  resendButton.addEventListener("click", () => run(resendButton, "Sending…", actions.resend));
  return el("div", { className: "center-card sign-in-card" }, [
    el("img", { className: "center-card-logo", src: "./img/logo.svg", alt: "", width: 64, height: 64 }),
    el("h1", { textContent: "Check your email" }),
    el("p", { textContent: `Check your email to confirm, then tap Continue. We sent the link to ${user.email}.` }),
    continueButton,
    resendButton,
    errorHolder,
    el("button", { type: "button", className: "btn btn-link", textContent: "Sign out", onclick: actions.signOut }),
  ]);
}
