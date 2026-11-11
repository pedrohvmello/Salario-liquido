export type PasswordPolicy={
 minLength:number;requireLetters:boolean;requireUppercase:boolean;
 requireNumbers:boolean;requireSymbols:boolean
}
export const passwordPolicyDefaults:PasswordPolicy={
 minLength:8,requireLetters:true,requireUppercase:true,requireNumbers:true,requireSymbols:true
}
/** UI policy preview only; actual enforcement must be configured in Supabase Auth. */
export function validatePasswordPolicy(p:PasswordPolicy):string|null{
 if(!Number.isInteger(p.minLength)||p.minLength<8||p.minLength>128)return 'Informe de 8 a 128 caracteres.'
 return null
}
export function checkPassword(s:string,p:PasswordPolicy):string[]{
 const missing:string[]=[]
 if(s.length<p.minLength)missing.push('mínimo de '+p.minLength+' caracteres')
 if(p.requireLetters&&!/[a-zA-ZÀ-ÿ]/.test(s))missing.push('letra')
 if(p.requireUppercase&&!/[A-ZÀ-Ý]/.test(s))missing.push('letra maiúscula')
 if(p.requireNumbers&&!/\d/.test(s))missing.push('número')
 if(p.requireSymbols&&!/[^a-zA-ZÀ-ÿ0-9\s]/.test(s))missing.push('caractere especial')
 return missing
}
