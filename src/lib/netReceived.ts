/**
 * Historical "líquido recebido" = payroll closing net + salary advance already
 * paid earlier in that month. This is a cash-flow measure, NOT a tax base.
 * Only exact employer-confirmed advance codes are accepted.
 * Vacation advances, 13th salary advances and reimbursements are excluded.
 */
import {roundMoney} from './money'

export type AdvanceLine = {code:string;description:string;amount:number;side:'credit'|'debit'|'unknown'}
export type EmployerLayout = 'old' | 'new'
const SALARY_ADVANCE_CODES: Record<EmployerLayout,ReadonlySet<string>> = {
  old:new Set(['07220']), // DESCONTO ADIANTAMENTO QUINZENAL
  new:new Set(['/B02'])   // Adiantamento pago
}
export function salaryAdvanceFromLines(lines:readonly AdvanceLine[],layout:EmployerLayout):number {
  const matches=lines.filter(line=>SALARY_ADVANCE_CODES[layout].has(line.code))
  if(matches.some(line=>line.side!=='debit'||!Number.isFinite(line.amount)||line.amount<0))
    throw new Error('Adiantamento salarial sem valor de desconto válido; revisar rubricas')
  return roundMoney(matches.reduce((sum,line)=>sum+line.amount,0))
}
export function netMonthlyReceived(closingNet:number|null,advance:number|null):number|null {
  if(closingNet===null||advance===null)return null
  if(!Number.isFinite(closingNet)||!Number.isFinite(advance)||advance<0)
    throw new Error('Valores inválidos para composição do líquido recebido')
  return roundMoney(closingNet+advance)
}
