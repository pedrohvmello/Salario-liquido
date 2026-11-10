/**
 * Client-side parsers for two Accenture PDF layouts.
 * Values are evidence only: never derive a missing line or silently fix totals.
 * PDFs are parsed in the browser; only explicit user confirmation persists anything.
 */
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {extractOldTotals} from './oldTotals'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
export type PayrollLine={code:string; description:string; amount:number; side:'credit'|'debit'|'unknown'}
export type ParsedStatement={
 period:string; format:'old'|'new'; salaryContract:number|null; trienio:number|null;
 credits:number|null; debits:number|null; net:number|null; irBase:number|null; fgts:number|null;
 lines:PayrollLine[]; warnings:string[]; sourceFile:string; page:number
}
type Item={text:string;x:number;y:number}
type Row={text:string;items:Item[];y:number}
const money=(s:string):number=>Number(s.replace(/\./g,'').replace(',','.'))
const allMoney=(s:string):string[]=>s.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g)||[]
function group(items:Item[]):Row[]{
  const ordered=items.filter(x=>x.text.trim()).sort((a,b)=>b.y-a.y||a.x-b.x)
  const groups:Row[]=[]
  for(const item of ordered) {
    const row=groups.find(g=>Math.abs(g.y-item.y)<2.7)
    if(row) row.items.push(item)
    else groups.push({y:item.y,items:[item],text:''})
  }
  for(const row of groups) {
    row.items.sort((a,b)=>a.x-b.x)
    row.text=row.items.map(i=>i.text.trim()).join(' ').replace(/\s+/g,' ').trim()
  }
  return groups.sort((a,b)=>b.y-a.y)
}
function rowValue(row:Pick<Row,'items'>,needle:RegExp){return row.items.find(i=>needle.test(i.text))?.text||''}
function oldParse(rows:Row[],name:string,page:number):ParsedStatement{
  const whole=rows.map(r=>r.text).join('\n')
  const range=whole.match(/\d{2}\/(\d{2})\/(\d{4})\s+a\s+\d{2}\/\d{2}\/\d{4}/i)
  const period=range ? range[2]+'-'+range[1] : ''
  const salaryRow=rows.find(r=>r.text.includes('Salário contratual:'))
  const salaryIndex=salaryRow?rows.indexOf(salaryRow):-1
  const salaryContract=salaryIndex>=0?money(rowValue(rows[salaryIndex+1]||{items:[]},/^\d{1,3}(?:\.\d{3})*,\d{2}$/))||null:null
  const start=rows.findIndex(r=>r.text.includes('Código')&&r.text.includes('Descrição'))
  const stop=rows.findIndex((r,i)=>i>start&&r.text.includes('Total de proventos:'))
  const lines:PayrollLine[]=[]
  for(const row of rows.slice(Math.max(0,start+1),stop<0?undefined:stop)){
    const codeItem=row.items.find(i=>/^\d{5}$/.test(i.text)&&i.x<65)
    if(!codeItem)continue
    const desc=row.items.filter(i=>i.x>=65&&i.x<385).map(i=>i.text).join(' ').trim()
    const amounts=row.items.filter(i=>i.x>=440&&/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(i.text))
    const item=amounts.at(-1)
    if(item)lines.push({code:codeItem.text,description:desc,amount:money(item.text),side:item.x<505?'credit':'debit'})
  }
  const {credits,debits,net}=extractOldTotals(rows)
  const totalsRow=rows.find(r=>r.text.includes('Sal. contrib. INSS:'))
  const figures2=totalsRow?allMoney((rows[rows.indexOf(totalsRow)+1]||{text:''}).text):[]
  const trienio=lines.find(l=>l.code==='00135')?.amount??null
  const result:ParsedStatement={period,format:'old',salaryContract,trienio,credits,debits,net,irBase:figures2.length>=4?money(figures2[3]):null,fgts:figures2.length>=3?money(figures2[2]):null,lines,warnings:[],sourceFile:name,page}
  return validate(result)
}
// The new layout prints each rubric as a monospaced line, often as ONE text item.
const NEW_CREDIT_CODES=new Set(['1000','3301','3041','3042','315Z','3065','3261','4389','6913','6914','6915','6916','4503'])
const NEW_DEBIT_CODES=new Set(['/314','/401','/B02','7020','7610','7612','7624','7627','8475','8503','8914','MG11'])
function newParse(rows:Row[],name:string,page:number):ParsedStatement{
  const salaryLine=rows.find(r=>/\d{2}\/\d{2}\s+\d{2}\.\d{2}\.\d{4}/.test(r.text))
  const match=salaryLine?.text.match(/(\d{1,3}(?:\.\d{3})*,\d{2}).*?(\d{2})\/(\d{2})\s+\d{2}\.\d{2}\.(\d{4})/)
  const period=match ? match[4]+'-'+match[2] : ''
  const salaryContract=match?money(match[1]):null
  const start=rows.findIndex(r=>r.text.includes('Cod.')&&r.text.includes('Descrição'))
  const stop=rows.findIndex((r,i)=>i>start&&/\bTotal\b/.test(r.text)&&allMoney(r.text).length>=2)
  const lines:PayrollLine[]=[]
  for(const row of rows.slice(Math.max(0,start+1),stop<0?undefined:stop)){
    const m=row.text.match(/^([A-Z0-9/]{4})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/)
    if(!m)continue
    const [,code,description,amount]=m
    const side:PayrollLine['side']=NEW_CREDIT_CODES.has(code)?'credit':NEW_DEBIT_CODES.has(code)?'debit':'unknown'
    lines.push({code,description,amount:money(amount),side})
  }
  const totals=stop>=0?allMoney(rows[stop].text):[]
  const baseIndex=rows.findIndex(r=>r.text.includes('Base IR')&&r.text.includes('Base INSS'))
  const bases=baseIndex>=0?allMoney((rows[baseIndex+1]||{text:''}).text):[]
  const trienio=lines.find(l=>l.code==='3301')?.amount??null
  return validate({period,format:'new',salaryContract,trienio,
    credits:totals.length>=2?money(totals[0]):null,
    debits:totals.length>=2?money(totals[1]):null,
    net:bases.length>=6?money(bases.at(-1)!):null,
    irBase:bases.length>=1?money(bases[0]):null,fgts:bases.length>=4?money(bases[3]):null,
    lines,warnings:[],sourceFile:name,page})
}
function validate(s:ParsedStatement):ParsedStatement {
  if(!/^\d{4}-\d{2}$/.test(s.period))s.warnings.push('Competência não identificada')
  if(!s.lines.length)s.warnings.push('Nenhuma rubrica reconhecida')
  if(s.lines.some(x=>x.side==='unknown'))s.warnings.push('Rubricas sem classificação: revisar antes de salvar')
  if(s.credits===null||s.debits===null||s.net===null)s.warnings.push('Totais incompletos: conferência manual necessária')
  else if(Math.abs(s.credits-s.debits-s.net)>0.02)s.warnings.push('Totais impressos não fecham: conferir retenções e antecipações do documento')
  return s
}
export async function parsePdf(file:File):Promise<ParsedStatement[]> {
  if(file.type&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Selecione um PDF')
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise
  const result:ParsedStatement[]=[]
  try {
    for(let pageNo=1;pageNo<=doc.numPages;pageNo++){
      const page=await doc.getPage(pageNo)
      const content=await page.getTextContent()
      const items:Item[]=content.items.filter((x):x is (typeof content.items)[number]&{str:string;transform:number[]}=>'str' in x).map(x=>({text:x.str,x:x.transform[4],y:x.transform[5]}))
      const rows=group(items)
      const newFormat=rows.some(r=>r.text.includes('RECIBO DE PAGAMENTO FOLHA MENSAL'))
      result.push(newFormat?newParse(rows,file.name,pageNo):oldParse(rows,file.name,pageNo))
    }
  } finally {await doc.destroy()}
  return result
}
