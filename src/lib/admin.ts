import {db} from './data'

export type AccessStatus='pending'|'approved'|'suspended'|'rejected'
export type AdminUser={
 id:string;email:string|null;createdAt:string;lastSignInAt:string|null;
 emailConfirmed:boolean;role:'admin'|'member';status:AccessStatus;active:boolean;
 sessions:number;sessions30d:number;lastAppAccess:string|null
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
