/**
 * Per-event pension criteria. Salary benefits remain outside the pension base.
 * Metadata is versioned and stored inside salary_events.notes to avoid an
 * incompatible production database migration.
 */
export type PensionRule = {
 excludeInss:boolean;excludeIrrf:boolean;includeOvertime:boolean;
 includeVacation:boolean;includeVacationThird:boolean;includeThirteenth:boolean;includePpr:boolean
}
export const defaultPensionRule:PensionRule={
 excludeInss:true,excludeIrrf:true,includeOvertime:true,
 includeVacation:true,includeVacationThird:true,includeThirteenth:true,includePpr:false
}
export const pensionRuleLabels={
 excludeInss:'INSS',excludeIrrf:'IRRF',includeOvertime:'Horas extras',
 includeVacation:'Férias',includeVacationThird:'Terço constitucional',includeThirteenth:'13º salário',includePpr:'PPR / PLR'
} as const
const PREFIX='@payrep:pension-rule:v1:'
const fields=(Object.keys(defaultPensionRule) as Array<keyof PensionRule>)
export function parsePensionNotes(raw:string):{note:string;rule:PensionRule}{
 if(!raw.startsWith(PREFIX))return {note:raw,rule:{...defaultPensionRule}}
 try{
  const data=JSON.parse(raw.slice(PREFIX.length)) as {note?:unknown;rule?:unknown}
  if(!data||typeof data.note!=='string'||!data.rule||typeof data.rule!=='object')throw Error('Invalid metadata')
  const rules=data.rule as Record<string,unknown>
  if(!fields.every(k=>typeof rules[k]==='boolean'))throw Error('Invalid criteria')
  return {note:data.note,rule:Object.fromEntries(fields.map(k=>[k,rules[k]])) as PensionRule}
 }catch{return {note:raw,rule:{...defaultPensionRule}}}
}
export function encodePensionNotes(note:string,rule:PensionRule):string {
 if(!fields.every(k=>typeof rule[k]==='boolean'))throw Error('Critérios da pensão inválidos')
 return PREFIX+JSON.stringify({note,rule})
}
