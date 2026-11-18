import {createClient, type SupabaseClient} from '@supabase/supabase-js'
import type {PDFDocument as PdfDocument} from 'pdf-lib'
import type {ParsedStatement} from './parse'
import {makePprEvent} from './ppr'
import {validateThirteenthPay} from './thirteenth'
import type {StatementRubric} from './vacation'
import {type DayEntry,type Overtime} from './calendar'
import {timePayload} from './timeEntryPayload'
import type {TimeBankPolicy} from './timeBank'
import type {SalaryParameters} from './money'
import {type BaseLocation,isValidBase} from './base'
const url=import.meta.env.VITE_SUPABASE_URL
// Prefer the independent HML project's modern publishable key when configured.
// Production remains compatible with its existing legacy anon key.
const anon=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY
const hmlRef=import.meta.env.VITE_HML_SUPABASE_PROJECT_REF
// Fail closed on HML if its published URL or key is accidentally changed to PRD.
const backendMatches=!hmlRef||(url===`https://${hmlRef}.supabase.co`&&Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY))
export const db:SupabaseClient | null=url&&anon&&backendMatches?createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,...(import.meta.env.VITE_ENABLE_PASSKEYS==='true'?{experimental:{passkey:true}}:{})}}):null
export type SavedStatement={id:string;storage_key:string;source_page:number;period:string;format:string;document_type:'monthly'|'ppr'|'vacation'|'thirteenth';vacation_start:string|null;vacation_end:string|null;payment_date:string|null;gross_ppr:number|null;ppr_income_tax:number;ppr_union_contribution:number;thirteenth_gross:number|null;thirteenth_advance:number;thirteenth_inss:number;thirteenth_irrf:number;thirteenth_pension:number;salary_contract:number|null;trienio:number|null;dependents_irrf?:number|null;event_use_competence_end?:boolean;credits:number|null;debits:number|null;net:number|null;salary_advance:number|null;net_received:number|null;ir_base:number|null;fgts:number|null;warnings:string[];source_file:string}
export type SalaryEvent={id:string;effective_date:string;kind:string;value:number;notes:string;created_at?:string;source_statement_id?:string|null}
export type SavedTimeEntry=DayEntry & {id:string}
export const eventsKinds=[
 ['salary','Alteração de salário'],['dependents','Dependentes IRRF'],['mealBenefit','Vale-refeição (R$/dia útil)'],['fixedBenefit','Vale-benefício (R$/mês)'],['childcareBenefit','Auxílio-creche (R$/mês)'],['trienio','Triênio'],
 ['esppPercent','ESPP %'],['privatePensionPercent','Previdência %'],
 ['pensionPercent','Pensão % e critérios de incidência'],['fixedPension','Pensão fixa (projeção)'],['advancePercent','Adiantamento %'],
 ['vacation','Férias (ocorrência)'],['bonus','Bônus (ocorrência)'],['ppr','PPR (participação nos resultados)'],['thirteenth','13º salário (recibo anual)'],['absence','Falta (ocorrência)']
] as const
async function identity(){if(!db)throw new Error('Supabase não configurado');const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error('Faça login');return user.id}
export type Membership={active:boolean;role:'member'|'admin';status:'pending'|'approved'|'suspended'|'rejected'}
export async function getMembership():Promise<Membership|null>{
 if(!db)return null
 const id=await identity()
 const {data,error}=await db.from('app_members').select('active,role,status').eq('user_id',id).maybeSingle()
 if(error)throw new Error(error.message)
 return data as Membership|null
}
export async function memberActive(){const membership=await getMembership();return membership?.active===true}
async function listAllStatementRubrics(id:string):Promise<StatementRubric[]>{
  if(!db)throw new Error('Banco não configurado')
  const collected:StatementRubric[]=[]
  const limit=500
  for(let offset=0;offset<100000;offset+=limit){
    const {data,error}=await db.from('statement_lines')
      .select('statement_id,code,description,amount,side').eq('user_id',id)
      .order('id',{ascending:true}).range(offset,offset+limit-1)
    if(error)throw new Error(error.message)
    collected.push(...(data||[]) as StatementRubric[])
    if((data||[]).length<limit)return collected
  }
  throw new Error('Volume de rubricas acima do limite de leitura: contate o suporte')
}
export async function getData(){
  const id=await identity();if(!db)throw new Error('Banco não configurado')
  const [statements,events,entries,settings,lines,profileChoice,profiles]=await Promise.all([
    db.from('statements').select('*').eq('user_id',id).order('period',{ascending:false}),
    db.from('salary_events').select('*').eq('user_id',id).order('effective_date',{ascending:false}),
    db.from('time_entries').select('*').eq('user_id',id).order('date',{ascending:false}),
    db.from('user_settings').select('parameters,base_city').eq('user_id',id).maybeSingle(),
    listAllStatementRubrics(id),
    db.from('user_bank_profile_selections').select('profile_id').eq('user_id',id).maybeSingle(),
    db.from('bank_policy_profiles').select('*').eq('active',true)
  ])
  for(const r of [statements,events,entries,settings,profileChoice,profiles])if(r.error)throw new Error(r.error.message)
  return {statements:(statements.data||[]) as SavedStatement[],lines,events:(events.data||[]) as SalaryEvent[],entries:(entries.data||[]) as Array<{id:string;date:string;start_at:string|null;lunch_start:string|null;lunch_end:string|null;end_at:string|null;holiday_override:boolean|null;additional_minutes:number|null;comments:string|null;bank_hours:boolean;effective_holiday:boolean;bank_delta_minutes:number|null;bank_weighted_minutes:number|null;bank_policy_id:string|null;bank_profile_id:string|null}>,
  bankPolicies:(profiles.data||[]).filter(p=>p.id===profileChoice.data?.profile_id)
   .map(p=>({...p,title:p.name,source_reference:p.source_note})) as TimeBankPolicy[],
  settings:(settings.data?.parameters||{}) as Partial<SalaryParameters>,overviewCards:settings.data?.parameters?.overviewCards as unknown,base:isValidBase(settings.data?.base_city)?settings.data.base_city:null}
}
export async function saveBase(base:BaseLocation){
  if(!db)throw new Error('Banco não configurado')
  if(!isValidBase(base))throw new Error('Selecione uma Base válida')
  const user_id=await identity()
  const {error}=await db.from('user_settings').upsert({user_id,base_city:base,updated_at:new Date().toISOString()})
  if(error)throw new Error(error.message)
}
export async function saveOverviewCards(cards:string[]){
 if(!db)throw new Error('Banco não configurado')
 const user_id=await identity()
 const {data:current,error:readError}=await db.from('user_settings').select('parameters').eq('user_id',user_id).maybeSingle()
 if(readError)throw new Error(readError.message)
 const parameters={...(current?.parameters||{}),overviewCards:cards}
 const {error}=await db.from('user_settings').upsert({user_id,parameters,updated_at:new Date().toISOString()})
 if(error)throw new Error(error.message)
}
export async function saveSettings(parameters:SalaryParameters){
  if(!db)throw new Error('Banco não configurado')
  const user_id=await identity()
  const {error}=await db.from('user_settings').upsert({user_id,parameters,updated_at:new Date().toISOString()})
  if(error)throw new Error(error.message)
}
export async function saveEvent(input:Omit<SalaryEvent,'id'> & {id?:string}){
  // Keep historical records readable but do not create or edit manual pension amounts.
  if(input.kind==='privatePensionFixed')throw new Error('Previdência em reais é calculada automaticamente a partir do percentual vigente.')
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
export async function saveTimeEntries(entries:DayEntry[]){
 if(!db)throw new Error('Banco não configurado')
 if(entries.length===0)return
 if(entries.length>31||new Set(entries.map(e=>e.date)).size!==entries.length)
  throw new Error('Seleção de registros inválida.')
 const user_id=await identity()
 const payload=entries.map(entry=>timePayload(entry,user_id))
 const {error}=await db.from('time_entries').upsert(payload,{onConflict:'user_id,date'})
 if(error)throw new Error(error.message)
}
export async function saveTimeEntry(entry:DayEntry,id?:string){
 if(!db)throw new Error('Banco não configurado')
 const user_id=await identity()
 const {error}=await db.from('time_entries').upsert(timePayload(entry,user_id,id),{onConflict:'user_id,date'})
 if(error)throw new Error(error.message)
}
export async function removeTimeEntry(id:string){
  if(!db)throw new Error('Banco não configurado')
  const {error}=await db.from('time_entries').delete().eq('id',id).eq('user_id',await identity())
  if(error)throw new Error(error.message)
}
export async function downloadPayslipPdf(statementId:string):Promise<{blob:Blob;page:number;filename:string}>{
 if(!db)throw new Error('Banco não configurado')
 const userId=await identity()
 const {data:statement,error:readError}=await db.from('statements')
  .select('storage_key,source_page,source_file,source_sha256,period,document_type').eq('user_id',userId).eq('id',statementId).single()
 if(readError||!statement)throw new Error('Documento não encontrado ou sessão sem permissão de leitura.')
 const sharedKey=userId+'/'+statement.source_sha256+'.pdf'
 const individualKey=userId+'/'+statement.source_sha256+'-p'+statement.source_page+'.pdf'
 if(!/^[0-9a-f]{64}$/i.test(statement.source_sha256||'')||![sharedKey,individualKey].includes(statement.storage_key))
  throw new Error('Referência do PDF inconsistente. O acesso foi bloqueado.')
 const {data,error}=await db.storage.from('payslips').download(statement.storage_key)
 if(error||!data)throw new Error(error?.message||'Não foi possível abrir o PDF privado.')
 const single=statement.storage_key===individualKey
 const source=String(statement.source_file||'holerite.pdf').replace(/[\/\\\x00-\x1f]/g,'_').slice(0,150)
 const name=single
  ? (statement.document_type==='monthly'?'Holerite':statement.document_type==='thirteenth'?'13o Salario':statement.document_type==='vacation'?'Ferias':'PPR')+' - '+statement.period+'.pdf'
  :source
 return {blob:data,page:single?1:Number(statement.source_page)||1,filename:name.toLowerCase().endsWith('.pdf')?name:name+'.pdf'}
}
export async function deletePayslipStatement(statementId:string):Promise<{deleted:boolean;fileDeleted:boolean;remainingRecords?:number;cleanupPending?:boolean;message?:string}>{
 if(!db)throw new Error('Banco não configurado')
 const {data,error}=await db.functions.invoke('payslip-delete',{body:{id:statementId}})
 if(error){
  const context=error && 'context' in error ? (error as {context?:Response}).context : undefined
  const detail=context?await context.json().catch(()=>null):null
  throw new Error((detail as {error?:string}|null)?.error||error.message||'Não foi possível excluir o holerite.')
 }
 if(!data||data.deleted!==true)throw new Error(data?.error||'Não foi possível confirmar a exclusão.')
 return data
}
export async function saveStatements(pages:ParsedStatement[],files:File[],selected:string[],useCompetenceDate=false){
  if(!db)throw new Error('Banco não configurado')
  const user_id=await identity()
  // Fast-fail before PDF parsing/upload. The actual entitlement is also
  // enforced by restrictive RLS/storage policies, never by this client check alone.
  const {data:plan,error:planError}=await db.rpc('my_effective_payrep_plan')
  if(planError)throw Error('Não foi possível verificar seu plano: '+planError.message)
  if(plan?.effectivePlan!=='full')throw Error('Importação de PDFs e eventos automáticos disponíveis somente no plano Full.')
  const chosen=pages.filter(p=>selected.includes(p.sourceFile+'#'+p.page))
  if(!chosen.length)throw new Error('Selecione ao menos um holerite.')
  if(files.length!==new Set(files.map(f=>f.name)).size)
    throw new Error('Foram selecionados PDFs com nomes iguais. Renomeie os arquivos antes de importar.')
  const fileByName=new Map(files.map(f=>[f.name,f]))
  // A page without an identified competence may be the continuation of the
  // preceding receipt. Do not silently drop such a page when splitting.
  for(const name of fileByName.keys()){
    if(!chosen.some(p=>p.sourceFile===name))continue
    if(pages.some(p=>p.sourceFile===name&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.period)))
      throw new Error('O PDF '+name+' contém páginas sem competência reconhecida. Revise ou separe esse arquivo antes de importar, para não descartar páginas de um holerite.')
  }
  for(const s of chosen){
    if(s.documentType==='ppr')makePprEvent(s)
    if(s.documentType==='thirteenth')validateThirteenthPay(s)
    if(s.documentType==='vacation'){
      if(!s.vacationStart||!s.vacationEnd||s.vacationEnd<s.vacationStart||!s.paymentDate||
         s.credits===null||s.debits===null||s.net===null||
         Math.abs(s.credits-s.debits-s.net)>.02)
        throw new Error('Recibo de férias incompleto. Verifique datas e totais antes de importar.')
    }
  }
  const {PDFDocument}=await import('pdf-lib')
  const originals=new Map<string,{hash:string;document:PdfDocument}>()
  for(const name of new Set(chosen.map(x=>x.sourceFile))){
    const file=fileByName.get(name)
    if(!file)throw new Error('Arquivo original ausente: '+name)
    const buffer=await file.arrayBuffer()
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
    let document:PdfDocument
    try{document=await PDFDocument.load(buffer)}
    catch{throw new Error('Não foi possível separar o PDF '+name+'. O arquivo pode estar protegido ou danificado.')}
    originals.set(name,{hash,document})
  }
  // Validate all new records before starting uploads.
  for(const s of chosen){
    const original=originals.get(s.sourceFile)
    if(!original||!Number.isInteger(s.page)||s.page<1||s.page>original.document.getPageCount())
      throw new Error('Página de origem inválida para '+s.sourceFile)
    const {data:existing,error:existingError}=await db.from('statements')
      .select('id').eq('user_id',user_id).eq('source_sha256',original.hash).eq('source_page',s.page).maybeSingle()
    if(existingError)throw new Error(existingError.message)
    if(existing)throw new Error('O holerite '+s.period+' já foi importado deste arquivo. Exclua o registro antes de importar novamente.')
    if(s.documentType==='thirteenth'){
      const {data:other,error:otherError}=await db.from('statements')
        .select('id').eq('user_id',user_id).eq('document_type','thirteenth').eq('period',s.period).maybeSingle()
      if(otherError)throw new Error(otherError.message)
      if(other)throw new Error('Já existe recibo de 13º para '+s.period+'. Exclua o anterior antes de importar.')
    }
  }
  const importedIds:string[]=[]
  // One original page => one PDF => one statement. The original document
  // hash + page remains the deduplication identity; only the stored object
  // name changes from <hash>.pdf to <hash>-pN.pdf.
  for(const s of chosen){
    const original=originals.get(s.sourceFile)!
    const destination=await PDFDocument.create()
    const [page]=await destination.copyPages(original.document,[s.page-1])
    destination.addPage(page)
    const bytes=await destination.save()
    const pdf=new Blob([new Uint8Array(bytes)],{type:'application/pdf'})
    const key=user_id+'/'+original.hash+'-p'+s.page+'.pdf'
    const uploaded=await db.storage.from('payslips').upload(key,pdf,{upsert:false,contentType:'application/pdf'})
    if(uploaded.error&&!/already exists|duplicate/i.test(uploaded.error.message))
      throw new Error('Falha ao salvar o PDF individual de '+s.period+': '+uploaded.error.message)
    const {data:statement,error}=await db.from('statements').insert({
      user_id,period:s.period,source_sha256:original.hash,source_page:s.page,source_file:s.sourceFile,
      storage_key:key,format:s.format,document_type:s.documentType,payment_date:s.paymentDate,
      vacation_start:s.vacationStart,vacation_end:s.vacationEnd,
      gross_ppr:s.grossPpr,ppr_income_tax:s.pprIncomeTax,ppr_union_contribution:s.pprUnionContribution,
      thirteenth_gross:s.thirteenthGross,thirteenth_advance:s.thirteenthAdvance,
      thirteenth_inss:s.thirteenthInss,thirteenth_irrf:s.thirteenthIrrf,
      thirteenth_pension:s.thirteenthPension,
      salary_contract:s.salaryContract,trienio:s.trienio,dependents_irrf:s.dependentsIrrf??null,
      credits:s.credits,debits:s.debits,net:s.net,salary_advance:s.salaryAdvance,net_received:s.netReceived,ir_base:s.irBase,fgts:s.fgts,warnings:s.warnings
    }).select('id').single()
    if(error)throw new Error('Falha ao registrar o holerite '+s.period+': '+error.message+'. Verifique os documentos importados antes de tentar novamente.')
    if(s.lines.length){
      const added=await db.from('statement_lines').insert(s.lines.map((l,i)=>({...l,user_id,statement_id:statement.id,ordinal:i})))
      if(added.error)throw new Error('O holerite '+s.period+' foi salvo, mas a gravação de algumas rubricas falhou: '+added.error.message)
    }
    importedIds.push(statement.id)
   }
  if(chosen.some(s=>s.documentType==='monthly')){
   // A database RPC atomically reconciles source-linked events. Missing actual
   // payment dates are not silently invented. Provisional dates require opt-in.
   const {error}=await db.rpc('sync_my_monthly_salary_events',{p_use_competence_end:useCompetenceDate,p_document_ids:importedIds})
   if(error)throw new Error('Holerites salvos, mas a sincronização dos eventos falhou: '+error.message+'. Use Gerar eventos em Meus documentos para corrigir.')
  }
}
export function effectiveParams(base:SalaryParameters,events:SalaryEvent[],month:string):SalaryParameters{
  const params={...base,pensionMethod:'none' as SalaryParameters['pensionMethod'],pensionPercent:0,fixedPension:0}
  // A pension exists only if an active event explicitly configures it.
  // Historical date of first observation is NOT an exact legal start date.
  for(const e of [...events].sort((a,b)=>a.effective_date.localeCompare(b.effective_date))){
    if(e.kind==='privatePensionFixed')continue // legacy events no longer contribute to payroll
    if(e.effective_date.slice(0,7)>month)continue
    if(e.kind in params && typeof params[e.kind as keyof SalaryParameters]==='number') {
      (params as unknown as Record<string,number>)[e.kind]=e.value
      if(e.kind==='pensionPercent')params.pensionMethod='old26'
      if(e.kind==='fixedPension')params.pensionMethod='fixed'
    }
  }
  return params
}
export function eventCandidates(newItem:ParsedStatement,prior:SavedStatement|null){
  if(newItem.documentType!=='monthly'||prior?.document_type!=='monthly'||!prior||!newItem.period)return [] as Array<{kind:string;value:number;reason:string}>
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
