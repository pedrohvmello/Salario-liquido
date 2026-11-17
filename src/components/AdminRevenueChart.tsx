import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {ChartColumnIncreasing,RefreshCw} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {db} from '../lib/data'

type Plan='basic'|'full'
type Metric='gross'|'net'
type View='monthly'|'annual'
type PlanTotals={grossCents:number;netCents:number;paymentCount:number;missingNetCount:number}
type RevenueBucket={period:string;label:string;basic:PlanTotals;full:PlanTotals}
type RevenueReport={
 environment:'sandbox';currency:'BRL';view:View;year:number|null;
 firstYear:number;lastYear:number;fetchedAt:string;
 buckets:RevenueBucket[];ignoredOutsidePayrep:number;invalidRows:number
}
const yearInSaoPaulo=Number(new Intl.DateTimeFormat('en-US',{
 timeZone:'America/Sao_Paulo',year:'numeric'
}).format(new Date()))
const years=Array.from({length:5},(_,index)=>yearInSaoPaulo-index)
const labels:Record<Plan,string>={basic:'Basic',full:'Full'}
const colors:Record<Plan,string>={basic:'#7400cf',full:'#0d88aa'}
const brl=(value:number)=>new Intl.NumberFormat('pt-BR',{
 style:'currency',currency:'BRL'
}).format(value)
const axis=(value:number)=>new Intl.NumberFormat('pt-BR',{
 notation:'compact',maximumFractionDigits:1
}).format(value)
const fmtTooltip=(value:unknown)=>brl(Number(value??0))
const planKeys:Plan[]=['basic','full']
function filterTotals(buckets:RevenueBucket[],plans:Record<Plan,boolean>,metric:Metric){
 let value=0,payments=0,missing=0
 for(const bucket of buckets)for(const plan of planKeys){
  if(!plans[plan])continue
  const v=bucket[plan]
  payments+=v.paymentCount
  value+=metric==='gross'?v.grossCents:v.netCents
  if(metric==='net')missing+=v.missingNetCount
 }
 return {value,missing,payments}
}
export function AdminRevenueChart(){
 const [view,setView]=useState<View>('monthly')
 const [year,setYear]=useState(String(yearInSaoPaulo))
 const [metric,setMetric]=useState<Metric>('gross')
 const [plans,setPlans]=useState<Record<Plan,boolean>>({basic:true,full:true})
 const [report,setReport]=useState<RevenueReport|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const requestId=useRef(0)
 const load=useCallback(async(mode:View,selectedYear:number)=>{
  const id=++requestId.current
  setLoading(true);setError('')
  setReport(null)
  try{
   if(!db)throw Error('Banco não configurado.')
   const {data,error}=await db.functions.invoke('admin-revenue-asaas',{
    body:{view:mode,year:selectedYear}
   })
   if(error)throw error
   if(!data||data.environment!=='sandbox'||data.view!==mode
     ||!Array.isArray(data.buckets)
     ||(mode==='monthly'&&data.year!==selectedYear))
    throw Error('O Asaas retornou um relatório incompatível com o filtro.')
   if(requestId.current===id)setReport(data as RevenueReport)
  }catch(e){
   if(requestId.current===id)setError(e instanceof Error?e.message:'Erro ao consultar faturamento.')
  }finally{if(requestId.current===id)setLoading(false)}
 },[])
 useEffect(()=>{void load(view,Number(year))},[view,year,load])
 const chosen=plans.basic||plans.full
 const totals=useMemo(()=>filterTotals(report?.buckets||[],plans,metric),[report,plans,metric])
 const incomplete=metric==='net'&&totals.missing>0
 const chartData=useMemo(()=>report?.buckets.map(bucket=>({
  period:bucket.period,label:bucket.label,
  basic:plans.basic?(metric==='gross'
   ?bucket.basic.grossCents/100
   :bucket.basic.missingNetCount>0?null:bucket.basic.netCents/100):null,
  full:plans.full?(metric==='gross'
   ?bucket.full.grossCents/100
   :bucket.full.missingNetCount>0?null:bucket.full.netCents/100):null
 }))||[],[report,plans,metric])
 const toggle=(plan:Plan,checked:boolean)=>setPlans(previous=>({...previous,[plan]:checked}))
 return <section className="panel" aria-labelledby="revenue-title">
  <div className="panel-heading">
   <h2 id="revenue-title"><ChartColumnIncreasing size={18}/> Faturamento por plano</h2>
   <button type="button" className="secondary" disabled={loading}
    onClick={()=>void load(view,Number(year))}><RefreshCw size={16}/>
    {loading?'Consultando...':'Atualizar gráfico'}
   </button>
  </div>
  <p className="subtle">Recebimentos confirmados ou recebidos no Asaas Sandbox. O valor líquido utiliza o valor informado pelo próprio Asaas após tarifas, sem estimativas.</p>
  <div className="admin-revenue-toolbar">
   <div className="admin-revenue-filter">
    <span>Período</span>
    <div className="admin-revenue-switch" role="group" aria-label="Agrupamento do gráfico">
     <button type="button" className={view==='monthly'?'active':''}
      aria-pressed={view==='monthly'} onClick={()=>setView('monthly')}>Mensal</button>
     <button type="button" className={view==='annual'?'active':''}
      aria-pressed={view==='annual'} onClick={()=>setView('annual')}>Anual</button>
    </div>
   </div>
   {view==='monthly'&&<div className="admin-revenue-filter admin-revenue-year">
    <span>Ano</span>
    <PayrepSelect title="Ano do faturamento" value={year} onChange={setYear} disabled={loading}>
     {years.map(y=><option key={y} value={y}>{y}</option>)}
    </PayrepSelect>
   </div>}
   <div className="admin-revenue-filter">
    <span>Valor</span>
    <div className="admin-revenue-switch" role="group" aria-label="Tipo de faturamento">
     <button type="button" className={metric==='gross'?'active':''}
      aria-pressed={metric==='gross'} onClick={()=>setMetric('gross')}>Bruto</button>
     <button type="button" className={metric==='net'?'active':''}
      aria-pressed={metric==='net'} onClick={()=>setMetric('net')}>Líquido</button>
    </div>
   </div>
   <div className="admin-revenue-filter">
    <span>Planos</span>
    <div className="admin-revenue-checks">
     {planKeys.map(plan=><label key={plan} className="admin-revenue-check">
      <input type="checkbox" checked={plans[plan]}
       onChange={e=>toggle(plan,e.target.checked)}/>
      <span aria-hidden="true" className="admin-revenue-dot" style={{background:colors[plan]}}/>
      {labels[plan]}
     </label>)}
    </div>
   </div>
  </div>
  <div className="admin-revenue-summary">
   <div>
    <span>{metric==='gross'?'Faturamento bruto':'Faturamento líquido'}
     {view==='monthly'?' em '+year:' nos últimos cinco anos'}</span>
    <strong>{!chosen?'Selecione um plano':loading?'Consultando...':
     !report?'—':incomplete?'Indisponível':brl(totals.value/100)}</strong>
   </div>
   <div>
    <span>Pagamentos considerados</span>
    <strong>{loading?'—':chosen&&report?totals.payments:0}</strong>
   </div>
  </div>
  {error&&<div className="notice danger" role="alert">{error}</div>}
  {!chosen?<p className="admin-revenue-empty">Marque Basic, Full ou ambos para visualizar o gráfico.</p>
  :loading?<p className="admin-revenue-empty">Consultando recebimentos no Asaas...</p>
  :report&&<div className="admin-revenue-chart-scroll">
   <div className="admin-revenue-chart">
    <ResponsiveContainer width="100%" height="100%">
     <BarChart data={chartData} barCategoryGap="24%" barGap={5}
      margin={{top:14,right:10,bottom:5,left:0}}>
      <CartesianGrid vertical={false} stroke="#eee3fa"/>
      <XAxis dataKey="label" tick={{fontSize:12,fill:'#74598c'}}/>
      <YAxis width={72} tick={{fontSize:11,fill:'#74598c'}}
       tickFormatter={axis}/>
      <Tooltip formatter={fmtTooltip} wrapperStyle={{pointerEvents:'none'}}/>
      {plans.basic&&<Bar dataKey="basic" name="Basic" fill={colors.basic}
       radius={[5,5,0,0]} maxBarSize={38}/>}
      {plans.full&&<Bar dataKey="full" name="Full" fill={colors.full}
       radius={[5,5,0,0]} maxBarSize={38}/>}
     </BarChart>
    </ResponsiveContainer>
   </div>
  </div>}
  {report&&!loading&&chosen&&totals.payments===0&&<p className="subtle">Nenhum pagamento dos planos selecionados foi confirmado nesse período.</p>}
  {report&&!loading&&incomplete&&<p className="error" role="status">
   O Asaas não informou o líquido de {totals.missing} cobrança(s). Os períodos afetados não são exibidos e o total líquido fica indisponível para evitar valores incorretos.
  </p>}
  {report&&!loading&&report.invalidRows>0&&<p className="subtle">
   {report.invalidRows} registro(s) do Asaas foram ignorados por ausência de valor ou data de pagamento válida.
  </p>}
  {report&&!loading&&<p className="subtle">
   {view==='annual'?'Comparação anual de '+report.firstYear+' a '+report.lastYear
    :'Total agrupado por mês de '+year}. Basic e Full seguem o plano contratado originalmente, inclusive após cancelamentos.
   Cobranças de outros produtos ou sem vínculo verificado com o Payrep são excluídas ({report.ignoredOutsidePayrep} registro(s)).
   Testes Full gratuitos não geram faturamento.
  </p>}
 </section>
}
