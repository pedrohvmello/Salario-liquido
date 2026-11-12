import {describe,expect,it} from 'vitest'
import {reconcileThirteenth,type ThirteenthStatement} from './thirteenthLedger'
import type {StatementRubric} from './vacation'
const receipt=(year:string,advance=4500):ThirteenthStatement=>({
 id:'13-'+year,period:year+'-12',document_type:'thirteenth',payment_date:year+'-12-20',
 credits:10000,net:3000,thirteenth_gross:10000,thirteenth_advance:advance,
 thirteenth_inss:800,thirteenth_irrf:1700,thirteenth_pension:0
})
const ordinary=(id:string,period:string,type:'monthly'|'vacation'='monthly'):ThirteenthStatement=>({
 id,period,document_type:type,payment_date:type==='vacation'?period+'-01':null,
 credits:10000,net:4000,thirteenth_gross:null,thirteenth_advance:0,
 thirteenth_inss:0,thirteenth_irrf:0,thirteenth_pension:0
})
const line=(id:string,code:string,amount:number,side:'debit'|'credit'):StatementRubric=>
 ({statement_id:id,code,amount,side,description:'Parcela de 13º'})
describe('conciliação do 13º sem duplicidade',()=>{
 it('liga 07210 mensal ao 07215 do recibo e só adiciona fechamento',()=>{
  const l=reconcileThirteenth([ordinary('apr','2024-04'),receipt('2024')],[line('apr','07210',4500,'debit')])
  expect(l.byYear.get('2024')?.state).toBe('reconciled')
  expect(l.cashByMonth.get('2024-12')).toBe(3000)
  expect(l.byYear.get('2024')?.irrf).toBe(1700)
 })
 it('liga 02880 no recibo de férias sem contabilizar uma segunda vez',()=>{
  const l=reconcileThirteenth([ordinary('vac','2025-04','vacation'),receipt('2025')],
   [line('vac','02880',4500,'credit')])
  expect(l.byYear.get('2025')?.cashAdditional).toBe(3000)
  expect(l.byYear.get('2025')?.matchedAdvance).toBe(4500)
 })
 it('não soma ao dobro quando o mensal e o recibo de férias comprovam a mesma parcela',()=>{
  const l=reconcileThirteenth([ordinary('m','2025-04'),ordinary('v','2025-04','vacation'),receipt('2025')],
  [line('m','07210',4500,'debit'),line('v','02880',4500,'credit')])
  expect(l.byYear.get('2025')?.matchedAdvance).toBe(4500)
  expect(l.byYear.get('2025')?.cashAdditional).toBe(3000)
 })
 it('informa adiantamento estimado do próprio 13º se faltam folhas anteriores',()=>{
  const l=reconcileThirteenth([receipt('2022')],[])
  expect(l.byYear.get('2022')?.unmatchedAdvance).toBe(4500)
  expect(l.byYear.get('2022')?.cashAdditional).toBe(7500)
  expect(l.byYear.get('2022')?.state).toBe('estimated')
 })
 it('não multiplica recibos duplicados para o mesmo ano',()=>{
  const second={...receipt('2023'),id:'outra-copia'}
  const l=reconcileThirteenth([receipt('2023'),second],[])
  expect(l.occurrences).toHaveLength(1)
  expect(l.cashByMonth.get('2023-12')).toBe(7500)
 })
 it('concilia parcela parcialmente documentada sem inventar data',()=>{
  const l=reconcileThirteenth([ordinary('apr','2021-04'),receipt('2021')],
  [line('apr','07210',1500,'debit')])
  expect(l.byYear.get('2021')?.unmatchedAdvance).toBe(3000)
  expect(l.byYear.get('2021')?.state).toBe('partial')
 })
})
