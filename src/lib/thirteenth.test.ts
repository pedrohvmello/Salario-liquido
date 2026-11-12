import {describe,expect,it} from 'vitest'
import {isThirteenthPayslip,thirteenthFigures,validateThirteenthPay,type HeaderRow} from './thirteenth'
const row=(text:string,y:number,parts:Array<[string,number]>):HeaderRow=>
 ({text,y,items:parts.map(([text,x])=>({text,x,y}))})
describe('Recibo de 13º',()=>{
 it('reconhece somente o cabeçalho de folha 13º SALÁRIO',()=>{
  const head=[row('Folha: Dt. pagt.:',490,[['Folha:',37],['Dt. pagt.:',402]]),
    row('13º SALÁRIO 20/12/2024',475,[['13º SALÁRIO',37],['20/12/2024',402]])]
  expect(isThirteenthPayslip(head)).toBe(true)
  expect(isThirteenthPayslip([head[0],row('MENSAL',475,[['MENSAL',37]])])).toBe(false)
 })
 it('preserva valor bruto, adiantamento e tributos separados',()=>{
  const figures=thirteenthFigures([
   {code:'03900',description:'13º SALARIO',amount:10000,side:'credit'},
   {code:'03905',description:'MEDIA 13º SALARIO',amount:500,side:'credit'},
   {code:'07025',description:'INSS 13º SALARIO',amount:800,side:'debit'},
   {code:'07055',description:'IRRF 13º SALARIO',amount:1400,side:'debit'},
   {code:'07160',description:'PENSAO ALIMENTICIA 13º SALARIO',amount:900,side:'debit'},
   {code:'07215',description:'DESCONTO ADIANTAMENTO 13º SALARIO',amount:4500,side:'debit'}
  ])
  expect(figures).toEqual({gross:10500,advance:4500,inss:800,irrf:1400,pension:900})
  expect(()=>validateThirteenthPay({period:'2024-12',paymentDate:'2024-12-20',
   thirteenthGross:10500,thirteenthAdvance:4500,thirteenthInss:800,thirteenthIrrf:1400,
   thirteenthPension:900,credits:10500,debits:7600,net:2900})).not.toThrow()
 })
 it('não interpreta imposto faltante como fechamento corretamente conciliado',()=>{
  expect(()=>validateThirteenthPay({period:'2024-12',paymentDate:'2024-12-20',
   thirteenthGross:10500,thirteenthAdvance:4500,thirteenthInss:800,thirteenthIrrf:0,
   thirteenthPension:900,credits:10500,debits:7600,net:2900})).toThrow()
 })
})
