import { authErrorMessage } from "../js/lib/auth-errors.js";

export const tests = [
  ["explains a wrong password", () => {
    if (authErrorMessage({ code: "auth/wrong-password" }) !== "That password didn't match. Try again or reset your password.") {
      throw new Error("Wrong-password message changed");
    }
  }],
  ["keeps an unfamiliar error useful", () => {
    if (authErrorMessage({ message: "Network unavailable" }) !== "Network unavailable") {
      throw new Error("Fallback message changed");
    }
  }],
];
