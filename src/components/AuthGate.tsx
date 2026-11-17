import {useEffect,useRef,useState} from 'react'
import {ChevronRight, CircleCheck, CircleX, LockKeyhole, MailCheck, UserRound} from 'lucide-react'
import {db} from '../lib/data'
import {checkPassword,passwordPolicyDefaults,loadPasswordPolicy,passwordRuleIndicators,passwordRequirements,type PasswordPolicy} from '../lib/passwordPolicy'
import {changePasswordWithCurrentVerification} from '../lib/currentPasswordVerification'
import {autoPromptPreferred,passkeyAutoPromptEnabled,supportsWebAuthn} from '../lib/passkey'
import {cancelPasskeyCeremony,rememberedCredentialId,signInWithDevicePasskey} from '../lib/devicePasskeys'
import {isUnconfirmedEmailError} from '../lib/authEmailConfirmation'

/** Official-style multicolor Google G mark for the OAuth button. */
function GoogleGIcon(){
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={20} height={20} aria-hidden="true" focusable="false">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.75 7.18l7.73 6C44.43 38.03 46.98 31.87 46.98 24.55z"/>
  <path fill="#FBBC05" d="M10.53 28.59C10.05 27.13 9.78 25.59 9.78 24s.27-3.13.75-4.59l-7.98-6.2C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.92-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.19 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
 </svg>
}

