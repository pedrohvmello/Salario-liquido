export type PasswordPolicy={
 minLength:number;requireLowercase:boolean;requireUppercase:boolean;
 requireNumbers:boolean;requireSymbols:boolean
}
/** Phase 1 baseline; mirror these requirements in Supabase Auth native settings. */
export const passwordPolicyDefaults:Readonly<PasswordPolicy>=Object.freeze({
 minLength:12,requireLowercase:true,requireUppercase:true,requireNumbers:true,requireSymbols:true
})
export function validatePasswordPolicy(p:PasswordPolicy):string|null{
 if(!Number.isInteger(p.minLength)||p.minLength<12||p.minLength>128)return 'Informe de 12 a 128 caracteres.'
 return null
}
export function checkPassword(s:string,p:PasswordPolicy=passwordPolicyDefaults):string[]{
 const missing:string[]=[]
 if(s.length<p.minLength)missing.push('mínimo de '+p.minLength+' caracteres')
 if(p.requireLowercase&&!/[a-z]/.test(s))missing.push('letra minúscula')
 if(p.requireUppercase&&!/[A-Z]/.test(s))missing.push('letra maiúscula')
 if(p.requireNumbers&&!/[0-9]/.test(s))missing.push('número')
 if(p.requireSymbols&&!/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,./\`~]/.test(s))missing.push('caractere especial')
 return missing
}
