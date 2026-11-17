import {useEffect,useState} from 'react'
import {CreditCard,Save} from 'lucide-react'
import {db} from '../lib/data'
type PlanCode='basic'|'full'
type PlanRow={code:PlanCode;monthly_price_cents:number|null;available_for_checkout:boolean}
type Editable={price:string;enabled:boolean}
const inReais=(value:number|null)=>value==null?'':(value/100).toFixed(2).replace('.',',')
const parseCents=(value:string)=>{
 const normalized=value.trim().replace(/\./g,'').replace(',','.')
 if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized))return null
 const cents=Math.round(Number(normalized)*100)
 return Number.isSafeInteger(cents)&&cents>=500&&cents<=100000000?cents:null
}
export function AdminBillingPlans(){
 const [values,setValues]=useState<Record<PlanCode,Editable>>({
  basic:{price:'',enabled:false},full:{price:'',enabled:false}
 })
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState<PlanCode|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 useEffect(()=>{let alive=true
  void (async()=>{
   try{
    if(!db)throw Error('Banco não disponível.')
    const {data,error}=await db.from('billing_plans')
     .select('code,monthly_price_cents,available_for_checkout').in('code',['basic','full'])
    if(error)throw error
    if(!alive)return
    const records=(data||[]) as PlanRow[]
    setValues(previous=>{
     const next={...previous}
     for(const plan of records)next[plan.code]={
      price:inReais(plan.monthly_price_cents),enabled:plan.available_for_checkout
     }
     return next
    })
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Falha ao carregar planos.')}
   finally{if(alive)setLoading(false)}
  })()
  return ()=>{alive=false}
 },[])
 const change=(code:PlanCode,patch:Partial<Editable>)=>setValues(old=>({
  ...old,[code]:{...old[code],...patch}
 }))
 const save=async(code:PlanCode)=>{
  if(!db||saving)return
  const amount=parseCents(values[code].price)
  if(amount===null){setError('Informe preço válido de pelo menos R$ 5,00.');return}
  setSaving(code);setError('');setMessage('')
  try{
   const {error}=await db.rpc('update_hml_billing_plan',{
    p_plan:code,p_price_cents:amount,p_available:values[code].enabled
   })
   if(error)throw error
   setValues(previous=>({...previous,[code]:{
    ...previous[code],price:inReais(amount)
   }}))
   setMessage('Plano '+(code==='basic'?'Basic':'Full')+' atualizado em HML.')
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar o preço.')}
  finally{setSaving(null)}
 }
 return <section className="panel">
  <div className="panel-heading"><h2><CreditCard size={18}/> Planos e assinaturas</h2></div>
  <p className="subtle">Valores mensais de teste em reais. Salvar não altera o preço das assinaturas já contratadas no Asaas.</p>
  <div className="subscription-plans">
   {(['basic','full'] as const).map(code=><div key={code} className="subscription-plan">
    <strong>{code==='basic'?'Basic':'Full'}</strong>
    <label>Valor mensal (R$)
     <input type="text" inputMode="decimal" aria-label={'Preço mensal '+code}
      value={values[code].price} disabled={loading||saving!==null}
      onChange={event=>change(code,{price:event.target.value})}
      placeholder="5,00"/>
    </label>
    <label className="admin-switch">
     <input type="checkbox" checked={values[code].enabled}
      disabled={loading||saving!==null}
      onChange={event=>change(code,{enabled:event.target.checked})}/>
     <span><strong>Disponível para contratação</strong></span>
    </label>
    <button type="button" className="secondary" disabled={loading||saving!==null}
     onClick={()=>void save(code)}><Save size={16}/>
     {saving===code?'Salvando...':'Salvar '+(code==='basic'?'Basic':'Full')}
    </button>
   </div>)}
  </div>
  {message&&<p role="status" className="auth-success">{message}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  <p className="subtle">As permissões por plano dependem da definição da matriz de recursos. Os valores atuais não são preços comerciais de produção.</p>
 </section>
}
