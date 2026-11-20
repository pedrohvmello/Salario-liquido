import {useMemo,useState} from 'react'
import {
 Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis
} from 'recharts'
import {AlertCircle,CheckCircle2,FileText} from 'lucide-react'
import {brl} from '../lib/money'
import {formatMoneyAxisTick} from '../lib/chartAxis'
import type {SavedStatement} from '../lib/data'
import type {StatementRubric,VacationLedger} from '../lib/vacation'
import type {MonthlyMetrics} from '../lib/analytics'
import type {ConfirmedTaxFigure} from '../lib/incomeTaxReports'
import {
 annualComparison,buildFinancialMonths,documentsAudit,financialDestinations,financialTrends
} from '../lib/financialInsights'

type Mode='destination'|'deductions'|'years'|'documents'
type Props={
 year:string;statements:SavedStatement[];lines:StatementRubric[];
 vacationLedger:VacationLedger;metrics:MonthlyMetrics[];reports:ConfirmedTaxFigure[]
}
const purple='#7900e9',green='#059669',blue='#2563eb',red='#e35755',
 orange='#e49a42',cyan='#0891b2',pink='#db2777',gray='#9ca3af'
const modes:readonly {id:Mode;label:string}[]=[
 {id:'destination',label:'Destino da remuneração'},
 {id:'deductions',label:'Evolução dos descontos'},
 {id:'years',label:'Comparar anos'},
 {id:'documents',label:'Conciliação dos documentos'}
]
const moneyFmt=(v:unknown)=>typeof v==='number'?brl(v):'—'
const percentFmt=(v:unknown)=>typeof v==='number'?
 new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2}).format(v)+'%':'—'
