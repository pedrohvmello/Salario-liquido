import {useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {ArrowLeft,KeyRound,ShieldCheck,Fingerprint,MessageCircle,Trash2,Info,LockKeyhole} from 'lucide-react'
import {ChangePassword} from './AuthGate'
import {db} from '../lib/data'
import {canConfirmDeletion} from '../lib/profile'
import {isHomologationHost} from '../lib/overviewPreview'
import {TotpSettings} from './TotpSettings'

export function AccountSecurityPage({user,onBack}:{user:User;onBack:()=>void}){
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
 const hml=isHomologationHost(window.location.hostname)
 const endOtherSessions=async()=>{
  if(!db)return
  setSessionsBusy(true);setSessionsError('');setSessionsMessage('')
  try{
   const {error}=await db.auth.signOut({scope:'others'})
   if(error)throw error
   setSessionsMessage('Outras sessões encerradas no servidor. Os tokens de acesso existentes permanecem válidos até expirar.')
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
 const deleteAccount=async()=>{
  if(hml){setDeleteError('Exclusão indisponível em HML: a função de exclusão ainda precisa ser publicada e validada no novo Supabase.');return}
  if(!canConfirmDeletion(deleteText,acknowledged)||!db){setDeleteError('Confirme a exclusão da conta.');return}
  setDeleteBusy(true);setDeleteError('')
  try{
   const {data:{session},error:sessionError}=await db.auth.getSession()
   if(sessionError||!session)throw Error('Faça login novamente.')
   const {error}=await db.functions.invoke('delete-my-account',{body:{confirmation:'EXCLUIR'},headers:{Authorization:'Bearer '+session.access_token}})
   if(error)throw Error('Não foi possível excluir a conta. Verifique sua sessão.')
   const {error:logoutError}=await db.auth.signOut({scope:'local'})
   if(logoutError)throw logoutError
  }catch(e){setDeleteError(e instanceof Error?e.message:'Falha na exclusão.')}
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
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Sessões e dispositivos</h2></div>
   <p className="subtle">Revogue os tokens de renovação dos demais aparelhos sem desconectar esta sessão. Os tokens de acesso já emitidos permanecem válidos até o vencimento.</p>
   <div className="account-security-reset">
    <button type="button" className="secondary" disabled={sessionsBusy} onClick={()=>void endOtherSessions()}><ShieldCheck size={16}/>{sessionsBusy?'Encerrando...':'Encerrar sessões de outros dispositivos'}</button>
    {sessionsMessage&&<div className="notice success" role="status">{sessionsMessage}</div>}
    {sessionsError&&<div className="notice danger" role="alert">{sessionsError}</div>}
   </div>
  </section>
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Autenticação em dois fatores (2FA)</h2></div>
   <p className="subtle">Proteja o acesso com códigos de um aplicativo autenticador. A configuração pode ser realizada individualmente em HML.</p>
   {import.meta.env.VITE_ENABLE_TOTP_MFA==='true'
     ?<TotpSettings/>
     :<div className="detail-hint"><Info size={16}/>O 2FA ainda não foi habilitado neste ambiente.</div>}
   <div className="account-security-row"><MessageCircle size={19}/><div><strong>WhatsApp como segundo fator</strong><small>Suportado pelo Supabase mediante configuração de um provedor de mensagens. Ainda não configurado neste projeto.</small></div></div>
   {hml&&<div className="detail-hint"><Info size={16}/>HML está isolada. Antes de ativar um fator, prepare um segundo autenticador de reserva. O Supabase não fornece códigos de recuperação TOTP.</div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2><Fingerprint size={17}/> Biometria e passkeys</h2></div>
   <label className="security-disabled-switch"><span>Ativar login por biometria</span><input type="checkbox" disabled aria-label="Recurso experimental indisponível"/></label>
   <p className="subtle">O padrão WebAuthn usa biometria ou PIN do dispositivo. O suporte a passkeys do Supabase é experimental e precisa de configuração específica de domínio e dispositivo. Não está ativado.</p>
  </section>
  <section className="panel"><div className="panel-heading"><h2><Trash2 size={17}/> Excluir minha conta</h2></div>
   <p className="subtle">Exclusão permanente da conta e dados vinculados. Não é possível desfazer.</p>
   {hml&&<div className="detail-hint"><Info size={16}/>Exclusão temporariamente indisponível em HML até a publicação e validação da função de exclusão.</div>}
   {!deleting?<button type="button" className="secondary profile-destructive" disabled={hml} onClick={()=>setDeleting(true)}><Trash2 size={15}/> Excluir minha conta</button>:<>
    <div className="profile-delete-confirm"><strong>Confirmação de exclusão permanente</strong><p>Essa ação remove dados financeiros, holerites e a conta do Supabase.</p>
     <label>Digite EXCLUIR para confirmar<input type="text" autoComplete="off" value={deleteText} onChange={e=>setDeleteText(e.target.value)} placeholder="EXCLUIR"/></label>
     <label className="checkbox-label"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/> Entendo que a exclusão é permanente.</label>
     <div className="profile-delete-buttons"><button className="secondary" type="button" onClick={()=>setDeleting(false)}>Cancelar</button><button className="profile-delete-submit" type="button" disabled={deleteBusy||hml||!canConfirmDeletion(deleteText,acknowledged)} onClick={()=>void deleteAccount()}>{deleteBusy?'Excluindo...':'Excluir permanentemente'}</button></div>
     {deleteError&&<p role="alert" className="error">{deleteError}</p>}
    </div>
   </>}
  </section>
 </div>
}
