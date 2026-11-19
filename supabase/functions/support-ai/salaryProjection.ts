import {brl,calculatePayroll2026,defaults,roundMoney,type SalaryParameters} from './money2026.ts'
import {parsePensionNotes,defaultPensionRule} from './pensionRule.ts'
import {sanitizeSettings,type FinancialEvent,type FinancialStatement} from './financialContext.ts'

type AiTurn={role:string;content:string}
type EventWithNotes=FinancialEvent&{notes?:string;hidden?:boolean}
export type SalaryProjection={answer:string;sources:string[]}

function normalized(value:string):string{
 return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
}
const projectionPattern=/\b(projecao|projetar|simulacao|simular|estimativa|estimar|previsao|quanto (?:vou|iria|passaria a|deveria) (?:receber|ganhar)|quanto (?:receberia|ganharia)|se (?:eu |meu salario |o salario )|aumento (?:salarial|de)|reajuste (?:salarial|de)|anualizar|salario anual|renda anual|remuneracao anual|baseado no meu salario)\b/
const procedurePattern=/\b(como (?:funciona|configurar|configuro|cadastrar|cadastro|usar|faco|fazer|acessar)|onde (?:vejo|fica|encontro))\b/

export function salaryProjectionIntent(question:string,history:readonly AiTurn[]=[]):boolean{
 const q=normalized(question)
 if(procedurePattern.test(q)&&!/(quanto|valor|simular|estimar|calcular|reajuste|aumento)/.test(q))return false
 if(projectionPattern.test(q))return true
 const previous=history.filter(x=>x.role==='user').slice(-2).map(x=>normalized(x.content)).join(' ')
 return /\b(calcular|calcule|faz|faca|pode|consegue|quanto|e se|entao)\b/.test(q)&&
  /\b(salario|remuneracao|receber|renda|projecao|simular|anual)\b/.test(previous)
}
function activeMonth(date:string){return date.slice(0,7)}
function decimalNumber(value:string):number{
 return Number(value.replace(/\./g,'').replace(',','.'))
}
function changedSalary(question:string,current:number):{value:number;note:string}|null{
 const q=normalized(question)
 const explicit=/\b(?:salario(?:-base)?|ganhar|ganhasse|receber|recebesse)\s+(?:bruto\s+)?(?:mensal\s+)?(?:de|para|fosse|for|seja)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{4,7}(?:,\d{1,2})?)\b/.exec(q)
 if(explicit){
  const v=decimalNumber(explicit[1]);if(v>=100&&v<=1_000_000)return {value:roundMoney(v),note:'salário hipotético informado na pergunta'}
 }
 const magnitude=/(?:\b(?:aumento|reajuste|aumentar|subir|acrescimo|reducao|reduzir|corte|diminuir)\s+(?:de\s+)?(\d{1,3}(?:[,.]\d{1,2})?)\s*%\b)|(?:\b(\d{1,3}(?:[,.]\d{1,2})?)\s*%\s+de\s+(?:aumento|reajuste|reducao|corte)\b)/.exec(q)
 if(!magnitude)return null
 const n=Number((magnitude[1]||magnitude[2]).replace(',','.'))
 if(!Number.isFinite(n)||n>100||n<0)return null
 const reduction=/\b(reducao|reduzir|corte|diminuir)\b/.test(q)
 const signed=reduction?-n:n
 return {value:roundMoney(current*(1+signed/100)),note:'cenário de '+(reduction?'redução':'aumento')+' de '+n+'%'}
}
function projectionYear(question:string,history:readonly AiTurn[],now:string):number{
 const q=normalized(question)
 const current=Number(now.slice(0,4))
 if(/\b(ano que vem|proximo ano)\b/.test(q))return current+1
 if(/\b(este ano|nesse ano|ano atual)\b/.test(q))return current
 const found=/(?:\b20\d{2}\b)/.exec(question)
 if(found)return Number(found[0])
 const older=history.filter(h=>h.role==='user').slice(-3).reverse().find(h=>/\b20\d{2}\b/.test(h.content))
 return older?Number(/\b20\d{2}\b/.exec(older.content)![0]):current
}
function safeAmount(x:unknown){return typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null}
export function buildSalaryProjection(args:{
 question:string;history?:AiTurn[];events:EventWithNotes[];settings:unknown;
 monthlyStatements?:FinancialStatement[];firstName?:string;now?:string
}):SalaryProjection|null{
 const history=args.history||[]
 if(!salaryProjectionIntent(args.question,history))return null
 const now=args.now||new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})
 const settings=sanitizeSettings(args.settings)
 const p:SalaryParameters={...defaults,...settings,pensionMethod:'none',pensionPercent:0,fixedPension:0,overtimePay:0,dsrPay:0}
 const validKinds=new Set(['salary','trienio','dependents','mealBenefit','fixedBenefit','childcareBenefit','esppPercent','privatePensionPercent','pensionPercent','fixedPension','advancePercent'])
 const active=args.events.filter(e=>!e.hidden&&validKinds.has(e.kind)&&/^\d{4}-\d{2}-\d{2}$/.test(e.effective_date)&&e.effective_date<=now&&
  safeAmount(e.value)!==null).sort((a,b)=>a.effective_date.localeCompare(b.effective_date))
 let pensionRule={...defaultPensionRule}
 let salarySource=settings.salary?'Definições':null
 for(const e of active){
  if(e.kind in p)(p as unknown as Record<string,number>)[e.kind]=e.value
  if(e.kind==='salary')salarySource='Eventos e vigências'
  if(e.kind==='pensionPercent'){
   p.pensionMethod='old26'
   pensionRule=parsePensionNotes(e.notes||'').rule
  }
  if(e.kind==='fixedPension')p.pensionMethod='fixed'
 }
 const statements=(args.monthlyStatements||[]).filter(s=>s.document_type==='monthly'&&
  s.period<=activeMonth(now)&&safeAmount(s.salary_contract)!==null&&s.salary_contract!>0).sort((a,b)=>b.period.localeCompare(a.period))
 if(!(p.salary>0)&&statements.length){
  p.salary=statements[0].salary_contract!
  salarySource='Holerite '+statements[0].period
 }
 const userScenario=p.salary>0?changedSalary(args.question,p.salary):null
 if(userScenario)p.salary=userScenario.value
 const greeting=args.firstName?.trim()?args.firstName.trim()+', ':''
 if(!(p.salary>0))return {
  answer:greeting+'posso calcular essa projeção, mas não encontrei um salário-base vigente confirmado na sua conta. Cadastre o valor em Eventos e vigências ou Definições e tente novamente. Também posso simular um valor que você informe, por exemplo: "salário de R$ 15.000".',
  sources:[]
 }
 const recurring=calculatePayroll2026({...p,pensionRule})
 const includeThirteenth=p.pensionMethod==='old26'&&pensionRule.includeThirteenth
 const thirteenth=calculatePayroll2026({...p,
  pensionMethod:includeThirteenth?'old26':'none',
  pensionPercent:includeThirteenth?p.pensionPercent:0,
  fixedPension:0,esppPercent:0,privatePensionPercent:0,advancePercent:0,
  pensionRule})
 const year=projectionYear(args.question,history,now)
 const salaryGross=roundMoney(recurring.gross*12)
 const salaryNet=roundMoney(recurring.netMonth*12)
 const annualGross=roundMoney(salaryGross+thirteenth.gross)
 const annualNet=roundMoney(salaryNet+thirteenth.netMonth)
 const extraVacationThird=roundMoney((p.salary+p.trienio)/3)
 const future=year>2026?'; descontos estimados pelas regras de 2026 (sujeitas a mudança)':''
 const baseline=(userScenario?'Cenário com '+userScenario.note+'. ':'')+'Base usada: '+(salarySource||'salário informado')+' de '+brl(p.salary)+
  (p.trienio?' + triênio de '+brl(p.trienio):'')+'.'
 const scenarioExtra=userScenario?(' Comparado ao salário-base atual de '+brl(args.events
   .filter(e=>e.kind==='salary'&&e.effective_date<=now).sort((a,b)=>b.effective_date.localeCompare(a.effective_date))[0]?.value||settings.salary||0)+'.'):''
 const answer=greeting+'consigo sim. Esta é uma projeção de '+year+' com 12 meses equivalentes à remuneração atual, não um fechamento real do ano.\n'+
 '• Bruto mensal: '+brl(recurring.gross)+'; líquido mensal estimado: '+brl(recurring.netMonth)+'.\n'+
 '• 12 salários: '+brl(salaryGross)+' brutos; '+brl(salaryNet)+' líquidos estimados.\n'+
 '• 13º estimado: '+brl(thirteenth.gross)+' bruto; '+brl(thirteenth.netMonth)+' líquido estimado.\n'+
 '• Total anual estimado: '+brl(annualGross)+' bruto; '+brl(annualNet)+' líquido.\n'+
 baseline+scenarioExtra+' Valores estimados: sem PPR, horas extras e 1/3 de férias (aprox. '+brl(extraVacationThird)+' bruto); incidência do 13º e descontos podem variar'+future+'.'
 return {answer:answer.slice(0,1300),sources:[salarySource||'Projeção calculada com dados informados','Cálculo Payrep 2026']}
}
