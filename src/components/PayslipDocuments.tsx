import {useEffect,useMemo,useState} from 'react'
import {Download,Eye,FileText,FolderOpen,Trash2,X,ShieldCheck,Info} from 'lucide-react'
import {deletePayslipStatement,downloadPayslipPdf,type SavedStatement} from '../lib/data'
import {PayslipPdfViewer} from './PayslipPdfViewer'

const typeLabels:Record<SavedStatement['document_type'],string>={
 monthly:'Holerite mensal',thirteenth:'13º salário',vacation:'Férias',ppr:'PPR'
}
type Viewer={blob:Blob;title:string;page:number;filename:string}

export function PayslipDocuments({statements,onRemoved}:{statements:SavedStatement[];onRemoved:()=>Promise<void>}){
 const [kind,setKind]=useState('all')
 const [year,setYear]=useState('all')
 const [month,setMonth]=useState('all')
 const [busyId,setBusyId]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [confirming,setConfirming]=useState<SavedStatement|null>(null)
 const [viewer,setViewer]=useState<Viewer|null>(null)
 const years=useMemo(()=>[...new Set(statements.map(s=>s.period.slice(0,4)))].sort().reverse(),[statements])
 const months=useMemo(()=>[...new Set(statements.filter(s=>year==='all'||s.period.startsWith(year)).map(s=>s.period.slice(5,7)))].sort(),[statements,year])
 const filtered=useMemo(()=>statements.filter(s=>
  (kind==='all'||s.document_type===kind)&&
  (year==='all'||s.period.startsWith(year))&&
  (month==='all'||s.period.slice(5,7)===month)
 ).sort((a,b)=>b.period.localeCompare(a.period)||a.document_type.localeCompare(b.document_type)||a.source_page-b.source_page),[statements,kind,year,month])
 const periodLabel=(period:string)=>{const [y,m]=period.split('-');return m+'/'+y}
 const closeViewer=()=>setViewer(null)
 useEffect(()=>{
  if(!viewer&&!confirming)return
  const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){setConfirming(null);closeViewer()}}
  document.addEventListener('keydown',handle)
  return ()=>document.removeEventListener('keydown',handle)
 },[viewer,confirming])
 const openDocument=async(s:SavedStatement)=>{
  setError('');setNotice('');setBusyId(s.id)
  try{
   const pdf=await downloadPayslipPdf(s.id)
   closeViewer()
   setViewer({blob:pdf.blob,title:typeLabels[s.document_type]+' · '+periodLabel(s.period),page:pdf.page,filename:pdf.filename})
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o documento.')}
  finally{setBusyId(null)}
 }
 const downloadDocument=async(s:SavedStatement)=>{
  setError('');setNotice('');setBusyId(s.id)
  try{
   const pdf=await downloadPayslipPdf(s.id)
   const url=URL.createObjectURL(new Blob([pdf.blob],{type:'application/pdf'}))
   const link=document.createElement('a')
   link.href=url;link.download=pdf.filename
   document.body.append(link);link.click();link.remove()
   window.setTimeout(()=>URL.revokeObjectURL(url),10000)
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível baixar o documento.')}
  finally{setBusyId(null)}
 }
 const deleteDocument=async()=>{
  const s=confirming
  if(!s||busyId)return
  setBusyId(s.id);setError('');setNotice('')
  try{
   const result=await deletePayslipStatement(s.id)
   setConfirming(null)
   await onRemoved()
   setNotice(result.cleanupPending
    ?'Holerite removido, mas a limpeza do arquivo PDF ficou pendente. Contate o suporte.'
    :'Holerite excluído. Outros documentos do mesmo PDF foram preservados, se existirem.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível excluir o holerite.')}
  finally{setBusyId(null)}
 }
 return <div className="payslip-documents">
  <div className="page-intro"><div><h2>Meus documentos</h2><p>Consulte os PDFs originais por tipo e competência. Os documentos ficam em armazenamento privado, com acesso restrito à sua conta.</p></div></div>
  <section className="panel payslip-documents-panel">
   <div className="payslip-filters">
    <label>Tipo
     <select value={kind} onChange={e=>setKind(e.target.value)} aria-label="Filtrar documentos por tipo">
      <option value="all">Todos os tipos</option>
      <option value="monthly">Holerite mensal</option>
      <option value="thirteenth">13º salário</option>
      <option value="vacation">Férias</option>
      <option value="ppr">PPR</option>
     </select>
    </label>
    <label>Ano
     <select value={year} onChange={e=>{setYear(e.target.value);setMonth('all')}} aria-label="Filtrar documentos por ano">
      <option value="all">Todos os anos</option>
      {years.map(y=><option key={y} value={y}>{y}</option>)}
     </select>
    </label>
    <label>Mês
     <select value={month} onChange={e=>setMonth(e.target.value)} aria-label="Filtrar documentos por mês">
      <option value="all">Todos os meses</option>
      {months.map(m=><option key={m} value={m}>{new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,Number(m)-1,1)))}</option>)}
     </select>
    </label>
    <span className="payslip-doc-count">{filtered.length} documento(s)</span>
   </div>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {notice&&<div className="notice success" role="status">{notice}</div>}
   {filtered.length===0?<div className="payslip-doc-empty"><FolderOpen size={30}/><p>Nenhum documento para os filtros selecionados.</p></div>:
   <div className="payslip-doc-list">
    {filtered.map(s=><div key={s.id} className="payslip-doc-row">
     <div className="payslip-doc-icon"><FileText size={24}/></div>
     <div className="payslip-doc-details">
      <strong>{typeLabels[s.document_type]} · {periodLabel(s.period)}</strong>
      <small title={s.source_file}>{s.source_file} · {s.storage_key.endsWith('-p'+s.source_page+'.pdf')?'PDF individual':'página '+s.source_page+' do PDF original'}</small>
      {s.payment_date&&<small>Pagamento: {s.payment_date.split('-').reverse().join('/')}</small>}
     </div>
     <div className="payslip-doc-actions">
      <button type="button" className="secondary" disabled={!!busyId} onClick={()=>void openDocument(s)} aria-label={'Visualizar '+typeLabels[s.document_type]+' de '+periodLabel(s.period)} title="Visualizar PDF"><Eye size={16}/><span>Ver</span></button>
      <button type="button" className="secondary" disabled={!!busyId} onClick={()=>void downloadDocument(s)} aria-label={'Baixar '+typeLabels[s.document_type]+' de '+periodLabel(s.period)} title="Baixar PDF"><Download size={16}/><span>Baixar</span></button>
      <button type="button" className="secondary payslip-doc-delete" disabled={!!busyId} onClick={()=>{setError('');setConfirming(s)}} aria-label={'Excluir '+typeLabels[s.document_type]+' de '+periodLabel(s.period)} title="Excluir holerite"><Trash2 size={16}/><span>Excluir</span></button>
     </div>
    </div>)}
   </div>}
   <div className="detail-hint"><ShieldCheck size={16}/>O arquivo original só é removido quando nenhum outro holerite importado depende dele.</div>
  </section>
  {viewer&&<div className="payslip-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeViewer()}}>
   <section className="payslip-viewer-dialog" role="dialog" aria-modal="true" aria-label={viewer.title}>
    <div className="payslip-dialog-heading"><strong>{viewer.title}</strong><button type="button" className="secondary" onClick={closeViewer} aria-label="Fechar visualização"><X size={19}/></button></div>
    <PayslipPdfViewer blob={viewer.blob} initialPage={viewer.page} filename={viewer.filename}/>
   </section>
  </div>}
  {confirming&&<div className="payslip-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busyId)setConfirming(null)}}>
   <section className="payslip-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="payslip-remove-title" aria-describedby="payslip-remove-description">
    <h3 id="payslip-remove-title">Excluir holerite?</h3>
    <p id="payslip-remove-description">Deseja excluir <strong>{typeLabels[confirming.document_type]} de {periodLabel(confirming.period)}</strong>? As rubricas e os eventos associados a este documento também serão removidos. Eventos manuais e outros holerites serão preservados.</p>
    {statements.filter(s=>s.storage_key===confirming.storage_key).length>1&&<p className="payslip-shared-info"><Info size={16}/>Este PDF contém outros holerites. O arquivo original será preservado enquanto eles existirem.</p>}
    <div className="payslip-confirm-actions">
     <button type="button" className="secondary" disabled={!!busyId} onClick={()=>setConfirming(null)}>Cancelar</button>
     <button type="button" className="primary payslip-confirm-delete" disabled={!!busyId} onClick={()=>void deleteDocument()}><Trash2 size={16}/>{busyId?'Excluindo...':'Excluir holerite'}</button>
    </div>
   </section>
  </div>}
 </div>
}
