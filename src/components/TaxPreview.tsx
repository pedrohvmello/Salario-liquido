import {useEffect,useMemo,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {AlertTriangle,CheckCircle2,FileCheck2,Info,Save} from 'lucide-react'
import {brl} from '../lib/money'
import {
  summarizeTaxYear,calculatedOfficialValue,officialDifference,OFFICIAL_FIELDS,
  type OfficialValues,type TaxStatement
} from '../lib/annualTax'
import {db} from '../lib/data'

function blankValues():OfficialValues{return {}}
function numberOrNull(text:string):number|null{
 if(text.trim()==='')return null
 const n=Number(text.replace(',','.'))
 return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null
}
export function TaxPreview({userId,statements}:{userId:string|null;statements:TaxStatement[]}){
 const current=new Date().getFullYear()
 const years=useMemo(()=>[...new Set([current,...statements.map(x=>Number(x.payment_date?.slice(0,4)||x.period.slice(0,4)))])]
   .filter(x=>Number.isInteger(x)&&x>=2000&&x<=2100).sort((a,b)=>b-a),[statements,current])
 const [year,setYear]=useState(current)
 const [official,setOfficial]=useState<OfficialValues>(blankValues)
 const [loading,setLoading]=useState(false)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const summary=useMemo(()=>summarizeTaxYear(statements,year),[statements,year])
 useEffect(()=>{
  if(!db||!userId){setOfficial(blankValues());return}
  let active=true
  setLoading(true);setMessage('');setError('');setOfficial(blankValues())
  void db.from('annual_tax_comparisons').select('official_values')
   .eq('user_id',userId).eq('calendar_year',year).maybeSingle()
   .then(({data,error})=>{
    if(!active)return
    if(error)setError(error.message)
    else setOfficial((data?.official_values||{}) as OfficialValues)
    setLoading(false)
   })
  return ()=>{active=false}
 },[userId,year])
 async function save(){
  if(!db||!userId)return
  setSaving(true);setMessage('');setError('')
  const sanitized:OfficialValues={}
  for(const field of OFFICIAL_FIELDS){
   const v=official[field.key]
   if(v!==null&&v!==undefined&&Number.isFinite(v)&&v>=0)
     sanitized[field.key]=Math.round(v*100)/100
  }
  const {error}=await db.from('annual_tax_comparisons').upsert(
   {user_id:userId,calendar_year:year,official_values:sanitized,updated_at:new Date().toISOString()},
   {onConflict:'user_id,calendar_year'})
  setSaving(false)
  if(error)setError(error.message)
  else setMessage('Valores do informe oficial registrados para comparação.')
 }
 const hasOfficial=OFFICIAL_FIELDS.some(x=>official[x.key]!==undefined&&official[x.key]!==null)
 return <div className="stack">
  <div className="page-intro">
   <div><h2>Prévia do informe de rendimentos</h2>
    <p>Ano-calendário {year}, exercício {year+1}. Conferência assistida de holerites, não é informe oficial nem declaração pronta.</p>
   </div>
   <label className="year-filter">Ano-calendário
    <PayrepSelect value={year} onChange={next=>setYear(Number(next))} title="Ano-calendário">
     {years.map(x=><option key={x} value={x}>{x}</option>)}
    </PayrepSelect>
   </label>
  </div>
  <div className="notice subtle-notice"><Info size={18}/>
   O PPR/PLR e o 13º possuem tributação exclusiva na fonte, em quadros próprios. Seus IRRFs não são somados ao IRRF mensal. Cada documento é agrupado pelo <strong>ano do pagamento</strong>.
  </div>
  <div className="stats-grid">
   <div className="stat"><span className="subtle">PPR bruto identificado</span><strong>{summary.pprDocuments?brl(summary.pprGross):'Não identificado'}</strong><small>{summary.pprDocuments} documento(s) importado(s)</small></div>
   <div className="stat"><span className="subtle">IRRF exclusivo do PPR</span><strong>{summary.pprDocuments?brl(summary.pprIrrf):'Não identificado'}</strong><small>Retido na fonte, sem somar ao IRRF salarial</small></div>
   <div className="stat"><span className="subtle">PPR líquido pago</span><strong>{summary.pprDocuments?brl(summary.pprNet):'Não identificado'}</strong><small>Montante líquido do documento</small></div>
   <div className="stat"><span className="subtle">13º bruto comprovado</span><strong>{summary.thirteenthDocuments?brl(summary.thirteenthGross):'Não identificado'}</strong><small>{summary.thirteenthDocuments} recibo(s) anual(is)</small></div>
   <div className="stat"><span className="subtle">IRRF exclusivo do 13º</span><strong>{summary.thirteenthDocuments?brl(summary.thirteenthIrrf):'Não identificado'}</strong><small>Separado de salários e PPR</small></div>
   <div className="stat"><span className="subtle">Adiantamento do 13º descontado</span><strong>{summary.thirteenthDocuments?brl(summary.thirteenthAdvance):'Não identificado'}</strong><small>Não equivale a novo pagamento</small></div>
   <div className="stat"><span className="subtle">Holerites mensais</span><strong>{summary.monthlyDocuments}/12</strong><small>Competências identificadas, não cobertura fiscal certificada</small></div>
  </div>
  <section className="panel">
   <div className="panel-heading"><h2>Comparar com o informe fornecido pela empresa</h2>
    <span className="pill">Preenchimento manual do documento oficial</span></div>
   <p className="subtle">Informe os valores oficiais nos campos à direita. A diferença só é calculada quando os holerites fornecem um valor comparável. Os campos sem apuração permanecem em branco.</p>
   <div className="table-scroll"><table>
    <thead><tr><th>Campo</th><th>Apurado nos PDFs</th><th>Informe oficial (R$)</th><th>Diferença app − informe</th></tr></thead>
    <tbody>{OFFICIAL_FIELDS.map(field=>{
     const calculated=calculatedOfficialValue(summary,field.key)
     const reference=official[field.key]??null
     const delta=officialDifference(calculated,reference)
     return <tr key={field.key}>
      <td><strong>{field.title}</strong><div className="subtle">{field.unit}</div></td>
      <td>{calculated===null?<span className="subtle">Não apurado</span>:brl(calculated)}</td>
      <td><input className="tax-number" type="number" min="0" step="0.01"
       aria-label={'Valor oficial: '+field.title} value={reference??''}
       onChange={e=>setOfficial(v=>({...v,[field.key]:numberOrNull(e.target.value)}))}
       placeholder="Não informado" disabled={loading}/></td>
      <td>{delta===null?<span className="subtle">Sem comparação</span>:
       Math.abs(delta)<=0.01?<span className="ok">Coincide</span>:
       <span className="flag">{brl(delta)}</span>}</td>
     </tr>
    })}</tbody>
   </table></div>
   <div className="tax-actions"><button className="primary" disabled={!db||!userId||saving||loading}
     onClick={()=>{void save()}}><Save size={16}/>Salvar valores oficiais</button>
    {loading&&<span className="subtle">Buscando comparação salva...</span>}
    {hasOfficial&&<span className="subtle">Os valores informados ficam privados na sua conta.</span>}
   </div>
   {message&&<div role="status" className="notice success"><CheckCircle2 size={17}/>{message}</div>}
   {error&&<div role="alert" className="notice danger"><AlertTriangle size={17}/>{error}</div>}
  </section>
  <section className="panel">
   <div className="panel-heading"><h2>Cobertura e critérios de apuração</h2><FileCheck2 size={19}/></div>
   <div className="breakdown">
    <div className="break-row"><span>INSS do 13º comprovado</span><strong>{summary.thirteenthDocuments?brl(summary.thirteenthInss):'Não identificado'}</strong></div>
    <div className="break-row"><span>Pensão sobre 13º comprovada</span><strong>{summary.thirteenthDocuments?brl(summary.thirteenthPension):'Não identificado'}</strong></div>
    <div className="break-row"><span>Contribuição negocial PPR identificada</span><strong>{summary.pprDocuments?brl(summary.pprContribution):'Não identificada'}</strong></div>
    <div className="break-row"><span>Proventos de folhas mensais por competência (informativo, NÃO é base tributável)</span><strong>{summary.monthlyDocuments?brl(summary.monthlyGrossIndicative):'Não identificado'}</strong></div>
    <div className="break-row"><span>Líquidos de fechamento mensais identificados (informativo)</span><strong>{summary.monthlyDocuments?brl(summary.monthlyClosingNetIndicative):'Não identificado'}</strong></div>
   </div>
   {summary.notes.map((note,i)=><div className="detail-hint" key={i}><Info size={16}/>{note}</div>)}
   <div className="detail-hint"><AlertTriangle size={16}/>Rendimentos tributáveis mensais, IRRF salarial e demais deduções exigem classificação e conciliação por pagamento. O 13º bruto e seu IRRF são apurados apenas quando o recibo específico for importado; adiantamentos não são somados novamente. Não devem ser inferidos de proventos ou líquidos da folha.</div>
  </section>
 </div>
}
