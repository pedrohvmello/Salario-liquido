import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type {OfficialField,OfficialValues} from './annualTax'

pdfjs.GlobalWorkerOptions.workerSrc=workerUrl

export type ExtractedTaxReport={
 fields:OfficialValues
 detectedYear:number|null
 pages:number
 warnings:string[]
 extractedText:boolean
}
type PdfToken={text:string;x:number;y:number}
type Line={text:string;page:number}
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .replace(/\s+/g,' ').toLowerCase().trim()
const validMoney=(text:string):number|null=>{
 const normalized=text.replace(/\s/g,'').replace(/R\$/ig,'').replace(/\./g,'').replace(',','.')
 const value=Number(normalized)
 return Number.isFinite(value)&&value>=0&&value<=1_000_000_000?Math.round(value*100)/100:null
}
const moneyPattern=/(?<![\d])(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?!\d)/g
function amountOnRow(raw:string):number|null{
 const matches=[...raw.matchAll(moneyPattern)]
 if(!matches.length)return null
 return validMoney(matches[matches.length-1][1])
}
function makeLines(items:PdfToken[],page:number):Line[]{
 const grouped:Array<{y:number;items:PdfToken[]}>= []
 for(const item of items.filter(i=>i.text.trim()).sort((a,b)=>b.y-a.y||a.x-b.x)){
  const group=grouped.find(g=>Math.abs(g.y-item.y)<2.8)
  if(group)group.items.push(item)
  else grouped.push({y:item.y,items:[item]})
 }
 return grouped.sort((a,b)=>b.y-a.y).map(g=>({
  page,text:g.items.sort((a,b)=>a.x-b.x).map(i=>i.text.trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim()
 })).filter(l=>l.text)
}
/**
 * Detect the calendar year ONLY from the employer-report header. Exercise is
 * normally the following year and is a fallback only when the calendar label
 * cannot be read. Conflicting labels must be confirmed by the user.
 */
export function inferCalendarYear(text:string):number|null{
 const value=normalize(text)
 const labeled=[...value.matchAll(/\b(?:ano\s*[-–]?\s*calendario|ano\s*[-–]?\s*base|ano\s+de\s+referencia)\s*(?:[:.=-]\s*)?(?:de\s+)?(20\d{2})\b/g)]
  .map(match=>Number(match[1]))
 const calendarYears=[...new Set(labeled)].filter(y=>y>=1990&&y<=2100)
 if(calendarYears.length>1)return null
 const exercise=[...new Set([...value.matchAll(/\bexercicio\s*(?:[:.=-]\s*)?(?:de\s+)?(20\d{2})\b/g)]
  .map(match=>Number(match[1])))].filter(y=>y>=1991&&y<=2101)
 if(exercise.length>1)return null
 if(calendarYears.length===1){
  if(exercise.length===1&&exercise[0]!==calendarYears[0]+1)return null
  return calendarYears[0]
 }
 return exercise.length===1?exercise[0]-1:null
}
type Section='taxable'|'exclusive_net'|'exclusive_other'|'other'
function sectionOf(text:string):Section|null{
 const row=normalize(text)
 // We only accept section headers, not incidental references in other rows.
 if(/^(?:3[.]\s*)?rendimentos tributaveis\s*,?\s*deduc/.test(row))return 'taxable'
 if(/^(?:5[.]\s*)?rendimentos sujeitos a tributacao exclusiva/.test(row)){
  return /\brendimento(?:s)? liquido(?:s)?\b/.test(row)?'exclusive_net':'exclusive_other'
 }
 if(/^[1-8][.]\s*(?:fonte pagadora|pessoa fisica beneficiaria|rendimentos isentos|rendimentos recebidos acumuladamente|informacoes complementares|responsavel pelas informacoes)/.test(row))
  return 'other'
 return null
}
const is13=/\b(?:13[ºo°]\s*(?:\(\s*decimo terceiro\s*\)\s*)?salario|decimo terceiro\s*salario)\b/
const isPlr=/\b(?:ppr|plr)\b|participac(?:ao|oes)\s+(?:nos|de)\s+lucros/
function fieldsOnLine(row:string,section:Section):OfficialField[]{
 const n=normalize(row)
 if(section==='taxable'){
  const matches:OfficialField[]=[]
  if(/\btotal dos rendimentos\b|\brendimentos tributaveis recebidos\b/.test(n))matches.push('taxable_salary')
  if(/contribuic(?:ao|oes) previdenciaria oficial|\bprevidencia oficial\b/.test(n))matches.push('inss')
  if(/previdencia complementar|\bprevidencia privada dedutivel\b/.test(n))matches.push('private_pension')
  if(/pensao alimenticia/.test(n))matches.push('alimony')
  if(/imposto (?:sobre a renda )?retido na fonte|\birrf\b/.test(n)&&
   !/(?:13[ºo°]|decimo terceiro|\bplr\b|\bppr\b)/.test(n))matches.push('salary_irrf')
  return matches
 }
 if(section!=='exclusive_net'&&section!=='exclusive_other')return []
 // RFB's "rendimento líquido" table is not equivalent to gross salary/PPR.
 const explicitNet=section==='exclusive_net'||/\bliquido\b/.test(n)
 const isWithholding=/\b(?:irrf|imposto|retido)\b/.test(n)
 if(is13.test(n)){
  if(isWithholding)return ['thirteenth_irrf']
  if(/\bbrut[oa]\b/.test(n))return ['thirteenth']
  return explicitNet?['thirteenth_net']:[]
 }
 if(isPlr.test(n)){
  if(isWithholding)return ['ppr_irrf']
  if(/\bbrut[oa]\b/.test(n))return ['ppr_gross']
  return explicitNet?['ppr_net']:[]
 }
 return []
}
/** Use labeled rows within their actual section; adjacent RRA/zero-value rows
 * must never be treated as the 13th or PLR of section 5. */
export function extractTaxFieldsFromLines(lines:Line[]):{fields:OfficialValues;warnings:string[]}{
 const fields:OfficialValues={}
 const warnings:string[]=[]
 const found=new Map<OfficialField,number[]>()
 let section:Section='other'
 for(let i=0;i<lines.length;i++){
  const row=lines[i]
  const nextSection=sectionOf(row.text)
  if(nextSection){section=nextSection;continue}
  if(section==='other')continue
  const matches=fieldsOnLine(row.text,section)
  if(!matches.length)continue
  let amount=amountOnRow(row.text)
  if(amount===null&&i+1<lines.length&&lines[i+1].page===row.page){
   const next=lines[i+1].text.trim()
   if(/^(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(next))amount=amountOnRow(next)
  }
  if(amount===null)continue
  for(const key of matches){
   const existing=found.get(key)||[]
   existing.push(amount)
   found.set(key,existing)
  }
 }
 for(const [key,amounts] of found){
  const distinct=[...new Set(amounts)]
  if(distinct.length===1)fields[key]=distinct[0]
  else warnings.push('Foram encontrados valores diferentes para '+key+'; confira o documento manualmente.')
 }
 return {fields,warnings}
}
export async function extractIncomeTaxPdf(file:File):Promise<ExtractedTaxReport>{
 if(file.size>15_000_000||file.size===0)throw Error('O arquivo deve ter até 15 MB.')
 const bytes=new Uint8Array(await file.arrayBuffer())
 if(String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')
  throw Error('O arquivo enviado não possui assinatura PDF válida.')
 const task=pdfjs.getDocument({data:bytes})
 const document=await task.promise
 const lines:Line[]=[]
 try{
  if(document.numPages>120)throw Error('Informe com páginas demais para processamento.')
  const scanPages=Math.min(document.numPages,30)
  for(let page=1;page<=scanPages;page++){
   const result=await (await document.getPage(page)).getTextContent()
   const items:PdfToken[]=result.items.filter((x):x is typeof x & {str:string,transform:number[]}=>('str' in x)&&('transform' in x))
    .map(x=>({text:x.str,x:x.transform[4],y:x.transform[5]}))
   lines.push(...makeLines(items,page))
  }
  const firstText=lines.slice(0,180).map(l=>l.text).join(' ')
  const year=inferCalendarYear(firstText)
  const result=extractTaxFieldsFromLines(lines)
  const warnings=result.warnings
  if(!lines.length)warnings.push('O PDF parece digitalizado. Os valores devem ser preenchidos e conferidos manualmente.')
  if(lines.length&&Object.keys(result.fields).length===0)
   warnings.push('Não foi possível reconhecer campos fiscais com segurança. Confira o PDF e informe os valores.')
  if(document.numPages>scanPages)warnings.push('A extração analisou as primeiras 30 páginas; confira os demais dados.')
  if(year===null)warnings.push('Não foi possível determinar com segurança o ano-calendário pelo cabeçalho. Confirme o ano antes de importar.')
  return {fields:result.fields,detectedYear:year,pages:document.numPages,
   warnings,extractedText:lines.length>0}
 }finally{await document.destroy()}
}
