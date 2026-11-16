import {useEffect,useState} from 'react'
import {ArrowLeft,CreditCard,Info,ShieldCheck} from 'lucide-react'
import {loadMyBilling,type BillingPayment,type BillingPlan,type BillingSubscription} from '../lib/account'
const names={free:'Free',basic:'Basic',full:'Full'}
function currency(amount:number,code:string){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:code||'BRL'}).format(amount/100)}
function date(raw:string|null){return raw?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw)):'—'}
const fallback:BillingSubscription={plan_code:'free',status:'active',provider:null,provider_customer_id:null,provider_subscription_id:null,current_period_start:null,current_period_end:null,cancel_at_period_end:false}
export function SubscriptionPage({onBack}:{onBack:()=>void}){
 const [data,setData]=useState<{subscription:BillingSubscription;payments:BillingPayment[];plans:BillingPlan[]}>({subscription:fallback,payments:[],plans:[]})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{let active=true;void loadMyBilling().then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao consultar plano.')}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[])
 const current=data.subscription
 return <div className="stack account-page">
  <div className="page-intro"><div><h2>Assinatura</h2><p>Informações do plano e histórico de pagamentos.</p></div><button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  {error&&<div className="notice danger">{error}</div>}
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
    <div className="detail-hint"><Info size={16}/>A contratação e o cancelamento recorrente pelo próprio aplicativo ainda não estão disponíveis. Os planos Basic e Full estão em preparação. A situação exibida corresponde aos registros disponíveis no Payrep.</div>
   </section>
   <section className="panel"><div className="panel-heading"><h2>Planos</h2></div>
    <div className="subscription-plans">{(['free','basic','full'] as const).map(code=>{
     const plan=data.plans.find(p=>p.code===code)
     return <div key={code} className={'subscription-plan '+(current.plan_code===code?'subscription-plan-active':'')}>
      <span>{names[code]}</span>
      <strong>{code==='free'?'Gratuito':plan?.monthly_price_cents==null?'Preço a definir':currency(plan.monthly_price_cents,plan.currency)}</strong>
      <small>{current.plan_code===code?'Plano atual':'Em preparação'}</small>
     </div>
    })}</div>
   </section>
   <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Pagamentos</h2></div>
    {data.payments.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>{data.payments.map(p=><tr key={p.id}><td>{date(p.paid_at||p.created_at)}</td><td>{p.description||p.provider}</td><td>{currency(p.amount_cents,p.currency)}</td><td>{p.status}</td></tr>)}</tbody></table></div>:<p className="subtle">Nenhum pagamento registrado.</p>}
   </section>
  </>}
 </div>
}
