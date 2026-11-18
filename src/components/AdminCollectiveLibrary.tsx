import {useCallback,useEffect,useState} from 'react'
import {BookOpen,RefreshCw,SearchCheck,Upload} from 'lucide-react'
import {db} from '../lib/data'
import {PayrepSelect} from './PayrepSelect'
import {PayrepDatePicker} from './PayrepDatePicker'

type Source={id:string;organization:string;uf:string;source_url:string|null;enabled:boolean;status:string;last_checked_at:string|null;last_error:string|null}
type Document={id:string;source_id:string|null;title:string;document_type:string;registration_code:string|null;source_url:string|null;storage_path:string|null;raw_text:string|null;bank_clause_excerpt:string|null;valid_from:string|null;valid_until:string|null;review_status:string;review_note:string|null;imported_at:string}
type Profile={id:string;organization:string;uf:string;name:string}
type Version={id:string;profile_id:string;version:number;valid_from:string;valid_until:string;published_at:string}
type Run={id:string;source_id:string;status:string;status_code:number|null;started_at:string;error_message:string|null}
type Request={id:string;organization:string;uf:string;status:string;created_at:string}
const official=/^https:\/\/(mediador\.trabalho\.gov\.br|www\.gov\.br)\/[A-Za-z0-9/_?&=%.,~+-]*$/i
const blankReview={title:'',registration_code:'',document_type:'UNKNOWN',valid_from:'',valid_until:'',review_note:''}
const blankFactors={weekday_factor:'1',saturday_factor:'1',sunday_factor:'2',holiday_factor:'2',daily_target_minutes:'480',settlement_interval_months:'6',settlement_months:'2,8',settlement_half:'1'}
const decodeEntities=(value:string)=>value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,key:string)=>{
 const map:Record<string,string>={
  amp:'&',quot:'"',apos:"'",nbsp:' ',ccedil:'ç',Ccedil:'Ç',
  atilde:'ã',Atilde:'Ã',otilde:'õ',Otilde:'Õ',aacute:'á',
  Aacute:'Á',eacute:'é',Eacute:'É',iacute:'í',Iacute:'Í',
  oacute:'ó',Oacute:'Ó',uacute:'ú',Uacute:'Ú',acirc:'â',
  Acirc:'Â',ecirc:'ê',Ecirc:'Ê',ocirc:'ô',Ocirc:'Ô',
  agrave:'à',Agrave:'À',ldquo:'“',rdquo:'”',deg:'°'
 }
 if(key.startsWith('#')){const num=key[1]?.toLowerCase()==='x'
  ?parseInt(key.slice(2),16):parseInt(key.slice(1),10)
  return Number.isInteger(num)&&num>0&&num<=0x10ffff?String.fromCodePoint(num):'&'+key+';'}
 return map[key]??'&'+key+';'
})
const excerpt=(raw:string)=>{const text=raw.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
 const match=/banco de horas|compensa[cç][aã]o|horas extraordin/i.exec(text)
 return match?text.slice(Math.max(0,match.index-150),match.index+950):''}
