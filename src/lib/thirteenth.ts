import {roundMoney} from './money'
import type {PayrollLine} from './parse'

export type HeaderRow={text:string;items:Array<{text:string;x:number;y:number}>;y:number}
export type ThirteenthFigures={
  gross:number|null; advance:number; inss:number; irrf:number; pension:number
}
export function isThirteenthPayslip(rows:readonly HeaderRow[]):boolean{
  const i=rows.findIndex(r=>r.items.some(item=>item.text.trim()==='Folha:'&&item.x<120))
  if(i<0)return false
  return (rows[i+1]?.items||[]).some(item=>
    item.x<120&&/^13[º°o]\s*SAL[AÁ]RIO$/i.test(item.text.trim()))
}
const sum=(lines:readonly PayrollLine[],code:string,side:PayrollLine['side'])=>
  roundMoney(lines.filter(l=>l.code===code&&l.side===side).reduce((a,l)=>a+l.amount,0))
export function thirteenthFigures(lines:readonly PayrollLine[]):ThirteenthFigures{
  const gross=roundMoney(lines.filter(l=>l.side==='credit'&&
    (l.code==='03900'||l.code==='03905'||['00405','00410','02450'].includes(l.code)||
     /\b13[º°o]\s*SAL[AÁ]RIO/i.test(l.description)))
    .reduce((a,l)=>a+l.amount,0))
  return {
    gross:gross>0?gross:null,
    advance:sum(lines,'07215','debit'),
    inss:sum(lines,'07025','debit'),
    irrf:sum(lines,'07055','debit'),
    pension:sum(lines,'07160','debit')
  }
}
export type ThirteenthPay={
 period:string;paymentDate:string|null;thirteenthGross:number|null;
 thirteenthAdvance:number;thirteenthInss:number;thirteenthIrrf:number;thirteenthPension:number;
 credits:number|null;debits:number|null;net:number|null
}
export function validateThirteenthPay(s:ThirteenthPay):void{
 if(!s.paymentDate||!/^\d{4}-12$/.test(s.period)||
    s.paymentDate.slice(0,4)!==s.period.slice(0,4)||
    s.thirteenthGross===null||s.thirteenthGross<=0||
    s.credits===null||s.debits===null||s.net===null)
  throw new Error('Holerite de 13º incompleto: confira competência, data, rubricas e totais')
 if(Math.abs(roundMoney(s.credits-s.debits-s.net))>.02||
    Math.abs(roundMoney(s.credits-s.thirteenthGross))>.02||
    Math.abs(roundMoney(s.thirteenthAdvance+s.thirteenthInss+s.thirteenthIrrf+
      s.thirteenthPension-s.debits))>.02)
  throw new Error('Holerite de 13º com rubricas ou totais divergentes; revisar antes de importar')
}
