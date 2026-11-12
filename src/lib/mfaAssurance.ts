export type Assurance={currentLevel:string|null;nextLevel:string|null}
/** Fail closed whenever the account is enrolled but the session is not yet AAL2. */
export function mfaGateForAssurance(level:Assurance|null|undefined,error?:unknown):'ready'|'challenge'|'error'{
 if(error||!level||!['aal1','aal2'].includes(level.currentLevel||'')||!['aal1','aal2'].includes(level.nextLevel||''))return 'error'
 return level.nextLevel==='aal2'&&level.currentLevel!=='aal2'?'challenge':'ready'
}
