import {useEffect,useMemo,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {Bar,BarChart,CartesianGrid,Legend,Line,LineChart,Pie,PieChart,Cell,Sector,Rectangle,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {FileText,Info,ChevronDown} from 'lucide-react'
import {brl,type SalaryParameters} from '../lib/money'
import {formatMoneyAxisTick} from '../lib/chartAxis'
import type {SavedStatement} from '../lib/data'
import type {StatementRubric,VacationLedger} from '../lib/vacation'
import type {ThirteenthLedger} from '../lib/thirteenthLedger'
import {loadConfirmedTaxFigures,type ConfirmedTaxFigure} from '../lib/incomeTaxReports'
import {annualFinancialRows,financialComposition,percentOfGross,financialColors,
 type ChartSegment,type CompositionOption} from '../lib/analyticsFinancial'
import {VacationOverview} from './VacationOverview'
import {ThirteenthOverview} from './ThirteenthOverview'
import {
 METRICS,payrollMetrics,timeMetrics,taxTimeSeries,thirteenthComparison,pprComparison,topIrrfStackSegment,
 type MetricKey,type TimeMetrics,type IrrfStackKey,type TaxTime
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
 userId,year,onYearChange,years,statements,lines,monthlyGraph,vacationLedger,thirteenthLedger,parameters
}:Props){
 const [metric,setMetric]=useState<MetricKey>('privatePension')
 const [visibleParts,setVisibleParts]=useState<Record<CompositionOption,boolean>>({
  trienio:false,espp:false,privatePension:false
 })
 const [hoveredSegment,setHoveredSegment]=useState<string|null>(null)
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
 const officialError=officialLoad.owner===userId?officialLoad.error:''
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
 const documentsCovered=composition.coveredMonths
 const legendGroups:readonly {title:string;segments:ChartSegment[]}[]=[
  {title:'Base da composição',segments:composition.gross===null?[]:[{
   key:'gross',name:'Proventos brutos',value:composition.gross,fill:financialColors.gross
  }]},
  {title:'Distribuição do bruto',segments:composition.inner},
  {title:'Síntese',segments:composition.outer},
  ...(composition.origin.length?[{title:'Origem dos proventos',segments:composition.origin}]:[])
 ]
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
    const current=entry as {key?:string;payload?:{key?:string}}
    setHoveredSegment(current.key??current.payload?.key??null)
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
     <div className="analytics-composition-chart" role="img"
      aria-label="Gráfico concêntrico com proventos brutos no centro, distribuição por descontos e líquido no anel interno e agrupamentos no anel externo">
      <ResponsiveContainer width="100%" height="100%">
       <PieChart>
        {showPie([{key:'gross',name:'Proventos brutos',value:composition.gross!,fill:financialColors.gross}],0,44)}
        {showPie(composition.inner,55,81)}
        {showPie(composition.outer,91,110)}
        {composition.origin.length>0&&showPie(composition.origin,118,130)}
        <Tooltip content={({active,payload})=>{
         if(!active||!payload?.length)return null
         const item=payload[0]
         return <div className="analytics-percent-tooltip">
          <strong>{item.name}</strong>
          <span>{percentOfGross(Number(item.value),composition.gross)} do bruto</span>
         </div>
        }}/>
        <text x="50%" y="46%" textAnchor="middle" fill="#fff" fontSize={12} fontWeight={750} pointerEvents="none">Bruto</text>
        <text x="50%" y="53%" textAnchor="middle" fill="#fff" fontSize={11} fontWeight={650} pointerEvents="none">100%</text>
       </PieChart>
      </ResponsiveContainer>
     </div>
     <div className="analytics-composition-legend" aria-label="Valores da composição dos proventos">
      {legendGroups.map(group=>group.segments.length>0&&
       <section className="analytics-composition-group" key={group.title}>
        <h3>{group.title}</h3>
        {group.segments.map(entry=><div
         className={'analytics-composition-row'+(hoveredSegment===entry.key?' is-highlighted':'')}
         key={entry.key}
         onMouseEnter={()=>setHoveredSegment(entry.key)}
         onMouseLeave={()=>setHoveredSegment(null)}>
         <span className="analytics-color-dot" style={{backgroundColor:entry.fill}}/>
         <span className="analytics-composition-label">{entry.name}</span>
         <strong className="analytics-composition-value">{valueOrDash(entry.value)}</strong>
        </div>)}
       </section>)}
     </div>
    </div>:<Empty label="A composição ainda não pode ser conciliada com os holerites disponíveis."/>}
    <div className="analytics-ring-options" aria-label="Detalhes opcionais da composição">
     <strong>Detalhar no gráfico</strong>
     {([
      ['trienio','Triênio'],
      ['espp','ESPP'],
      ['privatePension','Previdência']
     ] as const).map(([key,label])=><label key={key}>
      <input type="checkbox" checked={visibleParts[key]} disabled={composition.extras[key]===null}
       onChange={event=>setVisibleParts(prev=>({...prev,[key]:event.target.checked}))}/>
      {label}
     </label>)}
    </div>
    {visibleParts.trienio&&composition.origin.length>0&&<div className="analytics-origin-explanation">
     <Info size={15}/>Triênio aparece como origem dos proventos em um terceiro anel, sem somar novamente ao líquido ou aos descontos.
    </div>}
    {composition.warnings.map((warning,i)=><div className="detail-hint" key={i}><Info size={16}/>{warning}</div>)}
    {officialError&&<div className="detail-hint"><Info size={16}/>Os valores oficiais não puderam ser consultados. Exibindo somente dados dos holerites.</div>}
    <div className="detail-hint"><Info size={16}/>Os anéis representam os proventos brutos dos holerites e totalizadoras ({documentsCovered} folha(s) mensais identificadas). Passe o mouse para ver o percentual de cada parcela. Valores não identificados permanecem como ajustes, sem estimativas.</div>
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
    <div className="detail-hint"><Info size={16}/>{year==='all'
     ?'Proventos brutos incluem os créditos dos holerites e pagamentos complementares. Rendimentos tributáveis são apresentados somente em Informe IR. Para INSS e IRRF, valores confirmados no informe têm prioridade quando disponíveis.'
     :'As linhas representam competências mensais dos holerites. O Informe IR não distribui totais oficiais por mês, por isso não é usado para preencher lacunas mensais.'} 13º e PPR permanecem separados para evitar dupla contagem.</div>
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
