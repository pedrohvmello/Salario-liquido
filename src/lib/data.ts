import {createClient, type SupabaseClient} from '@supabase/supabase-js'
import type {ParsedStatement} from './parse'
import {type DayEntry,type Overtime} from './calendar'
import type {SalaryParameters} from './money'
const url=import.meta.env.VITE_SUPABASE_URL
const anon=import.meta.env.VITE_SUPABASE_ANON_KEY
export const db:SupabaseClient | null=url&&anon?createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true}}):null
export type SavedStatement={id:string;period:string;format:string;salary_contract:number|null;trienio:number|null;credits:number|null;debits:number|null;net:number|null;ir_base:number|null;fgts:number|null;warnings:string[];source_file:string}
export type SalaryEvent={id:string;effective_date:string;kind:string;value:number;notes:string;created_at?:string}
export type SavedTimeEntry=DayEntry & {id:string}
export const eventsKinds=[
 ['salary','Alteração de salário'],['dependents','Dependentes IRRF'],['mealBenefit','Vale-refeição'],['trienio','Triênio'],
 ['esppPercent','ESPP %'],['privatePensionPercent','Previdência %'],['privatePensionFixed','Previdência R$'],
 ['pensionPercent','Pensão % (projeção)'],['fixedPension','Pensão fixa (projeção)'],['advancePercent','Adiantamento %'],
 ['vacation','Férias (ocorrência)'],['bonus','Bônus (ocorrência)'],['absence','Falta (ocorrência)']
] as const
async function identity(){if(!db)throw new Error('Supabase não configurado');const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error('Faça login');return user.id}
export async function memberActive(){if(!db)return false;const id=await identity();const {data,error}=await db.from('app_members').select('active').eq('user_id',id).single();if(error)return false;return data?.active===true}
export async function getData(){
  const id=await identity();if(!db)throw new Error('Banco não configurado')
  const [statements,events,entries,settings]=await Promise.all([
    db.from('statements').select('*').eq('user_id',id).order('period',{ascending:false}),
    db.from('salary_events').select('*').eq('user_id',id).order('effective_date',{ascending:false}),
    db.from('time_entries').select('*').eq('user_id',id).order('date',{ascending:false}),
    db.from('user_settings').select('parameters').eq('user_id',id).maybeSingle()
  ])
  for(const r of [statements,events,entries,settings])if(r.error)throw new Error(r.error.message)
  return {statements:(statements.data||[]) as SavedStatement[],events:(events.data||[]) as SalaryEvent[],entries:(entries.data||[]) as Array<{id:string;date:string;start_at:string;lunch_start:string;lunch_end:string;end_at:string;holiday_override:boolean|null}>,settings:(settings.data?.parameters||{}) as Partial<SalaryParameters>}
}
export async function saveSettings(parameters:SalaryParameters){
  if(!db)throw new Error('Banco não configurado')
  const user_id=await identity()
  const {error}=await db.from('user_settings').upsert({user_id,parameters,updated_at:new Date().toISOString()})
  if(error)throw new Error(error.message)
}
export async function saveEvent(input:Omit<SalaryEvent,'id'> & {id?:string}){
  if(!db)throw new Error('Banco não configurado');const user_id=await identity()
  const payload={...input,user_id}
  const {error}=await db.from('salary_events').upsert(payload)
  if(error)throw new Error(error.message)
}
export async function removeEvent(id:string){
  if(!db)throw new Error('Banco não configurado')
  const {error}=await db.from('salary_events').delete().eq('id',id).eq('user_id',await identity())
  if(error)throw new Error(error.message)
}
export async function saveTimeEntry(entry:DayEntry,id?:string){
  if(!db)throw new Error('Banco não configurado')
  const user_id=await identity()
  const {error}=await db.from('time_entries').upsert({
    ...(id?{id}:{}),user_id,date:entry.date,start_at:entry.start,lunch_start:entry.lunchStart,lunch_end:entry.lunchEnd,end_at:entry.end,holiday_override:entry.holidayOverride
  },{onConflict:'user_id,date'})
  if(error)throw new Error(error.message)
}
export async function removeTimeEntry(id:string){
  if(!db)throw new Error('Banco não configurado')
  const {error}=await db.from('time_entries').delete().eq('id',id).eq('user_id',await identity())
  if(error)throw new Error(error.message)
}
export async function saveStatements(pages:ParsedStatement[],files:File[],selected:string[]){
  if(!db)throw new Error('Banco não configurado');const user_id=await identity()
  const chosen=pages.filter(p=>selected.includes(p.sourceFile+'#'+p.page))
  for(const s of chosen){
    const file=files.find(f=>f.name===s.sourceFile)
    if(!file)throw new Error('Arquivo original ausente: '+s.sourceFile)
    // No public object ACL. Object names never contain a person's real name.
    const buffer=await file.arrayBuffer()
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
    const key=user_id+'/'+hash+'.pdf'
    const uploaded=await db.storage.from('payslips').upload(key,file,{upsert:false,contentType:'application/pdf'})
    if(uploaded.error&&!/already exists|duplicate/i.test(uploaded.error.message))throw new Error(uploaded.error.message)
    const {data:statement,error}=await db.from('statements').upsert({
      user_id,period:s.period,source_sha256:hash,source_page:s.page,source_file:s.sourceFile,
      storage_key:key,format:s.format,salary_contract:s.salaryContract,trienio:s.trienio,
      credits:s.credits,debits:s.debits,net:s.net,ir_base:s.irBase,fgts:s.fgts,warnings:s.warnings
    },{onConflict:'user_id,source_sha256,source_page'}).select('id').single()
    if(error)throw new Error(error.message)
    const removed=await db.from('statement_lines').delete().eq('statement_id',statement.id)
    if(removed.error)throw new Error(removed.error.message)
    if(s.lines.length){
      const added=await db.from('statement_lines').insert(s.lines.map((l,i)=>({...l,user_id,statement_id:statement.id,ordinal:i})))
      if(added.error)throw new Error(added.error.message)
    }
  }
}
export function effectiveParams(base:SalaryParameters,events:SalaryEvent[],month:string):SalaryParameters{
  const params={...base}
  // Historical date of first observation is NOT an exact legal start date.
  for(const e of [...events].sort((a,b)=>a.effective_date.localeCompare(b.effective_date))){
    if(e.effective_date.slice(0,7)>month)continue
    if(e.kind in params && typeof params[e.kind as keyof SalaryParameters]==='number') {
      (params as unknown as Record<string,number>)[e.kind]=e.value
    }
  }
  return params
}
export function eventCandidates(newItem:ParsedStatement,prior:SavedStatement|null){
  if(!prior||!newItem.period)return [] as Array<{kind:string;value:number;reason:string}>
  const result:Array<{kind:string;value:number;reason:string}>=[]
  if(newItem.salaryContract!==null&&prior.salary_contract!==null&&newItem.salaryContract!==prior.salary_contract)
    result.push({kind:'salary',value:newItem.salaryContract,reason:'Salário contratual diferente. Data exata de vigência requer confirmação.'})
  if(newItem.trienio!==null&&prior.trienio!==null&&newItem.trienio!==prior.trienio)
    result.push({kind:'trienio',value:newItem.trienio,reason:'Triênio diferente na competência. Confirmar se não é proporcional ou retroativo.'})
  return result
}
export function sumHours(entries:Array<DayEntry & {calculated:Overtime}>,month:string){
  return entries.filter(e=>e.calculated.payMonth===month).reduce((a,e)=>({h60:a.h60+e.calculated.h60,h80:a.h80+e.calculated.h80,h100:a.h100+e.calculated.h100}),{h60:0,h80:0,h100:0})
}
