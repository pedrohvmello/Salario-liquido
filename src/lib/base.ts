/** Stable IBGE identifiers prevent collisions between municipalities with similar names. */
export type BaseLocation = {city:string;uf:string;ibge:string}
export const DEFAULT_BASE:BaseLocation={city:'São Paulo',uf:'SP',ibge:'3550308'}
export const UF_LIST=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'] as const
export function isValidBase(value:unknown):value is BaseLocation {
 if(!value||typeof value!=='object')return false
 const b=value as Record<string,unknown>
 return typeof b.city==='string'&&b.city.trim().length>0&&typeof b.uf==='string'&&UF_LIST.includes(b.uf as typeof UF_LIST[number])&&typeof b.ibge==='string'&&/^\d{7}$/.test(b.ibge)
}
export function baseLabel(b:BaseLocation){return b.city+' / '+b.uf}
export function baseKey(b:BaseLocation){return b.uf+'-'+b.ibge}
