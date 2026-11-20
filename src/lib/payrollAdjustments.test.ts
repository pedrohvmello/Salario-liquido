import {describe,expect,it} from 'vitest'
import {taxYearBridge,cashAdjustmentsByMonth,supplementalSettlements,type SupplementalStatement,type SupplementalLine} from './payrollAdjustments'
const s=(id:string,period:string,type:string,credits:number,debits=0,net=credits,
 subtype:SupplementalStatement['payroll_subtype']=null,payment_date:string|null=null):SupplementalStatement=>({
 id,period,document_type:type,credits,debits,net,payroll_subtype:subtype,payment_date
})
const l=(id:string,code:string,amount:number,side:'credit'|'debit'='credit'):SupplementalLine=>({
 statement_id:id,code,amount,side,description:code
})
function yearFixture(year:2024|2025){
 const data=year===2024?{
  base:166740.51,advance:6051.81,complement:0,balance:240.46,
  pension:33542.27,additional:992.36,pensionAdded:201.46,net:790.90,
  salary1:491.75,salary2:491.75,ot1:7.14,ot2:0,dsr1:1.72,dsr2:0,
  pension1:101.63,pension2:99.83,official:161440.60,officialPension:33743.73
 }:{
  base:195632.71,advance:6299.94,complement:23.76,balance:0,
  pension:39497.72,additional:1636.18,pensionAdded:332.17,net:1304.01,
  salary1:724.46,salary2:839.44,ot1:36.96,ot2:24.45,dsr1:7.11,dsr2:3.76,
  pension1:156.03,pension2:176.14,official:190945.19,officialPension:39829.89
 }
 const a:SupplementalStatement[]=[
  ...Array.from({length:12},(_,i)=>s('original-'+i,year+'-'+String(i+1).padStart(2,'0'),
   'monthly',i===0?data.base:0)),
  s('diff-sep',year+'-09','adjustment',0,0,0,'difference'),
  s('diff-oct',year+'-10','adjustment',0,0,0,'difference'),
  s('rect-sep',year+'-09','adjustment',12000,10000,2000,'rectification'),
  s('rect-oct',year+'-10','adjustment',12000,10000,2000,'rectification'),
  s('total',year+'-11','adjustment',data.additional,data.pensionAdded,
   data.net,'totalizer',year+'-11-'+(year===2024?'28':'27'))
 ]
 const lines:SupplementalLine[]=[
  l('original-0','02080',data.advance),l('original-0','07150',data.pension,'debit'),
  l('original-0','03920',data.complement),
  l('original-0','02690',data.balance),
  l('diff-sep','00006',data.salary1),l('diff-oct','00006',data.salary2),
  l('diff-sep','00051',data.ot1),l('diff-oct','00051',data.ot2),
  l('diff-sep','00121',data.dsr1),l('diff-oct','00121',data.dsr2),
  l('diff-sep','07151',data.pension1,'debit'),
  l('diff-oct','07151',data.pension2,'debit'),
  l('total','00006',data.salary1+data.salary2),
  l('total','00051',data.ot1+data.ot2),
  l('total','00121',data.dsr1+data.dsr2),
  l('total','07151',data.pensionAdded,'debit')
 ]
 return {data,a,lines}
}
describe('supplemental payroll financial reconciliation',()=>{
 for(const year of [2024,2025] as const){
  it('reconciles '+year+' to the exact official income and pension without duplicate retifications',()=>{
   const {data,a,lines}=yearFixture(year)
   const bridge=taxYearBridge(year,a,lines)
   expect(bridge.monthlyGross).toBe(data.base)
   expect(bridge.totalizerGross).toBe(data.additional)
   expect(bridge.taxableReconciled).toBe(data.official)
   expect(bridge.pensionReconciled).toBe(data.officialPension)
   expect(bridge.settlements).toHaveLength(1)
   expect(bridge.settlements[0].matchedByRubrics).toBe(true)
   expect(bridge.settlements[0].originPeriods).toEqual([year+'-09',year+'-10'])
   const cash=cashAdjustmentsByMonth(a,lines)
   expect(cash.get(year+'-11')?.net).toBe(data.net)
   expect(cash.get(year+'-09')).toBeUndefined()
  })
 }
 it('keeps difference/rectification as evidence if no valid totalizer has been uploaded',()=>{
  const {a,lines}=yearFixture(2024)
  const removed=a.filter(s=>s.id!=='total')
  const b=taxYearBridge(2024,removed,lines)
  expect(b.totalizerGross).toBe(0)
  expect(b.settlements).toHaveLength(0)
  expect(b.taxableReconciled).toBe(160448.24)
 })
 it('does not infer a linked original competence when rubrics do not agree',()=>{
  const {a,lines}=yearFixture(2025)
  const changed=lines.filter(l=>l.statement_id!=='diff-sep')
  const settlements=supplementalSettlements(a,changed)
  expect(settlements).toHaveLength(1)
  expect(settlements[0].matchedByRubrics).toBe(false)
  expect(settlements[0].originPeriods).toHaveLength(0)
 })
 it('ignores incomplete totalizadora, even if its proventos are printed',()=>{
  const {a,lines}=yearFixture(2025)
  const changed=a.map(s=>s.id==='total'?{...s,payment_date:null}:s)
  const res=taxYearBridge(2025,changed,lines)
  expect(res.totalizerGross).toBe(0)
  expect(res.warnings.join(' ')).toContain('incompletas')
 })
})
