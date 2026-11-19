import {useEffect,useMemo,useRef,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {AlertTriangle,CheckCircle2,Download,Eye,FileCheck2,Info,Save,Trash2,X} from 'lucide-react'
import {brl} from '../lib/money'
import {
  summarizeTaxYear,calculatedOfficialValue,officialDifference,OFFICIAL_FIELDS,
  type OfficialValues,type TaxStatement
} from '../lib/annualTax'
import {db} from '../lib/data'
import {PayslipPdfViewer} from './PayslipPdfViewer'
import {loadMyEffectivePayrepPlan} from '../lib/account'
import {confirmIncomeTaxReport,deleteIncomeTaxReport,downloadIncomeTaxReport,loadIncomeTaxReport,loadIncomeTaxYears,uploadIncomeTaxReport,type IncomeTaxReport} from '../lib/incomeTaxReports'

function blankValues():OfficialValues{return {}}
function numberOrNull(text:string):number|null{
 if(text.trim()==='')return null
 const n=Number(text.replace(',','.'))
 return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null
}
export function TaxPreview({userId,statements}:{userId:string|null;statements:TaxStatement[]}){
 const current=new Date().getFullYear()
 const [reportYears,setReportYears]=useState<number[]>([])
 const [report,setReport]=useState<IncomeTaxReport|null>(null)
 const [canUpload,setCanUpload]=useState(false)
 const [reportBusy,setReportBusy]=useState(false)
 const [reportWarnings,setReportWarnings]=useState<string[]>([])
 const [fileToReplace,setFileToReplace]=useState<File|null>(null)
 const [deleteConfirm,setDeleteConfirm]=useState(false)
 const [approved,setApproved]=useState(false)
 const [viewer,setViewer]=useState<{blob:Blob;name:string}|null>(null)
 const fileRef=useRef<HTMLInputElement|null>(null)
 const years=useMemo(()=>[...new Set([
   ...Array.from({length:Math.max(1,current-1999)},(_,i)=>current-i),
   ...reportYears,...statements.map(x=>Number(x.payment_date?.slice(0,4)||x.period.slice(0,4)))
  ])].filter(x=>Number.isInteger(x)&&x>=1990&&x<=current).sort((a,b)=>b-a),[statements,current,reportYears])
 const [year,setYear]=useState(current)
 const [official,setOfficial]=useState<OfficialValues>(blankValues)
 const [loading,setLoading]=useState(false)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const summary=useMemo(()=>summarizeTaxYear(statements,year),[statements,year])
 useEffect(()=>{
  let active=true
  if(!db||!userId){setReport(null);setOfficial(blankValues());return}
  void Promise.all([loadIncomeTaxYears(),loadMyEffectivePayrepPlan()])
   .then(([years,plan])=>{
    if(!active)return
    setReportYears(years)
    setCanUpload(plan.isAdmin===true||plan.effectivePlan==='basic'||plan.effectivePlan==='full')
   })
   .catch(()=>{if(active)setCanUpload(false)})
  return ()=>{active=false}
 },[userId])
 useEffect(()=>{
  if(!db||!userId){setOfficial(blankValues());setReport(null);return}
  let active=true
  setLoading(true);setMessage('');setError('');setOfficial(blankValues());setReport(null)
  setReportWarnings([]);setApproved(false);setFileToReplace(null);setDeleteConfirm(false)
  void Promise.all([
   db.from('annual_tax_comparisons').select('official_values')
    .eq('user_id',userId).eq('calendar_year',year).maybeSingle(),
   loadIncomeTaxReport(year)
  ]).then(([manual,uploaded])=>{
   if(!active)return
   if(manual.error)throw manual.error
   setReport(uploaded)
   setOfficial(uploaded
    ?uploaded.confirmed_at?uploaded.reviewed_values:uploaded.extracted_values
    :(manual.data?.official_values||{}) as OfficialValues)
   setApproved(Boolean(uploaded?.confirmed_at))
  }).catch(e=>{
   if(active)setError(e instanceof Error?e.message:'Não foi possível carregar o informe do ano selecionado.')
  }).finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[userId,year])

 async function upload(file:File){
  if(!canUpload||reportBusy)return
  setReportBusy(true);setError('');setMessage('');setFileToReplace(null)
  try{
   const {report:stored,extraction,alreadyStored}=await uploadIncomeTaxReport(year,file)
   setReport(stored)
   setReportWarnings(extraction.warnings)
   setOfficial(stored.confirmed_at?stored.reviewed_values:stored.extracted_values)
   setApproved(Boolean(stored.confirmed_at))
   setReportYears(prev=>[...new Set([...prev,year])])
   setMessage(alreadyStored?'Este PDF já está armazenado para o ano.':
    'PDF armazenado com segurança. Confira os valores detectados e confirme antes de utilizá-los como oficiais.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o PDF.')}
  finally{setReportBusy(false);if(fileRef.current)fileRef.current.value=''}
 }
 async function openReport(download:boolean){
  if(!report||reportBusy)return
  setReportBusy(true);setError('')
  try{
   const blob=await downloadIncomeTaxReport(report)
   if(download){
    const url=URL.createObjectURL(blob)
    const anchor=document.createElement('a')
    anchor.href=url;anchor.download=report.original_filename||('Informe-IR-'+year+'.pdf')
    document.body.append(anchor);anchor.click();anchor.remove()
    window.setTimeout(()=>URL.revokeObjectURL(url),10000)
   }else setViewer({blob,name:report.original_filename})
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o informe.')}
  finally{setReportBusy(false)}
 }
 async function removeReport(){
  if(!report||reportBusy)return
  setReportBusy(true);setError('');setMessage('')
  try{
   await deleteIncomeTaxReport(report)
   setReport(null);setOfficial(blankValues());setApproved(false);setDeleteConfirm(false)
   setReportWarnings([])
   setMessage('Informe removido. Valores anteriores digitados manualmente não são considerados dados extraídos do PDF.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível remover o informe.')}
  finally{setReportBusy(false)}
 }

 async function save(){
  if(!db||!userId)return
  if(report&&!approved){setError('Marque que conferiu os valores com o PDF antes de confirmar.');return}
  setSaving(true);setMessage('');setError('')
  const sanitized:OfficialValues={}
  for(const field of OFFICIAL_FIELDS){
   const v=official[field.key]
   if(v!==null&&v!==undefined&&Number.isFinite(v)&&v>=0)
    sanitized[field.key]=Math.round(v*100)/100
  }
  try{
   if(report){
    const confirmed=await confirmIncomeTaxReport(report,sanitized)
    setReport(confirmed);setOfficial(confirmed.reviewed_values)
    setMessage('Valores conferidos e registrados como fonte oficial do informe de '+year+'.')
   }else{
    const {error}=await db.from('annual_tax_comparisons').upsert(
     {user_id:userId,calendar_year:year,official_values:sanitized,updated_at:new Date().toISOString()},
     {onConflict:'user_id,calendar_year'})
    if(error)throw error
    setMessage('Valores digitados manualmente registrados para comparação, sem PDF de origem.')
   }
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar os valores.')}
  finally{setSaving(false)}
 }

 const hasOfficial=OFFICIAL_FIELDS.some(x=>official[x.key]!==undefined&&official[x.key]!==null)
 const sourceConfirmed=Boolean(report?.confirmed_at)
 const real=(key:keyof OfficialValues):number|null=>{
  const value=sourceConfirmed?report?.reviewed_values?.[key]:null
  return typeof value==='number'&&Number.isFinite(value)?value:null
 }
 const preferred=(key:keyof OfficialValues,calculated:number|null):{amount:number|null;source:string}=>{
  const officialValue=real(key)
  if(officialValue!==null)return {amount:officialValue,source:'Informe oficial conferido'}
  if(sourceConfirmed)return {amount:calculated,source:calculated!==null?'Estimativa por holerites; ausente do informe':'Não informado no informe'}
  return {amount:calculated,source:calculated!==null?'Apurado nos holerites':'Não identificado'}
 }

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
   O PPR/PLR e o 13º têm tributação exclusiva em quadros próprios. Os holerites são agrupados pelo <strong>ano do pagamento</strong>. Para valores tributários anuais, um informe de rendimentos conferido tem prioridade sobre totais estimados dos holerites.
  </div>
  <section className="panel tax-report-panel" aria-labelledby="tax-report-heading">
   <div className="panel-heading"><h2 id="tax-report-heading"><FileCheck2 size={18}/> Informe de rendimentos da empresa</h2>
    <span className="pill">{report?(sourceConfirmed?'PDF conferido · fonte oficial':'PDF salvo · conferência pendente'):'Nenhum PDF neste ano'}</span>
   </div>
   <p className="subtle">Ano-calendário <strong>{year}</strong>, exercício <strong>{year+1}</strong>. PDF privado, acessível apenas à sua conta. Os valores do informe prevalecem após conferência; a simples importação não certifica o conteúdo.</p>
   {report?<div className="tax-report-file">
    <div><strong><FileCheck2 size={16}/>{report.original_filename}</strong>
     <small>Enviado em {new Date(report.created_at).toLocaleString('pt-BR')} · {Math.round(report.file_size_bytes/1024)} KB</small></div>
    <div className="row">
     <button className="secondary" type="button" disabled={reportBusy} onClick={()=>void openReport(false)}><Eye size={16}/> Ver PDF</button>
     <button className="secondary" type="button" disabled={reportBusy} onClick={()=>void openReport(true)}><Download size={16}/> Baixar</button>
     {canUpload&&<button className="secondary" type="button" disabled={reportBusy} onClick={()=>setDeleteConfirm(true)}><Trash2 size={16}/> Excluir</button>}
    </div>
   </div>:<p className="subtle">Você ainda não carregou um informe para este ano. Os dados dos holerites permanecem apenas como indicadores parciais.</p>}
   {canUpload&&<div className="tax-report-upload">
    <input ref={fileRef} type="file" accept=".pdf,application/pdf" aria-label="Selecionar informe de rendimentos em PDF"
     disabled={reportBusy||loading} onChange={event=>{
      const file=event.target.files?.[0]
      if(file){if(report)setFileToReplace(file);else void upload(file)}
      if(fileRef.current)fileRef.current.value=''
     }}/>
    <small>{report?'Selecione outro arquivo para substituir o informe deste ano.':'Selecione o PDF emitido pela empresa. Limite de 15 MB.'}</small>
   </div>}
   {!canUpload&&<p className="subtle">O carregamento de novos informes é exclusivo dos planos Basic e Full. Documentos anteriores continuam acessíveis.</p>}
   {fileToReplace&&<div className="tax-report-confirm">
    <p>Substituir o documento de {year}? Os valores anteriormente conferidos deixarão de ter validade até a nova conferência.</p>
    <div className="row"><button type="button" className="secondary" onClick={()=>setFileToReplace(null)}>Cancelar</button>
     <button type="button" className="primary" disabled={reportBusy} onClick={()=>{void upload(fileToReplace)}}>Confirmar substituição</button></div>
   </div>}
   {deleteConfirm&&<div className="tax-report-confirm">
    <p>Excluir o PDF de {year} e os valores confirmados vinculados a ele? A operação não apaga holerites.</p>
    <div className="row"><button type="button" className="secondary" onClick={()=>setDeleteConfirm(false)}>Cancelar</button>
     <button type="button" className="primary" disabled={reportBusy} onClick={()=>{void removeReport()}}>Excluir informe</button></div>
   </div>}
   {reportWarnings.map((note,i)=><div className="detail-hint" key={i}><Info size={16}/>{note}</div>)}
  </section>
  <div className="stats-grid">
   <div className="stat"><span className="subtle">Rendimentos tributáveis anuais</span><strong>{real('taxable_salary')!==null?brl(real('taxable_salary')!):'Não informado no informe'}</strong><small>{sourceConfirmed?'Informe oficial conferido':'Aguardando PDF conferido'}</small></div>
   <div className="stat"><span className="subtle">IRRF salarial anual</span><strong>{real('salary_irrf')!==null?brl(real('salary_irrf')!):'Não informado no informe'}</strong><small>{sourceConfirmed?'Informe oficial conferido':'Aguardando PDF conferido'}</small></div>
   <div className="stat"><span className="subtle">PPR/PLR bruto</span><strong>{preferred('ppr_gross',summary.pprDocuments?summary.pprGross:null).amount!==null?brl(preferred('ppr_gross',summary.pprDocuments?summary.pprGross:null).amount!):'Não identificado'}</strong><small>{preferred('ppr_gross',summary.pprDocuments?summary.pprGross:null).source}</small></div>
   <div className="stat"><span className="subtle">IRRF exclusivo do PPR</span><strong>{preferred('ppr_irrf',summary.pprDocuments?summary.pprIrrf:null).amount!==null?brl(preferred('ppr_irrf',summary.pprDocuments?summary.pprIrrf:null).amount!):'Não identificado'}</strong><small>{preferred('ppr_irrf',summary.pprDocuments?summary.pprIrrf:null).source}</small></div>
   <div className="stat"><span className="subtle">13º salário bruto</span><strong>{preferred('thirteenth',summary.thirteenthDocuments?summary.thirteenthGross:null).amount!==null?brl(preferred('thirteenth',summary.thirteenthDocuments?summary.thirteenthGross:null).amount!):'Não identificado'}</strong><small>{preferred('thirteenth',summary.thirteenthDocuments?summary.thirteenthGross:null).source}</small></div>
   <div className="stat"><span className="subtle">IRRF exclusivo do 13º</span><strong>{preferred('thirteenth_irrf',summary.thirteenthDocuments?summary.thirteenthIrrf:null).amount!==null?brl(preferred('thirteenth_irrf',summary.thirteenthDocuments?summary.thirteenthIrrf:null).amount!):'Não identificado'}</strong><small>{preferred('thirteenth_irrf',summary.thirteenthDocuments?summary.thirteenthIrrf:null).source}</small></div>
   <div className="stat"><span className="subtle">Holerites mensais disponíveis</span><strong>{summary.monthlyDocuments}/12</strong><small>Cobertura parcial para comparação</small></div>
  </div>
  <section className="panel">
   <div className="panel-heading"><h2>Comparar com o informe fornecido pela empresa</h2>
    <span className="pill">{report?sourceConfirmed?'Valores oficiais conferidos':'Conferência do PDF pendente':'Valores digitados manualmente'}</span></div>
   <p className="subtle">{report?'Confira cada valor com o documento da empresa. Os campos extraídos automaticamente são sugestões até você confirmar.':'Informe valores manualmente para comparação ou carregue o PDF da empresa.'} A diferença só é calculada quando há dado comparável nos holerites; campos ausentes não são estimados.</p>
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
       onChange={e=>{setOfficial(v=>({...v,[field.key]:numberOrNull(e.target.value)}));if(report)setApproved(false)}}
       placeholder="Não informado" disabled={loading}/></td>
      <td>{delta===null?<span className="subtle">Sem comparação</span>:
       Math.abs(delta)<=0.01?<span className="ok">Coincide</span>:
       <span className="flag">{brl(delta)}</span>}</td>
     </tr>
    })}</tbody>
   </table></div>
   {report&&<label className="tax-report-approval">
    <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} disabled={loading||reportBusy}/>
    Conferi os valores com o PDF da empresa e confirmo sua utilização como fonte oficial para {year}.
   </label>}
   <div className="tax-actions"><button className="primary" disabled={!db||!userId||saving||loading||Boolean(report&&(!canUpload||!approved))}
     onClick={()=>{void save()}}><Save size={16}/>{report?'Confirmar valores do informe':'Salvar valores para comparação'}</button>
    {loading&&<span className="subtle">Buscando comparação salva...</span>}
    {hasOfficial&&<span className="subtle">Os valores ficam privados na sua conta. {report&&!sourceConfirmed?'Ainda não são considerados confirmados.':''}</span>}
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
  {viewer&&<div className="payslip-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setViewer(null)}}>
   <section className="payslip-viewer-dialog" role="dialog" aria-modal="true" aria-label="Informe de rendimentos">
    <div className="payslip-dialog-heading"><strong>Informe IR {year} · {viewer.name}</strong>
     <button type="button" className="secondary" onClick={()=>setViewer(null)} aria-label="Fechar PDF"><X size={18}/></button></div>
    <PayslipPdfViewer blob={viewer.blob} filename={viewer.name} initialPage={1}/>
   </section>
  </div>}
 </div>
}
