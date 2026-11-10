/** Cautions where a closing payslip cannot represent all money paid in a month.
 * A vacation/13th advance is a deduction linked to a separate payment; do not
 * add its deduction to cash received without validating the actual payment.
 */
export type Rubric = {code:string; description:string; amount:number; side:'credit'|'debit'|'unknown'}
const OLD_CASH_ADVANCE_CODES = new Set(['07200','07210'])
export function nonMonthlyCashWarnings(lines:readonly Rubric[],documentType:'monthly'|'ppr'):string[] {
 if(documentType!=='monthly')return []
 const special=lines.filter(line=>
   OLD_CASH_ADVANCE_CODES.has(line.code) ||
   (line.side==='debit' && /adiantamento.*(f[eé]rias|13[ºo°]?\s*sal[aá]rio)|(?:f[eé]rias|13[ºo°]?\s*sal[aá]rio).*adiantamento/i.test(line.description))
 )
 if(!special.length)return []
 const unique=[...new Set(special.map(x=>x.code))]
 return ['Há adiantamento de férias e/ou 13º ('+unique.join(', ')+'). O líquido mensal exibido considera apenas o fechamento e o adiantamento quinzenal; não representa todos os depósitos. Concilie os pagamentos separados.']
}
