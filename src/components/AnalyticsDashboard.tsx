import {useMemo,useState} from 'react'
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Legend,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {FileText,Info} from 'lucide-react'
import {brl,type SalaryParameters} from '../lib/money'
import {formatMoneyAxisTick} from '../lib/chartAxis'
import type {SavedStatement} from '../lib/data'
import type {StatementRubric,VacationLedger} from '../lib/vacation'
import type {ThirteenthLedger} from '../lib/thirteenthLedger'
import {VacationOverview} from './VacationOverview'
import {ThirteenthOverview} from './ThirteenthOverview'
import {
 METRICS,payrollMetrics,timeMetrics,taxTimeSeries,thirteenthComparison,pprComparison,
 type MetricKey,type TimeMetrics
} from '../lib/analytics'

type SalaryGraphRow={period:string;bruto:number;liquido:number|null;ferias:number;fgts:number}
type Props={
 year:string;onYearChange:(value:string)=>void;years:string[];
 statements:SavedStatement[];lines:StatementRubric[];
 monthlyGraph:SalaryGraphRow[];vacationLedger:VacationLedger;thirteenthLedger:ThirteenthLedger;
 parameters:SalaryParameters
}
const color={blue:'#2b78e4',green:'#0f9c86',orange:'#e49a42',red:'#e35755',
 indigo:'#7865d9',lightBlue:'#75abc9',gray:'#8492a5'}
