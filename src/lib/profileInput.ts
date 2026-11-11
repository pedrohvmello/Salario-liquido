export const onlyDigits=(s:string)=>s.replace(/\D/g,'')
/** Brazilian mobile phone mask; also accepts pasted +55 prefix. */
export function formatPhone(raw:string):string{
 let d=onlyDigits(raw)
 if(d.length>11&&d.startsWith('55'))d=d.slice(2)
 d=d.slice(0,11)
 if(!d)return ''
 if(d.length<=2)return '('+d
 const area='('+d.slice(0,2)+') '
 const rest=d.slice(2)
 if(rest.length<=4)return area+rest
 if(d.length<=10)return area+rest.slice(0,4)+'-'+rest.slice(4)
 return area+rest.slice(0,5)+'-'+rest.slice(5)
}
export function formatCep(raw:string):string{
 const d=onlyDigits(raw).slice(0,8)
 return d.length<=5?d:d.slice(0,5)+'-'+d.slice(5)
}
export type CepResult={logradouro?:string;bairro?:string;localidade?:string;uf?:string;erro?:boolean|string}
export function isValidCepResult(value:unknown):value is CepResult{
 if(!value||typeof value!=='object')return false
 const obj=value as Record<string,unknown>
 return obj.erro!==true&&obj.erro!=='true'&&typeof obj.localidade==='string'&&typeof obj.uf==='string'
}
