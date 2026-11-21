import {ArrowLeft,CreditCard,Gift} from 'lucide-react'
import {asaasMode} from '../lib/environment'

type Plan='basic'|'full'
type Props={
 plan:Plan
 priceLabel:string
 onShowBenefits:()=>void
 promoCode:string
 busy:boolean
 error:string
 onCodeChange:(value:string)=>void
 onConfirm:()=>void
 onCancel:()=>void
}
const planName:Record<Plan,string>={basic:'Basic',full:'Full'}

/** Separate subscription step, shared by paid Asaas and free-code paths. */
export function PlanSubscriptionFlow({
 plan,priceLabel,onShowBenefits,promoCode,busy,error,onCodeChange,onConfirm,onCancel
}:Props){
 return <div className="stack account-page">
  <div className="page-intro">
   <div><h2>Assinar plano {planName[plan]}</h2>
    <p>Confira as informações antes de continuar.</p></div>
   <button className="secondary" type="button" onClick={onCancel} disabled={busy}>
    <ArrowLeft size={16}/> Voltar
   </button>
  </div>
  <section className="panel subscription-confirm-panel" aria-labelledby="subscription-confirm-title">
   <div className="panel-heading">
    <h2 id="subscription-confirm-title"><CreditCard size={18}/> Assinatura {planName[plan]}</h2>
   </div>
   <div className="subscription-confirm-summary">
    <strong>Plano {planName[plan]}</strong>
    <span>{priceLabel}</span>
   </div>
   <button type="button" className="secondary" onClick={onShowBenefits} disabled={busy}>Ver todos os benefícios e limites</button>
   <p>Você está iniciando o processo de assinatura do plano {planName[plan]}.
    O plano estará disponível após a confirmação do pagamento pelo Asaas.
    Até essa confirmação, seu plano atual continuará ativo. A franquia diária pessoal do Pep será registrada quando o checkout for criado.</p>
   <p className="subtle">{asaasMode==='sandbox'
    ?'Ao continuar sem código promocional, você será direcionado ao Asaas Sandbox para simular uma assinatura mensal, sem cobrança real.'
    :'Ao continuar sem código promocional, você será direcionado ao Asaas para contratar uma assinatura com cobrança real e renovação mensal.'}</p>
   <form className="subscription-confirm-form" onSubmit={event=>{event.preventDefault();onConfirm()}}>
    <label htmlFor="subscription-confirm-promo"><Gift size={16}/> Resgatar por Código Promocional
     <input id="subscription-confirm-promo" type="text" autoComplete="off"
      maxLength={64} spellCheck={false} value={promoCode}
      onChange={event=>onCodeChange(event.target.value.toUpperCase())}
      disabled={busy} aria-invalid={Boolean(error)&&Boolean(promoCode.trim())}/>
    </label>
    <p className="subtle">O código é opcional. Se for válido para o plano selecionado, o acesso gratuito será ativado sem pagamento.
     Sem código, você revisará seus dados cadastrais antes de finalizar a assinatura no Asaas.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="row subscription-confirm-actions">
     <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
     <button type="submit" className="primary" disabled={busy}>
      {busy?(promoCode.trim()?'Validando código...':'Preparando assinatura...'):'Assinar'}
     </button>
    </div>
   </form>
  </section>
 </div>
}
