import {db} from './data'

export type AccessStatus='pending'|'approved'|'suspended'|'rejected'
export type AdminUser={
 id:string;email:string|null;createdAt:string;lastSignInAt:string|null;
 emailConfirmed:boolean;role:'admin'|'member';status:AccessStatus;active:boolean;
 sessions:number;sessions30d:number;lastAppAccess:string|null;
 displayName:string|null;plan:'free'|'basic'|'full';city:string|null;state:string|null
}
export type AdminAction={
 action:string;targetId:string|null;performedAt:string;old:string|null;new:string|null
}
export type AdminDashboardData={
 requireApproval:boolean;trackingSince:string|null;users:AdminUser[];
 sessions30d:number;uniqueUsers30d:number;recentActions:AdminAction[]
}
const client=()=>{if(!db)throw new Error('Supabase não configurado');return db}
export async function fetchAdminDashboard():Promise<AdminDashboardData>{
 const {data,error}=await client().rpc('get_admin_dashboard')
 if(error)throw new Error(error.message)
 if(!data||!Array.isArray(data.users))throw new Error('Dados administrativos inválidos')
 return data as AdminDashboardData
}
export async function isAppAdmin():Promise<boolean>{
 const {data,error}=await client().rpc('is_app_admin')
 if(error)throw new Error(error.message)
 return data===true
}
export async function changeUserStatus(id:string,status:AccessStatus):Promise<void>{
 const {error}=await client().rpc('set_member_status',{p_target:id,p_status:status})
 if(error)throw new Error(error.message)
}
export async function changeApprovalRequirement(required:boolean):Promise<void>{
 const {error}=await client().rpc('set_approval_requirement',{p_required:required})
 if(error)throw new Error(error.message)
}
export async function recordAppSession():Promise<void>{
 const {error}=await client().rpc('record_app_session')
 if(error)throw new Error(error.message)
}

export type AdminPayment={id:string;provider:string;description:string;amountCents:number;currency:string;status:string;dueAt:string|null;paidAt:string|null;createdAt:string}
export type AdminUserDetail={
 id:string;email:string|null;createdAt:string;lastSignInAt:string|null;
 emailConfirmed:boolean;role:'admin'|'member';status:AccessStatus;
 profile:{display_name?:string;phone?:string;postal_code?:string;street?:string;street_number?:string;
 complement?:string;neighborhood?:string;city?:string;state?:string;country?:string};
 subscription:{plan:'free'|'basic'|'full';status:string;provider:string|null;providerCustomerId:string|null;
 providerSubscriptionId:string|null;periodStart:string|null;periodEnd:string|null;cancelAtPeriodEnd:boolean};
 payments:AdminPayment[];payslipCount:number;eventCount:number
}
export async function fetchAdminUserDetail(id:string):Promise<AdminUserDetail>{
 const {data,error}=await client().rpc('get_admin_user_detail',{p_target:id})
 if(error)throw Error(error.message)
 if(!data||data.id!==id)throw Error('Detalhes administrativos inválidos.')
 return data as AdminUserDetail
}
