const messages = {
  "auth/invalid-credential": "That email or password didn't match. Try again or reset your password.",
  "auth/wrong-password": "That password didn't match. Try again or reset your password.",
  "auth/user-not-found": "We couldn't find an account with that email. Create one or check the address.",
  "auth/weak-password": "Use a stronger password with at least six characters.",
  "auth/email-already-in-use": "That email already has an account. Sign in or reset its password.",
  "auth/invalid-email": "Enter a complete email address.",
  "auth/too-many-requests": "Too many tries just now. Wait a little, then try again.",
};

export function authErrorMessage(error) {
  return messages[error?.code] || error?.message || "Something went wrong. Try again in a moment.";
}
