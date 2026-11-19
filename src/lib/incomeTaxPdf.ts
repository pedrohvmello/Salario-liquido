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
const patterns:Record<OfficialField,RegExp[]>={
 taxable_salary:[/total (?:dos )?rendimentos(?: tributaveis)?(?: inclusive ferias)?/,/rendimentos tributaveis (?:de salarios|recebidos)/],
 inss:[/contribuic(?:ao|oes) (?:previdenciaria )?oficial/,/previdencia oficial.*inss/],
 salary_irrf:[/imposto (?:sobre a renda )?retido na fonte/,/imposto de renda retido na fonte/],
 private_pension:[/previdencia complementar/,/previdencia privada dedutivel/],
 alimony:[/pensao alimenticia/],
 thirteenth:[/decimo terceiro salario/,/13[ºo°] salario/],
 thirteenth_irrf:[/irrf.*(?:13[ºo°]|decimo terceiro)/,/(?:13[ºo°]|decimo terceiro).*irrf/,/imposto.*(?:13[ºo°]|decimo terceiro)/],
 ppr_gross:[/participac(?:ao|oes) nos lucros(?: e resultados)?/,/ppr\/?plr/,/rendimento(?:s)? de ppr/],
 ppr_irrf:[/irrf.*(?:participac|ppr|plr)/,/imposto.*(?:participac|ppr|plr)/]
}
type Section='taxable'|'exclusive'|'other'
function sectionOf(text:string):Section|null{
 const n=normalize(text)
 if(/rendimentos tributaveis.*(?:deduc|imposto)/.test(n))return 'taxable'
 if(/rendimentos sujeitos a tributacao exclusiva/.test(n))return 'exclusive'
 if(/rendimentos isentos|informacoes complementares|responsavel pelas informacoes|dados da fonte pagadora/.test(n))return 'other'
 return null
}
/** Require a section and a label-plus-amount line. No guessed figures and no
 * cross-section IRRF mixing. Scanned or unfamiliar layouts remain review-only. */
export function extractTaxFieldsFromLines(lines:Line[]):{fields:OfficialValues;warnings:string[]}{
 const fields:OfficialValues={}
 const warnings:string[]=[]
 const found=new Map<OfficialField,number[]>()
 let section:Section='other'
 for(let i=0;i<lines.length;i++){
  const row=lines[i],n=normalize(row.text)
  const maybeSection=sectionOf(n)
  if(maybeSection){section=maybeSection;continue}
  if(section==='other')continue
  for(const [key,patternsForKey] of Object.entries(patterns) as [OfficialField,RegExp[]][]){
   if(key==='salary_irrf'&&section!=='taxable')continue
   if(['taxable_salary','inss','private_pension','alimony'].includes(key)&&section!=='taxable')continue
   if(['thirteenth','thirteenth_irrf','ppr_gross','ppr_irrf'].includes(key)&&section!=='exclusive')continue
   if(!patternsForKey.some(rx=>rx.test(n)))continue
   // Avoid classifying a PPR/13th line as generic salary withholding.
   if(key==='salary_irrf'&&/(?:ppr|plr|decimo terceiro|13[ºo°])/.test(n))continue
   if(key==='thirteenth'&&/(?:irrf|imposto|retido)/.test(n))continue
   if(key==='ppr_gross'&&/(?:irrf|imposto|retido)/.test(n))continue
   let amount=amountOnRow(row.text)
   if(amount===null&&i+1<lines.length&&lines[i+1].page===row.page){
    const next=lines[i+1].text.trim()
    // Only accept a following line containing an amount alone, not a new label.
    if(/^(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(next))amount=amountOnRow(next)
   }
   if(amount===null)continue
   const existing=found.get(key)||[]
   existing.push(amount);found.set(key,existing)
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
