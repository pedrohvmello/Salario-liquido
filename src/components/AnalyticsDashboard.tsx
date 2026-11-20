import {useEffect,useMemo,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {FinancialInsights} from './FinancialInsights'
import {CartesianGrid,Legend,Line,LineChart,Pie,PieChart,Cell,Sector,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {FileText,Info} from 'lucide-react'
import {brl,type SalaryParameters} from '../lib/money'
import {formatMoneyAxisTick} from '../lib/chartAxis'
import type {SavedStatement} from '../lib/data'
import type {StatementRubric,VacationLedger} from '../lib/vacation'
import type {ThirteenthLedger} from '../lib/thirteenthLedger'
import {loadConfirmedTaxFigures,type ConfirmedTaxFigure} from '../lib/incomeTaxReports'
import {annualFinancialRows,financialComposition,percentOfGross,financialColors,
 type ChartSegment,type CompositionOption} from '../lib/analyticsFinancial'
import {
 INDICATORS,indicatorValue,payrollMetrics,timeMetrics,
 type IndicatorKey,type TimeMetrics
} from '../lib/analytics'

type SalaryGraphRow={period:string;bruto:number|null;liquido:number|null;ferias:number}
type Props={
 userId:string|null;year:string;onYearChange:(value:string)=>void;years:string[];
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
function IndicatorTrend({data,label}:{data:{label:string;value:number|null}[];label:string}){
 return <div className="chart"><ResponsiveContainer width="100%" height="100%">
  <LineChart data={data} margin={{top:12,right:18,left:4,bottom:6}}>
   <CartesianGrid stroke="#eee3fa" vertical={false}/>
   <XAxis dataKey="label" tick={{fontSize:11}}/>
   <YAxis width={76} tick={{fontSize:11}} tickMargin={8} tickFormatter={formatMoneyAxisTick}/>
   <Tooltip formatter={fmt} wrapperStyle={{pointerEvents:"none"}}/>
   <Line type="monotone" dataKey="value" name={label} stroke={color.purple}
    strokeWidth={2.5} dot={{r:4}} activeDot={{r:6}} connectNulls={false}/>
  </LineChart>
 </ResponsiveContainer></div>
}
function sumKnown(rows:TimeMetrics[],key:IndicatorKey):number|null {
 const values=rows.map(r=>indicatorValue(r,key)).filter((v):v is number=>v!==null)
 return values.length?Math.round(values.reduce((n,v)=>n+v,0)*100)/100:null
}
function valueOrDash(value:number|null){return value===null?'—':brl(value)}
export function AnalyticsDashboard({
 userId,year,onYearChange,years,statements,lines,monthlyGraph,parameters
}:Props){
 const [metric,setMetric]=useState<IndicatorKey>('privatePension')
 const [visibleParts,setVisibleParts]=useState<Record<CompositionOption,boolean>>({
  espp:false,privatePension:false
 })
 const [hoveredSegment,setHoveredSegment]=useState<string|null>(null)
 const [hoverPosition,setHoverPosition]=useState<'top'|'bottom'>('bottom')
 const [officialLoad,setOfficialLoad]=useState<{owner:string|null;reports:ConfirmedTaxFigure[];error:string}>({
  owner:null,reports:[],error:''
 })
 useEffect(()=>{
  if(!userId){setOfficialLoad({owner:null,reports:[],error:''});return}
  let active=true
  void loadConfirmedTaxFigures()
   .then(reports=>{if(active)setOfficialLoad({owner:userId,reports,error:''})})
   .catch(err=>{if(active)setOfficialLoad({owner:userId,reports:[],error:err instanceof Error?err.message:'Informe IR indisponível.'})})
  return ()=>{active=false}
 },[userId])
 const confirmed=officialLoad.owner===userId?officialLoad.reports:[]
 const evidence=useMemo(()=>payrollMetrics(statements,lines),[statements,lines])
 const timeline=useMemo(()=>timeMetrics(evidence,year),[evidence,year])
 const metricInfo=INDICATORS.find(x=>x.key===metric)!
 const metricEvidence=timeline.some(x=>indicatorValue(x,metric)!==null)
 const metricTrend=timeline.map(x=>({label:x.label,value:indicatorValue(x,metric)}))
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
 const allYearMetrics=useMemo(()=>timeMetrics(evidence,'all'),[evidence])
 const annualRows=useMemo(()=>annualFinancialRows(monthlyGraph,allYearMetrics,confirmed,year),
  [monthlyGraph,allYearMetrics,confirmed,year])
 const composition=useMemo(()=>financialComposition(annualRows,visibleParts),[annualRows,visibleParts])
 const hasComposition=composition.gross!==null&&composition.inner.length>0
 const evolutionRows=year==='all'
  ?annualRows.map(row=>({
    label:row.year,bruto:row.payrollGross,
    liquido:row.net,inss:row.inss,irrf:row.irrf,
    monthlyStatements:row.months
   }))
  :comparisonRows
 const legendGroups:readonly {title:string;segments:ChartSegment[]}[]=[
  {title:'Base da composição',segments:composition.gross===null?[]:[{
   key:'gross',name:'Proventos brutos',value:composition.gross,fill:financialColors.gross
  }]},
  {title:'Distribuição do bruto',segments:composition.inner},
  {title:'Síntese',segments:composition.outer}
 ]
 const allHoverSegments=legendGroups.flatMap(group=>group.segments)
 const hoveredInfo=hoveredSegment?allHoverSegments.find(item=>item.key===hoveredSegment):undefined
 const highlight=(key:string)=>hoveredSegment===null||hoveredSegment===key
 const activeSector=(props:unknown)=>{
  const shape=props as React.ComponentProps<typeof Sector>
  const radius=Number(shape.outerRadius??0)
  return <Sector {...shape} outerRadius={radius+5} stroke="#fff" strokeWidth={2}/>
 }
 const showPie=(segments:ChartSegment[],innerRadius:number,outerRadius:number)=>(
  <Pie key={innerRadius} data={segments} dataKey="value" nameKey="name"
   cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={1}
   activeIndex={segments.findIndex(p=>p.key===hoveredSegment)} activeShape={activeSector}
   onMouseEnter={(entry)=>{
    const current=entry as {key?:string;midAngle?:number;payload?:{key?:string}}
    setHoveredSegment(current.key??current.payload?.key??null)
    if(typeof current.midAngle==='number'){
     setHoverPosition(Math.sin(current.midAngle*Math.PI/180)>0?'top':'bottom')
    }else setHoverPosition('bottom')
   }}
   onMouseLeave={()=>setHoveredSegment(null)} stroke="none">
   {segments.map(part=><Cell key={part.key} fill={part.fill}
    style={{opacity:highlight(part.key)?1:0.42,transition:'opacity 120ms ease',cursor:'pointer'}}/>)}
  </Pie>
 )

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
   <Panel title="Composição dos proventos">
    {hasComposition?<div className="analytics-composition-layout">
     <div className="analytics-composition-visual">
      <div className="analytics-composition-chart" aria-label="Composição dos proventos em anéis">
       <ResponsiveContainer width="100%" height="100%">
        <PieChart>
         {showPie([{key:'gross',name:'Proventos brutos',value:composition.gross!,fill:financialColors.gross}],0,44)}
         {showPie(composition.inner,55,81)}
         {showPie(composition.outer,91,110)}
        </PieChart>
       </ResponsiveContainer>
       {hoveredInfo&&<div className={'analytics-ring-tooltip is-'+hoverPosition} role="status" aria-live="off">
        <strong>{hoveredInfo.name}</strong>
        <span>{percentOfGross(hoveredInfo.value,composition.gross)} dos proventos brutos</span>
       </div>}
      </div>
      <div className="analytics-ring-options" aria-label="Detalhes opcionais da composição">
       <strong>Detalhar no gráfico</strong>
       {([
        ['espp','ESPP'],
        ['privatePension','Previdência']
       ] as const).map(([key,label])=><label key={key}>
        <input type="checkbox" checked={visibleParts[key]}
         disabled={composition.extras[key]===null||composition.extras[key]===0||(composition.netAndInvestments??0)<=0}
         onChange={event=>setVisibleParts(prev=>({...prev,[key]:event.target.checked}))}/>
        {label}
       </label>)}
      </div>
     </div>
     <div className="analytics-composition-legend" aria-label="Valores da composição dos proventos">
      {legendGroups.map(group=>group.segments.length>0&&
       <section className="analytics-composition-group" key={group.title}>
        <h3>{group.title}</h3>
        {group.segments.map(entry=><div
         className={'analytics-composition-row'+(hoveredSegment===entry.key?' is-highlighted':'')}
         key={entry.key}
         onMouseEnter={()=>{setHoveredSegment(entry.key);setHoverPosition('bottom')}}
         onMouseLeave={()=>setHoveredSegment(null)}>
         <span className="analytics-color-dot" style={{backgroundColor:entry.fill}}/>
         <span className="analytics-composition-label">{entry.name}</span>
         <strong className="analytics-composition-value">{valueOrDash(entry.value)}</strong>
        </div>)}
       </section>)}

     </div>
    </div>:<Empty label="A composição ainda não pode ser conciliada com os holerites disponíveis."/>}
    {composition.unclassified!==null&&composition.unclassified>0.01&&
     <details className="analytics-remainder-explanation">
      <summary>O que é o saldo não classificado? <strong>{brl(composition.unclassified)}</strong></summary>
      <p>É uma diferença de conciliação, não um desconto identificado. O Payrep calcula o saldo subtraindo do bruto os valores de líquido e aplicações, pensão, IRRF e INSS. Pode envolver rubricas ainda não categorizadas, adiantamentos ou ajustes entre folhas. Não equivale automaticamente a uma despesa.</p>
     </details>}

   </Panel>
   <Panel title={year==='all'?'Evolução anual da remuneração':'Evolução mensal da remuneração'}>
    {evolutionRows.some(row=>row.bruto!==null||row.liquido!==null)?
     <div className="chart analytics-evolution-chart"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={evolutionRows} margin={{top:12,right:8,left:0,bottom:5}}>
       <CartesianGrid stroke="#eee3fa" vertical={false}/>
       <XAxis dataKey="label" tick={{fontSize:11}}/>
       <YAxis width={77} tick={{fontSize:11}} tickFormatter={formatMoneyAxisTick}/>
       <Tooltip formatter={fmt} wrapperStyle={{pointerEvents:"none"}}/>
       <Legend wrapperStyle={{fontSize:11}}/>
       <Line type="monotone" dataKey="bruto" name="Proventos brutos" stroke={color.purple}
        strokeWidth={2.4} dot={{r:3}} connectNulls={false}/>
       <Line type="monotone" dataKey="liquido" name="Líquido recebido" stroke={color.green}
        strokeWidth={2.4} dot={{r:3}} connectNulls={false}/>
       <Line type="monotone" dataKey="inss" name="INSS"
        stroke={color.blue} strokeWidth={2} dot={{r:2}} connectNulls={false}/>
       <Line type="monotone" dataKey="irrf" name="IRRF"
        stroke={color.red} strokeWidth={2} dot={{r:2}} connectNulls={false}/>
      </LineChart>
     </ResponsiveContainer></div>:<Empty label="Importe holerites para acompanhar os rendimentos."/>}

   </Panel>
  </div>

  <Panel title="Benefícios, descontos e remuneração variável">
   <div className="analytics-indicator-header">
    <div className="analytics-filter">
     <label htmlFor="analytics-metric-select">Indicador</label>
     <PayrepSelect id="analytics-metric-select" value={metric} onChange={next=>setMetric(next as IndicatorKey)} title="Indicador">
      {INDICATORS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
     </PayrepSelect>
    </div>
    <div className="analytics-indicator-summary">
     <span>Total identificado no período</span>
     <strong>{valueOrDash(sumKnown(timeline,metric))}</strong>
    </div>
   </div>
   <p className="subtle analytics-description">{metricInfo.note}</p>
   {metricEvidence?
    <IndicatorTrend data={metricTrend} label={metricInfo.label}/>
    :<Empty label={'Nenhum valor de '+metricInfo.label.toLowerCase()+' identificado nas folhas do período.'}/>}
   {metric==='meal'&&parameters.mealBenefit>0&&
    <div className="detail-hint"><Info size={16}/>Valor diário atualmente configurado: {brl(parameters.mealBenefit)}. Esse parâmetro não é usado para inventar créditos de meses anteriores.</div>}
   {metric==='espp'&&parameters.esppPercent>0&&
    <div className="detail-hint"><Info size={16}/>Percentual atualmente configurado: {parameters.esppPercent}%. É uma previsão, não histórico de compra efetivamente descontada.</div>}
  </Panel>
  <FinancialInsights year={year} statements={statements} lines={lines}
   vacationLedger={vacationLedger} metrics={evidence} reports={confirmed}/>



 </div>
}
