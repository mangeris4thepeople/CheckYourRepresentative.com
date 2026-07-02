// Shared session helpers — single source of truth for "am I signed in"
// across every tab (Profile, Vote, Accountability, etc). Both App.jsx and
// VoterProfile.jsx read/write through here so they never drift out of sync.
export function getStoredSession() {
  try { return JSON.parse(localStorage.getItem("cyr_session") || "null"); } catch { return null; }
}
export function storeSession(s) {
  if (s) localStorage.setItem("cyr_session", JSON.stringify(s));
  else localStorage.removeItem("cyr_session");
}