export function AuthGate(){
  const [mode,setMode]=useState<'login'|'reset'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmation,setConfirmation]=useState('')
  const [signupResult,setSignupResult]=useState<'email'|'ready'|null>(null)
  const [unconfirmedEmail,setUnconfirmedEmail]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [passwordPolicy,setPasswordPolicy]=useState<PasswordPolicy>(passwordPolicyDefaults)
  const [passwordPolicyReady,setPasswordPolicyReady]=useState(false)
  const [passwordPolicyError,setPasswordPolicyError]=useState('')
  useEffect(()=>{
   let active=true
   void loadPasswordPolicy().then(({policy})=>{
    if(active){setPasswordPolicy(policy);setPasswordPolicyReady(true);setPasswordPolicyError('')}
   }).catch(()=>{
    if(active){setPasswordPolicyReady(false);setPasswordPolicyError('Não foi possível carregar os requisitos de senha. Atualize a página para tentar novamente.')}
   })
   return ()=>{active=false}
  },[])
  const signupPasswordRules=passwordRuleIndicators(password,passwordPolicy)
  const backToLogin=()=>{
   stopPasskeyAttempt();setMode('login');setPassword('');setConfirmation('')
   setSignupResult(null);setUnconfirmedEmail(false);setError('');setMessage('')
  }
  const autoPasskey=autoPromptPreferred()
  const automaticStarted=useRef(false)
  const passkeyRequest=useRef<AbortController|null>(null)
  const passkeySupported=supportsWebAuthn()
  const stopPasskeyAttempt=()=>{
    passkeyRequest.current?.abort()
    cancelPasskeyCeremony()
    passkeyRequest.current=null
  }
  const passkeySignIn=async(automatic=false)=>{
    if(!db||passkeyRequest.current)return
    const controller=new AbortController()
    passkeyRequest.current=controller
    try{
      await signInWithDevicePasskey({signal:controller.signal,useRemembered:automatic})
      // The existing auth state listener handles AAL1 to AAL2 TOTP escalation.
    }catch{
      // Automatic passkey prompts are optional; fallback to password or Google.
    }finally{
      if(passkeyRequest.current===controller)passkeyRequest.current=null
    }
  }
  useEffect(()=>{
    // Supabase session recovery happens in App before AuthGate mounts.
    // Request the device's native passkey UI at most once per login screen.
    // Do not interrupt users who have not registered a passkey on this device.
    if(!passkeyAutoPromptEnabled||!passkeySupported||!autoPasskey||!rememberedCredentialId()||automaticStarted.current)return
    automaticStarted.current=true
    void passkeySignIn(true)
  },[])
  const act=async()=>{
    if(!db)return
    stopPasskeyAttempt()
    setBusy(true);setError('');setMessage('')
    try{
      if(mode==='reset'){
        const {error}=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin})
        if(error)throw error
        setMessage('Se a conta existir, você receberá instruções para recuperar a senha.')
      }else if(mode==='signup'){
        if(!passwordPolicyReady)throw Error('Os requisitos de senha não estão disponíveis. Recarregue a página.')
        const latest=await loadPasswordPolicy()
        if(latest.policy.minLength!==passwordPolicy.minLength||latest.policy.preset!==passwordPolicy.preset){
         setPasswordPolicy(latest.policy)
         throw Error('Os requisitos de senha foram atualizados. Confira as novas validações e tente novamente.')
        }
        const missing=checkPassword(password,latest.policy)
        if(missing.length)throw Error('A senha precisa conter: '+missing.join(', ')+'.')
        if(password!==confirmation)throw Error('As senhas não coincidem. Confira a confirmação.')
        const {data,error}=await db.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin}})
        if(error)throw error
        // Supabase may deliberately return an obfuscated success for an existing
        // account. Do not claim confirmation was sent to an enumerated address.
        setPassword('');setConfirmation('')
        setSignupResult(data.session?'ready':'email')
      }else{
        const {error}=await db.auth.signInWithPassword({email:email.trim(),password})
        if(error)throw error
      }
    }catch(e){
     if(mode==='login'&&isUnconfirmedEmailError(e)){
      setUnconfirmedEmail(true)
      setPassword('')
     }else setError(e instanceof Error?e.message:'Não foi possível concluir a solicitação.')
    }
    finally{setBusy(false)}
  }
  const googleEnabled=import.meta.env.VITE_ENABLE_GOOGLE_OAUTH==='true'
  const googleSignIn=async()=>{
    if(!db)return
    stopPasskeyAttempt()
    setBusy(true);setError('');setMessage('')
    try{
      const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}})
      if(error)throw error
    }catch(e){setError(e instanceof Error?e.message:'Falha ao iniciar o login Google.');setBusy(false)}
  }
  return <div className="auth-background"><div className="auth-shell"><div className="auth-card">
    <div className="brand auth-brand brand--wordmark">
      <img className="brand-full-logo" src="/brand/payrep-logo.svg" alt="Payrep" width="290" height="87"/>
    </div>
    <h1>{unconfirmedEmail?'E-mail pendente de confirmação':signupResult?(signupResult==='email'?'Verifique seu e-mail':'Cadastro concluído'):mode==='reset'?'Recuperar senha':mode==='signup'?'Criar uma conta':'Acesse sua conta'}</h1>
    <p>{unconfirmedEmail?'Para acessar o Payrep, você precisa confirmar seu endereço de e-mail.':signupResult?(signupResult==='email'
       ?'Para continuar, confirme seu endereço de e-mail. A liberação da conta poderá depender de aprovação administrativa.'
       :'Sua solicitação de acesso foi recebida. O Payrep verificará a autorização da conta.')
      :mode==='reset'?'Informe o e-mail de sua conta. O link de recuperação abrirá esta aplicação.'
      :mode==='signup'?'Cadastre-se para solicitar acesso. Conforme a política administrativa, sua conta poderá exigir aprovação.'
      :'Seus holerites e registros ficam privados e vinculados à sua conta.'}</p>
    {(signupResult||unconfirmedEmail)?
     <div className="signup-confirmation-screen" role="status">
      <div className="signup-confirmation-icon"><MailCheck size={29} aria-hidden="true"/></div>
      <p>{unconfirmedEmail
       ?'Seu endereço ainda não foi confirmado. Acesse a caixa de entrada do e-mail cadastrado e clique em “Confirmar meu e-mail” na mensagem do Payrep. Confira também as pastas Spam e Promoções. Depois, volte e faça login.'
       :signupResult==='email'
       ?'Se o cadastro foi aceito, o e-mail de confirmação foi enviado para '+email.trim()+'. Confira também Spam e Promoções. O link valida o endereço de e-mail, não a senha.'
       :'A conta foi criada. Se houver aprovação administrativa, aguarde a liberação para entrar.'}</p>
      <button type="button" className="primary" onClick={backToLogin}>
       Voltar ao login <ChevronRight size={17} aria-hidden="true"/>
      </button>
     </div>
    :<>
    <form onSubmit={e=>{e.preventDefault();void act()}}>
      <label>E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>
      {mode!=='reset'&&<label>Senha<input type="password" required minLength={mode==='signup'?passwordPolicy.minLength:6} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup'?'Mínimo de '+passwordPolicy.minLength+' caracteres':'Sua senha'}/></label>}
      {mode==='signup'&&<label>Confirmar senha<input type="password" required minLength={passwordPolicy.minLength} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} aria-invalid={confirmation.length>0&&confirmation!==password} aria-describedby="signup-password-check signup-password-rules" placeholder="Digite a senha novamente"/></label>}
      {mode==='signup'&&<div id="signup-password-rules" className="signup-password-rules" aria-label="Requisitos de senha">
       {signupPasswordRules.map(rule=><div key={rule.id} className={'signup-password-rule '+(rule.met?'is-met':'is-missing')}>
        {rule.met?<CircleCheck size={15} aria-hidden="true"/>:<CircleX size={15} aria-hidden="true"/>}
        <span>{rule.label}</span>
       </div>)}
      </div>}
      {mode==='signup'&&confirmation.length>0&&<small id="signup-password-check" className={password===confirmation?'password-confirm-ok':'password-confirm-error'} role="status">
       {password===confirmation?'Senhas coincidem.':'As senhas não coincidem.'}
      </small>}
      {mode==='signup'&&passwordPolicyError&&<p className="error" role="alert">{passwordPolicyError}</p>}
      <button className="primary" disabled={busy||(mode==='signup'&&!passwordPolicyReady)} type="submit">{mode==='login'&&<UserRound size={17} aria-hidden="true"/>}{mode==='reset'?'Enviar link de recuperação':mode==='signup'?'Solicitar cadastro':'Entrar'} <ChevronRight size={17}/></button>
      {error&&<p className="error" role="alert">{error}</p>}
      {message&&<p className="auth-success" role="status">{message}</p>}
    </form>
    {mode!=='reset'&&googleEnabled&&<><div className="auth-separator">ou</div><button type="button" className="secondary google-sign-in" onClick={()=>{void googleSignIn()}} disabled={busy}><GoogleGIcon/> Continuar com Google</button></>}
    <div className="auth-bottom-actions">
      {mode==='login'&&<button className="text-button" type="button" onClick={()=>{stopPasskeyAttempt();setMode('signup');setPassword('');setConfirmation('');setError('');setMessage('')}}>Criar conta</button>}
      <button className="text-button" type="button" onClick={()=>{stopPasskeyAttempt();setMode(mode==='login'?'reset':'login');setPassword('');setConfirmation('');setSignupResult(null);setError('');setMessage('')}}>
        <LockKeyhole size={15}/>{mode==='login'?'Esqueci minha senha':'Voltar ao login'}
      </button>
    </div>
    </>}
  </div>
  <footer className="auth-public-footer" aria-label="Navegação institucional">
    <span>© 2026 Payrep</span>
    <nav aria-label="Links institucionais">
      <a href="/home">Home</a>
      <a href="/privacidade">Política de Privacidade</a>
      <a href="/termos">Termos de Uso</a>
    </nav>
  </footer>
  </div></div>
}

