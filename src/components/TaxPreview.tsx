import {useEffect,useMemo,useRef,useState} from 'react'
import {AlertTriangle,CheckCircle2,Download,Eye,FileCheck2,FileUp,Info,Save,ShieldCheck,Trash2,X} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {PayslipPdfViewer} from './PayslipPdfViewer'
import {brl} from '../lib/money'
import {db} from '../lib/data'
import {loadMyEffectivePayrepPlan} from '../lib/account'
import {
 summarizeTaxYear,calculatedOfficialValue,officialDifference,OFFICIAL_FIELDS,
 type OfficialField,type OfficialValues,type TaxStatement
} from '../lib/annualTax'
import {extractIncomeTaxPdf,type ExtractedTaxReport} from '../lib/incomeTaxPdf'
import {
 confirmIncomeTaxReport,deleteIncomeTaxReport,downloadIncomeTaxReport,
 loadIncomeTaxReport,loadIncomeTaxYears,uploadIncomeTaxReport,type IncomeTaxReport
} from '../lib/incomeTaxReports'

const taxableFields:readonly OfficialField[]=[
 'taxable_salary','inss','private_pension','alimony','salary_irrf'
]
const exclusiveFields:readonly OfficialField[]=[
 'thirteenth','thirteenth_irrf','ppr_gross','ppr_irrf'
]
const moneyLabel=(key:OfficialField)=>OFFICIAL_FIELDS.find(field=>field.key===key)?.title||key
const parseAmount=(raw:string):number|null=>{
 const value=raw.trim().replace(/\s/g,'').replace(/R\$/ig,'')
 if(!value)return null
 const normalized=value.includes(',')?value.replace(/\./g,'').replace(',','.'):value
 const number=Number(normalized)
 return Number.isFinite(number)&&number>=0&&number<=1e9?Math.round(number*100)/100:null
}
const formatAmount=(value:number|null|undefined)=>
 typeof value==='number'?value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):''
const draftsFrom=(values:OfficialValues):Record<string,string>=>Object.fromEntries(
 OFFICIAL_FIELDS.map(field=>[field.key,formatAmount(values[field.key])])
)
type PendingImport={
 file:File;analysis:ExtractedTaxReport;year:number|null;existing:IncomeTaxReport|null
}

