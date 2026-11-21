import {Check,Info,LockKeyhole,ShieldCheck} from 'lucide-react'
import {PayrepPickerDialog} from './PayrepPickerDialog'
import type {PlanBenefitLimits,PlanCode} from '../lib/account'
const labels:Record<PlanCode,string>={free:'Free',basic:'Basic',full:'Full'}
export function PlanBenefitsDialog({plan,features,limits,paidPlan,activeSubscription,onClose}:{
 plan:PlanCode;features:readonly string[];limits:PlanBenefitLimits;
 paidPlan:PlanCode;activeSubscription:boolean;onClose:()=>void
}){
 const configured=plan==='full'?limits.fullDailyLimit:plan==='basic'?limits.basicDailyLimit:0
 const minimum=activeSubscription&&paidPlan===plan?limits.contractedPersonalDailyMinimum:null
 const personal=plan==='free'?0:Math.max(configured,minimum||0)
 return <PayrepPickerDialog title={'Benefícios e limites do plano '+labels[plan]}
  description="Confira as funcionalidades e restrições antes de contratar."
  onClose={onClose} className="subscription-benefits-dialog">
  <div className="subscription-benefits-body" role="region" aria-label="Detalhes dos benefícios e limites" tabIndex={0}>
   <section className="subscription-benefits-section">
    <h4><Check size={17}/> Benefícios incluídos</h4>
    <ul>{features.map(item=><li key={item}><Check size={15}/>{item}</li>)}</ul>
   </section>
   <section className="subscription-benefits-section">
    <h4><LockKeyhole size={17}/> Limitações e condições</h4>
    <ul>
     {plan==='free'&&<li>Não inclui o Pep pessoal, simulações assistidas com dados da conta nem importação inteligente de holerites PDF.</li>}
     {plan==='basic'&&<li>O Pep pessoal consulta informações manuais da conta, mas não analisa holerites PDF. A importação inteligente está disponível apenas no Full.</li>}
     {plan==='full'&&<li>O Pep pode consultar dados extraídos de holerites importados. As respostas dependem dos documentos existentes e podem exigir conferência.</li>}
     {plan!=='free'&&<li>Franquia pessoal de <strong>{personal} consultas por dia</strong>, compartilhada entre consultas pessoais, sem acúmulo para o dia seguinte.</li>}
     <li>O Pep Ajuda possui limite de <strong>{limits.helpDailyLimit} consultas por usuário/dia</strong>, separado da franquia pessoal.</li>
     <li>As franquias reiniciam às 00h UTC. Também existem limite global compartilhado de {limits.globalDailyLimit} solicitações/dia e a disponibilidade do provedor de IA.</li>
    </ul>
   </section>
   {plan!=='free'&&<div className="subscription-benefits-contract">
    <ShieldCheck size={17}/>
    <p><strong>Franquia preservada na contratação.</strong> A cota pessoal vigente ao criar o checkout fica registrada como mínimo da assinatura. Reduções posteriores para novas assinaturas não reduzem esse mínimo durante a assinatura ativa; aumentos gerais podem beneficiar clientes existentes.</p>
   </div>}
   {minimum!==null&&<p className="subtle" role="status">
    Sua assinatura atual possui mínimo registrado de <strong>{minimum} consultas pessoais/dia</strong>. O limite efetivo hoje é <strong>{personal}/dia</strong>.
   </p>}
   {plan==='free'&&<p className="subtle">O plano Free não exige pagamento nem renovação mensal.</p>}
   <p className="subtle"><Info size={14}/> Limite global e disponibilidade da Cloudflare podem restringir temporariamente o serviço. O Pep é auxiliar e não substitui documentos oficiais.</p>
   <button type="button" className="primary subscription-benefits-close" onClick={onClose}>Entendi</button>
  </div>
 </PayrepPickerDialog>
}