function Missing({children}:{children:string}){return <div className="financial-insights-empty"><FileText size={20}/>{children}</div>}
function ChartRoot({children}:{children:React.ReactNode}){return <div className="financial-insights-chart">{children}</div>}
export function FinancialInsights({year,statements,lines,vacationLedger,metrics,reports}:Props){
 const [mode,setMode]=useState<Mode>('destination')
 const monthEvidence=useMemo(()=>buildFinancialMonths(statements,lines,vacationLedger,metrics),
  [statements,lines,vacationLedger,metrics])
 const trend=useMemo(()=>financialTrends(monthEvidence,year),[monthEvidence,year])
 const distributions=useMemo(()=>financialDestinations(monthEvidence,year),[monthEvidence,year])
 const comparisons=useMemo(()=>annualComparison(monthEvidence,year),[monthEvidence,year])
 const audits=useMemo(()=>documentsAudit(statements,lines,reports,year),
  [statements,lines,reports,year])
 const grossRate=useMemo(()=>{
  // The effective rate is computed only for fully observed tax periods;
  // no unknown IRRF/INSS row is treated as zero.
  const complete=trend.filter(row=>row.rateTaxes!==null&&row.gross!==null&&row.gross>0&&
   row.irrf!==null&&row.inss!==null)
  if(!complete.length)return null
  const gross=complete.reduce((n,row)=>n+row.gross!,0)
  return gross>0?
   Math.round(10000*complete.reduce((n,row)=>n+row.irrf!+row.inss!,0)/gross)/100:null
 },[trend])
 const destinationData=distributions.some(d=>d.classified)
 const percentData=trend.some(t=>t.rateTaxes!==null||t.ratePension!==null)
 const yearData=comparisons.some(c=>c.gross!==null||c.net!==null)
 const auditCount=audits.reduce((n,a)=>n+a.months,0)
 return <section className="panel financial-insights-panel" aria-label="Outras análises financeiras">
  <div className="panel-heading financial-insights-heading">
   <div>
    <h2>Explore seus dados</h2>
    <p>Selecione a análise que deseja visualizar. Os valores consideram apenas documentos importados.</p>
   </div>
  </div>
  <div className="financial-insights-tabs" role="tablist" aria-label="Tipo de análise">
   {modes.map(item=><button key={item.id} type="button" role="tab"
    aria-selected={mode===item.id} className={mode===item.id?'is-active':''}
    onClick={()=>setMode(item.id)}>{item.label}</button>)}
  </div>
  {mode==='destination'&&<div className="financial-insights-content" role="tabpanel">
   <div className="financial-insights-headline">
    <h3>Para onde foi a remuneração?</h3>
    <p>Recebimentos, aplicações, tributos, pensão e valores ainda não classificados, por período.</p>
   </div>
   {destinationData?<ChartRoot><ResponsiveContainer width="100%" height="100%">
    <BarChart data={distributions} margin={{top:10,right:12,left:5,bottom:12}}>
     <CartesianGrid stroke="#eee3fa" vertical={false}/>
     <XAxis dataKey="label" tick={{fontSize:11}}/>
     <YAxis width={77} tick={{fontSize:11}} tickFormatter={formatMoneyAxisTick}/>
     <Tooltip formatter={moneyFmt} wrapperStyle={{pointerEvents:'none'}}/>
     <Legend wrapperStyle={{fontSize:11}}/>
     <Bar dataKey="cash" name="Líquido recebido" stackId="gross" fill={green} maxBarSize={45}/>
     <Bar dataKey="espp" name="ESPP" stackId="gross" fill={pink} maxBarSize={45}/>
     <Bar dataKey="privatePension" name="Previdência" stackId="gross" fill={cyan} maxBarSize={45}/>
     <Bar dataKey="pension" name="Pensão" stackId="gross" fill={orange} maxBarSize={45}/>
     <Bar dataKey="inss" name="INSS" stackId="gross" fill={blue} maxBarSize={45}/>
     <Bar dataKey="irrf" name="IRRF" stackId="gross" fill={red} maxBarSize={45}/>
     <Bar dataKey="remainder" name="Não classificado" stackId="gross" fill={gray} maxBarSize={45}/>
    </BarChart>
   </ResponsiveContainer></ChartRoot>:
    <Missing>Não há competências com proventos e líquido suficientes para compor o gráfico.</Missing>}
   <p className="financial-insights-note">Somente holerites e pagamentos complementares confirmados. Valores não classificados são diferenças de conciliação, não despesas comprovadas. 13º e PPR não entram nesta composição.</p>
  </div>}
  {mode==='deductions'&&<div className="financial-insights-content" role="tabpanel">
   <div className="financial-insights-headline">
    <h3>Quanto do bruto foi descontado?</h3>
    <p>Percentual sobre os proventos brutos dos holerites. Pensão é apresentada separadamente dos tributos.</p>
   </div>
   <div className="financial-insights-rate">
    <span>Taxa efetiva de tributos identificados</span>
    <strong>{percentFmt(grossRate)}</strong>
    <small>IRRF + INSS ÷ proventos brutos, apenas nos períodos com ambos os valores disponíveis.</small>
   </div>
   {percentData?<ChartRoot><ResponsiveContainer width="100%" height="100%">
    <LineChart data={trend} margin={{top:10,right:16,left:4,bottom:10}}>
     <CartesianGrid stroke="#eee3fa" vertical={false}/>
     <XAxis dataKey="label" tick={{fontSize:11}}/>
     <YAxis width={66} tick={{fontSize:11}} tickFormatter={v=>String(v)+'%'}/>
     <Tooltip formatter={percentFmt} wrapperStyle={{pointerEvents:'none'}}/>
     <Legend wrapperStyle={{fontSize:11}}/>
     <Line dataKey="rateTaxes" name="IRRF + INSS" type="monotone" stroke={purple}
      strokeWidth={3} connectNulls={false} dot={{r:3}}/>
     <Line dataKey="rateIrrf" name="IRRF" type="monotone" stroke={red}
      strokeWidth={2} connectNulls={false} dot={{r:3}}/>
     <Line dataKey="rateInss" name="INSS" type="monotone" stroke={blue}
      strokeWidth={2} connectNulls={false} dot={{r:3}}/>
     <Line dataKey="ratePension" name="Pensão" type="monotone" stroke={orange}
      strokeWidth={2} connectNulls={false} dot={{r:3}}/>
    </LineChart>
   </ResponsiveContainer></ChartRoot>:
    <Missing>Importe holerites com valores de bruto e retenções para calcular as taxas.</Missing>}
   <p className="financial-insights-note">Lacunas permanecem sem valor quando não houver rubrica comprovada. FGTS e aplicações não são tratados como tributos.</p>
  </div>}
  {mode==='years'&&<div className="financial-insights-content" role="tabpanel">
   <div className="financial-insights-headline">
    <h3>Comparativo de remuneração entre anos</h3>
    <p>Bruto e líquido dos meses identificados. As variações percentuais usam somente meses presentes nos dois anos comparados.</p>
   </div>
   {yearData?<><ChartRoot><ResponsiveContainer width="100%" height="100%">
    <BarChart data={comparisons} margin={{top:10,right:16,left:4,bottom:8}}>
     <CartesianGrid stroke="#eee3fa" vertical={false}/>
     <XAxis dataKey="year" tick={{fontSize:11}}/>
     <YAxis width={77} tick={{fontSize:11}} tickFormatter={formatMoneyAxisTick}/>
     <Tooltip formatter={moneyFmt} wrapperStyle={{pointerEvents:'none'}}/>
     <Legend wrapperStyle={{fontSize:11}}/>
     <Bar dataKey="gross" name="Proventos brutos" fill={purple} maxBarSize={45} radius={[5,5,0,0]}/>
     <Bar dataKey="net" name="Líquido recebido" fill={green} maxBarSize={45} radius={[5,5,0,0]}/>
    </BarChart>
   </ResponsiveContainer></ChartRoot>
    <div className="financial-insights-table-wrap"><table className="financial-insights-table">
     <thead><tr><th>Ano</th><th>Meses</th><th>Bruto identificado</th><th>Líquido recebido</th><th>Variação do bruto</th><th>Variação do líquido</th></tr></thead>
     <tbody>{comparisons.map(row=><tr key={row.year}>
      <th scope="row">{row.year}</th>
      <td>{row.months}/12</td>
      <td>{row.gross===null?'—':brl(row.gross)}</td>
      <td>{row.net===null?'—':brl(row.net)}</td>
      <td>{percentFmt(row.grossChange)}{row.grossChange!==null&&<small>{row.commonMonths} mês(es) comum(ns)</small>}</td>
      <td>{percentFmt(row.netChange)}{row.netChange!==null&&<small>{row.commonMonths} mês(es) comum(ns)</small>}</td>
     </tr>)}</tbody>
    </table></div></>:
    <Missing>Não há períodos com proventos documentados para comparar.</Missing>}
   <p className="financial-insights-note">Totais são dos meses importados, sem projeção de períodos faltantes. Variações comparam exclusivamente competências equivalentes do ano anterior.</p>
  </div>}
  {mode==='documents'&&<div className="financial-insights-content" role="tabpanel">
   <div className="financial-insights-headline">
    <h3>Cobertura e conciliação dos holerites</h3>
    <p>{auditCount} competência(s) mensal(is) identificada(s). Totalizadoras pagas contam uma vez; diferenças e retificadoras são evidências.</p>
   </div>
   {audits.length?<div className="financial-insights-table-wrap">
    <table className="financial-insights-table">
     <thead><tr><th>Ano</th><th>Holerites mensais</th><th>Totalizadoras</th><th>Retificadoras</th><th>Diferenças</th><th>Conciliação IR</th><th>Diferença</th></tr></thead>
     <tbody>{audits.map(row=><tr key={row.year}>
      <th scope="row">{row.year}</th><td>{row.months}/12</td>
      <td>{row.totalizers}</td><td>{row.rectifications}</td><td>{row.differences}</td>
      <td><span className={'financial-insights-status is-'+row.state}>
       {row.state==='reconciled'?<CheckCircle2 size={14}/>:<AlertCircle size={14}/>}
       {row.state==='reconciled'?'Conciliado':row.state==='divergent'?'Divergente':
        row.state==='partial'?'Parcial':'Sem informe confirmado'}
      </span></td>
      <td>{row.difference===null?'—':brl(row.difference)}</td>
     </tr>)}</tbody>
    </table>
   </div>:<Missing>Nenhum documento disponível para conciliação.</Missing>}
   <p className="financial-insights-note">A diferença compara rendimentos tributáveis apurados com o Informe IR confirmado. Não equivale a diferenças dos proventos brutos. O status “Conciliado” exige 12 holerites e igualdade até R$ 0,01.</p>
  </div>}
 </section>
}