const fmt=(value:unknown)=>brl(Number(value??0))
function Panel({title,children}:{title:string;children:React.ReactNode}){
 return <section className="panel"><div className="panel-heading"><h2>{title}</h2></div>{children}</section>
}
function Empty({label}:{label:string}){
 return <div className="empty"><FileText size={27}/><p>{label}</p></div>
}
function Summary({name,value,note}:{name:string;value:string;note:string}){
 return <div className="stat"><span className="subtle">{name}</span><strong>{value}</strong><small>{note}</small></div>
}
function Bars({data,children}:{data:Array<Record<string,string|number|null>>;children:React.ReactNode}){
 return <div className="chart"><ResponsiveContainer width="100%" height="100%">
  <BarChart data={data} barCategoryGap="24%" barGap={5} margin={{top:12,right:10,left:2,bottom:4}}>
   <CartesianGrid stroke="#e9edf2" vertical={false}/>
   <XAxis dataKey="label" tick={{fontSize:11}}/>
   <YAxis width={76} tick={{fontSize:11}} tickMargin={8} tickFormatter={formatMoneyAxisTick}/>
   <Tooltip formatter={fmt}/><Legend/>{children}
  </BarChart>
 </ResponsiveContainer></div>
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
 const selectedPeriod=year==='all'?'nos holerites importados':'em '+year
 const metricBars=timeline.map(x=>({label:x.label,value:x[metric]}))
 const fgtsBars=timeline.map(x=>({label:x.label,value:x.fgts}))
 const taxBars=tax.map(x=>({label:x.label,
  salary:x.salary,vacation:x.vacation,thirteenth:x.thirteenth,ppr:x.ppr}))
 const completeThirteenth=thirteenth.map(x=>({
  label:x.label,gross:x.gross,net:x.net,pension:x.pension??0,irrf:x.irrf
 }))
 const completePpr=ppr.map(x=>({label:x.label,gross:x.gross,net:x.net,irrf:x.irrf}))
 return <div className="stack">
  <div className="page-intro">
   <div><h2>Análises financeiras</h2>
    <p>Histórico de valores identificados nos holerites. 13º, férias e PPR permanecem separados para evitar dupla contabilização.</p>
   </div>
   <select value={year} onChange={e=>onYearChange(e.target.value)} aria-label="Filtrar ano">
    <option value="all">Todos os anos</option>
    {years.map(y=><option key={y} value={y}>{y}</option>)}
   </select>
  </div>

  <Panel title="Remuneração mensal e líquido registrado (sem PPR e 13º)">
   {monthlyGraph.length?<div className="chart"><ResponsiveContainer width="100%" height="100%">
    <AreaChart data={monthlyGraph}>
     <CartesianGrid stroke="#e9edf2" vertical={false}/>
     <XAxis dataKey="period" tick={{fontSize:11}}/>
     <YAxis width={76} tick={{fontSize:11}} tickMargin={8} tickFormatter={formatMoneyAxisTick}/>
     <Tooltip formatter={fmt}/><Legend/>
     <Area dataKey="bruto" name="Proventos da folha mensal" stroke={color.blue} fill="#c5ddfd" fillOpacity={.65}/>
     <Area dataKey="liquido" name="Líquido financeiro mensal" stroke={color.green} fill="#c3eade" fillOpacity={.5}/>
     <Area dataKey="ferias" name="Férias antecipadas incluídas no líquido" stroke={color.orange} fill="#f9d9ac" fillOpacity={.15}/>
    </AreaChart>
   </ResponsiveContainer></div>:<Empty label="Importe holerites mensais para acompanhar a evolução."/>}
  </Panel>

  <Panel title="Benefícios, descontos e remuneração variável">
   <div className="stats-grid analytics-overview">
    <Summary name="Previdência privada" value={valueOrDash(sumKnown(timeline,'privatePension'))} note={'Contribuições identificadas '+selectedPeriod}/>
    <Summary name="ESPP" value={valueOrDash(sumKnown(timeline,'espp'))} note={'Descontos identificados '+selectedPeriod}/>
    <Summary name="Vale-refeição" value={valueOrDash(sumKnown(timeline,'meal'))} note={'Créditos identificados '+selectedPeriod}/>
    <Summary name="Triênio" value={valueOrDash(sumKnown(timeline,'trienio'))} note={'Total de rubricas regulares '+selectedPeriod}/>
   </div>
   <div className="analytics-filter">
    <label htmlFor="analytics-metric-select">Indicador</label>
    <select id="analytics-metric-select" value={metric} onChange={e=>setMetric(e.target.value as MetricKey)}>
     {METRICS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
    </select>
   </div>
   <p className="subtle analytics-description">{metricInfo.note}</p>
   {metricEvidence?
    <Bars data={metricBars}><Bar dataKey="value" name={metricInfo.label} fill={color.blue} maxBarSize={44} radius={[5,5,0,0]}/></Bars>
    :<Empty label={'Nenhum valor de '+metricInfo.label.toLowerCase()+' identificado nas folhas do período.'}/>}
   {metric==='meal'&&parameters.mealBenefit>0&&
    <div className="detail-hint"><Info size={16}/>Valor diário atualmente configurado: {brl(parameters.mealBenefit)}. Esse parâmetro não é usado para inventar créditos de meses anteriores.</div>}
   {metric==='espp'&&parameters.esppPercent>0&&
    <div className="detail-hint"><Info size={16}/>Percentual atualmente configurado: {parameters.esppPercent}%. É uma previsão, não histórico de compra efetivamente descontada.</div>}
   <div className="detail-hint"><Info size={16}/>Um traço (—) indica ausência de valor comprovado na rubrica, não valor zero. Todos os anos soma apenas os meses importados. Ao escolher um ano, o gráfico mostra janeiro a dezembro.</div>
  </Panel>

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

  <Panel title="13º salário: bruto x composição do líquido, pensão e IRRF">
   {completeThirteenth.length?
    <Bars data={completeThirteenth}>
     <Bar dataKey="gross" name="13º bruto" fill={color.blue} barSize={28} radius={[5,5,0,0]}/>
     <Bar dataKey="net" name="13º líquido total (com adiantamento)" stackId="13o" fill={color.green} barSize={28}/>
     <Bar dataKey="pension" name="Pensão do 13º" stackId="13o" fill={color.orange} barSize={28}/>
     <Bar dataKey="irrf" name="IRRF do 13º" stackId="13o" fill={color.red} barSize={28} radius={[5,5,0,0]}/>
    </Bars>
    :<Empty label="Nenhum recibo de 13º registrado para o período."/>}
   <div className="detail-hint"><Info size={16}/>A coluna à direita representa líquido total do 13º (fechamento + adiantamento), pensão e IRRF. A diferença para o bruto corresponde ao INSS e a eventuais outras rubricas não incluídas na pilha. O adiantamento não é somado de novo ao fluxo de caixa.</div>
  </Panel>

  <Panel title="PPR: bruto x líquido e IRRF">
   {completePpr.length?
    <Bars data={completePpr}>
     <Bar dataKey="gross" name="PPR bruto" fill={color.blue} barSize={28} radius={[5,5,0,0]}/>
     <Bar dataKey="net" name="PPR líquido" stackId="ppr" fill={color.green} barSize={28}/>
     <Bar dataKey="irrf" name="IRRF PPR" stackId="ppr" fill={color.red} barSize={28} radius={[5,5,0,0]}/>
    </Bars>
    :<Empty label="Nenhum holerite de PPR importado para o período."/>}
   <div className="detail-hint"><Info size={16}/>A eventual diferença entre as duas colunas corresponde a outras deduções do PPR, como contribuição negocial. O IRRF do PPR é exclusivo e não é somado ao IRRF mensal como se fosse salário.</div>
  </Panel>

  <Panel title={year==='all'?'IRRF retido por ano':'IRRF retido por mês em '+year}>
   {taxEvidence?<Bars data={taxBars}>
    <Bar dataKey="salary" stackId="irrf" name="IRRF mensal" fill={color.blue} maxBarSize={44}/>
    <Bar dataKey="vacation" stackId="irrf" name="IRRF férias na folha" fill={color.orange} maxBarSize={44}/>
    <Bar dataKey="thirteenth" stackId="irrf" name="IRRF 13º" fill={color.red} maxBarSize={44}/>
    <Bar dataKey="ppr" stackId="irrf" name="IRRF PPR" fill={color.indigo} maxBarSize={44}/>
   </Bars>:<Empty label="Nenhum IRRF identificado nos documentos deste período."/>}
   <div className="detail-hint"><Info size={16}/>O gráfico consolida apenas retenções efetivamente identificadas: mensal, férias contabilizadas na folha, 13º e PPR. Não duplica impostos de recibos de férias quando já constam na folha mensal. Meses não importados permanecem sem informação.</div>
  </Panel>

  <Panel title={year==='all'?'FGTS registrado por ano':'FGTS de janeiro a dezembro de '+year}>
   {fgtsEvidence?<Bars data={fgtsBars}>
    <Bar dataKey="value" name="FGTS informado na folha" fill={color.blue} maxBarSize={44} radius={[5,5,0,0]}/>
   </Bars>:<Empty label="Nenhum valor de FGTS identificado nas folhas do período."/>}
   <div className="detail-hint"><Info size={16}/>O FGTS corresponde ao valor informado nos holerites mensais, não necessariamente ao saldo acumulado da conta FGTS. No filtro anual são exibidos os 12 meses, inclusive meses ainda sem holerite.</div>
  </Panel>
 </div>
}