export function TaxPreview({userId,statements}:{userId:string|null;statements:TaxStatement[]}){
 const today=new Date().getFullYear()
 const defaultYear=Math.max(1990,today-1)
 const [year,setYear]=useState(defaultYear)
 const [reportYears,setReportYears]=useState<number[]>([])
 const [report,setReport]=useState<IncomeTaxReport|null>(null)
 const [canUpload,setCanUpload]=useState(false)
 const [loading,setLoading]=useState(false)
 const [busy,setBusy]=useState(false)
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const [warnings,setWarnings]=useState<string[]>([])
 const [drafts,setDrafts]=useState<Record<string,string>>({})
 const [confirmedByUser,setConfirmedByUser]=useState(false)
 const [pending,setPending]=useState<PendingImport|null>(null)
 const [manualYear,setManualYear]=useState(defaultYear)
 const [deleteConfirm,setDeleteConfirm]=useState(false)
 const [viewer,setViewer]=useState<{blob:Blob;name:string}|null>(null)
 const [legacyCount,setLegacyCount]=useState(0)
 const fileRef=useRef<HTMLInputElement|null>(null)
 const summary=useMemo(()=>summarizeTaxYear(statements,year),[statements,year])
 const sourceConfirmed=Boolean(report?.confirmed_at)
 const viewingYears=useMemo(()=>[...new Set(reportYears)].sort((a,b)=>b-a),[reportYears])
 const inferredYearOptions=useMemo(()=>Array.from({length:Math.max(1,today-1989)},(_,i)=>today-i),[today])

 function present(values:OfficialValues){
  setDrafts(draftsFrom(values))
 }

 useEffect(()=>{
  let active=true
  if(!db||!userId){setReport(null);setCanUpload(false);return}
  void Promise.all([loadIncomeTaxYears(),loadMyEffectivePayrepPlan()])
   .then(([loaded,plan])=>{
    if(!active)return
    setReportYears(loaded)
    setYear(loaded[0]??defaultYear)
    setCanUpload(plan.isAdmin===true||plan.effectivePlan==='basic'||plan.effectivePlan==='full')
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível carregar os informes disponíveis.')})
  return ()=>{active=false}
 },[userId,defaultYear])

 useEffect(()=>{
  let active=true
  if(!db||!userId){setReport(null);present({});return}
  setLoading(true);setReport(null);setWarnings([]);setConfirmedByUser(false)
  void Promise.all([
   loadIncomeTaxReport(year),
   db.from('annual_tax_comparisons').select('official_values')
    .eq('user_id',userId).eq('calendar_year',year).maybeSingle()
  ]).then(([stored,legacy])=>{
   if(!active)return
   if(legacy.error)throw legacy.error
   setReport(stored)
   present(stored?(stored.confirmed_at?stored.reviewed_values:stored.extracted_values):{})
   setLegacyCount(Object.keys(legacy.data?.official_values||{}).length)
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao consultar informe do ano.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[userId,year])

 async function commitImport(file:File,analysis:ExtractedTaxReport,targetYear:number){
  setBusy(true);setError('');setMessage('')
  try{
   const {report:stored,alreadyStored}=await uploadIncomeTaxReport(targetYear,file,analysis)
   setReportYears(old=>[...new Set([...old,targetYear])])
   setYear(targetYear)
   setReport(stored)
   present(stored.confirmed_at?stored.reviewed_values:stored.extracted_values)
   setWarnings(analysis.warnings)
   setConfirmedByUser(false)
   setPending(null)
   setMessage(alreadyStored?'Este documento já estava armazenado para '+targetYear+'.':
    'Informe de '+targetYear+' armazenado. Confira os valores e confirme para torná-los oficiais.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível importar o informe.')}
  finally{setBusy(false)}
 }

 async function analyzeFile(file:File){
  if(!canUpload||busy)return
  setBusy(true);setError('');setMessage('');setPending(null)
  try{
   const analysis=await extractIncomeTaxPdf(file)
   const detected=analysis.detectedYear
   if(detected===null){
    setManualYear(defaultYear)
    setPending({file,analysis,year:null,existing:null})
    return
   }
   if(detected<1990||detected>today){
    setPending({file,analysis,year:null,existing:null})
    setManualYear(defaultYear)
    return
   }
   const existing=await loadIncomeTaxReport(detected)
   if(existing){setPending({file,analysis,year:detected,existing});return}
   await commitImport(file,analysis,detected)
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível ler o PDF enviado.')}
  finally{setBusy(false)}
 }

 async function confirmMissingYear(){
  if(!pending||busy||pending.year!==null)return
  setBusy(true);setError('')
  try{
   const existing=await loadIncomeTaxReport(manualYear)
   if(existing){setPending({...pending,year:manualYear,existing});return}
   await commitImport(pending.file,pending.analysis,manualYear)
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível validar o ano do informe.')}
  finally{setBusy(false)}
 }
 async function showPdf(download:boolean){
  if(!report||busy)return
  setBusy(true);setError('')
  try{
   const blob=await downloadIncomeTaxReport(report)
   if(download){
    const objectUrl=URL.createObjectURL(blob)
    const anchor=document.createElement('a')
    anchor.href=objectUrl;anchor.download=report.original_filename||('Informe-IR-'+year+'.pdf')
    document.body.append(anchor);anchor.click();anchor.remove()
    window.setTimeout(()=>URL.revokeObjectURL(objectUrl),10000)
   }else setViewer({blob,name:report.original_filename})
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o PDF.')}
  finally{setBusy(false)}
 }
 async function removePdf(){
  if(!report||busy)return
  setBusy(true);setError('')
  try{
   await deleteIncomeTaxReport(report)
   const remaining=viewingYears.filter(y=>y!==year)
   setReportYears(remaining)
   setYear(remaining[0]??defaultYear)
   setReport(null);present({});setWarnings([])
   setConfirmedByUser(false);setDeleteConfirm(false)
   setMessage('Informe excluído. Holerites e outros documentos não foram alterados.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível remover o informe.')}
  finally{setBusy(false)}
 }
 function changeValue(field:OfficialField,text:string){
  setDrafts(old=>({...old,[field]:text}))
  setConfirmedByUser(false)
 }
 async function saveReviewed(){
  if(!report||!canUpload||saving||!confirmedByUser)return
  const invalid=OFFICIAL_FIELDS.find(field=>drafts[field.key]?.trim()&&parseAmount(drafts[field.key])===null)
  if(invalid){setError('Confira o valor de '+invalid.title+'. Use um número em reais ou deixe em branco.');return}
  const clean:OfficialValues={}
  for(const field of OFFICIAL_FIELDS){
   const amount=parseAmount(drafts[field.key]||'')
   if(amount!==null)clean[field.key]=amount
  }
  if(!Object.keys(clean).length){
   setError('Confira ao menos um valor com o documento antes de confirmar.')
   return
  }
  setSaving(true);setError('');setMessage('')
  try{
   const stored=await confirmIncomeTaxReport(report,clean)
   setReport(stored);present(stored.reviewed_values)
   setConfirmedByUser(false)
   setMessage('Informe de '+year+' conferido. Os valores confirmados agora são a fonte oficial desse ano.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível confirmar os valores.')}
  finally{setSaving(false)}
 }
 const renderRows=(fields:readonly OfficialField[])=>fields.map((key,index)=><div className="ir-report-row" key={key}>
  <div className="ir-report-row-label">
   <span className="ir-report-index">{String(index+1).padStart(2,'0')}</span>
   <span>{moneyLabel(key)}</span>
  </div>
  <label className="ir-report-amount">
   <span className="ir-report-currency">R$</span>
   <input type="text" inputMode="decimal" autoComplete="off" className="ir-report-number"
    aria-label={'Valor em reais: '+moneyLabel(key)}
    placeholder="Não informado" value={drafts[key]||''}
    disabled={!report||!canUpload||loading||busy||saving}
    onChange={e=>changeValue(key,e.target.value)}/>
  </label>
 </div>)

 return <div className="stack ir-page">
  <div className="page-intro ir-page-heading">
   <div>
    <h2>Informe IR</h2>
    <p>Seus informes de rendimentos da empresa, organizados pelo ano-calendário.</p>
   </div>
   <div className="ir-page-actions">
    {canUpload&&<button type="button" className="primary ir-upload-action" disabled={busy||saving}
     onClick={()=>fileRef.current?.click()}><FileUp size={18}/>{busy?'Processando PDF...':'Importar informe'}</button>}
    <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="ir-file-hidden"
     aria-label="Selecionar informe de rendimentos em PDF"
     onChange={event=>{
      const file=event.currentTarget.files?.[0]
      event.currentTarget.value=''
      if(file)void analyzeFile(file)
     }}/>
   </div>
  </div>
  {viewingYears.length>0&&<nav className="ir-report-years" aria-label="Informes importados por ano-calendário">
   <span>Informes disponíveis</span>
   {viewingYears.map(y=><button key={y} type="button"
    className={'ir-year-button'+(y===year?' is-active':'')} aria-current={y===year?'true':undefined}
    onClick={()=>{if(busy||saving)return;setError('');setMessage('');setYear(y)}}>{y}</button>)}
  </nav>}
  {message&&<div className="notice success" role="status"><CheckCircle2 size={17}/>{message}</div>}
  {error&&<div className="notice danger" role="alert"><AlertTriangle size={17}/>{error}</div>}
  {!canUpload&&<div className="notice subtle-notice"><Info size={17}/>
   A importação de novos informes está disponível nos planos Basic e Full. Documentos já armazenados podem ser consultados.</div>}

  {loading?<section className="panel ir-report-empty"><p className="subtle">Carregando informe...</p></section>:
   !report?<section className="panel ir-report-empty">
    <div className="ir-report-empty-icon"><FileCheck2 size={35}/></div>
    <h3>{viewingYears.length?'Nenhum documento neste período':'Seu primeiro informe começa aqui'}</h3>
    <p>Importe o PDF fornecido pela empresa. O Payrep identifica o ano-calendário automaticamente e organiza o documento na sua conta.</p>
    {canUpload&&<button type="button" className="primary" disabled={busy} onClick={()=>fileRef.current?.click()}>
     <FileUp size={17}/> Importar informe
    </button>}
    {legacyCount>0&&<small>Existem valores digitados anteriormente para {year}; eles não são considerados um informe da empresa.</small>}
    <small>PDF privado · até 15 MB · dados considerados oficiais apenas após conferência.</small>
   </section>:
   <>
    <section className="ir-attachment-strip" aria-label="Documento do informe">
     <div className="ir-attachment-meta">
      <span className="ir-attachment-icon"><FileCheck2 size={23}/></span>
      <div>
       <strong>{report.original_filename}</strong>
       <small>Importado em {new Date(report.created_at).toLocaleDateString('pt-BR')} · {Math.round(report.file_size_bytes/1024)} KB</small>
      </div>
     </div>
     <div className="ir-attachment-actions">
      <button type="button" className="secondary" disabled={busy} onClick={()=>void showPdf(false)}><Eye size={15}/> Ver PDF</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>void showPdf(true)}><Download size={15}/> Baixar</button>
      {canUpload&&<button type="button" className="secondary" disabled={busy}
       onClick={()=>fileRef.current?.click()}><FileUp size={15}/> Substituir</button>}
      {canUpload&&<button type="button" className="secondary ir-danger-action" disabled={busy}
       onClick={()=>setDeleteConfirm(true)}><Trash2 size={15}/> Excluir</button>}
     </div>
    </section>
    <section className="ir-report-paper" aria-labelledby="ir-paper-heading">
     <div className="ir-report-paper-top">
      <div className="ir-report-kicker">Resumo estruturado do documento importado</div>
      <h3 id="ir-paper-heading">Comprovante de Rendimentos Pagos e de Imposto sobre a Renda Retido na Fonte</h3>
      <div className="ir-report-paper-identifiers">
       <div><small>Ano-calendário</small><strong>{year}</strong></div>
       <div><small>Exercício</small><strong>{year+1}</strong></div>
       <div className="ir-report-source">
        {sourceConfirmed?<><ShieldCheck size={16}/><span>Conferido · fonte oficial</span></>:
         <><Info size={16}/><span>Conferência pendente</span></>}
       </div>
      </div>
     </div>
     {warnings.map((note,i)=><div className="ir-extraction-warning" key={i}><Info size={16}/>{note}</div>)}
     <div className="ir-report-section">
      <h4><span>3</span> Rendimentos tributáveis, deduções e imposto retido na fonte</h4>
      <div className="ir-report-table-head"><span>Descrição</span><span>Valor (R$)</span></div>
      {renderRows(taxableFields)}
     </div>
     <div className="ir-report-section">
      <h4><span>5</span> Rendimentos sujeitos à tributação exclusiva</h4>
      <div className="ir-report-table-head"><span>Descrição</span><span>Valor (R$)</span></div>
      {renderRows(exclusiveFields)}
     </div>
     <div className="ir-report-paper-footer">
      <Info size={16}/>
      <p>Este é um resumo organizado pelo Payrep, não uma reprodução do formulário oficial. Compare cada valor com o PDF antes de confirmar. Campo em branco significa não identificado, nunca zero.</p>
     </div>
    </section>
    {canUpload&&<section className="panel ir-review-panel">
     <div>
      <h3>{sourceConfirmed?'Revisar valores do informe':'Confirmar valores do informe'}</h3>
      <p>Os dados são utilizados como informação oficial do ano somente após sua conferência. Alterações exigem nova confirmação.</p>
     </div>
     <label className="ir-review-checkbox">
      <input type="checkbox" checked={confirmedByUser} onChange={e=>setConfirmedByUser(e.target.checked)}/>
      Conferi os valores acima com o Informe de Rendimentos da empresa.
     </label>
     <button type="button" className="primary" disabled={!confirmedByUser||busy||saving}
      onClick={()=>void saveReviewed()}><Save size={16}/>{saving?'Salvando...':sourceConfirmed?'Salvar valores conferidos':'Confirmar informe'}</button>
    </section>}
    <details className="panel ir-compare-details">
     <summary>Comparação com holerites cadastrados <span>Opcional</span></summary>
     <p className="subtle">Os totais por competência são indicativos, e não substituem o documento anual. A comparação só é possível quando há dados compatíveis.</p>
     <div className="table-scroll"><table>
      <thead><tr><th>Rubrica</th><th>Informe da empresa (R$)</th><th>Apuração dos holerites</th><th>Diferença</th></tr></thead>
      <tbody>{OFFICIAL_FIELDS.map(field=>{
       const imported=sourceConfirmed?report.reviewed_values[field.key]??null:null
       const derived=calculatedOfficialValue(summary,field.key)
       const delta=officialDifference(derived,imported)
       return <tr key={field.key}>
        <td>{field.title}</td>
        <td>{imported===null?'Não confirmado':brl(imported)}</td>
        <td>{derived===null?'Não apurado':brl(derived)}</td>
        <td>{delta===null?'Sem comparação':Math.abs(delta)<=0.01?'Coincide':brl(delta)}</td>
       </tr>
      })}</tbody>
     </table></div>
     <p className="subtle">Cobertura dos holerites mensais: {summary.monthlyDocuments}/12. Proventos e líquidos mensais não são automaticamente rendimentos tributáveis.</p>
    </details>
   </>}

  {pending&&<div className="ir-dialog-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setPending(null)}}>
   <section className="ir-dialog" role="dialog" aria-modal="true" aria-label="Confirmar importação do informe">
    <div className="ir-dialog-head"><h3>{pending.year===null?'Confirmar ano-calendário':'Substituir informe existente?'}</h3>
     <button type="button" className="secondary" disabled={busy} aria-label="Fechar"
      onClick={()=>setPending(null)}><X size={17}/></button></div>
    {pending.year===null?<div className="ir-dialog-content">
     <p>O Payrep não conseguiu identificar com segurança o ano-calendário neste PDF. Confirme o ano indicado no documento para continuar.</p>
     <label>Ano-calendário do PDF
      <PayrepSelect value={manualYear} onChange={next=>setManualYear(Number(next))} title="Ano-calendário do documento">
       {inferredYearOptions.map(y=><option key={y} value={y} label={`${y} (exercício ${y+1})`}>{y} (exercício {y+1})</option>)}
      </PayrepSelect>
     </label>
     <p className="subtle">O ano só é solicitado quando o documento não permite identificação automática, como em PDFs digitalizados.</p>
    </div>:<div className="ir-dialog-content">
     <p>Já existe um informe armazenado para o ano-calendário <strong>{pending.year}</strong>. Deseja substituir o documento?</p>
     <p className="subtle">Os valores antigos deixarão de ser fonte oficial até a conferência do novo PDF. Nenhum holerite será alterado.</p>
    </div>}
    <div className="ir-dialog-actions">
     <button type="button" className="secondary" disabled={busy} onClick={()=>setPending(null)}>Cancelar</button>
     <button type="button" className="primary" disabled={busy} onClick={()=>{
      if(pending.year===null)void confirmMissingYear()
      else void commitImport(pending.file,pending.analysis,pending.year)
     }}>{busy?'Processando...':pending.year===null?'Continuar':'Substituir informe'}</button>
    </div>
   </section>
  </div>}
  {deleteConfirm&&report&&<div className="ir-dialog-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDeleteConfirm(false)}}>
   <section className="ir-dialog" role="dialog" aria-modal="true" aria-label="Excluir informe">
    <div className="ir-dialog-head"><h3>Excluir informe de {year}?</h3>
     <button type="button" className="secondary" disabled={busy} aria-label="Fechar" onClick={()=>setDeleteConfirm(false)}><X size={17}/></button></div>
    <p>O PDF e os valores confirmados associados a ele serão excluídos. Seus holerites não serão afetados.</p>
    <div className="ir-dialog-actions">
     <button type="button" className="secondary" disabled={busy} onClick={()=>setDeleteConfirm(false)}>Cancelar</button>
     <button type="button" className="primary" disabled={busy} onClick={()=>void removePdf()}>Excluir informe</button>
    </div>
   </section>
  </div>}
  {viewer&&<div className="payslip-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setViewer(null)}}>
   <section className="payslip-viewer-dialog" role="dialog" aria-modal="true" aria-label="Visualizar Informe de Rendimentos">
    <div className="payslip-dialog-heading"><strong>Informe de Rendimentos · {year}</strong>
     <button type="button" className="secondary" onClick={()=>setViewer(null)} aria-label="Fechar PDF"><X size={18}/></button></div>
    <PayslipPdfViewer blob={viewer.blob} filename={viewer.name} initialPage={1}/>
   </section>
  </div>}
 </div>
}
