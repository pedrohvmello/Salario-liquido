export type PayrepEnvironment='hml'|'prd'
export type AsaasMode='sandbox'|'production'

/** The HML-only project ref is injected by Vercel in both HML targets.
 * Backend URL/key consistency is independently enforced in data.ts.
 */
export function resolvePayrepEnvironment(hmlProjectRef:unknown):PayrepEnvironment{
 return typeof hmlProjectRef==='string'&&hmlProjectRef.trim()!==''?'hml':'prd'
}

/** Explicit flag overrides the legacy HML pilot default.
 * Production is opt-in: absence of the flag never enables Pep in PRD.
 */
export function resolvePepEnabled(flag:unknown,environment:PayrepEnvironment):boolean{
 if(flag==='true')return true
 if(flag==='false')return false
 return environment==='hml'
}

export const runtimeEnvironment=resolvePayrepEnvironment(import.meta.env.VITE_HML_SUPABASE_PROJECT_REF)
export const asaasMode:AsaasMode=runtimeEnvironment==='hml'?'sandbox':'production'
export const asaasLabel=asaasMode==='sandbox'?'Asaas Sandbox':'Asaas Produção'
export const pepAssistantEnabled=resolvePepEnabled(import.meta.env.VITE_ENABLE_PEP_ASSISTANT,runtimeEnvironment)
