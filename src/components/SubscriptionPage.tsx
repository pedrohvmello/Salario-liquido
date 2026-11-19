import {useEffect,useState} from 'react'
import {ArrowLeft,CreditCard,Info,ShieldCheck} from 'lucide-react'
import {cancelMyAsaasSandboxRenewal,loadMyEffectivePayrepPlan,loadMyBilling,loadMyCheckoutIntents,reconcileMyAsaasSandboxBilling,redeemPayrepPromoCode,startAsaasSandboxCheckout,type BillingCheckoutIntent,type BillingPayment,type BillingPlan,type BillingSubscription,type BillingReconciliationResult,type EffectivePayrepPlan} from '../lib/account'
import type {BillingReturn} from '../lib/billingReturn'
import {CheckoutPayerReview} from './CheckoutPayerReview'
import {PlanSubscriptionFlow} from './PlanSubscriptionFlow'
import {loadMyProfile,saveMyProfile,type PayrepProfile} from '../lib/account'
const names={free:'Free',basic:'Basic',full:'Full'}
function currency(amount:number,code:string){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:code||'BRL'}).format(amount/100)}
function date(raw:string|null){return raw?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw)):'—'}
const fallback:BillingSubscription={plan_code:'free',status:'active',provider:null,provider_customer_id:null,provider_subscription_id:null,current_period_start:null,current_period_end:null,cancel_at_period_end:false}
export function SubscriptionPage({onBack,billingReturn=null}:{onBack:()=>void;billingReturn?:BillingReturn|null}){
 const [data,setData]=useState<{subscription:BillingSubscription;payments:BillingPayment[];plans:BillingPlan[]}>({subscription:fallback,payments:[],plans:[]})
 const [loading,setLoading]=useState(true)
 const [access,setAccess]=useState<EffectivePayrepPlan|null>(null)
 const [error,setError]=useState('')
 const [checkoutHistory,setCheckoutHistory]=useState<BillingCheckoutIntent[]>([])
 const [checkoutBusy,setCheckoutBusy]=useState<'basic'|'full'|null>(null)
 const [checkoutError,setCheckoutError]=useState('')
 const [selectedPlan,setSelectedPlan]=useState<'basic'|'full'|null>(null)
 const [promoCode,setPromoCode]=useState('')
 const [promoBusy,setPromoBusy]=useState(false)
 const [promoError,setPromoError]=useState('')
 const [promoMessage,setPromoMessage]=useState('')
 const [reviewCheckout,setReviewCheckout]=useState<{plan:'basic'|'full';profile:PayrepProfile}|null>(null)
 const [cancelConfirm,setCancelConfirm]=useState(false)
 const [cancelBusy,setCancelBusy]=useState(false)
 const [cancelMessage,setCancelMessage]=useState('')
 const [reconciling,setReconciling]=useState(false)
 const [reconciliationMessage,setReconciliationMessage]=useState('')
 const reconciliationText=(result:BillingReconciliationResult)=>{
  if(result.state==='active')return 'A cobrança foi confirmada pelo Asaas e a assinatura está ativa no Payrep HML.'
  if(result.state==='pending')return 'O checkout foi pago. A cobrança individual ainda está como '+(result.providerPaymentStatus||'pendente')+' no Asaas.'
  if(result.state==='needs_review')return 'O checkout foi pago, mas a assinatura ou cobrança precisa de conciliação antes de liberar benefícios.'
  if(result.state==='provider_unavailable')return 'Não foi possível consultar o Asaas agora. Nenhum benefício foi liberado.'
  return 'Ainda não recebemos a confirmação do checkout pelo webhook do Asaas.'
 }
 const checkPayment=async()=>{
  if(reconciling)return
  setReconciling(true);setReconciliationMessage('')
  try{
   const result=await reconcileMyAsaasSandboxBilling()
   setReconciliationMessage(reconciliationText(result))
   const [billing,intents]=await Promise.all([loadMyBilling(),loadMyCheckoutIntents()])
   setData(billing);setCheckoutHistory(intents)
  }catch(e){setReconciliationMessage(e instanceof Error?e.message:'Falha ao verificar pagamento.')}
  finally{setReconciling(false)}
 }
 useEffect(()=>{let active=true
  void Promise.all([loadMyBilling(),loadMyCheckoutIntents(),loadMyEffectivePayrepPlan()])
   .then(async([billing,intents,effective])=>{
    setAccess(effective)
    if(!active)return
    setData(billing);setCheckoutHistory(intents)
    if(billing.subscription.plan_code==='free'&&(intents.some(i=>i.status==='paid')||billingReturn==='success')){
     setReconciling(true)
     try{
      const result=await reconcileMyAsaasSandboxBilling()
      if(!active)return
      setReconciliationMessage(reconciliationText(result))
      const [latest,history,effective]=await Promise.all([loadMyBilling(),loadMyCheckoutIntents(),loadMyEffectivePayrepPlan()])
      if(active){setData(latest);setCheckoutHistory(history);setAccess(effective)}
     }catch(e){
      if(active)setReconciliationMessage(e instanceof Error?e.message:'Não foi possível verificar o pagamento.')
     }finally{if(active)setReconciling(false)}
    }
   })
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao consultar informações de cobrança.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[])
 useEffect(()=>{
  // Database time windows are the source of truth; refresh the visible plan
  // while this screen remains open, without any background billing jobs.
  const interval=window.setInterval(()=>{
   void loadMyEffectivePayrepPlan().then(setAccess).catch(()=>{})
  },60_000)
  return ()=>window.clearInterval(interval)
 },[])
 const checkout=async(plan:'basic'|'full')=>{
  if(checkoutBusy)return
  setCheckoutBusy(plan);setCheckoutError('')
  try{
   // A hosted Asaas checkout does not offer an editable-prefilled toggle.
   // Let users review their account data before the first provider request.
   const profile=await loadMyProfile()
   setReviewCheckout({plan,profile})
  }catch(e){
   setCheckoutError(e instanceof Error?e.message:'Não foi possível carregar os dados cadastrais.')
  }finally{setCheckoutBusy(null)}
 }
 const submitReviewedCheckout=async(profile:PayrepProfile)=>{
  if(!reviewCheckout||checkoutBusy)return
  const plan=reviewCheckout.plan
  setCheckoutBusy(plan);setCheckoutError('')
  try{
   // Payrep remains the source of truth for newly created Asaas customers.
   // Existing linked customers are validated by the provider integration.
   await saveMyProfile(profile)
   const url=await startAsaasSandboxCheckout(plan)
   window.location.assign(url)
  }finally{setCheckoutBusy(null)}
 }
 const redeemPromo=async(plan:'basic'|'full')=>{
  if(promoBusy)return
  setPromoBusy(true);setPromoError('');setPromoMessage('')
  try{
   const redeemed=await redeemPayrepPromoCode(plan,promoCode)
   const next=await loadMyEffectivePayrepPlan()
   setAccess(next);setPromoCode('');setSelectedPlan(null)
   setPromoMessage('Código ativado: '+names[redeemed.plan]+' por '+redeemed.days+
    (redeemed.days===1?' dia.':' dias.')+
    ' Acesso até '+new Intl.DateTimeFormat('pt-BR',{
     timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'
    }).format(new Date(redeemed.endsAt))+'. Após esse período, o plano anterior válido retorna automaticamente.')
   window.scrollTo(0,0)
  }catch(e){setPromoError(e instanceof Error?e.message:'Não foi possível resgatar o código.')}
  finally{setPromoBusy(false)}
 }
 const openSubscription=(plan:'basic'|'full')=>{
  setSelectedPlan(plan);setPromoCode('');setPromoError('');setPromoMessage('')
  setReviewCheckout(null);setCheckoutError('')
  window.scrollTo(0,0)
 }
 const closeSubscription=()=>{
  setSelectedPlan(null);setReviewCheckout(null)
  setPromoCode('');setPromoError('');setCheckoutError('')
  window.scrollTo(0,0)
 }
 const submitSubscription=()=>{
  if(!selectedPlan||promoBusy||checkoutBusy)return
  if(promoCode.trim())void redeemPromo(selectedPlan)
  else void checkout(selectedPlan)
 }
 const cancelRenewal=async()=>{
  if(cancelBusy)return
  setCancelBusy(true);setCancelMessage('')
  try{
   await cancelMyAsaasSandboxRenewal()
   const billing=await loadMyBilling()
   setData(billing)
   setCancelConfirm(false)
   setCancelMessage('A renovação automática foi interrompida no Asaas Sandbox. O acesso permanece até a data de fim do período pago. Cobranças já geradas não são canceladas por esta operação.')
  }catch(e){setCancelMessage(e instanceof Error?e.message:'Falha ao cancelar a renovação.')}
  finally{setCancelBusy(false)}
 }
 const current=data.subscription
 const adminAccess=access?.isAdmin===true
 const pendingCheckout=current.plan_code==='free'?checkoutHistory.find(intent=>intent.status==='paid'):undefined
 const paidCheckoutPending=Boolean(pendingCheckout)
 const pendingPlanName=pendingCheckout?names[pendingCheckout.plan_code]:null
 if(selectedPlan){
  if(reviewCheckout)return <div className="stack account-page">
   <div className="page-intro"><div><h2>Revisar dados de assinatura</h2>
    <p>Plano {names[selectedPlan]}. Confira os dados para o checkout.</p></div>
    <button className="secondary" type="button" disabled={checkoutBusy!==null}
     onClick={()=>{setReviewCheckout(null);setCheckoutError('')}}><ArrowLeft size={16}/> Voltar</button>
   </div>
   <CheckoutPayerReview key={selectedPlan} planName={names[selectedPlan]}
    initial={reviewCheckout.profile} busy={checkoutBusy!==null}
    onCancel={()=>{setReviewCheckout(null);setCheckoutError('')}} onContinue={submitReviewedCheckout}/>
  </div>
  const plan=data.plans.find(item=>item.code===selectedPlan)
  const priceLabel=plan?.monthly_price_cents!=null
   ?currency(plan.monthly_price_cents,plan.currency)+' / mês':'Preço a definir'
  return <PlanSubscriptionFlow plan={selectedPlan} priceLabel={priceLabel}
   promoCode={promoCode} busy={promoBusy||checkoutBusy!==null}
   error={promoError||checkoutError}
   onCodeChange={value=>{setPromoCode(value);setPromoError('');setCheckoutError('')}}
   onConfirm={submitSubscription} onCancel={closeSubscription}/>
 }
 return <div className="stack account-page">
  <div className="page-intro"><div><h2>Assinatura</h2><p>Informações do plano e histórico de pagamentos.</p></div><button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  {error&&<div className="notice danger">{error}</div>}
  {loading?<div className="panel">Consultando sua assinatura...</div>:<>
   <section className="panel">
    <div className="panel-heading"><h2><CreditCard size={17}/> Seu plano</h2>
     <span className="pill">{adminAccess?'Administrador':access?.promoApplied?(names[access.promoPlan||'free']+' promoção'):
      access?.trialActive?'Full teste':names[current.plan_code]||'Free'}</span></div>
    <div className="subscription-current"><strong>{adminAccess?'Acesso administrativo integral':access?.promoApplied?'Plano '+names[access.promoPlan||'free']+' · promocional':
      access?.trialActive?'Full · teste gratuito':'Plano '+(names[current.plan_code]||'Free')}</strong><span>
     {adminAccess?'Acesso completo a todas as funcionalidades, sem vínculo com um plano comercial.':access?.promoApplied?'Acesso promocional gratuito. O plano pago cadastrado permanece '+names[current.plan_code]+'.':
      access?.trialActive?'Acesso temporário concedido pelo Payrep, sem cartão e sem cobrança. A assinatura financeira permanece Free.'
      :current.plan_code==='free'?(paidCheckoutPending?'Gratuito. Assinatura '+pendingPlanName+' em andamento, aguardando confirmação do pagamento.':'Gratuito. Nenhuma cobrança ativa.')
      :current.status==='active'?'Assinatura ativa':'Situação: '+current.status}
    </span></div>
    {!adminAccess&&access?.promoActive&&access.promoEndsAt&&<div className="payrep-billing-help">
     <strong>Código promocional ativado: {names[access.promoPlan||'free']}</strong>
     <p>Válido até {new Intl.DateTimeFormat('pt-BR',{
      timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'
     }).format(new Date(access.promoEndsAt))}.
     Depois, seu acesso volta ao plano pago vigente, ou ao Free se não houver assinatura ativa.
     O resgate não criou pagamento e não suspende cobranças de uma assinatura já existente.</p>
    </div>}
    {!adminAccess&&access?.trialActive&&<div className="payrep-billing-help">
     <strong>Período de avaliação Full</strong>
     <p>Válido até {date(access.trialEndsAt)}. Ao expirar, o acesso retorna automaticamente ao Free, sem renovação ou cobrança automática. Não é necessário cancelar.</p>
    </div>}
    {!paidCheckoutPending&&billingReturn&&billingReturn!=='success'&&<p className="subtle" role="status">
     {billingReturn==='cancel'?'O checkout foi cancelado.':'O checkout expirou.'} Consulte a situação do seu plano abaixo.
    </p>}
    {!paidCheckoutPending&&reconciliationMessage&&<p className="subtle" role="status">{reconciliationMessage}</p>}
    {current.current_period_end&&<p className="subtle">Fim do período atual: {date(current.current_period_end)}</p>}
    {current.plan_code!=='free'&&<div className="payrep-billing-help">
     <strong>{adminAccess?'Assinatura histórica vinculada à conta':'Gerenciamento e cancelamento da assinatura'}</strong>
     {current.cancel_at_period_end
      ?<p role="status">Renovação automática interrompida. Seu acesso ao plano pago permanece até {date(current.current_period_end)}. Cobranças já geradas no Asaas não são canceladas automaticamente.</p>
      :<>
       <p>Você pode interromper as próximas renovações. O acesso já pago permanece até {date(current.current_period_end)}. Cobranças já geradas continuam exigíveis e precisam ser tratadas separadamente.</p>
       {!cancelConfirm
        ?<button type="button" className="secondary" onClick={()=>setCancelConfirm(true)}>Cancelar renovação</button>
        :<div className="stack" role="group" aria-label="Confirmar cancelamento da renovação">
          <p><strong>Confirma interromper a renovação do plano {names[current.plan_code]} no Asaas?</strong></p>
          <div className="row">
           <button type="button" className="secondary" disabled={cancelBusy} onClick={()=>setCancelConfirm(false)}>Manter assinatura</button>
           <button type="button" className="secondary" disabled={cancelBusy} onClick={()=>void cancelRenewal()}>{cancelBusy?'Cancelando...':'Confirmar cancelamento'}</button>
          </div>
         </div>}
      </>}
     {cancelMessage&&<p role="status" className="subtle">{cancelMessage}</p>}
    </div>}
    <div className="detail-hint"><Info size={16}/>Integração Asaas exclusivamente em homologação. Não há movimentação financeira real. A interrupção da renovação não estorna pagamentos nem remove cobranças já emitidas.</div>
   </section>
   {paidCheckoutPending&&<section className="panel" aria-labelledby="subscription-pending-title">
    <div className="panel-heading">
     <h2 id="subscription-pending-title"><CreditCard size={17}/> Assinatura {pendingPlanName} em andamento</h2>
     <span className="pill">Em andamento</span>
    </div>
    <p role="status"><strong>Status: Aguardando confirmação do pagamento</strong></p>
    <p className="subtle">O checkout foi concluído no Asaas Sandbox. O plano Free permanece ativo até a conciliação, sem necessidade de realizar outra compra.</p>
    {reconciliationMessage&&<p className="subtle" role="status">{reconciliationMessage}</p>}
    <button type="button" className="secondary" onClick={()=>void checkPayment()} disabled={reconciling}>
     {reconciling?'Verificando cobrança...':'Verificar pagamento no Asaas'}
    </button>
   </section>}
   {promoMessage&&<div className="auth-success" role="status">{promoMessage}</div>}
   {!adminAccess&&<section className="panel"><div className="panel-heading"><h2>Planos</h2></div>
    <div className="subscription-plans">{(['free','basic','full'] as const).map(code=>{
     const plan=data.plans.find(p=>p.code===code)
     return <div key={code} className={'subscription-plan '+(access?.effectivePlan===code?'subscription-plan-active':'')}>
      <span>{names[code]}</span>
      <strong>{code==='free'?'Gratuito':plan?.monthly_price_cents==null?'Preço a definir':currency(plan.monthly_price_cents,plan.currency)}</strong>
      <small>{access?.effectivePlan===code?(access.promoApplied?'Promoção ativa':access.trialActive?'Teste Full ativo':'Plano atual'):pendingCheckout?.plan_code===code?'Assinatura em andamento · aguardando confirmação':plan?.available_for_checkout&&plan.monthly_price_cents!=null?'Sandbox habilitado':'Em preparação'}</small>
      {code!=='free'&&plan?.available_for_checkout&&Number(plan.monthly_price_cents)>0&&current.plan_code==='free'&&!paidCheckoutPending&&
       <button type="button" className="secondary" disabled={checkoutBusy!==null||promoBusy}
         onClick={()=>openSubscription(code)}>Assinar</button>}
     </div>
    })}</div>
   </section>}
   {checkoutHistory.length>0&&<section className="panel">
    <div className="panel-heading"><h2>Checkouts de homologação</h2></div>
    <p className="subtle">O retorno do Asaas não confirma pagamento nem altera automaticamente o plano. O processamento depende da conciliação segura dos webhooks.</p>
    <div className="table-scroll"><table><thead><tr><th>Plano</th><th>Valor</th><th>Status</th><th>Criação</th></tr></thead>
     <tbody>{checkoutHistory.map(c=><tr key={c.id}><td>{names[c.plan_code]}</td><td>{currency(c.amount_cents,c.currency)}</td><td>{c.status==='paid'&&current.plan_code==='free'?'Aguardando confirmação do pagamento':c.status}</td><td>{date(c.created_at)}</td></tr>)}</tbody>
    </table></div>
   </section>}
   <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Pagamentos</h2></div>
    {data.payments.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>{data.payments.map(p=><tr key={p.id}><td>{date(p.paid_at||p.created_at)}</td><td>{p.description||p.provider}</td><td>{currency(p.amount_cents,p.currency)}</td><td>{p.status}</td></tr>)}</tbody></table></div>:<p className="subtle">Nenhum pagamento registrado.</p>}
   </section>
  </>}
 </div>
}
