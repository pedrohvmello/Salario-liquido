import {useMemo,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {Bar,BarChart,CartesianGrid,Legend,Line,LineChart,Pie,PieChart,Cell,Rectangle,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {FileText,Info,ChevronDown} from 'lucide-react'
import {brl,type SalaryParameters} from '../lib/money'
import {formatMoneyAxisTick} from '../lib/chartAxis'
import type {SavedStatement} from '../lib/data'
import type {StatementRubric,VacationLedger} from '../lib/vacation'
import type {ThirteenthLedger} from '../lib/thirteenthLedger'
import {VacationOverview} from './VacationOverview'
import {ThirteenthOverview} from './ThirteenthOverview'
import {
 METRICS,payrollMetrics,timeMetrics,taxTimeSeries,thirteenthComparison,pprComparison,topIrrfStackSegment,
 type MetricKey,type TimeMetrics,type IrrfStackKey,type TaxTime
} from '../lib/analytics'

type SalaryGraphRow={period:string;bruto:number|null;liquido:number|null;ferias:number}
type Props={
 year:string;onYearChange:(value:string)=>void;years:string[];
 statements:SavedStatement[];lines:StatementRubric[];
 monthlyGraph:SalaryGraphRow[];vacationLedger:VacationLedger;thirteenthLedger:ThirteenthLedger;
 parameters:SalaryParameters
}
// Use distinguishable chart series, while keeping purple as the main brand color.
const color={
 purple:'#7900e9',blue:'#2563eb',green:'#059669',pink:'#db2777',
 orange:'#e49a42',red:'#e35755',cyan:'#0891d1',gray:'#8492a5'
}
const fmt=(value:unknown)=>brl(Number(value??0))
function Panel({title,children}:{title:string;children:React.ReactNode}){
 return <section className="panel"><div className="panel-heading"><h2>{title}</h2></div>{children}</section>
}
function Empty({label}:{label:string}){
 return <div className="empty"><FileText size={27}/><p>{label}</p></div>
}
function Bars({data,children}:{data:Array<Record<string,string|number|null>>;children:React.ReactNode}){
 return <div className="chart"><ResponsiveContainer width="100%" height="100%">
  <BarChart data={data} barCategoryGap="24%" barGap={5} margin={{top:12,right:10,left:2,bottom:4}}>
   <CartesianGrid stroke="#eee3fa" vertical={false}/>
   <XAxis dataKey="label" tick={{fontSize:11}}/>
   <YAxis width={76} tick={{fontSize:11}} tickMargin={8} tickFormatter={formatMoneyAxisTick}/>
   <Tooltip formatter={fmt} offset={56} wrapperStyle={{pointerEvents:"none"}}/><Legend/>{children}
  </BarChart>
 </ResponsiveContainer></div>
}
function roundedIrrfShape(segment:IrrfStackKey){
 return (props:unknown)=>{
  const rect=props as React.ComponentProps<typeof Rectangle> & {payload?:TaxTime}
  const top=rect.payload?topIrrfStackSegment(rect.payload):null
  return <Rectangle {...rect} radius={top===segment?[6,6,0,0]:[0,0,0,0]}/>
 }
}
function sumKnown(rows:TimeMetrics[],key:MetricKey):number|null {
 const present=rows.filter(r=>r[key]!==null)
 return present.length?Math.round(present.reduce((n,r)=>n+(r[key]??0),0)*100)/100:null
}
function valueOrDash(value:number|null){return value===null?'—':brl(value)}
export function AnalyticsDashboard({
 year,onYearChange,years,statements,lines,monthlyGraph,vacationLedger,thirteenthLedger,parameters
}:Props){
 const [metric,setMetric]=useState<MetricKey>('privatePension')
 const evidence=useMemo(()=>payrollMetrics(statements,lines),[statements,lines])
 const timeline=useMemo(()=>timeMetrics(evidence,year),[evidence,year])
 const tax=useMemo(()=>taxTimeSeries(evidence,statements,year),[evidence,statements,year])
 const thirteenth=useMemo(()=>thirteenthComparison(thirteenthLedger.occurrences,year),[thirteenthLedger,year])
 const ppr=useMemo(()=>pprComparison(statements,year),[statements,year])
 const metricInfo=METRICS.find(x=>x.key===metric)!
 const metricEvidence=timeline.some(x=>x[metric]!==null)
 const fgtsEvidence=timeline.some(x=>x.fgts!==null)
 const taxEvidence=tax.some(x=>x.total!==null)
 const metricBars=timeline.map(x=>({label:x.label,value:x[metric]}))
 const fgtsBars=timeline.map(x=>({label:x.label,value:x.fgts}))
 const taxBars=tax.map(x=>({label:x.label,
  salary:x.salary,vacation:x.vacation,thirteenth:x.thirteenth,ppr:x.ppr}))
 const completeThirteenth=thirteenth.map(x=>({
  label:x.label,gross:x.gross,net:x.net,pension:x.pension??0,
  inss:x.inss??0,other:Math.max(0,x.other),irrf:x.irrf
 }))
 const completePpr=ppr.map(x=>({label:x.label,gross:x.gross,net:x.net,irrf:x.irrf}))

 const comparisonRows=useMemo(()=>{
  const monthLabel=(period:string)=>period.slice(5,7)+'/'+period.slice(2,4)
  return timeline.map(item=>{
   const key=year==='all'?item.period:monthLabel(item.period)
   const salary=monthlyGraph.find(row=>row.period===key)
   const taxParts=[item.irrfSalary,item.irrfVacation].filter((v):v is number=>v!==null)
   return {
    label:item.label,
    bruto:salary?.bruto??null,
    liquido:salary?.liquido??null,
    inss:item.inss,
    irrf:taxParts.length?Math.round(taxParts.reduce((sum,v)=>sum+v,0)*100)/100:null,
    monthlyStatements:item.monthlyStatements
   }
  })
 },[timeline,monthlyGraph,year])
 const breakdown=useMemo(()=>{
  const sum=(name:'liquido'|'irrf'|'inss')=>{
   const known=comparisonRows.map(row=>row[name]).filter((v):v is number=>v!==null)
   return known.length?Math.round(known.reduce((a,b)=>a+b,0)*100)/100:null
  }
  return [
   {name:'Líquido recebido',value:sum('liquido'),fill:color.green},
   {name:'IRRF da folha',value:sum('irrf'),fill:color.red},
   {name:'INSS da folha',value:sum('inss'),fill:color.blue},
  ]
 },[comparisonRows])
 const pieRows=breakdown.filter((entry):entry is {name:string;value:number;fill:string}=>
  entry.value!==null&&entry.value>0)
 const missingBreakdown=comparisonRows.some(row=>row.monthlyStatements>0&&(
  row.liquido===null||row.inss===null||row.irrf===null))
 const documentsCovered=comparisonRows.reduce((sum,row)=>sum+row.monthlyStatements,0)

 return <div className="stack">
  <div className="page-intro">
   <div><h2>Análises financeiras</h2>
    <p>Histórico de valores identificados nos holerites. 13º, férias e PPR permanecem separados para evitar dupla contabilização.</p>
   </div>
   <PayrepSelect value={year} onChange={onYearChange} title="Ano" aria-label="Filtrar ano">
    <option value="all">Todos os anos</option>
    {years.map(y=><option key={y} value={y}>{y}</option>)}
   </PayrepSelect>
  </div>

  <div className="analytics-main-grid">
   <Panel title="Distribuição financeira identificada">
    {pieRows.length?<div className="analytics-donut-layout">
     <div className="analytics-donut-chart">
      <ResponsiveContainer width="100%" height="100%">
       <PieChart>
        <Pie data={pieRows} dataKey="value" nameKey="name" cx="50%" cy="50%"
         innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
         {pieRows.map(entry=><Cell key={entry.name} fill={entry.fill}/>)}
        </Pie>
        <Tooltip formatter={fmt}/>
       </PieChart>
      </ResponsiveContainer>
     </div>
     <div className="analytics-donut-legend">
      {breakdown.map(entry=><div key={entry.name}>
       <span className="analytics-color-dot" style={{backgroundColor:entry.fill}}/>
       <span>{entry.name}</span>
       <strong>{valueOrDash(entry.value)}</strong>
      </div>)}
     </div>
    </div>:<Empty label="Não há valores mensais suficientes para compor o gráfico."/>}
    <div className="detail-hint"><Info size={16}/>Composição relativa apenas dos valores identificados nos holerites mensais ({documentsCovered} folha(s)). Não representa a divisão integral do bruto. {missingBreakdown?'Há rubricas ausentes em parte dos meses.':''}</div>
   </Panel>
   <Panel title={year==='all'?'Evolução anual da remuneração':'Evolução mensal da remuneração'}>
    {comparisonRows.some(row=>row.bruto!==null||row.liquido!==null)?
     <div className="chart analytics-evolution-chart"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={comparisonRows} margin={{top:12,right:8,left:0,bottom:5}}>
       <CartesianGrid stroke="#eee3fa" vertical={false}/>
       <XAxis dataKey="label" tick={{fontSize:11}}/>
       <YAxis width={77} tick={{fontSize:11}} tickFormatter={formatMoneyAxisTick}/>
       <Tooltip formatter={fmt} wrapperStyle={{pointerEvents:"none"}}/>
       <Legend wrapperStyle={{fontSize:11}}/>
       <Line type="monotone" dataKey="bruto" name="Proventos brutos" stroke={color.purple} strokeWidth={2.4} dot={{r:3}} connectNulls={false}/>
       <Line type="monotone" dataKey="liquido" name="Líquido recebido" stroke={color.green} strokeWidth={2.4} dot={{r:3}} connectNulls={false}/>
       <Line type="monotone" dataKey="inss" name="INSS mensal" stroke={color.blue} strokeWidth={2} dot={{r:2}} connectNulls={false}/>
       <Line type="monotone" dataKey="irrf" name="IRRF mensal" stroke={color.red} strokeWidth={2} dot={{r:2}} connectNulls={false}/>
      </LineChart>
     </ResponsiveContainer></div>:<Empty label="Importe holerites mensais para acompanhar a evolução."/>}
    <div className="detail-hint"><Info size={16}/>{year==='all'?
     'Cada ponto é a soma das competências importadas naquele ano.' :
     'Cada ponto representa um mês. Lacunas ficam sem valores estimados.'} 13º e PPR são analisados separadamente, evitando dupla contagem.</div>
   </Panel>
  </div>

  <Panel title="Benefícios, descontos e remuneração variável">
   <div className="analytics-filter">
    <label htmlFor="analytics-metric-select">Indicador</label>
    <PayrepSelect id="analytics-metric-select" value={metric} onChange={next=>setMetric(next as MetricKey)} title="Indicador">
     {METRICS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
    </PayrepSelect>
   </div>
   <div className="analytics-indicator-summary"><span>Total identificado no período</span><strong>{valueOrDash(sumKnown(timeline,metric))}</strong></div>
   <p className="subtle analytics-description">{metricInfo.note}</p>
   {metricEvidence?
    <Bars data={metricBars}><Bar dataKey="value" name={metricInfo.label} fill={color.purple} maxBarSize={44} radius={[5,5,0,0]}/></Bars>
    :<Empty label={'Nenhum valor de '+metricInfo.label.toLowerCase()+' identificado nas folhas do período.'}/>}
   {metric==='meal'&&parameters.mealBenefit>0&&
    <div className="detail-hint"><Info size={16}/>Valor diário atualmente configurado: {brl(parameters.mealBenefit)}. Esse parâmetro não é usado para inventar créditos de meses anteriores.</div>}
   {metric==='espp'&&parameters.esppPercent>0&&
    <div className="detail-hint"><Info size={16}/>Percentual atualmente configurado: {parameters.esppPercent}%. É uma previsão, não histórico de compra efetivamente descontada.</div>}
   <div className="detail-hint"><Info size={16}/>Um traço (—) indica ausência de valor comprovado na rubrica, não valor zero. Todos os anos soma apenas os meses importados. Ao escolher um ano, o gráfico mostra janeiro a dezembro.</div>
  </Panel>

  <details className="analytics-advanced">
   <summary><ChevronDown size={18}/> Análises detalhadas: 13º, PPR, impostos, FGTS e férias</summary>
   <div className="stack">
  <Panel title={year==='all'?'Histórico anual dos indicadores':'Indicadores mensais de '+year}>
   <div className="table-scroll">
    <table><thead><tr>
     <th>{year==='all'?'Ano':'Mês'}</th><th>Folhas mensais</th>
     <th>Previdência privada</th><th>ESPP</th><th>Vale-refeição</th><th>Triênio</th>
     <th>INSS</th><th>Pensão</th><th>Horas extras</th>
    </tr></thead>
    <tbody>{timeline.map(x=><tr key={x.period}>
     <td><strong>{x.label}</strong></td><td>{x.monthlyStatements||'—'}</td>
     <td>{valueOrDash(x.privatePension)}</td><td>{valueOrDash(x.espp)}</td>
     <td>{valueOrDash(x.meal)}</td><td>{valueOrDash(x.trienio)}</td>
     <td>{valueOrDash(x.inss)}</td><td>{valueOrDash(x.pension)}</td>
     <td>{valueOrDash(x.overtime)}</td>
    </tr>)}</tbody></table>
   </div>
  </Panel>

  <VacationOverview ledger={vacationLedger} year={year}/>
  <ThirteenthOverview ledger={thirteenthLedger} year={year}/>

  <Panel title="13º salário: bruto x líquido, pensão, INSS e IRRF">
   {completeThirteenth.length?
    <Bars data={completeThirteenth}>
     <Bar dataKey="gross" name="13º bruto" fill={color.purple} barSize={28} radius={[5,5,0,0]}/>
     <Bar dataKey="net" name="13º líquido total (com adiantamento)" stackId="13o" fill={color.green} barSize={28}/>
     <Bar dataKey="pension" name="Pensão do 13º" stackId="13o" fill={color.orange} barSize={28}/>
     <Bar dataKey="inss" name="INSS do 13º" stackId="13o" fill={color.cyan} barSize={28}/>
     {completeThirteenth.some(x=>x.other>0.01)&&<Bar dataKey="other" name="Outros descontos (diferença)" stackId="13o" fill={color.gray} barSize={28}/>}
     <Bar dataKey="irrf" name="IRRF do 13º" stackId="13o" fill={color.red} barSize={28} radius={[5,5,0,0]}/>
    </Bars>
    :<Empty label="Nenhum recibo de 13º registrado para o período."/>}
   <div className="detail-hint"><Info size={16}/>A coluna à direita representa líquido total do 13º (fechamento + adiantamento), pensão, INSS e IRRF. Eventuais diferenças residuais aparecem como outros descontos, sem criar novo recebimento. O adiantamento não é somado novamente ao fluxo de caixa.</div>
  </Panel>

  <Panel title="PPR: bruto x líquido e IRRF">
   {completePpr.length?
    <Bars data={completePpr}>
     <Bar dataKey="gross" name="PPR bruto" fill={color.purple} barSize={28} radius={[5,5,0,0]}/>
     <Bar dataKey="net" name="PPR líquido" stackId="ppr" fill={color.green} barSize={28}/>
     <Bar dataKey="irrf" name="IRRF PPR" stackId="ppr" fill={color.red} barSize={28} radius={[5,5,0,0]}/>
    </Bars>
    :<Empty label="Nenhum holerite de PPR importado para o período."/>}
   <div className="detail-hint"><Info size={16}/>A eventual diferença entre as duas colunas corresponde a outras deduções do PPR, como contribuição negocial. O IRRF do PPR é exclusivo e não é somado ao IRRF mensal como se fosse salário.</div>
  </Panel>

  <Panel title={year==='all'?'IRRF retido por ano':'IRRF retido por mês em '+year}>
   {taxEvidence?<Bars data={taxBars}>
    <Bar dataKey="salary" stackId="irrf" name="IRRF mensal" fill={color.purple} maxBarSize={44} shape={roundedIrrfShape('salary')}/>
    <Bar dataKey="vacation" stackId="irrf" name="IRRF férias na folha" fill={color.orange} maxBarSize={44} shape={roundedIrrfShape('vacation')}/>
    <Bar dataKey="thirteenth" stackId="irrf" name="IRRF 13º" fill={color.red} maxBarSize={44} shape={roundedIrrfShape('thirteenth')}/>
    <Bar dataKey="ppr" stackId="irrf" name="IRRF PPR" fill={color.cyan} maxBarSize={44} shape={roundedIrrfShape('ppr')}/>
   </Bars>:<Empty label="Nenhum IRRF identificado nos documentos deste período."/>}
   <div className="detail-hint"><Info size={16}/>O gráfico consolida apenas retenções efetivamente identificadas: mensal, férias contabilizadas na folha, 13º e PPR. Não duplica impostos de recibos de férias quando já constam na folha mensal. Meses não importados permanecem sem informação.</div>
  </Panel>

  <Panel title={year==='all'?'FGTS registrado por ano':'FGTS de janeiro a dezembro de '+year}>
   {fgtsEvidence?<Bars data={fgtsBars}>
    <Bar dataKey="value" name="FGTS informado na folha" fill={color.purple} maxBarSize={44} radius={[5,5,0,0]}/>
   </Bars>:<Empty label="Nenhum valor de FGTS identificado nas folhas do período."/>}
   <div className="detail-hint"><Info size={16}/>O FGTS corresponde ao valor informado nos holerites mensais, não necessariamente ao saldo acumulado da conta FGTS. No filtro anual são exibidos os 12 meses, inclusive meses ainda sem holerite.</div>
  </Panel>
   </div>
  </details>
 </div>
}
