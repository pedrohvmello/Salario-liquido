import {overviewCardPalette,type OverviewCardColor} from './overview'

export const adminKpiIds=[
 'registered','approved','pending','blocked','sessions30d',
 'uniqueUsers30d','free','basic','full','locations'
] as const
export type AdminKpiId=typeof adminKpiIds[number]
export type AdminKpiColors=Partial<Record<AdminKpiId,OverviewCardColor>>
const validIds=new Set<string>(adminKpiIds)
const validColors=new Set<string>(overviewCardPalette.map(v=>v.id))

export function normalizeAdminKpiOrder(value:unknown):AdminKpiId[]{
 if(!Array.isArray(value))return [...adminKpiIds]
 const result:AdminKpiId[]=[]
 for(const v of value){
  if(typeof v==='string'&&validIds.has(v)&&!result.includes(v as AdminKpiId))
   result.push(v as AdminKpiId)
 }
 return result
}
export function normalizeAdminKpiColors(value:unknown):AdminKpiColors{
 if(!value||typeof value!=='object'||Array.isArray(value))return {}
 const raw=value as Record<string,unknown>
 const result:AdminKpiColors={}
 for(const id of adminKpiIds){
  const color=raw[id]
  if(typeof color==='string'&&color!=='default'&&validColors.has(color))
   result[id]=color as OverviewCardColor
 }
 return result
}
export function reorderAdminKpi(order:AdminKpiId[],id:AdminKpiId,target:number):AdminKpiId[]{
 const current=normalizeAdminKpiOrder(order)
 const before=current.indexOf(id)
 if(before<0||target<0||target>=current.length||before===target)return current
 const next=[...current]
 next.splice(before,1)
 next.splice(target,0,id)
 return next
}
export function chooseAdminKpiColor(colors:AdminKpiColors,id:AdminKpiId,color:OverviewCardColor):AdminKpiColors{
 const next=normalizeAdminKpiColors(colors)
 if(color==='default')delete next[id]
 else next[id]=color
 return next
}
