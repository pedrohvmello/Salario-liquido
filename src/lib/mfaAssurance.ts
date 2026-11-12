export type Assurance={currentLevel:'aal1'|'aal2'|null;nextLevel:'aal1'|'aal2'|null}
/** Fail closed whenever the account is enrolled but the session is not yet AAL2. */
export function mfaGateForAssurance(level:Assurance|null|undefined,error?:unknown):'ready'|'challenge'|'error'{
 if(error||!level||!level.currentLevel||!level.nextLevel)return 'error'
 return level.nextLevel==='aal2'&&level.currentLevel!=='aal2'?'challenge':'ready'
}
