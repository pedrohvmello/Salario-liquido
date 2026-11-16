import {useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {ArrowLeft,KeyRound,ShieldCheck,Fingerprint,Trash2,Info,LockKeyhole} from 'lucide-react'
import {ChangePassword} from './AuthGate'
import {db} from '../lib/data'
import {canConfirmDeletion} from '../lib/profile'
import {TotpSettings} from './TotpSettings'
import {PasskeySettings} from './PasskeySettings'
import {passkeyFeatureEnabled} from '../lib/passkey'

export function AccountSecurityPage({user,onBack,onPayrollReset}:{user:User;onBack:()=>void;onPayrollReset:()=>Promise<void>}){
 const [resetBusy,setResetBusy]=useState(false)
 const [resetMessage,setResetMessage]=useState('')
 const [resetError,setResetError]=useState('')
 const [sessionsBusy,setSessionsBusy]=useState(false)
 const [sessionsMessage,setSessionsMessage]=useState('')
 const [sessionsError,setSessionsError]=useState('')
 const [deleting,setDeleting]=useState(false)
 const [deleteText,setDeleteText]=useState('')
 const [acknowledged,setAcknowledged]=useState(false)
 const [deleteBusy,setDeleteBusy]=useState(false)
 const [deleteError,setDeleteError]=useState('')
 const [dataDeleting,setDataDeleting]=useState(false)
 const [dataDeleteText,setDataDeleteText]=useState('')
 const [dataDeleteAcknowledged,setDataDeleteAcknowledged]=useState(false)
 const [dataDeleteBusy,setDataDeleteBusy]=useState(false)
 const [dataDeleteError,setDataDeleteError]=useState('')
 const [dataDeleteMessage,setDataDeleteMessage]=useState('')
 const [dataDeleteWarning,setDataDeleteWarning]=useState('')
 const endOtherSessions=async()=>{
  if(!db)return
  setSessionsBusy(true);setSessionsError('');setSessionsMessage('')
  try{
   const {error}=await db.auth.signOut({scope:'others'})
   if(error)throw error
   setSessionsMessage('Outras sessões encerradas.')
  }catch(e){setSessionsError(e instanceof Error?e.message:'Não foi possível encerrar outras sessões.')}
  finally{setSessionsBusy(false)}
 }
 const recover=async()=>{
  if(!db||!user.email){setResetError('E-mail indisponível para recuperação.');return}
  setResetBusy(true);setResetError('');setResetMessage('')
  try{
   const {error}=await db.auth.resetPasswordForEmail(user.email,{redirectTo:window.location.origin})
   if(error)throw error
   setResetMessage('Se a conta estiver apta, você receberá um link de redefinição por e-mail.')
  }catch(e){setResetError(e instanceof Error?e.message:'Não foi possível solicitar a redefinição.')}
  finally{setResetBusy(false)}
 }
 const clearPayroll=async()=>{
  if(!canConfirmDeletion(dataDeleteText,dataDeleteAcknowledged)||!db){
   setDataDeleteError('Digite EXCLUIR e marque a confirmação para continuar.')
   return
  }
  setDataDeleteBusy(true);setDataDeleteError('');setDataDeleteMessage('');setDataDeleteWarning('')
  try{
   const {data:{session},error:sessionError}=await db.auth.getSession()
   if(sessionError||!session)throw Error('Faça login novamente.')
   const {data,error}=await db.functions.invoke('payslip-reset',{
    body:{confirmation:'EXCLUIR'},
    headers:{Authorization:'Bearer '+session.access_token}
   })
   if(error){
    const payload=error && 'context' in error ? await (error as {context?:Response}).context?.json().catch(()=>null) : null
    throw Error((payload as {error?:string}|null)?.error||'Não foi possível excluir os dados financeiros. Tente novamente.')
   }
   if(data?.reset!==true)throw Error(data?.error||'A exclusão não foi confirmada.')
   await onPayrollReset()
   setDataDeleting(false);setDataDeleteText('');setDataDeleteAcknowledged(false)
   if(data.cleanupPending)setDataDeleteWarning('Dados financeiros excluídos, mas a limpeza de alguns PDFs precisa de revisão pelo suporte.')
   else setDataDeleteMessage('Holerites, eventos e dados salariais excluídos. Seu cadastro, perfil, segurança e assinatura foram preservados.')
  }catch(e){setDataDeleteError(e instanceof Error?e.message:'Falha ao excluir seus dados.')}
  finally{setDataDeleteBusy(false)}
 }
 const deleteAccount=async()=>{
  if(!canConfirmDeletion(deleteText,acknowledged)||!db){setDeleteError('Confirme o encerramento da conta.');return}
  setDeleteBusy(true);setDeleteError('')
  try{
   const {data:{session},error:sessionError}=await db.auth.getSession()
   if(sessionError||!session)throw Error('Faça login novamente.')
   const {data,error}=await db.functions.invoke('payslip-reset',{
    body:{confirmation:'EXCLUIR',mode:'account'},headers:{Authorization:'Bearer '+session.access_token}
   })
   if(error){
    const context=error&&'context' in error?(error as {context?:Response}).context:undefined
    const payload=context?await context.json().catch(()=>null):null
    throw Error((payload as {error?:string}|null)?.error||'A suspensão não foi concluída. Confira sua sessão e tente novamente.')
   }
   if(data?.reset!==true||data?.accountSuspended!==true)
    throw Error(data?.error||'Não foi possível confirmar a suspensão e a exclusão dos dados.')
   const {error:logoutError}=await db.auth.signOut({scope:'local'})
   if(logoutError)throw logoutError
  }catch(e){setDeleteError(e instanceof Error?e.message:'Falha ao encerrar a conta.')}
  finally{setDeleteBusy(false)}
 }
 return <div className="stack">
  <div className="page-intro"><div><h2>Segurança da conta</h2><p>Senha, autenticação em dois fatores, biometria e exclusão da conta.</p></div><button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  <section className="panel"><div className="panel-heading"><h2><KeyRound size={17}/> Senha</h2></div>
   <p className="subtle">Redefina sua senha por e-mail ou altere-a estando autenticado.</p>
   <div className="account-security-reset"><button className="secondary" type="button" disabled={resetBusy} onClick={()=>void recover()}><LockKeyhole size={16}/>{resetBusy?'Enviando...':'Enviar link para redefinir senha'}</button>
    {resetMessage&&<div role="status" className="notice success">{resetMessage}</div>}
    {resetError&&<div role="alert" className="notice danger">{resetError}</div>}
   </div>
   <details className="account-security-details"><summary>Alterar senha diretamente</summary><ChangePassword requireCurrent/></details>
  </section>
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Autenticação em dois fatores (2FA)</h2></div>
   <p className="subtle">Proteja sua conta usando códigos gerados por um aplicativo autenticador.</p>
   {import.meta.env.VITE_ENABLE_TOTP_MFA==='true'
     ?<TotpSettings/>
     :<div className="detail-hint"><Info size={16}/>O 2FA ainda não foi habilitado neste ambiente.</div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2><Fingerprint size={17}/> Biometria e passkeys</h2></div>
   {passkeyFeatureEnabled
    ?<PasskeySettings/>
    :<div className="detail-hint"><Info size={16}/>Login por passkey ainda não está habilitado neste ambiente. O acesso por senha, Google e TOTP permanece disponível.</div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Sessões e dispositivos</h2></div>
   <p className="subtle">Encerre as sessões de outros dispositivos sem desconectar este aparelho.</p>
   <div className="account-security-reset">
    <button type="button" className="secondary" disabled={sessionsBusy} onClick={()=>void endOtherSessions()}><ShieldCheck size={16}/>{sessionsBusy?'Encerrando...':'Encerrar sessões de outros dispositivos'}</button>
    {sessionsMessage&&<div className="notice success" role="status">{sessionsMessage}</div>}
    {sessionsError&&<div className="notice danger" role="alert">{sessionsError}</div>}
   </div>
  </section>
  <section className="panel"><div className="panel-heading"><h2><Trash2 size={17}/> Excluir meus dados</h2></div>
   <p className="subtle">Reinicie seus dados financeiros sem excluir sua conta. Esta ação é permanente e não pode ser desfeita.</p>
   {dataDeleteMessage&&<div role="status" className="notice success">{dataDeleteMessage}</div>}
   {dataDeleteWarning&&<div role="alert" className="notice danger">{dataDeleteWarning}</div>}
   {!dataDeleting?
    <button type="button" className="secondary profile-destructive" onClick={()=>{setDataDeleteError('');setDataDeleteMessage('');setDataDeleteWarning('');setDataDeleting(true)}}>
     <Trash2 size={15}/> Excluir meus holerites
    </button>:
    <div className="profile-delete-confirm">
     <strong>Confirmação de exclusão dos dados financeiros</strong>
     <p>Serão excluídos permanentemente todos os seus holerites e PDFs armazenados, rubricas, eventos e vigências, registros de horas, comparações de imposto de renda, base e parâmetros de remuneração e da Visão Geral.</p>
     <p><strong>Serão preservados:</strong> seu cadastro, nome e dados do perfil, login, senha, autenticação em dois fatores, passkeys/biometria, assinatura e histórico de suporte. Sua conta continuará ativa.</p>
     <label>Digite EXCLUIR para confirmar
      <input type="text" autoComplete="off" value={dataDeleteText} onChange={e=>setDataDeleteText(e.target.value)} placeholder="EXCLUIR" disabled={dataDeleteBusy}/>
     </label>
     <label className="checkbox-label"><input type="checkbox" checked={dataDeleteAcknowledged} onChange={e=>setDataDeleteAcknowledged(e.target.checked)} disabled={dataDeleteBusy}/> Entendo que todos os dados financeiros serão removidos permanentemente, mas minha conta continuará ativa.</label>
     <div className="profile-delete-buttons">
      <button className="secondary" type="button" disabled={dataDeleteBusy} onClick={()=>{setDataDeleting(false);setDataDeleteText('');setDataDeleteAcknowledged(false);setDataDeleteError('')}}>Cancelar</button>
      <button className="profile-delete-submit" type="button" disabled={dataDeleteBusy||!canConfirmDeletion(dataDeleteText,dataDeleteAcknowledged)} onClick={()=>void clearPayroll()}>{dataDeleteBusy?'Excluindo...':'Excluir meus dados permanentemente'}</button>
     </div>
     {dataDeleteError&&<p role="alert" className="error">{dataDeleteError}</p>}
    </div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2><Trash2 size={17}/> Excluir minha conta</h2></div>
   <p className="subtle">Apague seus dados financeiros e suspenda o acesso. O cadastro e as credenciais serão preservados para eventual reativação, que poderá exigir aprovação administrativa. Os dados apagados não serão recuperados.</p>
   {!deleting?<button type="button" className="secondary profile-destructive" onClick={()=>setDeleting(true)}><Trash2 size={15}/> Excluir minha conta</button>:<>
    <div className="profile-delete-confirm"><strong>Confirmação de encerramento e suspensão</strong><p>Todos os holerites, eventos, registros de horas, parâmetros salariais e PDFs serão apagados. Sua conta ficará suspensa e não poderá acessar o Payrep até solicitar reativação. O cadastro, login, autenticação, assinatura e histórico de suporte serão preservados. A reativação não recupera os dados apagados.</p>
     <label>Digite EXCLUIR para confirmar<input type="text" autoComplete="off" value={deleteText} onChange={e=>setDeleteText(e.target.value)} placeholder="EXCLUIR"/></label>
     <label className="checkbox-label"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> Entendo que meus dados financeiros serão perdidos e a conta ficará suspensa.</label>
     <div className="profile-delete-buttons"><button className="secondary" type="button" onClick={()=>setDeleting(false)}>Cancelar</button><button className="profile-delete-submit" type="button" disabled={deleteBusy||!canConfirmDeletion(deleteText,acknowledged)} onClick={()=>void deleteAccount()}>{deleteBusy?'Processando...':'Apagar dados e suspender conta'}</button></div>
     {deleteError&&<p role="alert" className="error">{deleteError}</p>}
    </div>
   </>}
  </section>
 </div>
}
