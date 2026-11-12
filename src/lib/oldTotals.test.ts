import {describe,expect,it} from 'vitest'
import {extractOldTotals,type OldPdfRow} from './oldTotals'
const item=(text:string,x:number,y:number)=>({text,x,y})
describe('Legacy PDF totals',()=>{
 it('reads amounts on a different baseline than labels',()=>{
  const rows:OldPdfRow[]=[
   {y:100,text:'Total de proventos: Total de descontos: Total líquido:',items:[item('Total de proventos:',45,100),item('Total de descontos:',218,100),item('Total líquido:',413,100)]},
   {y:95,text:'12.345,67 10.123,45 2.222,22',items:[item('12.345,67',169,95),item('10.123,45',349,95),item('2.222,22',523,95)]},
   {y:86,text:'Base cal. FGTS',items:[item('Base cal. FGTS:',170,86)]}
  ]
  expect(extractOldTotals(rows)).toEqual({credits:12345.67,debits:10123.45,net:2222.22})
 })
 it('reads totals already in the same text row',()=>{
  const rows:OldPdfRow[]=[{y:100,text:'Total de proventos: 12.345,67 Total de descontos: 10.123,45 Total líquido: 2.222,22',items:[]}]
  expect(extractOldTotals(rows)).toEqual({credits:12345.67,debits:10123.45,net:2222.22})
 })
 it('never uses unrelated nearby deductions to fill missing figures',()=>{
  const rows:OldPdfRow[]=[
   {y:100,text:'Total de proventos: Total de descontos: Total líquido:',items:[item('Total de proventos:',45,100)]},
   {y:87,text:'123,45 456,78 789,12',items:[item('123,45',169,87),item('456,78',349,87),item('789,12',523,87)]}
  ]
  expect(extractOldTotals(rows)).toEqual({credits:null,debits:null,net:null})
 })
 it('does not fabricate a net value from two amounts',()=>{
  const rows:OldPdfRow[]=[
   {y:100,text:'Total de proventos: Total de descontos: Total líquido:',items:[item('Total de proventos:',45,100)]},
   {y:95,text:'12.345,67 10.123,45',items:[item('12.345,67',169,95),item('10.123,45',349,95)]}
  ]
  expect(extractOldTotals(rows)).toEqual({credits:null,debits:null,net:null})
 })
})
