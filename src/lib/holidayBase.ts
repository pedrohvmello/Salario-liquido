import Holidays from 'date-holidays'
import {type BaseLocation,baseKey} from './base'

export type HolidayCatalog={dates:ReadonlySet<string>;baseKey:string;years:number[];coverage:'regional'|'provider'|'partial';message:string}
const regionsByIBGE:Record<string,string>={
 '3550308':'SP', // São Paulo
 '3304557':'RJ', // Rio de Janeiro
 '3106200':'BH', // Belo Horizonte
 '4106902':'CU', // Curitiba
 '2611606':'RE', // Recife
 '5208707':'GOIANIA' // Goiânia
}
type ExternalHoliday={date?:unknown;data?:unknown;type?:unknown;tipo?:unknown;name?:unknown}
const DATE=/^\d{4}-\d{2}-\d{2}$/
const TYPES=new Set(['national','state','municipal','nacional','estadual','municipal','public'])
function normalizeDate(data:unknown):string|null {
 if(typeof data!=='string')return null
 if(DATE.test(data))return data
 const m=data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
 return m?m[3]+'-'+m[2]+'-'+m[1]:null
}
function slug(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function itemsFromRemote(payload:unknown):ExternalHoliday[] {
 if(Array.isArray(payload))return payload
 if(!payload||typeof payload!=='object')return []
 const p=payload as Record<string,unknown>
 if(Array.isArray(p.data))return p.data
 if(Array.isArray(p.holidays))return p.holidays
 if(Array.isArray(p.feriados))return p.feriados
 return []
}
export function publicDatesFromProvider(payload:unknown):Set<string> {
 const result=new Set<string>()
 for(const h of itemsFromRemote(payload)){
  const kind=String(h.type??h.tipo??'').toLowerCase()
  if(!TYPES.has(kind))continue // optional/facultativo are NOT holidays
  const d=normalizeDate(h.date??h.data)
  if(d)result.add(d)
 }
 return result
}
/** National and state holidays are always calculated offline via date-holidays.
 * For recognized cities, date-holidays also includes local public holidays.
 * For other IBGE municipalities, a public OSS data API is queried. If unavailable,
 * coverage is marked partial, never declared complete.
 */
export async function loadHolidayCatalog(base:BaseLocation,years:number[]):Promise<HolidayCatalog> {
 const uniqueYears=[...new Set(years)].filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100).sort()
 const region=regionsByIBGE[base.ibge]
 const engine=new Holidays('BR',base.uf,region)
 engine.setLanguages('pt')
 const dates=new Set<string>()
 for(const year of uniqueYears){
  for(const h of engine.getHolidays(year)||[]){
   if(h.type==='public'&&DATE.test(h.date.slice(0,10)))dates.add(h.date.slice(0,10))
  }
 }
 let coverage:HolidayCatalog['coverage']=region?'regional':'partial'
 let message=region?'Feriados nacionais, estaduais e municipais cadastrados para esta cidade. Confirme exceções na prefeitura.':'Feriados nacionais e estaduais cadastrados. Verificando os feriados municipais...'
 if(!region&&uniqueYears.length){
  let allYearsSucceeded=true
  for(const year of uniqueYears){
   try{
    const location=base.uf+'-'+slug(base.city)
    const uri='https://api.feriados.dev/api/v1/holidays?city='+encodeURIComponent(location)+'&year='+year
    const r=await fetch(uri,{signal:AbortSignal.timeout(6000),headers:{Accept:'application/json'}})
    if(!r.ok)throw Error('Serviço retornou '+r.status)
    const data=await r.json() as unknown
    const list=publicDatesFromProvider(data)
    // A valid annual calendar must have common fixed national holidays.
    if(!list.has(year+'-01-01')||!list.has(year+'-12-25'))throw Error('Dados anuais incompletos')
    for(const d of list)if(d.startsWith(String(year)+'-'))dates.add(d)
   }catch{allYearsSucceeded=false}
  }
  if(allYearsSucceeded){coverage='provider';message='Feriados nacionais, estaduais e municipais consultados em fonte externa. Confira com a prefeitura.'}
  else{coverage='partial';message='Feriados municipais não confirmados para '+base.city+'. Apenas feriados nacionais/estaduais estão assegurados; marque exceções manualmente.'}
 }
 return {dates,baseKey:baseKey(base),years:uniqueYears,coverage,message}
}
