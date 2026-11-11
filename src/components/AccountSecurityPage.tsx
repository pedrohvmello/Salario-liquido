import {useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {ArrowLeft,KeyRound,ShieldCheck,Fingerprint,MessageCircle,Trash2,Info,LockKeyhole} from 'lucide-react'
import {ChangePassword} from './AuthGate'
import {db} from '../lib/data'
import {canConfirmDeletion} from '../lib/profile'
import {isHomologationHost} from '../lib/overviewPreview'

export function AccountSecurityPage({user,onBack}:{user:User;onBack:()=>void}){
 const [resetBusy,setResetBusy]=useState(false)
 const [resetMessage,setResetMessage]=useState('')
 const [resetError,setResetError]=useState('')
 const [deleting,setDeleting]=useState(false)
 const [deleteText,setDeleteText]=useState('')
 const [acknowledged,setAcknowledged]=useState(false)
 const [deleteBusy,setDeleteBusy]=useState(false)
 const [deleteError,setDeleteError]=useState('')
 const hml=isHomologationHost(window.location.hostname)
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
  if(hml){setDeleteError('Exclusão bloqueada em homologação: a base é compartilhada com produção.');return}
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
  <div className="page-intro"><div><h2>Configurações da conta</h2><p>Segurança, autenticação, senha e privacidade.</p></div><button className="secondary" type="button" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  <section className="panel"><div className="panel-heading"><h2><KeyRound size={17}/> Senha</h2></div>
   <p className="subtle">Redefina sua senha por e-mail ou altere-a estando autenticado.</p>
   <div className="account-security-reset"><button className="secondary" type="button" disabled={resetBusy} onClick={()=>void recover()}><LockKeyhole size={16}/>{resetBusy?'Enviando...':'Enviar link para redefinir senha'}</button>
    {resetMessage&&<div role="status" className="notice success">{resetMessage}</div>}
    {resetError&&<div role="alert" className="notice danger">{resetError}</div>}
   </div>
   <details className="account-security-details"><summary>Alterar senha diretamente</summary><ChangePassword/></details>
  </section>
  <section className="panel"><div className="panel-heading"><h2><ShieldCheck size={17}/> Autenticação em dois fatores (2FA)</h2></div>
   <p className="subtle">O Supabase suporta códigos TOTP de aplicativos autenticadores, como Google Authenticator ou Microsoft Authenticator.</p>
   <label className="security-disabled-switch"><span>Ativar autenticador (TOTP)</span><input type="checkbox" disabled aria-label="Aguardando integração completa de 2FA"/></label>
   <p className="subtle">A ativação depende da verificação de segundo fator no login e de regras de acesso no servidor. Ainda não está habilitada no Payrep.</p>
   <div className="account-security-row"><MessageCircle size={19}/><div><strong>WhatsApp como segundo fator</strong><small>Suportado pelo Supabase mediante configuração de um provedor de mensagens. Ainda não configurado neste projeto.</small></div></div>
   {hml&&<div className="detail-hint"><Info size={16}/>Não é seguro cadastrar MFA de teste enquanto HML e PRD compartilham a mesma autenticação. O recurso permanecerá desativado até isolar os ambientes.</div>}
  </section>
  <section className="panel"><div className="panel-heading"><h2><Fingerprint size={17}/> Biometria e passkeys</h2></div>
   <label className="security-disabled-switch"><span>Ativar login por biometria</span><input type="checkbox" disabled aria-label="Recurso experimental indisponível"/></label>
   <p className="subtle">O padrão WebAuthn usa biometria ou PIN do dispositivo. O suporte a passkeys do Supabase é experimental e precisa de configuração específica de domínio e dispositivo. Não está ativado.</p>
  </section>
  <section className="panel"><div className="panel-heading"><h2><Trash2 size={17}/> Excluir minha conta</h2></div>
   <p className="subtle">Exclusão permanente da conta e dados vinculados. Não é possível desfazer.</p>
   {hml&&<div className="detail-hint"><Info size={16}/>Exclusão desativada em HML para proteger os dados de produção.</div>}
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
