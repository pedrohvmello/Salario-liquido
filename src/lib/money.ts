/**
 * Projection-only Brazilian payroll calculator. Historical statements are NEVER recomputed.
 * Official 2026 tables:
 * https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal/
 * https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
 * NOT a certified payroll engine. Pension applicability depends on the judicial order.
 */
export const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const brl = (value: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value)
export type PensionMethod = 'old26' | 'fixed' | 'none'
export type SalaryParameters = {
  salary: number; trienio: number; dependents: number; mealBenefit: number; fixedBenefit:number; childcareBenefit:number;
  esppPercent: number; privatePensionPercent: number; privatePensionFixed: number;
  pensionPercent: number; pensionMethod: PensionMethod; fixedPension: number;
  advancePercent: number; overtimePay: number; dsrPay: number;
}
export const defaults: SalaryParameters = {
  salary: 0, trienio: 0, dependents: 0, mealBenefit: 0, fixedBenefit:0, childcareBenefit:0,
  esppPercent: 0, privatePensionPercent: 0, privatePensionFixed: 0,
  pensionPercent: 0, pensionMethod: 'none', fixedPension: 0,
  advancePercent: 40, overtimePay: 0, dsrPay: 0
}
const inss2026 = [[1621,.075],[2902.84,.09],[4354.27,.12],[8475.55,.14]] as const
export function calculateINSS2026(gross: number) {
  let total = 0, lower = 0
  for (const [ceiling, rate] of inss2026) {
    const taxable = Math.min(Math.max(gross - lower,0), ceiling - lower)
    total += taxable * rate
    lower = ceiling
  }
  return roundMoney(total)
}
export function calculateIRRF2026(gross: number, inss: number, pension: number, dependents: number) {
  const legalDeduction = inss + pension + Math.max(0,dependents) * 189.59
  const deduction = Math.max(607.20,legalDeduction)
  const base = Math.max(0,roundMoney(gross-deduction))
  const brackets = [[2428.80,0,0],[2826.65,.075,182.16],[3751.05,.15,394.16],[4664.68,.225,675.49],[Infinity,.275,908.73]] as const
  const bracket = brackets.find(b=>base<=b[0]) || brackets[4]
  const standardTax = Math.max(0,roundMoney(base*bracket[1]-bracket[2]))
  // Lei 15.270/2025: reduction depends on TAXABLE EARNINGS, not IR base.
  const reduction = gross<=5000?Math.min(standardTax,312.89)
    : gross<=7350?Math.min(standardTax,Math.max(0,roundMoney(978.62-.133145*gross))):0
  return {base, tax:roundMoney(Math.max(0,standardTax-reduction)), reduction:roundMoney(reduction)}
}
export function calculatePayroll2026(p: SalaryParameters & {pensionRule?: {excludeInss:boolean;excludeIrrf:boolean;includeOvertime:boolean}}) {
  const gross = roundMoney(Math.max(0,p.salary)+Math.max(0,p.trienio)+Math.max(0,p.overtimePay)+Math.max(0,p.dsrPay))
  const inss = calculateINSS2026(gross)
  let pension = p.pensionMethod === 'fixed' ? roundMoney(Math.max(0,p.fixedPension)) : 0
  let ir = calculateIRRF2026(gross,inss,pension,p.dependents)
  if (p.pensionMethod==='old26') {
    const rule=p.pensionRule??{excludeInss:true,excludeIrrf:true,includeOvertime:true}
    for (let i=0;i<40;i++) {
      const eligibleGross=Math.max(0,gross-(rule.includeOvertime?0:Math.max(0,p.overtimePay)))
      const base=Math.max(0,eligibleGross-(rule.excludeInss?inss:0)-(rule.excludeIrrf?ir.tax:0))
      const nextPension=roundMoney(base*Math.min(100,Math.max(0,p.pensionPercent))/100)
      const nextIR=calculateIRRF2026(gross,inss,nextPension,p.dependents)
      if(nextPension===pension&&nextIR.tax===ir.tax)break
      pension=nextPension;ir=nextIR
    }
  }
  const espp = roundMoney(Math.max(0,p.salary)*Math.max(0,p.esppPercent)/100)
  const privatePension = roundMoney(Math.max(0,p.privatePensionFixed + (p.salary*p.privatePensionPercent/100)))
  const advance = roundMoney(Math.max(0,p.salary+p.trienio)*Math.max(0,p.advancePercent)/100)
  const fgts = roundMoney(gross*.08) // informative: employer contribution, not withheld
  const netMonth = roundMoney(gross-inss-ir.tax-pension-espp-privatePension)
  const finalPayment = roundMoney(netMonth-advance)
  return {gross,inss,irrf:ir.tax,irBase:ir.base,irReduction:ir.reduction,pension,espp,privatePension,fgts,advance,netMonth,finalPayment,mealBenefit:p.mealBenefit}
}
