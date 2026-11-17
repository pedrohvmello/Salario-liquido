import {useEffect,useState} from 'react'
import {ArrowLeft,CreditCard,Info,ShieldCheck} from 'lucide-react'
import {loadMyBilling,loadMyCheckoutIntents,reconcileMyAsaasSandboxBilling,startAsaasSandboxCheckout,type BillingCheckoutIntent,type BillingPayment,type BillingPlan,type BillingSubscription,type BillingReconciliationResult} from '../lib/account'
import type {BillingReturn} from '../lib/billingReturn'
const names={free:'Free',basic:'Basic',full:'Full'}
function currency(amount:number,code:string){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:code||'BRL'}).format(amount/100)}
function date(raw:string|null){return raw?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw)):'—'}
const fallback:BillingSubscription={plan_code:'free',status:'active',provider:null,provider_customer_id:null,provider_subscription_id:null,current_period_start:null,current_period_end:null,cancel_at_period_end:false}
export function SubscriptionPage({onBack,billingReturn=null}:{onBack:()=>void;billingReturn?:BillingReturn|null}){
 const [data,setData]=useState<{subscription:BillingSubscription;payments:BillingPayment[];plans:BillingPlan[]}>({subscription:fallback,payments:[],plans:[]})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [checkoutHistory,setCheckoutHistory]=useState<BillingCheckoutIntent[]>([])
 const [checkoutBusy,setCheckoutBusy]=useState<'basic'|'full'|null>(null)
 const [checkoutError,setCheckoutError]=useState('')
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
  void Promise.all([loadMyBilling(),loadMyCheckoutIntents()])
   .then(async([billing,intents])=>{
    if(!active)return
    setData(billing);setCheckoutHistory(intents)
    if(billing.subscription.plan_code==='free'&&(intents.some(i=>i.status==='paid')||billingReturn==='success')){
     setReconciling(true)
     try{
      const result=await reconcileMyAsaasSandboxBilling()
      if(!active)return
      setReconciliationMessage(reconciliationText(result))
      const [latest,history]=await Promise.all([loadMyBilling(),loadMyCheckoutIntents()])
      if(active){setData(latest);setCheckoutHistory(history)}
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
  setCheckoutBusy(plan);setCheckoutError('')
  try{
   const url=await startAsaasSandboxCheckout(plan)
   window.location.assign(url)
  }catch(e){setCheckoutError(e instanceof Error?e.message:'Checkout de homologação indisponível.');setCheckoutBusy(null)}
 }
 const current=data.subscription
 const paidCheckoutPending=current.plan_code==='free'&&checkoutHistory.some(intent=>intent.status==='paid')
 return <div className="stack account-page">
  <div className="page-intro"><div><h2>Assinatura</h2><p>Informações do plano e histórico de pagamentos.</p></div><button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  {error&&<div className="notice danger">{error}</div>}
  {billingReturn&&<div className="notice" role="status">
   {billingReturn==='success'
    ?'Checkout finalizado no Asaas. O pagamento será confirmado no Payrep somente após a conciliação com o provedor.'
    :billingReturn==='cancel'
    ?'Você retornou de um checkout cancelado. Consulte abaixo a situação registrada pelo provedor.'
    :'O checkout expirou. Consulte abaixo o estado da assinatura antes de iniciar outra contratação.'}
  </div>}
  {reconciliationMessage&&<div className="notice" role="status">{reconciliationMessage}</div>}
  {loading?<div className="panel">Consultando sua assinatura...</div>:<>
   <section className="panel">
    <div className="panel-heading"><h2><CreditCard size={17}/> Seu plano</h2><span className="pill">{names[current.plan_code]||'Free'}</span></div>
    <div className="subscription-current"><strong>Plano {names[current.plan_code]||'Free'}</strong><span>{current.plan_code==='free'?'Gratuito. Nenhuma cobrança ativa.':current.status==='active'?'Assinatura ativa': 'Situação: '+current.status}</span></div>
    {current.current_period_end&&<p className="subtle">Fim do período atual: {date(current.current_period_end)}</p>}
    {current.plan_code!=='free'&&<div className="payrep-billing-help">
     <strong>Gerenciamento e cancelamento da assinatura</strong>
     <p>{current.cancel_at_period_end||current.status==='canceled'
      ?'A renovação está registrada como cancelada. Se ainda existir período pago, você poderá continuar utilizando o plano até o fim da vigência, salvo se optar por encerrar a conta.'
      :'O Payrep registra uma assinatura paga. Para cancelar a renovação, utilize o canal pelo qual contratou ou solicite atendimento ao suporte. A exclusão da conta será bloqueada enquanto a renovação estiver ativa.'}</p>
     <a href="mailto:suporte@payrep.com.br?subject=Cancelamento%20de%20assinatura%20Payrep">Solicitar orientação de cancelamento</a>
    </div>}
    <div className="detail-hint"><Info size={16}/>A infraestrutura de checkout Asaas está preparada exclusivamente para testes no HML. A contratação depende de preços aprovados, habilitação administrativa e credenciais do Sandbox. Não há pagamentos reais nem cancelamento integrado nesta etapa.</div>
   </section>
   {paidCheckoutPending&&<div className="notice" role="status">
    O checkout de teste foi pago no Asaas Sandbox. A assinatura está aguardando conciliação no Payrep. Não inicie outra contratação.
    <button type="button" className="secondary" onClick={()=>void checkPayment()} disabled={reconciling}>
     {reconciling?'Verificando cobrança...':'Verificar pagamento no Asaas'}
    </button>
   </div>}
   <section className="panel"><div className="panel-heading"><h2>Planos</h2></div>
    <div className="subscription-plans">{(['free','basic','full'] as const).map(code=>{
     const plan=data.plans.find(p=>p.code===code)
     return <div key={code} className={'subscription-plan '+(current.plan_code===code?'subscription-plan-active':'')}>
      <span>{names[code]}</span>
      <strong>{code==='free'?'Gratuito':plan?.monthly_price_cents==null?'Preço a definir':currency(plan.monthly_price_cents,plan.currency)}</strong>
      <small>{current.plan_code===code?'Plano atual':plan?.available_for_checkout&&plan.monthly_price_cents!=null?'Sandbox habilitado':'Em preparação'}</small>
      {code!=='free'&&plan?.available_for_checkout&&Number(plan.monthly_price_cents)>0&&current.plan_code==='free'&&!paidCheckoutPending&&
       <button type="button" className="secondary" disabled={checkoutBusy!==null}
        onClick={()=>void checkout(code)}>
        {checkoutBusy===code?'Preparando checkout...':'Testar checkout no Asaas'}
       </button>}
     </div>
    })}</div>
   </section>
   {checkoutError&&<div className="notice danger" role="alert">{checkoutError}</div>}
   {checkoutHistory.length>0&&<section className="panel">
    <div className="panel-heading"><h2>Checkouts de homologação</h2></div>
    <p className="subtle">O retorno do Asaas não confirma pagamento nem altera automaticamente o plano. O processamento depende da conciliação segura dos webhooks.</p>
    <div className="table-scroll"><table><thead><tr><th>Plano</th><th>Valor</th><th>Status</th><th>Criação</th></tr></thead>
     <tbody>{checkoutHistory.map(c=><tr key={c.id}><td>{names[c.plan_code]}</td><td>{currency(c.amount_cents,c.currency)}</td><td>{c.status}</td><td>{date(c.created_at)}</td></tr>)}</tbody>
    </table></div>
   </section>}
   <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Pagamentos</h2></div>
    {data.payments.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>{data.payments.map(p=><tr key={p.id}><td>{date(p.paid_at||p.created_at)}</td><td>{p.description||p.provider}</td><td>{currency(p.amount_cents,p.currency)}</td><td>{p.status}</td></tr>)}</tbody></table></div>:<p className="subtle">Nenhum pagamento registrado.</p>}
   </section>
  </>}
 </div>
}
