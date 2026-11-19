import {db} from './data'
import {extractIncomeTaxPdf,type ExtractedTaxReport} from './incomeTaxPdf'
import {OFFICIAL_FIELDS,type OfficialValues} from './annualTax'

const BUCKET='income-tax-reports'
const maxSize=15_000_000
const keyPattern=/^[0-9a-f-]{36}\/[0-9]{4}\/[0-9a-f-]{36}[.]pdf$/
export type IncomeTaxReport={
 id:string;user_id:string;calendar_year:number;storage_key:string;
 original_filename:string;sha256:string;file_size_bytes:number;
 extracted_values:OfficialValues;reviewed_values:OfficialValues;
 confirmed_at:string|null;created_at:string;updated_at:string
}
function client(){if(!db)throw Error('Banco não configurado.');return db}
async function ownerId():Promise<string>{
 const {data,error}=await client().auth.getUser()
 if(error||!data.user)throw Error('Faça login novamente para acessar seus informes.')
 return data.user.id
}
export function sanitizeTaxValues(raw:OfficialValues):OfficialValues{
 const out:OfficialValues={}
 for(const {key} of OFFICIAL_FIELDS){
  const value=raw[key]
  if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1_000_000_000)
   out[key]=Math.round(value*100)/100
 }
 return out
}
function privatePath(row:IncomeTaxReport,uid:string){
 if(row.user_id!==uid||row.storage_key.split('/')[0]!==uid||
  row.storage_key.split('/')[1]!==String(row.calendar_year)||!keyPattern.test(row.storage_key))
  throw Error('Referência do informe inválida.')
 return row.storage_key
}
export async function loadIncomeTaxReport(year:number):Promise<IncomeTaxReport|null>{
 const userId=await ownerId()
 const {data,error}=await client().from('annual_tax_reports').select('*')
  .eq('user_id',userId).eq('calendar_year',year).maybeSingle()
 if(error)throw Error('Não foi possível consultar o informe de IR: '+error.message)
 return data as IncomeTaxReport|null
}
export async function loadIncomeTaxYears():Promise<number[]>{
 const userId=await ownerId()
 const {data,error}=await client().from('annual_tax_reports').select('calendar_year')
  .eq('user_id',userId).order('calendar_year',{ascending:false})
 if(error)throw Error('Não foi possível carregar os anos dos informes.')
 return (data||[]).map(row=>Number(row.calendar_year)).filter(Number.isInteger)
}
export async function uploadIncomeTaxReport(year:number,file:File):
 Promise<{report:IncomeTaxReport;extraction:ExtractedTaxReport;alreadyStored:boolean}>{
 const userId=await ownerId()
 if(year<1990||year>2100||!Number.isInteger(year))throw Error('Ano-calendário inválido.')
 if(file.size<1||file.size>maxSize)throw Error('Selecione um PDF de até 15 MB.')
 const extraction=await extractIncomeTaxPdf(file)
 if(extraction.detectedYear!==null&&extraction.detectedYear!==year)
  throw Error('O documento informa ano-calendário '+extraction.detectedYear+
   ', diferente do ano selecionado ('+year+'). Altere o ano antes de enviar.')
 const data=new Uint8Array(await file.arrayBuffer())
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)))
  .map(x=>x.toString(16).padStart(2,'0')).join('')
 const previous=await loadIncomeTaxReport(year)
 if(previous?.sha256===hash)return {report:previous,extraction,alreadyStored:true}
 const key=userId+'/'+year+'/'+crypto.randomUUID()+'.pdf'
 const {error:uploadError}=await client().storage.from(BUCKET).upload(key,file,{
  contentType:'application/pdf',upsert:false,cacheControl:'0'
 })
 if(uploadError)throw Error('Não foi possível armazenar o informe privado: '+uploadError.message)
 const filename=(file.name||'informe.pdf').replace(/[\/\\\x00-\x1f]/g,'_').slice(0,160)
 const payload={
  user_id:userId,calendar_year:year,storage_key:key,original_filename:filename||'informe.pdf',
  sha256:hash,file_size_bytes:file.size,extracted_values:sanitizeTaxValues(extraction.fields),
  reviewed_values:{},confirmed_at:null,updated_at:new Date().toISOString()
 }
 const {data:row,error:saveError}=await client().from('annual_tax_reports').upsert(payload,{
  onConflict:'user_id,calendar_year'
 }).select('*').single()
 if(saveError||!row){
  await client().storage.from(BUCKET).remove([key])
  throw Error('Não foi possível registrar o informe. O upload foi desfeito: '+(saveError?.message||'erro desconhecido'))
 }
 if(previous?.storage_key&&previous.storage_key!==key){
  // An orphan on cleanup failure is private and does not affect the new record.
  await client().storage.from(BUCKET).remove([privatePath(previous,userId)])
 }
 return {report:row as IncomeTaxReport,extraction,alreadyStored:false}
}
export async function confirmIncomeTaxReport(row:IncomeTaxReport,values:OfficialValues):
 Promise<IncomeTaxReport>{
 const userId=await ownerId()
 const saved=sanitizeTaxValues(values)
 if(Object.keys(saved).length===0)throw Error('Confira e informe ao menos um campo do documento antes de confirmar.')
 const {data,error}=await client().from('annual_tax_reports')
  .update({reviewed_values:saved,confirmed_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  .eq('id',row.id).eq('user_id',userId).eq('calendar_year',row.calendar_year)
  .eq('storage_key',privatePath(row,userId)).select('*').single()
 if(error||!data)throw Error('Não foi possível confirmar os valores do informe: '+(error?.message||'registro não encontrado'))
 return data as IncomeTaxReport
}
export async function downloadIncomeTaxReport(row:IncomeTaxReport):Promise<Blob>{
 const userId=await ownerId()
 const {data,error}=await client().storage.from(BUCKET).download(privatePath(row,userId))
 if(error||!data)throw Error('Não foi possível abrir o PDF privado: '+(error?.message||'arquivo indisponível'))
 return data
}
export async function deleteIncomeTaxReport(row:IncomeTaxReport):Promise<void>{
 const userId=await ownerId()
 const key=privatePath(row,userId)
 const {error}=await client().from('annual_tax_reports').delete()
  .eq('id',row.id).eq('user_id',userId).eq('storage_key',key)
 if(error)throw Error('Não foi possível remover o cadastro do informe: '+error.message)
 const cleaned=await client().storage.from(BUCKET).remove([key])
 if(cleaned.error)throw Error('Cadastro removido, mas a exclusão do PDF ficou pendente. Contate o suporte.')
}
