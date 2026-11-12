import {useEffect,useMemo,useState} from 'react'
import {ExternalLink,Info} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'

export type LegalDocumentType='privacidade'|'termos'
export type LegalRevision={
 id:string
 version:string
 revision:number
 changedAt:string
 summary:string
 path:string
 sourceCommit:string
 blobSha:string
}
export type LegalHistoryManifest={
 schemaVersion:number
 publicVersion:string
 launchState:'prelaunch'|'launched'
 notes:string
 documents:Record<LegalDocumentType,{
  title:string
  currentRevisionId:string
  revisions:LegalRevision[]
 }>
}

const localDate=(iso:string)=>new Intl.DateTimeFormat('pt-BR',{
 timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
 hour:'2-digit',minute:'2-digit'
}).format(new Date(iso))

function isValidManifest(value:unknown):value is LegalHistoryManifest{
 if(!value||typeof value!=='object')return false
 const manifest=value as Partial<LegalHistoryManifest>
 if(manifest.schemaVersion!==1||!manifest.documents)return false
 return (['privacidade','termos'] as const).every(kind=>{
  const doc=manifest.documents?.[kind]
  return doc&&typeof doc.currentRevisionId==='string'&&Array.isArray(doc.revisions)
   &&doc.revisions.length>0&&doc.revisions.every(revision=>typeof revision.id==='string'
    &&revision.path.startsWith('/legal-history/')&&revision.path.endsWith('.html')
    &&typeof revision.changedAt==='string'&&typeof revision.version==='string')
 })
}

export function LegalHistoryViewer(){
 const [manifest,setManifest]=useState<LegalHistoryManifest|null>(null)
 const [documentType,setDocumentType]=useState<LegalDocumentType>('privacidade')
 const [selectedId,setSelectedId]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{
  const controller=new AbortController()
  const load=async()=>{
   try{
    const response=await fetch('/legal-history/manifest.json',{cache:'no-store',signal:controller.signal})
    if(!response.ok)throw new Error('Não foi possível consultar o histórico dos documentos.')
    const value:unknown=await response.json()
    if(!isValidManifest(value))throw new Error('Histórico dos documentos inválido.')
    setManifest(value)
   }catch(e){
    if(controller.signal.aborted)return
    setError(e instanceof Error?e.message:'Não foi possível carregar o histórico.')
   }finally{if(!controller.signal.aborted)setLoading(false)}
  }
  void load()
  return ()=>controller.abort()
 },[])

 const document=manifest?.documents[documentType]
 const revisions=useMemo(()=>document?.revisions.slice().reverse()??[],[document])
 const activeId=selectedId&&revisions.some(item=>item.id===selectedId)?selectedId:document?.currentRevisionId??''
 const active=revisions.find(item=>item.id===activeId)

 return <div className="legal-history">
  {loading&&<p className="subtle">Carregando histórico...</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  {manifest&&document&&<>
   <div className="legal-history-fields">
    <div className="legal-history-field">
     <label htmlFor="legal-document-select">Documento</label>
     <PayrepSelect id="legal-document-select" title="Documento legal" value={documentType}
      onChange={value=>{setDocumentType(value as LegalDocumentType);setSelectedId('')}}>
      <option value="privacidade">Política de Privacidade</option>
      <option value="termos">Termos de Uso</option>
     </PayrepSelect>
    </div>
    <div className="legal-history-field">
     <label htmlFor="legal-revision-select">Versão e data</label>
     <PayrepSelect id="legal-revision-select" title="Versão e data do documento" value={activeId}
      onChange={setSelectedId}>
      {revisions.map(item=><option key={item.id} value={item.id}>{item.version} · Revisão {String(item.revision).padStart(2,'0')} · {localDate(item.changedAt)}</option>)}
     </PayrepSelect>
    </div>
   </div>
   {active&&<>
    <div className="legal-history-meta">
     <div><strong>{active.version} · Revisão {String(active.revision).padStart(2,'0')}</strong>
      <small>{localDate(active.changedAt)} · {active.summary}</small></div>
     <a className="secondary" href={active.path} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={15}/> Abrir versão arquivada
     </a>
    </div>
    <iframe className="legal-history-preview" key={active.path} src={active.path}
     title={`Texto integral: ${document.title}, ${active.version}, revisão ${active.revision}`}
     sandbox="" loading="lazy" referrerPolicy="no-referrer"/>
   </>}
   <div className="detail-hint"><Info size={16}/>
    <span>O rótulo público permanece em <strong>{manifest.publicVersion}</strong> até o lançamento.
    Cada revisão tem data, identificador próprio e arquivo integral preservado.
    As revisões anteriores à criação do versionamento foram identificadas retrospectivamente, sem alterar seu texto.</span>
   </div>
  </>}
 </div>
}
