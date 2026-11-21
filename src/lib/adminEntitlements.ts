import {db} from './data'
export type Plan='free'|'basic'|'full'
export type AdminAccessUser={
 userId:string;email:string;displayName:string;role:string;active:boolean;status:string;
 basePlan:Plan;paidPlan:Plan;effectivePlan:Plan;overridePlan:Plan|null;
 hasActivePromo:boolean;hasActiveManual:boolean;hasActiveLegacyTrial:boolean;
}
export type AccessGrant={
 id:string;type:'manual'|'legacy'|'code';userId:string;email:string;displayName:string;
 plan:'basic'|'full';startsAt:string;endsAt:string;revokedAt:string|null;
 state:'active'|'expired'|'revoked';code?:string;codeId?:string
}
const client=()=>{if(!db)throw Error('Banco não configurado.');return db}
async function rpcArray<T>(name:string):Promise<T[]>{
 const {data,error}=await client().rpc(name)
 if(error)throw Error(error.message)
 if(!Array.isArray(data))throw Error('Resposta administrativa inválida: '+name)
 return data as T[]
}
export const loadAdminAccessUsers=()=>rpcArray<AdminAccessUser>('list_admin_plan_access')
export const loadAdminManualGrants=()=>rpcArray<AccessGrant>('list_admin_manual_access')
export const loadAdminPromoRedemptions=()=>rpcArray<AccessGrant>('list_admin_promo_redemptions')
export async function grantManualAccess(userId:string,plan:'basic'|'full',days:number){
 const {data,error}=await client().rpc('grant_admin_promotional_access',{p_target:userId,p_plan:plan,p_days:days})
 if(error)throw Error(error.message)
 if(data?.granted!==true)throw Error('Não foi possível confirmar a concessão.')
}
export async function revokePromotionalAccess(id:string,type:AccessGrant['type']){
 const {data,error}=await client().rpc('revoke_admin_promotional_access',{p_id:id,p_type:type})
 if(error)throw Error(error.message)
 if(data?.revoked!==true)throw Error('Não foi possível confirmar a revogação.')
}
export async function changeAdminPlan(userId:string,plan:Plan|null){
 const {data,error}=await client().rpc('set_admin_plan_override',{p_target:userId,p_plan:plan})
 if(error)throw Error(error.message)
 if(data?.updated!==true||data?.billingUnchanged!==true)throw Error('Alteração de acesso não confirmada.')
}
export function daysRemaining(end:string,state:string,now=Date.now()):number{
 if(state!=='active')return 0
 const time=Date.parse(end)
 return Number.isFinite(time)?Math.max(0,Math.ceil((time-now)/86400000)):0
}
export function grantStateText(value:AccessGrant['state']):string{
 return value==='active'?'Ativo':value==='expired'?'Expirado':'Revogado'
}
export function planName(plan:Plan|string):string{
 return plan==='full'?'Full':plan==='basic'?'Basic':'Free'
}
export const paymentStatusText=(value:string):string=>{
 const labels:Record<string,string>={paid:'Pago',active:'Ativo',pending:'Pendente',checkout_created:'Checkout criado',
  canceled:'Cancelado',cancelled:'Cancelado',expired:'Expirado',failed:'Falhou',overdue:'Vencido',
  received:'Recebido',confirmed:'Confirmado',PENDING:'Pendente',RECEIVED:'Recebido',
  CONFIRMED:'Confirmado',OVERDUE:'Vencido',REFUNDED:'Estornado'}
 return labels[value]||value
}
