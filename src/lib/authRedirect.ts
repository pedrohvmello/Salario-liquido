/** The type is captured in index.html BEFORE Supabase reads and clears OAuth URL fragments. */
export function requiresPasswordSetup(type: string | null | undefined): boolean {
  return type === 'recovery' || type === 'invite'
}