export function ChangePassword({onComplete,requireCurrent=false}:{onComplete?:()=>void;requireCurrent?:boolean}={}){
  const [password,setPassword]=useState('')
  const [currentPassword,setCurrentPassword]=useState('')
  const [confirmation,setConfirmation]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [policy,setPolicy]=useState<PasswordPolicy|null>(null)
  const [policyLoadError,setPolicyLoadError]=useState('')
  useEffect(()=>{
   let active=true
   void loadPasswordPolicy().then(({policy:loaded})=>{if(active){setPolicy(loaded);setPolicyLoadError('')}})
    .catch(()=>{if(active){setPolicy(null);setPolicyLoadError('Não foi possível carregar os requisitos de senha.')}})
   return ()=>{active=false}
  },[])
  async function update(){
    if(!db)return
    setError('');setMessage('')
    if(!policy){setError('Não foi possível consultar os requisitos atuais. Atualize a página.');return}
    let latest:PasswordPolicy
    try{
     const snapshot=await loadPasswordPolicy()
     latest=snapshot.policy
     if(latest.minLength!==policy.minLength||latest.preset!==policy.preset){
      setPolicy(latest)
      setError('Os requisitos de senha mudaram. Revise a nova política antes de continuar.')
      return
     }
    }catch{setError('Não foi possível verificar os requisitos de senha. Tente novamente.');return}
    const missing=checkPassword(password,latest)
    if(missing.length){setError('A senha precisa conter: '+missing.join(', ')+'.');return}
    if(password!==confirmation){setError('As senhas informadas são diferentes.');return}
    if(requireCurrent&&!currentPassword){setError('Informe a senha atual.');return}
    if(requireCurrent&&password===currentPassword){setError('A nova senha deve ser diferente da atual.');return}
    setBusy(true)
    try{
      if(requireCurrent)await changePasswordWithCurrentVerification(currentPassword,password)
      else{
        const {error}=await db.auth.updateUser({password})
        if(error)throw error
      }
      setPassword('');setConfirmation('');setCurrentPassword('');setMessage('Senha atualizada com sucesso.')
      onComplete?.()
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar a senha.')}
    finally{setBusy(false)}
  }
  return <form className="form" onSubmit={e=>{e.preventDefault();void update()}}>
    <p className="subtle">{policy?passwordRequirements(policy):'Consultando os requisitos atuais de senha...'}</p>
    {policyLoadError&&<p className="error" role="alert">{policyLoadError}</p>}
    {requireCurrent&&<label>Senha atual<input type="password" required autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>}
    <label>Nova senha<input type="password" autoComplete="new-password" minLength={policy?.minLength||passwordPolicyDefaults.minLength} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Confirme a nova senha<input type="password" autoComplete="new-password" minLength={policy?.minLength||passwordPolicyDefaults.minLength} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    {password&&<small className="password-policy-status" role="status">{checkPassword(password,policy||passwordPolicyDefaults).length?'Faltam: '+checkPassword(password,policy||passwordPolicyDefaults).join(', '):'Senha atende aos requisitos atuais.'}</small>}
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="auth-success">{message}</p>}
    <button type="submit" disabled={!db||busy||!policy} className="primary"><LockKeyhole size={16}/> {requireCurrent?"Alterar senha":"Definir senha"}</button>
  </form>
}
