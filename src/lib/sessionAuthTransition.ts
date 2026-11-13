/** Distinguish a new authenticated identity from routine Supabase focus/refresh events.
 * SIGNED_IN is emitted even when an existing user returns to the tab.
 * Only real identity transitions must replace the application with auth gates.
 */
export function sessionAuthTransition(
 event:string,
 previousUserId:string|null,
 nextUserId:string|null
):{resetMfa:boolean;backgroundMfaCheck:boolean}{
 const identityChanged=previousUserId!==nextUserId
 return {
  resetMfa:identityChanged||event==='SIGNED_OUT',
  backgroundMfaCheck:!identityChanged&&nextUserId!==null
   &&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')
 }
}