export function AdminCollectiveLibrary(){
 const [sources,setSources]=useState<Source[]>([])
 const [docs,setDocs]=useState<Document[]>([])
 const [profiles,setProfiles]=useState<Profile[]>([])
 const [versions,setVersions]=useState<Version[]>([])
 const [runs,setRuns]=useState<Run[]>([])
 const [requests,setRequests]=useState<Request[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [org,setOrg]=useState('')
 const [uf,setUf]=useState('SP')
 const [url,setUrl]=useState('')
 const [sourceId,setSourceId]=useState('')
 const [manualTitle,setManualTitle]=useState('')
 const [manualText,setManualText]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [selectedId,setSelectedId]=useState('')
 const [review,setReview]=useState(blankReview)
 const [profileName,setProfileName]=useState('')
 const [factors,setFactors]=useState(blankFactors)
 const load=useCallback(async()=>{
  if(!db)throw Error('Supabase não configurado')
  const q=await Promise.all([
   db.from('collective_sources').select('*').order('organization'),
   db.from('collective_documents').select('id,source_id,title,document_type,registration_code,source_url,storage_path,bank_clause_excerpt,valid_from,valid_until,review_status,review_note,imported_at').order('imported_at',{ascending:false}).limit(100),
   db.from('collective_profiles').select('*').order('organization'),
   db.from('collective_profile_versions').select('*').order('published_at',{ascending:false}),
   db.from('collective_scan_runs').select('*').order('started_at',{ascending:false}).limit(30),
   db.from('collective_company_requests').select('*').order('created_at',{ascending:false}).limit(40)
  ])
  for(const r of q)if(r.error)throw Error(r.error.message)
  setSources((q[0].data||[]) as Source[]);setDocs((q[1].data||[]) as Document[])
  setProfiles((q[2].data||[]) as Profile[]);setVersions((q[3].data||[]) as Version[])
  setRuns((q[4].data||[]) as Run[]);setRequests((q[5].data||[]) as Request[])
 },[])
 useEffect(()=>{let active=true;void load().catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}},[load])
 const act=async(action:()=>Promise<void>,success:string)=>{
  if(busy)return
  setBusy(true);setError('');setMessage('')
  try{await action();await load();setMessage(success)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a operação.')}
  finally{setBusy(false)}
 }
 const selected=docs.find(d=>d.id===selectedId)
 const choose=(d:Document)=>{
  setSelectedId(d.id)
  setReview({title:d.title,registration_code:d.registration_code||'',document_type:d.document_type,
   valid_from:d.valid_from||'',valid_until:d.valid_until||'',review_note:d.review_note||''})
  const origin=sources.find(s=>s.id===d.source_id)
  setProfileName(origin?origin.organization+' · '+origin.uf:d.title)
 }
 const addSource=()=>act(async()=>{
  if(!db)throw Error('Supabase não configurado')
  if(!org.trim()||!uf.match(/^[A-Z]{2}$/))throw Error('Informe empresa e UF.')
  if(url.trim()&&!official.test(url.trim()))throw Error('Somente URLs HTTPS dos domínios oficiais.')
  const {error}=await db.from('collective_sources').insert({
   organization:org.trim(),uf,source_url:url.trim()||null,
   enabled:Boolean(url.trim()),status:url.trim()?'ready':'awaiting_direct_url'
  })
  if(error)throw Error(error.message)
  setOrg('');setUrl('')
 },'Fonte cadastrada.')
 const importDocument=()=>act(async()=>{
  if(!db)throw Error('Supabase não configurado')
  if(manualTitle.trim().length<3||(!file&&!manualText.trim()))throw Error('Informe título e arquivo ou texto.')
  let storage_path:string|null=null
  let raw_text=manualText.trim()||null
  if(file){
   const extension=file.name.split('.').pop()?.toLowerCase()
   if(!extension||!['pdf','txt','html'].includes(extension)||file.size>10485760)throw Error('Arquivo inválido. Use PDF/TXT/HTML até 10 MB.')
   const mime=extension==='pdf'?'application/pdf':extension==='html'?'text/html':'text/plain'
   storage_path=crypto.randomUUID()+'.'+extension
   const response=await db.storage.from('collective-agreements').upload(storage_path,file,{contentType:mime,upsert:false})
   if(response.error)throw Error(response.error.message)
   if(!raw_text&&extension!=='pdf')raw_text=(await file.text()).slice(0,400000)
  }
  const {data}=await db.auth.getUser()
  const {error}=await db.from('collective_documents').insert({
   title:manualTitle.trim(),source_id:sourceId||null,storage_path,
   raw_text,bank_clause_excerpt:raw_text?excerpt(raw_text):null,
   imported_by:data.user?.id||null
  })
  if(error)throw Error(error.message)
  setManualTitle('');setManualText('');setFile(null)
 },'Documento adicionado à fila de revisão.')
 const reviewDoc=(status:'pending'|'approved'|'rejected')=>act(async()=>{
  if(!db||!selected)throw Error('Selecione um documento.')
  if(status==='approved'&&(!review.valid_from||!review.valid_until||review.valid_from>review.valid_until||
   !review.registration_code.trim()||review.document_type==='UNKNOWN'))
   throw Error('Para aprovar, confira tipo, registro oficial e vigência.')
  const {data}=await db.auth.getUser()
  const {error}=await db.from('collective_documents').update({
   ...review,registration_code:review.registration_code||null,
   valid_from:review.valid_from||null,valid_until:review.valid_until||null,
   review_status:status,
   reviewed_by:status==='pending'?null:data.user?.id,
   reviewed_at:status==='pending'?null:new Date().toISOString()
  }).eq('id',selected.id)
  if(error)throw Error(error.message)
 },'Revisão salva.')
 const publish=()=>act(async()=>{
  if(!db||!selected||selected.review_status!=='approved'||!selected.valid_from||!selected.valid_until)
   throw Error('Aprovação e vigência completa são obrigatórias.')
  const source=sources.find(s=>s.id===selected.source_id)
  if(!source||!profileName.trim())throw Error('Vincule a empresa/UF e informe um nome de perfil.')
  let id=profiles.find(p=>p.organization===source.organization&&p.uf===source.uf&&p.name===profileName.trim())?.id
  if(!id){
   const {data,error}=await db.from('collective_profiles').insert({
    organization:source.organization,uf:source.uf,name:profileName.trim()
   }).select('id').single()
   if(error)throw Error(error.message)
   id=data.id
  }
  const {data:auth}=await db.auth.getUser()
  if(!auth.user)throw Error('Sessão inválida.')
  const months=factors.settlement_months.split(',').map(x=>Number(x.trim()))
  if(!months.length||months.some(x=>!Number.isInteger(x)||x<1||x>12))throw Error('Meses inválidos.')
  const number=(s:string)=>Number(s.replace(',','.'))
  const payload={
   profile_id:id,document_id:selected.id,version:Math.max(0,...versions.filter(v=>v.profile_id===id).map(v=>v.version))+1,
   valid_from:selected.valid_from,valid_until:selected.valid_until,
   weekday_factor:number(factors.weekday_factor),saturday_factor:number(factors.saturday_factor),
   sunday_factor:number(factors.sunday_factor),holiday_factor:number(factors.holiday_factor),
   daily_target_minutes:number(factors.daily_target_minutes),
   settlement_interval_months:number(factors.settlement_interval_months),
   settlement_months:months,settlement_half:number(factors.settlement_half),published_by:auth.user.id
  }
  const {error}=await db.from('collective_profile_versions').insert(payload)
  if(error)throw Error(error.message)
 },'Perfil publicado com rastreabilidade. Nenhuma política pessoal foi alterada.')
 const openOriginal=async(d:Document)=>{
  if(!db)return
  // Never execute saved external HTML under the Supabase Storage origin.
  if(d.storage_path&&/\.(pdf|txt)$/i.test(d.storage_path)){
   const {data,error}=await db.storage.from('collective-agreements').createSignedUrl(d.storage_path,120)
   if(error){setError(error.message);return}
   window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }else if(d.source_url&&official.test(d.source_url)){
   window.open(d.source_url,'_blank','noopener,noreferrer')
  }else if(d.storage_path?.toLowerCase().endsWith('.html')){
   setError('O HTML original foi arquivado, mas sua execução direta está bloqueada. Verifique o texto importado e os metadados na revisão.')
  }
 }
 return <div className="stack">
  <div className="page-intro"><div><h2>Biblioteca de ACTs e CCTs</h2>
   <p>Verificações periódicas, versões, fila de revisão e perfis publicados.</p></div></div>
  <div className="admin-settings-actions">
   <button type="button" className="secondary" disabled={busy||loading} onClick={()=>void act(async()=>{
    if(!db)throw Error('Supabase não configurado')
    if(!sources.some(source=>source.enabled&&source.source_url))throw Error('Nenhuma URL oficial direta está habilitada.')
    const {data,error}=await db.rpc('run_collective_source_check')
    if(error)throw Error(error.message)
    if(!data)throw Error('Nenhuma URL oficial direta está ativa.')
   },'Verificações enviadas. Os resultados serão processados pelo agendamento.')}>
    <SearchCheck size={16}/> Verificar fontes agora
   </button>
   <button type="button" className="secondary" disabled={busy} onClick={()=>void act(async()=>{},'Lista atualizada.')}>
    <RefreshCw size={16}/> Atualizar</button>
  </div>
  <p className="subtle">Verificação automática toda segunda, às 08h (São Paulo). O Mediador pode bloquear acessos automáticos. PDFs obtidos por URL direta são arquivados automaticamente, mas a interpretação das cláusulas exige revisão humana.</p>
  {error&&<p className="error" role="alert">{error}</p>}
  {message&&<p className="auth-success" role="status">{message}</p>}
  <section className="panel"><div className="panel-heading"><h2>Fontes ({sources.length})</h2></div>
   <div className="form-grid">
    <label>Empresa<input value={org} onChange={e=>setOrg(e.target.value)} placeholder="Empresa"/></label>
    <label>UF<input value={uf} maxLength={2} onChange={e=>setUf(e.target.value.toUpperCase())}/></label>
    <label>URL direta oficial (opcional)<input value={url} onChange={e=>setUrl(e.target.value)}
     placeholder="https://mediador.trabalho.gov.br/..."/></label>
   </div>
   <button type="button" className="primary" disabled={busy} onClick={()=>void addSource()}>Cadastrar fonte</button>
   <div className="table-scroll"><table><thead><tr><th>Empresa / UF</th><th>Situação</th><th>URL</th><th>Última consulta</th><th>Ações</th></tr></thead>
    <tbody>{sources.map(s=><SourceRow key={s.id} source={s} busy={busy}
     onSave={(item,u,enabled)=>void act(async()=>{
      if(!db)throw Error('Supabase não configurado')
      if(u&&!official.test(u))throw Error('URL não oficial.')
      const {error}=await db.from('collective_sources').update({
       source_url:u||null,enabled:enabled&&Boolean(u),
       status:u?'ready':'awaiting_direct_url',last_error:null
      }).eq('id',item.id)
      if(error)throw Error(error.message)
     },'Fonte atualizada.')}/>)}</tbody>
   </table></div>
  </section>
  <section className="panel"><div className="panel-heading"><h2><Upload size={18}/> Importar documento</h2></div>
   <p className="subtle">Importe manualmente PDF, TXT ou HTML até 10 MB quando o download oficial não for possível. Copie o trecho relevante para facilitar a revisão.</p>
   <div className="form-grid">
    <label>Título<input value={manualTitle} onChange={e=>setManualTitle(e.target.value)}/></label>
    <label>Empresa / UF<PayrepSelect value={sourceId} onChange={setSourceId} title="Fonte">
     <option value="">Sem vínculo</option>{sources.map(s=><option key={s.id} value={s.id}>{s.organization} · {s.uf}</option>)}
    </PayrepSelect></label>
    <label>Arquivo<input type="file" accept=".pdf,.txt,.html,application/pdf,text/plain,text/html"
     onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   </div>
   <label>Texto / trecho transcrito (opcional)<textarea rows={3} value={manualText}
    onChange={e=>setManualText(e.target.value)}/></label>
   {manualText&&excerpt(manualText)&&<p className="subtle">Trecho identificado: {excerpt(manualText).slice(0,330)}</p>}
   <button type="button" className="primary" disabled={busy} onClick={()=>void importDocument()}>Importar para revisão</button>
  </section>
  <section className="panel"><div className="panel-heading"><h2><BookOpen size={18}/> Documentos ({docs.length})</h2>
   <span className="pill">{docs.filter(d=>d.review_status==='pending').length} pendentes</span></div>
   <div className="table-scroll"><table><thead><tr><th>Documento</th><th>Tipo</th><th>Revisão</th><th>Ações</th></tr></thead>
    <tbody>{docs.length===0?<tr><td colSpan={4}>Nenhum documento coletado ou importado.</td></tr>:
     docs.map(d=><tr key={d.id}><td>{d.title}</td><td>{d.document_type}</td>
      <td>{d.review_status}</td><td>
       <button type="button" className="secondary" onClick={()=>choose(d)}>Revisar</button>
       {(d.storage_path||d.source_url)&&<button type="button" className="text-button"
        onClick={()=>void openOriginal(d)}>Original</button>}
      </td></tr>)}</tbody>
   </table></div>
   {selected&&<div className="collective-review-panel">
    <h3>Revisão: {selected.title}</h3>
    <p className="subtle">{selected.bank_clause_excerpt?
     'Trecho sugerido (não verificado): '+decodeEntities(selected.bank_clause_excerpt).slice(0,1600):
     'Nenhuma cláusula de Banco de Horas extraída. Examine o original.'}</p>
    <div className="form-grid">
     <label>Título<input value={review.title} onChange={e=>setReview(x=>({...x,title:e.target.value}))}/></label>
     <label>Registro MTE<input value={review.registration_code} onChange={e=>setReview(x=>({...x,registration_code:e.target.value}))}/></label>
     <label>Tipo<PayrepSelect value={review.document_type} onChange={value=>setReview(x=>({...x,document_type:value}))}>
      <option value="UNKNOWN">Não identificado</option><option value="ACT">ACT</option>
      <option value="CCT">CCT</option><option value="ADITIVO">Aditivo</option>
     </PayrepSelect></label>
     <label>Vigência inicial<PayrepDatePicker value={review.valid_from} onChange={value=>setReview(x=>({...x,valid_from:value}))}/></label>
     <label>Vigência final<PayrepDatePicker value={review.valid_until} onChange={value=>setReview(x=>({...x,valid_until:value}))}/></label>
     <label>Observações<input value={review.review_note} onChange={e=>setReview(x=>({...x,review_note:e.target.value}))}/></label>
    </div>
    <div className="admin-settings-actions">
     <button type="button" className="primary" disabled={busy} onClick={()=>void reviewDoc('approved')}>Aprovar</button>
     <button type="button" className="secondary" disabled={busy} onClick={()=>void reviewDoc('pending')}>Salvar revisão</button>
     <button type="button" className="secondary" disabled={busy} onClick={()=>void reviewDoc('rejected')}>Rejeitar</button>
    </div>
    {selected.review_status==='approved'&&<>
     <h3>Publicar versão do perfil</h3>
     <p className="subtle">Preencha os fatores conferidos. A publicação não altera os cálculos dos usuários.</p>
     <label>Nome do perfil<input value={profileName} onChange={e=>setProfileName(e.target.value)}/></label>
     <div className="time-bank-policy-factors">{(['weekday_factor','saturday_factor','sunday_factor','holiday_factor'] as const).map((k,i)=>
      <label key={k}>{['Seg. a sexta','Sábado','Domingo','Feriado'][i]}
       <input type="number" min={0.25} max={4} step={0.25} value={factors[k]}
        onChange={e=>setFactors(x=>({...x,[k]:e.target.value}))}/></label>)}</div>
     <div className="form-grid">
      <label>Jornada de referência (minutos)<input type="number" value={factors.daily_target_minutes}
       onChange={e=>setFactors(x=>({...x,daily_target_minutes:e.target.value}))}/></label>
      <label>Prazo compensação (meses)<input type="number" value={factors.settlement_interval_months}
       onChange={e=>setFactors(x=>({...x,settlement_interval_months:e.target.value}))}/></label>
      <label>Meses liquidação<input value={factors.settlement_months}
       onChange={e=>setFactors(x=>({...x,settlement_months:e.target.value}))}/></label>
      <label>Quinzena<PayrepSelect value={factors.settlement_half}
       onChange={value=>setFactors(x=>({...x,settlement_half:value}))}>
       <option value="1">Primeira</option><option value="2">Segunda</option>
      </PayrepSelect></label>
     </div>
     <button type="button" className="primary" disabled={busy} onClick={()=>void publish()}>Publicar perfil verificado</button>
    </>}
   </div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2>Perfis publicados</h2></div>
   {profiles.length===0?<p className="subtle">Nenhum perfil publicado.</p>:
    <div className="table-scroll"><table><thead><tr><th>Empresa</th><th>Perfil</th><th>Versões</th><th>Vigência mais recente</th></tr></thead>
     <tbody>{profiles.map(p=>{const v=versions.filter(v=>v.profile_id===p.id);return <tr key={p.id}>
      <td>{p.organization} · {p.uf}</td><td>{p.name}</td><td>{v.length}</td>
      <td>{v[0]?v[0].valid_from+' a '+v[0].valid_until:'Pendente'}</td>
     </tr>})}</tbody>
    </table></div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2>Solicitações de empresas</h2></div>
   <div className="table-scroll"><table><thead><tr><th>Empresa</th><th>UF</th><th>Status</th><th>Ação</th></tr></thead>
    <tbody>{requests.map(r=><tr key={r.id}><td>{r.organization}</td><td>{r.uf}</td><td>{r.status}</td>
     <td><button type="button" className="secondary" disabled={busy} onClick={()=>void act(async()=>{
      if(!db)throw Error('Supabase não configurado')
      const {error}=await db.from('collective_company_requests').update({status:'reviewing'}).eq('id',r.id)
      if(error)throw Error(error.message)
     },'Solicitação em análise.')}>Analisar</button></td></tr>)}
     {requests.length===0&&<tr><td colSpan={4}>Nenhuma solicitação recebida.</td></tr>}</tbody>
   </table></div>
  </section>
  <section className="panel"><div className="panel-heading"><h2>Histórico das verificações</h2></div>
   <div className="table-scroll"><table><thead><tr><th>Empresa</th><th>Situação</th><th>HTTP</th><th>Detalhe</th></tr></thead>
    <tbody>{runs.map(r=><tr key={r.id}><td>{sources.find(s=>s.id===r.source_id)?.organization||'Fonte'}</td>
     <td>{r.status}</td><td>{r.status_code??'—'}</td><td>{r.error_message||'—'}</td></tr>)}
     {runs.length===0&&<tr><td colSpan={4}>Nenhuma verificação executada.</td></tr>}</tbody>
   </table></div>
  </section>
 </div>
}
function SourceRow({source,busy,onSave}:{source:Source;busy:boolean;onSave:(source:Source,url:string,enabled:boolean)=>void}){
 const [url,setUrl]=useState(source.source_url||'')
 const [enabled,setEnabled]=useState(source.enabled)
 useEffect(()=>{setUrl(source.source_url||'');setEnabled(source.enabled)},[source.source_url,source.enabled])
 return <tr><td>{source.organization} · {source.uf}</td><td>{source.status}</td>
  <td><input value={url} className="collective-url-input" aria-label={'URL '+source.organization}
   onChange={e=>setUrl(e.target.value)}/></td>
  <td>{source.last_checked_at?new Date(source.last_checked_at).toLocaleDateString('pt-BR'):'—'}</td>
  <td><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Ativa</label>
   <button type="button" className="secondary" disabled={busy} onClick={()=>onSave(source,url.trim(),enabled)}>Salvar</button></td>
 </tr>
}
