/** Input and display formatting for manual payroll events, pt-BR.
 * Currency/percent values use two decimals; dependent count is an integer.
 * Stored values remain numeric, never locale-formatted strings.
 */
const formatDecimal=(value:number,digits:number)=>new Intl.NumberFormat('pt-BR',{
  minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:true
}).format(value)
export function isQuantityEvent(kind:string):boolean{return kind==='dependents'}
/** Accept 15.340,57 and 15340,57 (BR), plus 15340.57 from older numeric inputs.
 * A lone period followed by three digits is grouping, e.g. 1.234 -> 1234.
 * Ambiguous or malformed separators fail instead of silently changing the amount.
 */
export function parseEventValue(input:string,kind:string):number|null {
 const raw=input.replace(/^\s*R\$\s*/i,'').replace(/\s+/g,'').trim()
 if(!raw)return null
 let canonical:string
 if(raw.includes(',')){
  if(!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{0,2})?$/.test(raw))return null
  canonical=raw.replace(/\./g,'').replace(',','.')
 }else if(raw.includes('.')){
  if(/^-?\d{1,3}(?:\.\d{3})+$/.test(raw)){
   canonical=raw.replace(/\./g,'')
  }else if(/^-?\d+\.\d{1,2}$/.test(raw)){
   canonical=raw
  }else return null
 }else{
  if(!/^-?\d+$/.test(raw))return null
  canonical=raw
 }
 const number=Number(canonical)
 if(!Number.isFinite(number)||!Number.isSafeInteger(Math.trunc(number)))return null
 const rounded=Math.round((number+Number.EPSILON)*100)/100
 if(isQuantityEvent(kind)&&(!Number.isInteger(rounded)||rounded<0))return null
 return rounded
}
export function formatEventValue(value:number,kind:string):string{
 return formatDecimal(value,isQuantityEvent(kind)?0:2)
}
export function formatEventInput(input:string,kind:string):string{
 const number=parseEventValue(input,kind)
 return number===null?input:formatEventValue(number,kind)
}
