import {useEffect,useRef,useState} from 'react'
import {ArrowLeft,CreditCard,Info,ShieldCheck} from 'lucide-react'
import {cancelMyAsaasSandboxRenewal,confirmMyCheckoutCpf,hasMyCheckoutCpf,loadMyEffectivePayrepPlan,loadMyBilling,loadMyCheckoutIntents,reconcileMyAsaasSandboxBilling,startAsaasSandboxCheckout,type BillingCheckoutIntent,type BillingPayment,type BillingPlan,type BillingSubscription,type BillingReconciliationResult,type EffectivePayrepPlan} from '../lib/account'
import type {BillingReturn} from '../lib/billingReturn'
import {cpfDigits,formatCpf,isValidCpf} from '../lib/brazilIdentity'
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
 const [cpfPlan,setCpfPlan]=useState<'basic'|'full'|null>(null)
 const [cpfDraft,setCpfDraft]=useState('')
 const [cpfError,setCpfError]=useState('')
 const cpfInputRef=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(cpfPlan)cpfInputRef.current?.focus()},[cpfPlan])
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
 const checkout=async(plan:'basic'|'full')=>{
  if(checkoutBusy)return
  setCheckoutBusy(plan);setCheckoutError('');setCpfError('')
  try{
   if(!await hasMyCheckoutCpf()){
    setCpfDraft('');setCpfPlan(plan);setCheckoutBusy(null)
    return
   }
   const url=await startAsaasSandboxCheckout(plan)
   window.location.assign(url)
  }catch(e){
   const message=e instanceof Error?e.message:'Checkout de homologação indisponível.'
   if(message.includes('CPF_REQUIRED')||message.includes('Informe seu CPF')){
    setCpfPlan(plan);setCpfDraft('')
   }else setCheckoutError(message)
   setCheckoutBusy(null)
  }
 }
 const confirmCpfAndCheckout=async()=>{
  if(!cpfPlan||checkoutBusy)return
  if(!isValidCpf(cpfDraft)){
   setCpfError('CPF inválido. Confira os 11 dígitos informados.')
   return
  }
  const plan=cpfPlan
  setCheckoutBusy(plan);setCpfError('');setCheckoutError('')
  let saved=false
  try{
   await confirmMyCheckoutCpf(cpfDraft)
   saved=true
   setCpfPlan(null);setCpfDraft('')
   const url=await startAsaasSandboxCheckout(plan)
   window.location.assign(url)
  }catch(e){
   const message=e instanceof Error?e.message:'Não foi possível concluir o cadastro para pagamento.'
   if(saved)setCheckoutError('CPF salvo no seu cadastro. '+message)
   else setCpfError(message)
  }finally{setCheckoutBusy(null)}
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
 const pendingCheckout=current.plan_code==='free'?checkoutHistory.find(intent=>intent.status==='paid'):undefined
 const paidCheckoutPending=Boolean(pendingCheckout)
 const pendingPlanName=pendingCheckout?names[pendingCheckout.plan_code]:null
 return <div className="stack account-page">
  <div className="page-intro"><div><h2>Assinatura</h2><p>Informações do plano e histórico de pagamentos.</p></div><button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  {error&&<div className="notice danger">{error}</div>}
  {loading?<div className="panel">Consultando sua assinatura...</div>:<>
   <section className="panel">
    <div className="panel-heading"><h2><CreditCard size={17}/> Seu plano</h2><span className="pill">{access?.trialActive?'Full teste':names[current.plan_code]||'Free'}</span></div>
    <div className="subscription-current"><strong>{access?.trialActive?'Full · teste gratuito':'Plano '+(names[current.plan_code]||'Free')}</strong><span>
     {access?.trialActive?'Acesso temporário concedido pelo Payrep, sem cartão e sem cobrança. A assinatura financeira permanece Free.'
      :current.plan_code==='free'?(paidCheckoutPending?'Gratuito. Assinatura '+pendingPlanName+' em andamento, aguardando confirmação do pagamento.':'Gratuito. Nenhuma cobrança ativa.')
      :current.status==='active'?'Assinatura ativa':'Situação: '+current.status}
    </span></div>
    {access?.trialActive&&<div className="payrep-billing-help">
     <strong>Período de avaliação Full</strong>
     <p>Válido até {date(access.trialEndsAt)}. Ao expirar, o acesso retorna automaticamente ao Free, sem renovação ou cobrança automática. Não é necessário cancelar.</p>
    </div>}
    {!paidCheckoutPending&&billingReturn&&billingReturn!=='success'&&<p className="subtle" role="status">
     {billingReturn==='cancel'?'O checkout foi cancelado.':'O checkout expirou.'} Consulte a situação do seu plano abaixo.
    </p>}
    {!paidCheckoutPending&&reconciliationMessage&&<p className="subtle" role="status">{reconciliationMessage}</p>}
    {current.current_period_end&&<p className="subtle">Fim do período atual: {date(current.current_period_end)}</p>}
    {current.plan_code!=='free'&&<div className="payrep-billing-help">
     <strong>Gerenciamento e cancelamento da assinatura</strong>
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
   <section className="panel"><div className="panel-heading"><h2>Planos</h2></div>
    <div className="subscription-plans">{(['free','basic','full'] as const).map(code=>{
     const plan=data.plans.find(p=>p.code===code)
     return <div key={code} className={'subscription-plan '+(current.plan_code===code?'subscription-plan-active':'')}>
      <span>{names[code]}</span>
      <strong>{code==='free'?'Gratuito':plan?.monthly_price_cents==null?'Preço a definir':currency(plan.monthly_price_cents,plan.currency)}</strong>
      <small>{current.plan_code===code?'Plano atual':pendingCheckout?.plan_code===code?'Assinatura em andamento · aguardando confirmação':plan?.available_for_checkout&&plan.monthly_price_cents!=null?'Sandbox habilitado':'Em preparação'}</small>
      {code!=='free'&&plan?.available_for_checkout&&Number(plan.monthly_price_cents)>0&&current.plan_code==='free'&&!paidCheckoutPending&&
       <button type="button" className="secondary" disabled={checkoutBusy!==null}
        onClick={()=>void checkout(code)}>
        {checkoutBusy===code?'Preparando checkout...':'Testar checkout no Asaas'}
       </button>}
     </div>
    })}</div>
   </section>
   {cpfPlan&&<section className="panel subscription-cpf-panel" aria-labelledby="checkout-cpf-title">
    <div className="panel-heading"><h2 id="checkout-cpf-title">Informe seu CPF para contratar o {names[cpfPlan]}</h2></div>
    <p className="subtle">O CPF é necessário para contratar uma assinatura. Após confirmar, ele será automaticamente salvo no seu cadastro. Não solicitamos dados de cartão nesta etapa.</p>
    <form className="subscription-cpf-form" onSubmit={e=>{e.preventDefault();void confirmCpfAndCheckout()}}>
     <label htmlFor="checkout-cpf-input">CPF
      <input id="checkout-cpf-input" ref={cpfInputRef} type="text" inputMode="numeric"
       autoComplete="off" placeholder="000.000.000-00" maxLength={14}
       value={cpfDraft} onChange={e=>{setCpfDraft(formatCpf(e.target.value));setCpfError('')}}
       aria-invalid={cpfDigits(cpfDraft).length===11&&!isValidCpf(cpfDraft)||Boolean(cpfError)}
       aria-describedby={cpfError?'checkout-cpf-error':'checkout-cpf-help'}/>
     </label>
     <small id="checkout-cpf-help" className="subtle">O CPF deve conter 11 dígitos válidos. A data de nascimento não é exigida para contratar.</small>
     {cpfError&&<p id="checkout-cpf-error" className="error" role="alert">{cpfError}</p>}
     <div className="row subscription-cpf-actions">
      <button type="button" className="secondary" disabled={checkoutBusy!==null}
       onClick={()=>{setCpfPlan(null);setCpfDraft('');setCpfError('')}}>Cancelar</button>
      <button type="submit" className="primary"
       disabled={checkoutBusy!==null||!isValidCpf(cpfDraft)}>
       {checkoutBusy===cpfPlan?'Salvando CPF...':'Confirmar CPF e continuar no Asaas'}
      </button>
     </div>
    </form>
   </section>}
   {checkoutError&&<div className="notice danger" role="alert">{checkoutError}</div>}
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
