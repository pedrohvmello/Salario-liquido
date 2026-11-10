import {roundMoney} from './money'

export type TaxStatement={
  id:string;period:string;document_type:'monthly'|'ppr'|'vacation';payment_date:string|null;
  gross_ppr:number|null;ppr_income_tax:number;ppr_union_contribution:number;
  credits:number|null;net:number|null;net_received:number|null
}
export type AnnualTaxSummary={
  year:number;monthlyDocuments:number;monthlyGrossIndicative:number;
  monthlyClosingNetIndicative:number;monthlyIncomplete:number;
  pprDocuments:number;pprGross:number;pprIrrf:number;pprNet:number;pprContribution:number;
  pprUnassignedDates:number;notes:string[]
}
export const OFFICIAL_FIELDS=[
 {key:'ppr_gross',title:'PPR/PLR bruto',unit:'Rendimento de tributação exclusiva'},
 {key:'ppr_irrf',title:'IRRF retido sobre PPR/PLR',unit:'Retenção exclusiva na fonte'},
 {key:'taxable_salary',title:'Rendimentos tributáveis de salários',unit:'Exige rubricas tributárias classificadas'},
 {key:'inss',title:'Previdência oficial (INSS)',unit:'Exige reconciliação das folhas'},
 {key:'salary_irrf',title:'IRRF sobre salários',unit:'Separado do IRRF do PPR'},
 {key:'thirteenth',title:'13º salário',unit:'Tributação exclusiva em quadro próprio'},
 {key:'thirteenth_irrf',title:'IRRF sobre 13º',unit:'Retenção exclusiva'},
 {key:'private_pension',title:'Previdência complementar dedutível',unit:'Depende do plano e do informe'},
 {key:'alimony',title:'Pensão alimentícia dedutível',unit:'Depende da natureza do pagamento'}
] as const
export type OfficialField=typeof OFFICIAL_FIELDS[number]['key']
export type OfficialValues=Partial<Record<OfficialField,number|null>>
export type AnnualTaxComparison={user_id:string;calendar_year:number;official_values:OfficialValues;updated_at?:string}
export function summarizeTaxYear(statements:readonly TaxStatement[],year:number):AnnualTaxSummary {
 const r:AnnualTaxSummary={year,monthlyDocuments:0,monthlyGrossIndicative:0,monthlyClosingNetIndicative:0,
  monthlyIncomplete:0,pprDocuments:0,pprGross:0,pprIrrf:0,pprNet:0,pprContribution:0,pprUnassignedDates:0,notes:[]}
 for(const s of statements){
  if(s.document_type==='ppr'){
   if(!s.payment_date){if(s.period.startsWith(String(year)))r.pprUnassignedDates++;continue}
   if(!s.payment_date.startsWith(String(year)))continue
   r.pprDocuments++
   if(s.gross_ppr!==null)r.pprGross+=s.gross_ppr
   else r.notes.push('PPR sem rubrica bruta em '+s.period)
   r.pprIrrf+=s.ppr_income_tax||0
   r.pprContribution+=s.ppr_union_contribution||0
   if(s.net!==null)r.pprNet+=s.net
   else r.notes.push('PPR sem valor líquido em '+s.period)
  }else if(s.document_type==='monthly'&&s.period.startsWith(String(year))){
   r.monthlyDocuments++
   r.monthlyGrossIndicative+=s.credits||0
   r.monthlyClosingNetIndicative+=s.net||0
   if(s.credits===null||s.net===null)r.monthlyIncomplete++
  }
 }
 for(const k of ['monthlyGrossIndicative','monthlyClosingNetIndicative','pprGross','pprIrrf','pprNet','pprContribution'] as const)r[k]=roundMoney(r[k])
 if(r.monthlyDocuments!==12)r.notes.push('Cobertura mensal: '+r.monthlyDocuments+'/12 competências; podem faltar holerites.')
 if(r.pprUnassignedDates)r.notes.push(r.pprUnassignedDates+' PPR sem data de pagamento confirmada: excluído da totalização fiscal.')
 r.notes.push('Os totais de salário são apenas indicadores por competência, não rendimentos tributáveis anuais.')
 return r
}
export function calculatedOfficialValue(s:AnnualTaxSummary,field:OfficialField):number|null {
 if(field==='ppr_gross')return s.pprDocuments>0?s.pprGross:null
 if(field==='ppr_irrf')return s.pprDocuments>0?s.pprIrrf:null
 return null
}
export function officialDifference(estimated:number|null,official:number|null|undefined):number|null {
 return estimated===null||official===null||official===undefined?null:roundMoney(estimated-official)
}
