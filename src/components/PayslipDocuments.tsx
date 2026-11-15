import {useEffect,useMemo,useState} from 'react'
import {Download,Eye,FileText,FolderOpen,Trash2,X,ShieldCheck,Info,Files,RefreshCw} from 'lucide-react'
import {deletePayslipStatement,downloadPayslipPdf,syncStoredMonthlyEvents,type SavedStatement} from '../lib/data'
import {PayslipPdfViewer} from './PayslipPdfViewer'
import {PayrepSelect} from './PayrepSelect'
import {PayrepConfirmDialog} from './PayrepConfirmDialog'

const typeLabels:Record<SavedStatement['document_type'],string>={
 monthly:'Holerite mensal',thirteenth:'13º salário',vacation:'Férias',ppr:'PPR'
}
type Viewer={blob:Blob;title:string;page:number;filename:string}
type PreparedPdf={id:string;blob:Blob;filename:string}

export function PayslipDocuments({statements,onRemoved,onEventsSynced}:{statements:SavedStatement[];onRemoved:()=>Promise<void>;onEventsSynced:()=>Promise<void>}){
 const [kind,setKind]=useState('all')
 const [year,setYear]=useState('all')
 const [month,setMonth]=useState('all')
 const [busyId,setBusyId]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [confirming,setConfirming]=useState<SavedStatement|null>(null)
 const [viewer,setViewer]=useState<Viewer|null>(null)
 const [selectedIds,setSelectedIds]=useState<string[]>([])
 const [batchDialog,setBatchDialog]=useState(false)
 const [batchMode,setBatchMode]=useState<'merged'|'individual'>('merged')
 const [batchBusy,setBatchBusy]=useState(false)
 const [batchError,setBatchError]=useState('')
 const [batchNotice,setBatchNotice]=useState('')
 const [preparedPdfs,setPreparedPdfs]=useState<PreparedPdf[]>([])
 const [eventDialog,setEventDialog]=useState(false)
 const [eventUseReference,setEventUseReference]=useState(false)
 const [eventBusy,setEventBusy]=useState(false)
 const [eventError,setEventError]=useState('')
 const monthlyStatements=useMemo(()=>statements.filter(s=>s.document_type==='monthly'),[statements])
 const noPaymentDate=monthlyStatements.filter(s=>!s.payment_date).length
 const years=useMemo(()=>[...new Set(statements.map(s=>s.period.slice(0,4)))].sort().reverse(),[statements])
 const months=useMemo(()=>[...new Set(statements.filter(s=>year==='all'||s.period.startsWith(year)).map(s=>s.period.slice(5,7)))].sort(),[statements,year])
 const filtered=useMemo(()=>statements.filter(s=>
  (kind==='all'||s.document_type===kind)&&
  (year==='all'||s.period.startsWith(year))&&
  (month==='all'||s.period.slice(5,7)===month)
 ).sort((a,b)=>b.period.localeCompare(a.period)||a.document_type.localeCompare(b.document_type)||a.source_page-b.source_page),[statements,kind,year,month])
 const periodLabel=(period:string)=>{const [y,m]=period.split('-');return m+'/'+y}
 const selectedDocs=useMemo(()=>statements.filter(s=>selectedIds.includes(s.id)).sort((a,b)=>
  a.period.localeCompare(b.period)||a.document_type.localeCompare(b.document_type)||a.source_page-b.source_page
 ),[statements,selectedIds])
 const visibleIds=useMemo(()=>new Set(filtered.map(s=>s.id)),[filtered])
 const visibleSelected=filtered.filter(s=>selectedIds.includes(s.id)).length
 const allVisible=filtered.length>0&&visibleSelected===filtered.length
 const toggleAllVisible=(checked:boolean)=>setSelectedIds(prev=>checked
  ?Array.from(new Set([...prev,...filtered.map(s=>s.id)]))
  :prev.filter(id=>!visibleIds.has(id)))
 const toggleRow=(id:string,checked:boolean)=>setSelectedIds(prev=>checked
  ?Array.from(new Set([...prev,id]))
  :prev.filter(x=>x!==id))
 useEffect(()=>{setSelectedIds(prev=>prev.filter(id=>statements.some(s=>s.id===id)))},[statements])
 const closeBatch=()=>{
  if(batchBusy)return
  setBatchDialog(false)
  setBatchError('');setBatchNotice('');setPreparedPdfs([])
 }
 const openBatch=()=>{
  if(!selectedDocs.length)return
  setBatchMode('merged');setBatchError('');setBatchNotice('');setPreparedPdfs([])
  setBatchDialog(true)
 }
 const promptDownload=(blob:Blob,filename:string)=>{
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url;link.download=filename
  document.body.append(link);link.click();link.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),30000)
 }
 const batchDownload=async()=>{
  if(batchBusy||!selectedDocs.length)return
  setBatchBusy(true);setBatchError('');setBatchNotice('');setPreparedPdfs([])
  try{
   const {PDFDocument}=await import('pdf-lib')
   const combined=await PDFDocument.create()
   const separate:PreparedPdf[]=[]
   for(let index=0;index<selectedDocs.length;index++){
    const statement=selectedDocs[index]
    const pdf=await downloadPayslipPdf(statement.id)
    const document=await PDFDocument.load(await pdf.blob.arrayBuffer())
    if(pdf.page<1||pdf.page>document.getPageCount())throw new Error('Página não encontrada para '+statement.period)
    const [copied]=await combined.copyPages(document,[pdf.page-1])
    combined.addPage(copied)
    if(batchMode==='individual'){
     const single=await PDFDocument.create()
     const [page]=await single.copyPages(document,[pdf.page-1])
     single.addPage(page)
     const name=typeLabels[statement.document_type].normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/\s+/g,'-')+'-'+statement.period+'-'+String(index+1).padStart(2,'0')+'.pdf'
     separate.push({id:statement.id,filename:name,blob:new Blob([new Uint8Array(await single.save())],{type:'application/pdf'})})
    }
   }
   if(batchMode==='merged'){
    const blob=new Blob([new Uint8Array(await combined.save())],{type:'application/pdf'})
    const name='Payrep-Holerites-'+selectedDocs.length+'-documentos.pdf'
    promptDownload(blob,name)
    setBatchNotice('Download do PDF agrupado solicitado ao navegador.')
   }else{
    // Some mobile browsers request permission to download multiple files.
    // Preserve individually prepared files for manual retries if blocked.
    setPreparedPdfs(separate)
    for(const file of separate)promptDownload(file.blob,file.filename)
    setBatchNotice('Downloads individuais solicitados. O navegador pode pedir permissão para baixar vários arquivos. Se algum não aparecer, utilize os botões individuais abaixo.')
   }
  }catch(e){
   setBatchError(e instanceof Error?e.message:'Não foi possível preparar os PDFs. Nenhum documento foi removido.')
  }finally{setBatchBusy(false)}
 }
 const syncEvents=async()=>{
  if(eventBusy)return
  setEventBusy(true);setEventError('');setError('');setNotice('')
  try{
   const result=await syncStoredMonthlyEvents(statements,eventUseReference)
   await onEventsSynced()
   setEventDialog(false);setEventUseReference(false)
   setNotice('Eventos salariais sincronizados. '+result.changedEvents+' evento(s) criado(s) ou atualizado(s). '+
    (result.missingDateDocuments>0
     ?result.missingDateDocuments+' holerite(s) ainda sem data de referência. Confirme a data provisória para incluí-los.'
     :result.provisionalDateDocuments>0
      ?result.provisionalDateDocuments+' holerite(s) utilizaram uma data provisória claramente sinalizada nos eventos.'
      :'As datas de pagamento identificadas foram utilizadas.'))
  }catch(e){setEventError(e instanceof Error?e.message:'Não foi possível sincronizar os eventos.')}
  finally{setEventBusy(false)}
 }
 const closeViewer=()=>setViewer(null)
 useEffect(()=>{
  if(!viewer&&!confirming&&!batchDialog&&!eventDialog)return
  const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!batchBusy&&!eventBusy){setConfirming(null);closeViewer();closeBatch();setEventDialog(false)}}
  document.addEventListener('keydown',handle)
  return ()=>document.removeEventListener('keydown',handle)
 },[viewer,confirming,batchDialog,batchBusy,eventDialog,eventBusy])
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
   setSelectedIds(prev=>prev.filter(id=>id!==s.id))
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
    <div className="payslip-filter-field payslip-filter-year">
     <label id="payslip-filter-year-label">Ano</label>
     <PayrepSelect value={year} onChange={value=>{setYear(value);setMonth('all')}} title="Filtrar por ano" aria-label="Filtrar documentos por ano">
      <option value="all">Todos os anos</option>
      {years.map(y=><option key={y} value={y}>{y}</option>)}
     </PayrepSelect>
    </div>
    <div className="payslip-filter-field payslip-filter-month">
     <label id="payslip-filter-month-label">Mês</label>
     <PayrepSelect value={month} onChange={setMonth} title="Filtrar por mês" aria-label="Filtrar documentos por mês">
      <option value="all">Todos os meses</option>
      {months.map(m=><option key={m} value={m}>{new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,Number(m)-1,1)))}</option>)}
     </PayrepSelect>
    </div>
    <div className="payslip-filter-field payslip-filter-kind">
     <label id="payslip-filter-kind-label">Tipo</label>
     <PayrepSelect value={kind} onChange={setKind} title="Filtrar por tipo" aria-label="Filtrar documentos por tipo">
      <option value="all">Todos os tipos</option>
      <option value="monthly">Holerite mensal</option>
      <option value="thirteenth">13º salário</option>
      <option value="vacation">Férias</option>
      <option value="ppr">PPR</option>
     </PayrepSelect>
    </div>
    <span className="payslip-doc-count">{filtered.length} documento(s) exibido(s)</span>
   </div>
   <div className="payslip-batch-toolbar">
    <label className="payslip-select-all">
     <input className="payslip-custom-checkbox" type="checkbox" checked={allVisible} disabled={!filtered.length||batchBusy}
      ref={input=>{if(input)input.indeterminate=visibleSelected>0&&!allVisible}}
      onChange={e=>toggleAllVisible(e.target.checked)}
      aria-label="Selecionar todos os holerites exibidos"/>
     <span>Selecionar todos <small>({visibleSelected} de {filtered.length} visíveis)</small></span>
    </label>
    <div className="payslip-batch-actions">
     {selectedIds.length>0&&<button type="button" className="payslip-clear-selection" onClick={()=>setSelectedIds([])} disabled={batchBusy}>Limpar seleção</button>}
     <button type="button" className="primary" disabled={!selectedIds.length||batchBusy||!!busyId} onClick={openBatch}>
      <Download size={17}/> Baixar Selecionados <span className="payslip-batch-count">{selectedIds.length}</span>
     </button>
    </div>
   </div>
   {monthlyStatements.length>0&&<div className="payslip-events-toolbar">
    <div><strong>Eventos salariais automáticos</strong>
     <small>Salário, triênio, previdência, ESPP e dependentes, apenas quando os dados estiverem disponíveis no holerite.</small>
     {noPaymentDate>0&&<small>{noPaymentDate} holerite(s) ainda não possuem data de pagamento registrada. Uma data provisória só será usada com sua confirmação.</small>}
    </div>
    <button type="button" className="secondary" disabled={!!busyId||eventBusy||batchBusy}
     onClick={()=>{setEventDialog(true);setEventUseReference(false);setEventError('')}}>
     <RefreshCw size={17}/> Gerar eventos dos holerites
    </button>
   </div>}
   {error&&<div className="notice error" role="alert">{error}</div>}
   {notice&&<div className="notice success" role="status">{notice}</div>}
   {filtered.length===0?<div className="payslip-doc-empty"><FolderOpen size={30}/><p>Nenhum documento para os filtros selecionados.</p></div>:
   <div className="payslip-doc-list">
    {filtered.map(s=><div key={s.id} className="payslip-doc-row">
     <label className="payslip-row-select" title={'Selecionar '+typeLabels[s.document_type]+' de '+periodLabel(s.period)}>
      <input className="payslip-custom-checkbox" type="checkbox" checked={selectedIds.includes(s.id)}
       disabled={!!busyId||batchBusy} onChange={e=>toggleRow(s.id,e.target.checked)}
       aria-label={'Selecionar '+typeLabels[s.document_type]+' de '+periodLabel(s.period)}/>
     </label>
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
  {eventDialog&&<PayrepConfirmDialog
   title="Gerar eventos salariais?"
   description={'O Payrep vai reler seus '+monthlyStatements.length+' holerites mensais, tentar recuperar datas de pagamento e reconciliar as mudanças identificadas. Eventos manuais serão preservados, e nenhum PDF será excluído.'}
   confirmLabel="Gerar eventos"
   busy={eventBusy}
   onClose={()=>{if(!eventBusy){setEventDialog(false);setEventError('')}}}
   onConfirm={()=>void syncEvents()}>
   {noPaymentDate>0&&<div className="payslip-event-date-review">
    <p><strong>{noPaymentDate} documento(s) sem data de pagamento registrada.</strong> O Payrep tentará recuperar a data diretamente dos PDFs. Caso não consiga, poderá utilizar o último dia de cada competência como data de referência provisória.</p>
    <label className="checkbox-label">
     <input type="checkbox" checked={eventUseReference} disabled={eventBusy} onChange={e=>setEventUseReference(e.target.checked)}/>
     Autorizo a usar o último dia da competência como data provisória quando o PDF não informar a data de pagamento.
    </label>
    <small>Essa data será identificada nos eventos como estimativa, não como data real de pagamento.</small>
   </div>}
   {eventError&&<p className="error" role="alert">{eventError}</p>}
  </PayrepConfirmDialog>}
  {batchDialog&&<div className="payslip-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeBatch()}}>
   <section className="payslip-confirm-dialog payslip-download-dialog" role="dialog" aria-modal="true"
    aria-labelledby="payslip-download-title" aria-describedby="payslip-download-description">
    <div className="payslip-batch-dialog-heading">
     <h3 id="payslip-download-title">Baixar {selectedDocs.length} holerite(s)</h3>
     <button type="button" className="secondary" onClick={closeBatch} disabled={batchBusy} aria-label="Fechar"><X size={18}/></button>
    </div>
    <p id="payslip-download-description">Escolha o formato de download. Serão incluídos somente os holerites selecionados, em ordem cronológica, sem modificar os documentos armazenados.</p>
    <div className="payslip-download-choices" role="group" aria-label="Formato dos PDFs">
     <button type="button" className={'payslip-download-choice'+(batchMode==='merged'?' is-selected':'')}
      aria-pressed={batchMode==='merged'} disabled={batchBusy} onClick={()=>{setBatchMode('merged');setBatchError('');setBatchNotice('');setPreparedPdfs([])}}>
      <Files size={21}/><span><strong>PDF agrupado</strong><small>Um único PDF com {selectedDocs.length} página(s)</small></span>
     </button>
     <button type="button" className={'payslip-download-choice'+(batchMode==='individual'?' is-selected':'')}
      aria-pressed={batchMode==='individual'} disabled={batchBusy} onClick={()=>{setBatchMode('individual');setBatchError('');setBatchNotice('');setPreparedPdfs([])}}>
      <FileText size={21}/><span><strong>PDFs individuais</strong><small>{selectedDocs.length} arquivo(s) separados</small></span>
     </button>
    </div>
    {batchError&&<div role="alert" className="notice danger">{batchError}</div>}
    {batchNotice&&<div role="status" className="notice success">{batchNotice}</div>}
    {preparedPdfs.length>0&&<div className="payslip-prepared-list">
     <strong>Arquivos disponíveis para baixar separadamente</strong>
     <div>{preparedPdfs.map(pdf=><button key={pdf.id} type="button" className="secondary" onClick={()=>promptDownload(pdf.blob,pdf.filename)}>
      <Download size={15}/><span>{pdf.filename}</span>
     </button>)}</div>
    </div>}
    <div className="payslip-confirm-actions">
     <button className="secondary" type="button" disabled={batchBusy} onClick={closeBatch}>Fechar</button>
     <button className="primary" type="button" disabled={batchBusy||!selectedDocs.length}
      onClick={()=>void batchDownload()}><Download size={16}/>{batchBusy?'Preparando PDFs...':'Confirmar download'}</button>
    </div>
   </section>
  </div>}
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
