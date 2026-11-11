import type {User} from '@supabase/supabase-js'
/** Match the initials formerly displayed in the sidebar, using email only. */
export function accountInitials(user:Pick<User,'email'>|null):string {
 const account=(user?.email||'SL').split('@')[0].replace(/[^a-zA-ZÀ-ÿ]/g,'')
 return account.slice(0,2).toLocaleUpperCase('pt-BR')||'SL'
}
export function profileDisplayName(user:Pick<User,'user_metadata'>|null):string {
 const meta=user?.user_metadata
 const value=meta?.display_name??meta?.full_name??meta?.name
 return typeof value==='string'?value:''
}
export function canConfirmDeletion(value:string,acknowledged:boolean):boolean {
 return acknowledged&&value.trim()==='EXCLUIR'
}
