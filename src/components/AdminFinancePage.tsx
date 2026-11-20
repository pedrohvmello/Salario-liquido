import {useCallback,useEffect,useState} from 'react'
import {ArrowDownToLine,CalendarDays,Landmark,RefreshCw,ShieldCheck,Wallet} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {AdminRevenueChart} from './AdminRevenueChart'
import {db} from '../lib/data'
import {asaasMode,asaasLabel} from '../lib/environment'
type Transaction={
 id:string;date:string;description:string;type:string;value:number|null;
 balance:number|null;paymentId:string
}
type Charge={
 id:string;status:string;value:number|null;netValue:number|null;
 dueDate:string;paymentDate:string;billingType:string;subscription:string
}
type FinanceResponse={
 environment:'sandbox'|'production';currency:'BRL';periodDays:number;fetchedAt:string;
 balance:number|null;transactions:Transaction[];transactionsHasMore:boolean;
 transactionsOffset:number;transactionsLimit:number;payments:Charge[];paymentsHasMore:boolean
}
const money=(n:number|null)=>n===null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n)
const date=(raw:string)=>raw?new Date(raw.length===10?raw+'T12:00:00Z':raw).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'—'
const csvSafe=(value:unknown)=>{
 const cleaned=String(value??'').replace(/[\r\n]+/g,' ')
 const safe=/^[=+@\-\t]/.test(cleaned)?"'"+cleaned:cleaned
 return '"'+safe.replace(/"/g,'""')+'"'
}
export function AdminFinancePage(){
 const [days,setDays]=useState('30')
 const [report,setReport]=useState<FinanceResponse|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [page,setPage]=useState(0)
 const load=useCallback(async(period:number,offset:number)=>{
  if(!db)throw Error('Banco não configurado.')
  setLoading(true);setError('')
  try{
   const {data,error}=await db.functions.invoke('admin-finance-asaas',{
    body:{days:period,offset}
   })
   if(error)throw error
   if(!data||data.environment!==asaasMode||!Array.isArray(data.transactions)||!Array.isArray(data.payments))
    throw Error('Formato inesperado da API financeira.')
   setReport(data as FinanceResponse);setPage(offset)
  }catch(e){setError(e instanceof Error?e.message:'Falha ao consultar dados financeiros.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load(Number(days),0)},[days,load])
 const exportCsv=()=>{
  if(!report)return
  const rows=[
   ['Data','Tipo','Descrição','Valor (R$)','Saldo (R$)','Identificador de pagamento'],
   ...report.transactions.map(x=>[
    x.date,x.type,x.description,x.value?.toFixed(2)??'',
    x.balance?.toFixed(2)??'',x.paymentId
   ])
  ]
  const csv='\uFEFF'+rows.map(row=>row.map(csvSafe).join(';')).join('\r\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download='payrep-'+asaasMode+'-extrato-'+report.periodDays+'d-pagina-'+(page/40+1)+'.csv'
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
 }
 const transactions=report?.transactions||[]
 const pending=(report?.payments||[]).filter(p=>['PENDING','OVERDUE'].includes(p.status))
 const confirmed=(report?.payments||[]).filter(p=>['CONFIRMED','RECEIVED'].includes(p.status))
 return <div className="stack">
  <div className="page-intro"><div><h2>Financeiro</h2>
   <p>Saldo, extrato e cobranças diretamente da conta {asaasLabel}.</p>
  </div><div className="row">
    <PayrepSelect value={days} onChange={setDays} title="Período do extrato" disabled={loading}>
     <option value="7">Últimos 7 dias</option>
     <option value="30">Últimos 30 dias</option>
     <option value="90">Últimos 90 dias</option>
    </PayrepSelect>
    <button type="button" className="secondary" onClick={()=>void load(Number(days),0)} disabled={loading}>
     <RefreshCw size={16}/>{loading?'Consultando...':'Atualizar'}
    </button>
   </div></div>
  <div className="detail-hint"><ShieldCheck size={16}/>
   Área administrativa de consulta. Não realiza transferências, estornos ou pagamentos. {asaasMode==='sandbox'?'Os valores são simulados, sem dinheiro real.':'Os valores refletem a conta de produção e podem incluir transações reais.'}
  </div>
  {error&&<div className="notice danger" role="alert">{error}</div>}
  <div className="admin-finance-kpis">
   <div className="stat"><span><Wallet size={16}/> Saldo Asaas</span>
    <strong>{report?money(report.balance):'—'}</strong><small>{asaasMode==='sandbox'?'Conta de homologação':'Conta de produção'}</small></div>
   <div className="stat"><span><Landmark size={16}/> Cobranças pendentes</span>
    <strong>{report?String(pending.length):'—'}</strong><small>Entre as {report?.payments.length||0} últimas cobranças consultadas</small></div>
   <div className="stat"><span><ArrowDownToLine size={16}/> Cobranças confirmadas</span>
    <strong>{report?String(confirmed.length):'—'}</strong><small>Na amostra consultada, não no histórico completo</small></div>
  </div>
  <AdminRevenueChart/>
  <section className="panel">
   <div className="panel-heading"><h2><CalendarDays size={18}/> Extrato da conta</h2>
    <button type="button" className="secondary" onClick={exportCsv} disabled={!report||transactions.length===0}>Exportar CSV da página</button>
   </div>
   <p className="subtle">Movimentações do período escolhido. Recebimentos e tarifas são lançamentos separados; o saldo é consultado diretamente no Asaas.</p>
   <div className="table-scroll"><table><thead><tr>
    <th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Saldo após lançamento</th>
   </tr></thead><tbody>
    {transactions.length===0?<tr><td colSpan={5}>{loading?'Carregando...':'Nenhuma movimentação para o período.'}</td></tr>:
     transactions.map((t,i)=><tr key={t.id||i}><td>{date(t.date)}</td><td>{t.type}</td>
      <td>{t.description}</td><td>{money(t.value)}</td><td>{money(t.balance)}</td></tr>)}
   </tbody></table></div>
   {report&&<div className="row">
    <button type="button" className="secondary" disabled={page===0||loading}
     onClick={()=>void load(Number(days),Math.max(0,page-report.transactionsLimit))}>Anterior</button>
    <span className="subtle">Lançamentos {page+1} a {page+transactions.length}</span>
    <button type="button" className="secondary" disabled={!report.transactionsHasMore||loading}
     onClick={()=>void load(Number(days),page+report.transactionsLimit)}>Próxima página</button>
   </div>}
  </section>
  <section className="panel">
   <div className="panel-heading"><h2>Recebíveis e cobranças</h2></div>
   <p className="subtle">Últimas 50 cobranças criadas no período, independentemente da página do extrato. A listagem não inclui automaticamente todo o histórico.</p>
   <div className="table-scroll"><table><thead><tr>
    <th>Vencimento</th><th>Valor bruto</th><th>Valor líquido informado</th><th>Situação</th><th>Meio</th>
   </tr></thead><tbody>
    {(report?.payments.length||0)===0?<tr><td colSpan={5}>{loading?'Carregando...':'Nenhuma cobrança encontrada.'}</td></tr>:
    report?.payments.map(c=><tr key={c.id}>
     <td>{date(c.dueDate)}</td><td>{money(c.value)}</td>
     <td>{money(c.netValue)}</td><td>{c.status}</td><td>{c.billingType}</td>
    </tr>)}
   </tbody></table></div>
   {report?.paymentsHasMore&&<p className="subtle">Existem mais cobranças no Asaas. A paginação integral de cobranças será incorporada numa próxima etapa.</p>}
  </section>
  {report&&<p className="subtle">Atualizado em {new Date(report.fetchedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}. Fonte: {asaasLabel}, consulta pontual.</p>}
 </div>
}
