function superAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(email?: string | null) {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}
