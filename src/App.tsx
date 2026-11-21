import {useEffect,useMemo,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {LayoutDashboard,History,Clock3,CalendarClock,ChartNoAxesCombined,FileInput,Settings2,FileSpreadsheet,Wallet,ContactRound,Plus,Trash2,Pencil,FileText,ShieldCheck,AlertTriangle,CheckCircle2,Menu,ChevronRight,Upload,RefreshCw,Info,ArrowUpRight,Bot,PanelLeftClose,PanelLeftOpen,Sparkles,ChevronLeft} from 'lucide-react'
import {brl,calculatePayroll2026,defaults,type SalaryParameters} from './lib/money'
import {type DayEntry} from './lib/calendar'
import {paidOvertime,type TimeBankPolicy} from './lib/timeBank'
import {type WorkRegime} from './lib/workRegime'
import {overtimeComponents,overtimeDsr} from './lib/overtimeDsr'
import {type BaseLocation,baseKey,baseLabel} from './lib/base'
import {loadHolidayCatalog,type HolidayCatalog} from './lib/holidayBase'
import {DefinitionsPage} from './components/DefinitionsPage'
import {PayrepSelect} from './components/PayrepSelect'
import {PayrepDatePicker} from './components/PayrepDatePicker'
import {FortnightTimesheet} from './components/FortnightTimesheet'
import {todayInSaoPaulo,fortnightDisplay,shiftFortnight} from './lib/fortnight'
import {FortnightPeriodPicker} from './components/FortnightPeriodPicker'
import {TaxPreview} from './components/TaxPreview'
import {VacationOverview} from './components/VacationOverview'
import {ThirteenthOverview} from './components/ThirteenthOverview'
import {AnalyticsDashboard} from './components/AnalyticsDashboard'
import {AdminDashboard} from './components/AdminDashboard'
import {recordAppSession} from './lib/admin'
import {formatEventInput,formatEventValue,parseEventValue} from './lib/eventValue'
import {latestEffectiveEvent} from './lib/eventSources'
import {defaultPensionRule,encodePensionNotes,parsePensionNotes,pensionRuleLabels,type PensionRule} from './lib/pensionRule'
import {overviewCardDefinitions,defaultOverviewCards,normalizeOverviewCards,followingMonth,projectedMealBenefit,normalizeOverviewCardColors,type OverviewCardId,type OverviewCardColors} from './lib/overview'
import {reconcileThirteenth} from './lib/thirteenthLedger'
import {remunerationSeries} from './lib/remunerationSeries'
import {annualSalarySummary} from './lib/annualSalary'
import {reconcileVacations,vacationAdvanceFromLines,type StatementRubric} from './lib/vacation'
import {parsePdf,type ParsedStatement} from './lib/parse'
import {cashAdjustmentsByMonth} from './lib/payrollAdjustments'
import {pprReceiptKey} from './lib/pprDuplicate'
import {db,eventsKinds,eventCandidates,effectiveParams,getData,getMembership,removeEvent,saveEvent,saveBase,saveWorkRegime,saveOverviewCards,saveStatements,type SalaryEvent,type SavedStatement} from './lib/data'
import {AuthGate,ChangePassword} from './components/AuthGate'
import {PayslipDocuments} from './components/PayslipDocuments'
import {requiresPasswordSetup} from './lib/authRedirect'
import {billingReturnFromUrl,withoutBillingReturn,type BillingReturn} from './lib/billingReturn'
import {pathnameWithoutEmptyFragment} from './lib/urlFragment'
import {ProfileMenu} from './components/ProfileMenu'
import {ProfilePage} from './components/ProfilePage'
import {SubscriptionPage} from './components/SubscriptionPage'
import {AdminSettingsPage} from './components/AdminSettingsPage'
import {AdminPepSettingsPage} from './components/AdminPepSettingsPage'
import {AdminFinancePage} from './components/AdminFinancePage'
import {AdminPlansPage} from './components/AdminPlansPage'
import {AdminSupportTickets} from './components/AdminSupportTickets'
import {AccountSecurityPage} from './components/AccountSecurityPage'
import {PayrepConfirmDialog} from './components/PayrepConfirmDialog'
import {SupportPage} from './components/SupportPage'
import {PersonalPepPage} from './components/PersonalPepPage'
import {loadMyEffectivePayrepPlan} from './lib/account'
import {MfaGate} from './components/MfaGate'
import {TotpSettings} from './components/TotpSettings'
import {mfaGateForAssurance} from './lib/mfaAssurance'
import {sessionAuthTransition} from './lib/sessionAuthTransition'
import {accessScreenFor,adminNeedsTotp,membershipAccessState,type AccessDecision} from './lib/accessGate'
import {CompetencePicker} from './components/CompetencePicker'
import {OverviewCardsEditor} from './components/OverviewCardsEditor'
import {PayrepMobileNavigationSurface} from './components/PayrepMobileNavigationSurface'
import {AppPageBoundary} from './components/AppPageBoundary'
import type {MobilePrimaryView} from './lib/mobile-primary-navigation'

type Section='overview'|'history'|'hours'|'events'|'analytics'|'income-tax'|'pep-personal'|'imports'|'definitions'|'admin'|'admin-settings'|'admin-pep'|'admin-finance'|'admin-plans'|'admin-support'|'profile'|'subscription'|'account-settings'|'help'
type TimeRecord=DayEntry&{id:string}
const nav=[
 {id:'overview',label:'Visão geral',icon:LayoutDashboard},
 {id:'imports',label:'Meus Holerites',icon:FileInput},
 {id:'events',label:'Eventos e vigências',icon:CalendarClock},
 {id:'history',label:'Histórico salarial',icon:History},
 {id:'hours',label:'Controle de horas',icon:Clock3},
 {id:'analytics',label:'Análises',icon:ChartNoAxesCombined},
 {id:'income-tax',label:'Informe IR',icon:FileSpreadsheet},
 {id:'pep-personal',label:'Pergunte ao Pep',icon:Bot},
 {id:'definitions',label:'Definições',icon:Settings2},
 {id:'admin-settings',label:'Configurações',icon:Settings2},
 {id:'admin-pep',label:'Configurações do Pep',icon:Sparkles},
 {id:'admin-finance',label:'Financeiro',icon:Wallet},
 {id:'admin-plans',label:'Planos e Assinaturas',icon:ContactRound}
] as const
const today=()=>new Date().toISOString().slice(0,10)
const currentMonth=()=>today().slice(0,7)
const monthLabel=(m:string)=>{const [y,mm]=m.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,mm-1,1)))}
const dateBR=(s:string)=>{const [y,m,d]=s.split('-');return d+'/'+m+'/'+y}
function Stat({name,value,note,tone}:{name:string;value:string;note?:string;tone?:string}){return <div className="stat"><span className="subtle">{name}</span><strong className={tone||''}>{value}</strong>{note&&<small>{note}</small>}</div>}
function Panel({title,extra,children}:{title:string;extra?:React.ReactNode;children:React.ReactNode}){return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{extra}</div>{children}</section>}
function Empty({text}:{text:string}){return <div className="empty"><FileText size={27}/><p>{text}</p></div>}
function eventNotesText(event:SalaryEvent):string {
 if(event.kind!=='pensionPercent')return event.notes
 const {note,rule}=parsePensionNotes(event.notes)
 const criteria=Object.entries(rule).filter(([,active])=>active)
  .map(([key])=>pensionRuleLabels[key as keyof PensionRule]).join(', ')
 return [note,criteria?'Critérios ativos: '+criteria:''].filter(Boolean).join(' · ')
}
const fieldNames:Record<string,string>={salary:'Salário-base',trienio:'Triênio',dependents:'Dependentes',mealBenefit:'Vale-refeição (por dia útil)',fixedBenefit:'Vale-benefício',childcareBenefit:'Auxílio-creche',esppPercent:'ESPP (%)',privatePensionPercent:'Previdência (%)',privatePensionAmount:'Previdência (R$)',pensionPercent:'Pensão (%)',fixedPension:'Pensão fixa',advancePercent:'Adiantamento (%)'}

/**
 * Desktop guests see the public Home first. Keep the direct sign-in experience
 * on phones and at /login; never redirect OAuth callbacks or recovery links.
 */
function GuestEntry(){
 const [desktop,setDesktop]=useState(()=>window.matchMedia('(min-width: 821px)').matches)
 useEffect(()=>{
  const media=window.matchMedia('(min-width: 821px)')
  const update=()=>setDesktop(media.matches)
  media.addEventListener('change',update)
  return ()=>media.removeEventListener('change',update)
 },[])
 const path=window.location.pathname
 const plainRoot=path==='/'&&!window.location.search&&!window.location.hash&&!window.__salaryAuthIntent
 const showHome=desktop&&plainRoot
 useEffect(()=>{
  if(showHome)window.location.replace('/home')
 },[showHome])
 if(showHome)return <div className="centered" aria-live="polite"><div className="spinner"/>Abrindo a Home...</div>
 return <AuthGate/>
}

export default function App(){
 const [section,setSection]=useState<Section>('overview')
 const bootstrappedIdentityRef=useRef<string|null>(null)
 const [billingReturn,setBillingReturn]=useState<BillingReturn|null>(()=>billingReturnFromUrl(window.location.href))
 const [menu,setMenu]=useState(false)
 const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>{
  try{return window.localStorage.getItem('payrep.sidebar.collapsed')==='true'}catch{return false}
 })
 const [sidebarTooltip,setSidebarTooltip]=useState<{label:string;left:number;top:number}|null>(null)
 const toggleDesktopSidebar=()=>{
  setSidebarCollapsed(previous=>!previous)
  setSidebarTooltip(null)
 }
 useEffect(()=>{
  try{window.localStorage.setItem('payrep.sidebar.collapsed',String(sidebarCollapsed))}catch{}
 },[sidebarCollapsed])
 const showSidebarTooltip=(label:string,element:HTMLElement)=>{
  if(!sidebarCollapsed||!window.matchMedia('(min-width:761px)').matches)return
  const rect=element.getBoundingClientRect()
  setSidebarTooltip({label,left:rect.right+12,top:rect.top+rect.height/2})
 }
 useEffect(()=>{
  if(!menu)return
  const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(false)}
  window.addEventListener('keydown',closeOnEscape)
  return ()=>window.removeEventListener('keydown',closeOnEscape)
 },[menu])
 const [user,setUser]=useState<User|null>(null)
 const authUserIdRef=useRef<string|null>(null)
 const [authReady,setAuthReady]=useState(!db)


 useEffect(()=>{
  if(!authReady)return
  const path=pathnameWithoutEmptyFragment(window.location.href)
  if(path!==null)window.history.replaceState(window.history.state,'',path)
 },[authReady,user?.id])
 const mfaEnabled=import.meta.env.VITE_ENABLE_TOTP_MFA==='true'
 // Admin enforcement is a separate rollout switch: enroll verified factors first.
 const requireAdminTotp=mfaEnabled&&import.meta.env.VITE_REQUIRE_ADMIN_TOTP==='true'
 const [mfaState,setMfaState]=useState<'checking'|'ready'|'challenge'|'error'>(mfaEnabled?'checking':'ready')
 const [mfaRetry,setMfaRetry]=useState(0)
 const [passwordSetup,setPasswordSetup]=useState(()=>requiresPasswordSetup(window.__salaryAuthIntent))
 const [accessDecision,setAccessDecision]=useState<AccessDecision|null>(null)
 useEffect(()=>{
  // Route only after authentication, MFA and account approval. The callback
  // is never used as proof of payment or to grant plan entitlements.
  if(!user||!authReady||accessDecision?.userId!==user.id||accessDecision.state!=='approved'
   ||(mfaEnabled&&mfaState!=='ready')||passwordSetup)return
  const returned=billingReturnFromUrl(window.location.href)
  if(returned){
   setBillingReturn(returned)
   setSection('subscription')
   window.history.replaceState(window.history.state,'',withoutBillingReturn(window.location.href))
  }
 },[authReady,user?.id,accessDecision?.userId,accessDecision?.state,mfaState,passwordSetup])
 useEffect(()=>{
  if(!user||!authReady||accessDecision?.userId!==user.id||accessDecision.state!=='approved'
    ||(mfaEnabled&&mfaState!=='ready')||passwordSetup)return
  if(bootstrappedIdentityRef.current===user.id)return
  bootstrappedIdentityRef.current=user.id
  // After a new sign-in start on a known page; do not override payment returns.
  if(!billingReturnFromUrl(window.location.href)&&!billingReturn)setSection('overview')
  window.scrollTo({top:0,left:0,behavior:'auto'})
 },[user?.id,authReady,accessDecision?.userId,accessDecision?.state,mfaState,passwordSetup,billingReturn])
 const [accessRetry,setAccessRetry]=useState(0)
 const [reactivationDialog,setReactivationDialog]=useState(false)
 const [reactivationBusy,setReactivationBusy]=useState(false)
 const [reactivationError,setReactivationError]=useState('')
 const [isAdmin,setIsAdmin]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [busy,setBusy]=useState(false)
 const [month,setMonth]=useState(currentMonth())
 const [year,setYear]=useState('all')
 const [statements,setStatements]=useState<SavedStatement[]>([])
 const [documentStatements,setDocumentStatements]=useState<SavedStatement[]>([])
 const [allLines,setAllLines]=useState<StatementRubric[]>([])
 const [events,setEvents]=useState<SalaryEvent[]>([])
 const [eventsYear,setEventsYear]=useState('all')
 const [eventsKindFilter,setEventsKindFilter]=useState('all')
 const [eventToDelete,setEventToDelete]=useState<SalaryEvent|null>(null)
 const [hoursAnchor,setHoursAnchor]=useState(todayInSaoPaulo)
 const [periodPickerOpen,setPeriodPickerOpen]=useState(false)
 const [records,setRecords]=useState<TimeRecord[]>([])
 const [timeBankPolicies,setTimeBankPolicies]=useState<TimeBankPolicy[]>([])
 const [base,setBase]=useState<BaseLocation|null>(null)
 const [workRegime,setWorkRegime]=useState<WorkRegime>('regular')
 const [holidayCalendar,setHolidayCalendar]=useState<HolidayCatalog|null>(null)
 const [holidayStatus,setHolidayStatus]=useState<'unconfigured'|'loading'|'ready'|'failed'>('unconfigured')
 const [params,setParams]=useState<SalaryParameters>(!db?{...defaults,salary:9500,trienio:100,dependents:1,esppPercent:5,privatePensionPercent:2,pensionMethod:'none'}:defaults)
 const [selectedStmt,setSelectedStmt]=useState<SavedStatement|null>(null)
 const [statementLines,setStatementLines]=useState<Array<{code:string;description:string;amount:number;side:string}>>([])
 const [importFiles,setImportFiles]=useState<File[]>([])
 const [previews,setPreviews]=useState<ParsedStatement[]>([])
 const [importSelected,setImportSelected]=useState<string[]>([])
 const [importUseCompetenceDate,setImportUseCompetenceDate]=useState(false)
 const [payslipTab,setPayslipTab]=useState<'import'|'documents'>('documents')
 const [payslipAccess,setPayslipAccess]=useState<'loading'|'full'|'limited'|'error'>('loading')
 useEffect(()=>{
  if(section!=='imports'||!user){setPayslipAccess('loading');return}
  let alive=true
  setPayslipAccess('loading')
  void loadMyEffectivePayrepPlan().then(result=>{
   if(alive)setPayslipAccess(result.effectivePlan==='full'?'full':'limited')
  }).catch(()=>{if(alive)setPayslipAccess('error')})
  return ()=>{alive=false}
 },[section,user?.id])
 const [eventId,setEventId]=useState<string|undefined>()
 const [eventKind,setEventKind]=useState('salary')
 const [eventValue,setEventValue]=useState('')
 const [eventDate,setEventDate]=useState(today())
 const [eventNote,setEventNote]=useState('')
 const [pensionOptions,setPensionOptions]=useState<PensionRule>({...defaultPensionRule})
 const [overviewCards,setOverviewCards]=useState<OverviewCardId[]>([...defaultOverviewCards])
 const [overviewCardColors,setOverviewCardColors]=useState<OverviewCardColors>({})

 useEffect(()=>{
  const authClient=db
  if(!authClient)return
  let active=true
  // INITIAL_SESSION is the single authoritative bootstrap. Avoid racing a
  // second getSession() result against a cross-tab SIGNED_OUT event.
  const {data:subscription}=authClient.auth.onAuthStateChange((event,session)=>{
   if(!active)return
   const nextUserId=session?.user?.id??null
   const change=sessionAuthTransition(event,authUserIdRef.current,nextUserId)
   authUserIdRef.current=nextUserId
   if(mfaEnabled&&change.resetMfa){
    // New identity or actual sign-out: always re-enter the security gate.
    setMfaState('checking')
   }
   if(mfaEnabled&&change.backgroundMfaCheck){
    // SIGNED_IN fires when a tab is refocused; TOKEN_REFRESHED fires when
    // Supabase renews a session. Neither should unmount the current screen.
    // Verify assurance asynchronously, *outside* the auth callback, and
    // interrupt only if the session has actually lost required assurance.
    void Promise.resolve().then(()=>{
     if(!active||authUserIdRef.current!==nextUserId)return null
     return authClient.auth.mfa.getAuthenticatorAssuranceLevel()
    }).then(result=>{
     if(!active||authUserIdRef.current!==nextUserId||!result)return
     const nextState=mfaGateForAssurance(result.data,result.error)
     if(nextState!=='ready')setMfaState(nextState)
    }).catch(()=>{
     if(active&&authUserIdRef.current===nextUserId)setMfaState('error')
    })
   }
   setUser(session?.user||null)
   setAuthReady(true)
   if(event==='PASSWORD_RECOVERY')setPasswordSetup(true)
   if(event==='SIGNED_OUT')setPasswordSetup(false)
  })
  return ()=>{active=false;subscription.subscription.unsubscribe()}
 },[])
 useEffect(()=>{
  if(!mfaEnabled){setMfaState('ready');return}
  if(!db||!user){setMfaState('checking');return}
  let active=true
  setMfaState('checking')
  void db.auth.mfa.getAuthenticatorAssuranceLevel().then(({data,error})=>{
   if(active)setMfaState(mfaGateForAssurance(data,error))
  }).catch(()=>{if(active)setMfaState('error')})
  return ()=>{active=false}
 },[mfaEnabled,user?.id,mfaRetry])
 const refresh=async(isCurrent:()=>boolean=()=>true)=>{
  if(!db||!user)return
  const checkedUserId=user.id
  const membership=await getMembership()
  if(!isCurrent())return
  const state=membershipAccessState(membership)
  if(state!=='approved'){
   setIsAdmin(false)
   setAccessDecision({userId:checkedUserId,state})
   return
  }
  // Admin enrollment is a separate step from membership approval.
  // Never authorize administrative data from client-controlled metadata.
  if(requireAdminTotp&&membership?.role==='admin'){
   const {data:factors,error:factorsError}=await db.auth.mfa.listFactors()
   if(factorsError)throw factorsError
   if(!isCurrent())return
   const verifiedCount=factors.totp.filter(f=>f.status==='verified').length
   if(adminNeedsTotp(membership,verifiedCount,requireAdminTotp)){
    setIsAdmin(false)
    setAccessDecision({userId:checkedUserId,state:'enroll-mfa'})
    return
   }
   const {data:assurance,error:assuranceError}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
   if(assuranceError||assurance?.currentLevel!=='aal2')throw Error('Acesso administrativo exige confirmação do aplicativo autenticador.')
  }
  // Only display the approved application once the account and its data are ready.
  const d=await getData()
  if(!isCurrent())return
  setDocumentStatements(d.statements)
  setStatements(d.statements.filter(x=>!x.duplicate_of));setAllLines(d.lines);setEvents(d.events)
  setTimeBankPolicies(d.bankPolicies)
  setRecords(d.entries.map(x=>({
   id:x.id,date:x.date,
   start:x.start_at?.slice(0,5)||'',lunchStart:x.lunch_start?.slice(0,5)||'',
   lunchEnd:x.lunch_end?.slice(0,5)||'',end:x.end_at?.slice(0,5)||'',
   holidayOverride:x.holiday_override,
   additionalHours:x.additional_minutes
    ?String(Math.floor(x.additional_minutes/60)).padStart(2,'0')+':'+String(x.additional_minutes%60).padStart(2,'0'):'',
   comments:x.comments||'',
   bankHours:x.bank_hours??false,
   effectiveHoliday:x.effective_holiday??false,
   bankDeltaMinutes:x.bank_delta_minutes??0,
   bankWeightedMinutes:x.bank_weighted_minutes??0
  })))
  setParams({...defaults,...d.settings})
  setOverviewCards(normalizeOverviewCards(d.overviewCards,d.overviewCardsVersion??0))
  setOverviewCardColors(normalizeOverviewCardColors(d.overviewCardColors))
  setBase(d.base)
  setWorkRegime(d.workRegime)
  setIsAdmin(membership?.role==='admin')
  setAccessDecision({userId:checkedUserId,state:'approved'})
  // Metrics are supplementary: a monitoring error must never block payroll access.
  void recordAppSession().catch(()=>{})
 }
 useEffect(()=>{
  let current=true
  if(user&&(!mfaEnabled||mfaState==='ready')){
   setAccessDecision({userId:user.id,state:'checking'})
   setError('')
   void refresh(()=>current).catch(e=>{
    if(!current)return
    setError(e instanceof Error?e.message:'Falha ao validar o acesso.')
    setAccessDecision({userId:user.id,state:'error'})
   })
  }else{
   setAccessDecision(null)
   setIsAdmin(false)
   setStatements([]);setDocumentStatements([]);setAllLines([]);setEvents([]);setRecords([]);setTimeBankPolicies([]);setWorkRegime('regular')
  }
  return ()=>{current=false}
 // User metadata updates (e.g. saving a profile) must not unmount the active screen.
 // Only changes of account identity or MFA assurance require rechecking access.
 },[user?.id,mfaState,accessRetry])
 const requestReactivation=async()=>{
  if(!db||reactivationBusy)return
  setReactivationBusy(true);setReactivationError('')
  try{
   const {data,error}=await db.rpc('request_my_reactivation',{p_confirmation:'REATIVAR'})
   if(error)throw Error(error.message)
   if(!data||!['pending','approved'].includes(data.status))throw Error('A solicitação não foi confirmada.')
   setReactivationDialog(false)
   setAccessRetry(n=>n+1)
  }catch(e){setReactivationError(e instanceof Error?e.message:'Não foi possível solicitar a reativação.')}
  finally{setReactivationBusy(false)}
 }
 const task=async(fn:()=>Promise<void>,success:string)=>{
  setBusy(true);setError('');setNotice('')
  try{await fn();setNotice(success)}catch(e){setError(e instanceof Error?e.message:'Falha inesperada')}finally{setBusy(false)}
 }
 const persistOverviewCards=async(next:OverviewCardId[],selectedColors?:OverviewCardColors)=>{
  if(!db||!user)throw Error('Faça login para salvar os cartões.')
  const cards=normalizeOverviewCards(next)
  const colors=normalizeOverviewCardColors(selectedColors??overviewCardColors)
  await saveOverviewCards(cards,colors)
  setOverviewCards(cards)
  setOverviewCardColors(colors)
 }
 const benefitReferenceMonth=followingMonth(month)
 const holidayYears=useMemo(()=>[...new Set([Number(hoursAnchor.slice(0,4)),Number(month.slice(0,4)),Number(benefitReferenceMonth.slice(0,4)),...records.map(r=>Number(r.date.slice(0,4)))])].sort(),[records,hoursAnchor,month,benefitReferenceMonth])
 const holidayYearsKey=holidayYears.join(',')
 useEffect(()=>{
  let active=true
  setHolidayCalendar(null)
  if(!base){setHolidayStatus('unconfigured');return}
  setHolidayStatus('loading')
  void loadHolidayCatalog(base,holidayYears).then(c=>{if(active){setHolidayCalendar(c);setHolidayStatus('ready')}})
   .catch(()=>{if(active){setHolidayCalendar(null);setHolidayStatus('failed')}})
  return ()=>{active=false}
 },[base?.ibge,base?.uf,holidayYearsKey])
 const holidayDates=base&&holidayStatus==='ready'&&holidayCalendar?.baseKey===baseKey(base)?holidayCalendar.dates:null
 const computedHours=useMemo(()=>workRegime==='trust'?[]:holidayDates?records.flatMap(r=>{try{return [{...r,calc:paidOvertime(r,holidayDates)}]}catch{return []}}):[],[records,holidayDates,workRegime])
 const monthHours=useMemo(()=>computedHours.filter(x=>x.calc.payMonth===month).reduce((a,x)=>({h60:a.h60+x.calc.h60,h80:a.h80+x.calc.h80,h100:a.h100+x.calc.h100}),{h60:0,h80:0,h100:0}),[computedHours,month])
 const holidayOverrides=useMemo(()=>new Map(records.filter(r=>r.holidayOverride!==null).map(r=>[r.date,r.holidayOverride as boolean])),[records])
 const effective=useMemo(()=>effectiveParams(params,events,month),[params,events,month])
 const latestPension=useMemo(()=>latestEffectiveEvent(events,'pensionPercent',month),[events,month])
 const pensionRule=useMemo(()=>latestPension?parsePensionNotes(latestPension.notes).rule:{...defaultPensionRule},[latestPension])
 const extraParts=useMemo(()=>overtimeComponents(monthHours,effective.salary+effective.trienio),[monthHours,effective.salary,effective.trienio])
 const extraPay=extraParts.total
 const dsr=useMemo(()=>holidayDates?overtimeDsr(month,extraPay,holidayDates,holidayOverrides):null,[month,extraPay,holidayDates,holidayOverrides])
 const dsrPay=dsr?.amount??0
 const payroll=useMemo(()=>calculatePayroll2026({...effective,overtimePay:extraPay,dsrPay,pensionRule}),[effective,extraPay,dsrPay,pensionRule])
 const mealEvent=useMemo(()=>latestEffectiveEvent(events,'mealBenefit',month),[events,month])
 const hasPension=effective.pensionMethod!=='none'
 const benefitEstimate=useMemo(()=>mealEvent&&holidayDates?projectedMealBenefit(effective.mealBenefit,month,holidayDates):null,[mealEvent,effective.mealBenefit,month,holidayDates])
 const displayEvents=useMemo(()=>events.filter(e=>e.kind!=='privatePensionFixed'),[events])
 const eventYears=useMemo(()=>[...new Set(displayEvents.map(e=>e.effective_date.slice(0,4)))].sort().reverse(),[displayEvents])
 const filteredEvents=useMemo(()=>displayEvents.filter(e=>(eventsYear==='all'||e.effective_date.startsWith(eventsYear+'-'))&&(eventsKindFilter==='all'||e.kind===eventsKindFilter)),[displayEvents,eventsYear,eventsKindFilter])
 const months=useMemo(()=>[...new Set(statements.map(s=>s.period.slice(0,4)))].sort().reverse(),[statements])
 const filtered=useMemo(()=>statements.filter(s=>year==='all'||s.period.startsWith(year)).sort((a,b)=>b.period.localeCompare(a.period)),[statements,year])
 const vacationLedger=useMemo(()=>reconcileVacations(statements,allLines),[statements,allLines])
 const thirteenthLedger=useMemo(()=>reconcileThirteenth(statements,allLines),[statements,allLines])
 const annual=useMemo(()=>
  annualSalarySummary(statements,allLines,vacationLedger,thirteenthLedger),
  [statements,allLines,vacationLedger,thirteenthLedger])
 const supplementaryCash=useMemo(()=>cashAdjustmentsByMonth(statements,allLines),
  [statements,allLines])
 const monthlyGraph=useMemo(()=>{
  const months=[...new Set([...vacationLedger.months.map(x=>x.period),...supplementaryCash.keys()])].sort()
   .map(period=>{
    const x=vacationLedger.byMonth.get(period)
    const statement=statements.find(s=>s.document_type==='monthly'&&!s.duplicate_of&&s.period===period)
    const add=supplementaryCash.get(period)
    // A totalizadora is one additional paid adjustment in its actual payment
    // month. Difference/rectification documents never add to cash or gross.
    const gross=(statement?.credits??null)
    return {
     period,
     bruto:gross===null?(add?add.gross:null):Math.round((gross+(add?.gross||0))*100)/100,
     liquido:x?.total===null||x?.total===undefined?(add?add.net:null)
      :Math.round((x.total+(add?.net||0))*100)/100,
     ferias:x?.vacation??0
    }
   })
  return remunerationSeries(months,year)
 },[vacationLedger,statements,supplementaryCash,year])
 const actual=useMemo(()=>statements.find(s=>s.period===month&&s.document_type==='monthly')||null,[statements,month])
 const currentCash=vacationLedger.byMonth.get(month)
 const thirteenthMonth=thirteenthLedger.cashByMonth.get(month)??0
 const thirteenthThisMonth=thirteenthLedger.occurrences.find(t=>t.period===month)
 const pprMonth=useMemo(()=>statements.filter(s=>s.period===month&&s.document_type==='ppr'),[statements,month])
 const suggestions=useMemo(()=>{
  const sorted=previews.filter(s=>s.documentType==='monthly').sort((a,b)=>a.period.localeCompare(b.period))
  return sorted.flatMap((s,i)=>{
   const previous=sorted.slice(0,i).filter(x=>x.period<s.period).at(-1)
   const historical=[...statements].filter(x=>x.document_type==='monthly'&&x.period<s.period).sort((a,b)=>b.period.localeCompare(a.period))[0]
   const prior=previous?{salary_contract:previous.salaryContract,trienio:previous.trienio} as SavedStatement:historical||null
   return eventCandidates(s,prior).map(e=>({...e,period:s.period,key:s.sourceFile+'#'+s.page}))
  })
 },[previews,statements])
 const importedPprKeys=useMemo(()=>new Set(statements.filter(s=>s.document_type==='ppr').map(s=>pprReceiptKey({
  period:s.period,paymentDate:s.payment_date,gross:s.gross_ppr,net:s.net,
  incomeTax:s.ppr_income_tax,unionContribution:s.ppr_union_contribution
 }))),[statements])
 const duplicatePprPreview=(s:ParsedStatement)=>s.documentType==='ppr'&&importedPprKeys.has(pprReceiptKey({
  period:s.period,paymentDate:s.paymentDate,gross:s.grossPpr,net:s.net,
  incomeTax:s.pprIncomeTax,unionContribution:s.pprUnionContribution
 }))
 const showStatement=(s:SavedStatement)=>task(async()=>{
  setSelectedStmt(s)
  if(!db){setStatementLines([]);return}
  const {data,error}=await db.from('statement_lines').select('code,description,amount,side').eq('statement_id',s.id).order('ordinal')
  if(error)throw error;setStatementLines(data||[])
 },'Detalhes carregados')
 const previewFiles=(items:File[])=>task(async()=>{
  setImportFiles(items)
  setImportUseCompetenceDate(false)
  const result=(await Promise.all(items.map(parsePdf))).flat()
  setPreviews(result);setImportSelected(result.filter(x=>
   !duplicatePprPreview(x)&&(
    x.warnings.length===0||x.documentType==='adjustment'&&x.payrollSubtype!==null
   )).map(x=>x.sourceFile+'#'+x.page))
 },'Leitura concluída. Revise antes de salvar.')
 const saveNewEvent=()=>task(async()=>{
  if(!db)throw Error('Conecte o banco para persistir eventos')
  const value=parseEventValue(eventValue,eventKind)
  if(value===null)throw Error('Valor inválido. Informe um número no formato 15.340,57 (duas casas decimais) ou uma quantidade inteira para dependentes.')
  if(value<0)throw Error('O valor do evento não pode ser negativo')
  if(['pensionPercent','esppPercent','privatePensionPercent','advancePercent'].includes(eventKind)&&value>100)throw Error('Percentual deve estar entre 0 e 100')
  const notes=eventKind==='pensionPercent'?encodePensionNotes(eventNote,pensionOptions):eventNote
  await saveEvent({...(eventId?{id:eventId}:{}),kind:eventKind,value,effective_date:eventDate,notes})
  setEventId(undefined);setEventValue('');setEventNote('');setPensionOptions({...defaultPensionRule});await refresh()
 },'Evento salvo')
 const dependentsSnapshot=useMemo(()=>statements.filter(s=>s.document_type==='monthly'
  &&s.period<=month&&s.dependents_total!=null).sort((a,b)=>b.period.localeCompare(a.period))[0],
  [statements,month])
 const dependentTaxSnapshot=useMemo(()=>statements.filter(s=>s.document_type==='monthly'
  &&s.period<=month&&s.dependents_irrf!=null).sort((a,b)=>b.period.localeCompare(a.period))[0],
  [statements,month])
 const isDemo=!db
 if(!authReady)return <div className="centered"><div className="spinner"/>Carregando...</div>
 if(db&&!user)return <GuestEntry/>
 if(db&&user&&mfaEnabled&&mfaState==='checking')return <div className="centered"><div className="spinner"/>Verificando segurança da sessão...</div>
 if(db&&user&&mfaEnabled&&mfaState==='error')return <div className="auth-background"><div className="auth-card"><ShieldCheck size={32}/><h1>Verificação de segurança indisponível</h1><p>Não foi possível confirmar a proteção da sessão. Nenhum dado financeiro será carregado até a verificação.</p><button className="secondary" type="button" onClick={()=>setMfaRetry(v=>v+1)}>Tentar novamente</button><button type="button" className="text-button" onClick={()=>void db?.auth.signOut({scope:'local'})}>Sair</button></div></div>
 if(db&&user&&mfaEnabled&&mfaState==='challenge')return <MfaGate onVerified={()=>setMfaState('ready')}/>
 if(db&&user&&passwordSetup)return <div className="auth-background"><div className="auth-card"><ShieldCheck size={33}/><h1>Defina sua senha</h1><p>O link autenticou sua conta temporariamente. Antes de acessar o painel, escolha a senha que será usada nos próximos logins.</p><ChangePassword onComplete={()=>{setPasswordSetup(false);setSection('overview');window.history.replaceState(null,'',window.location.pathname)}}/><button type="button" className="text-button" onClick={()=>db?.auth.signOut()}>Sair sem definir a senha</button></div></div>
 const accessScreen=db&&user?accessScreenFor(user.id,accessDecision):'checking'
 if(db&&user&&accessScreen==='checking')return <div className="centered"><div className="spinner"/>Verificando permissão de acesso...</div>
 if(db&&user&&accessScreen==='error')return <div className="auth-background"><div className="auth-card"><ShieldCheck size={34}/><h1>Não foi possível verificar o acesso</h1><p>Não foi possível consultar sua autorização no momento. Tente novamente. Seus dados financeiros permanecem protegidos.</p>{error&&<p className="error" role="alert">{error}</p>}<button type="button" className="secondary" onClick={()=>setAccessRetry(n=>n+1)}>Tentar novamente</button><button type="button" className="text-button" onClick={()=>void db?.auth.signOut({scope:'local'})}>Sair</button></div></div>
 if(db&&user&&accessScreen==='enroll-mfa')return <div className="auth-background"><div className="auth-card">
  <ShieldCheck size={34}/>
  <h1>Proteja sua conta de administrador</h1>
  <p>O acesso administrativo exige autenticação em dois fatores. Cadastre e confirme um aplicativo autenticador para continuar.</p>
  <TotpSettings onActivated={()=>{setMfaRetry(n=>n+1);setAccessRetry(n=>n+1)}}/>
  <p className="subtle">Cadastre também um autenticador de reserva em outro dispositivo.</p>
  <button type="button" className="text-button" onClick={()=>void db?.auth.signOut({scope:'local'})}>Sair da conta</button>
 </div></div>
 if(db&&user&&accessScreen!=='approved')return <div className="auth-background"><div className="auth-card payrep-suspended-gate"><ShieldCheck size={34}/><h1>{accessScreen==='suspended'?'Conta suspensa':accessScreen==='rejected'?'Cadastro não aprovado':'Conta aguardando liberação'}</h1>
  <p>{accessScreen==='suspended'?'O acesso desta conta está suspenso. Você pode solicitar a reativação. Dependendo da política de cadastro ou do motivo da suspensão, a autorização do administrador será necessária. Os dados financeiros apagados anteriormente não serão recuperados.':accessScreen==='rejected'?'Seu cadastro não foi aprovado pelo administrador. Entre em contato com o suporte para obter informações.':'Seu cadastro foi recebido e aguarda aprovação do administrador. Os dados financeiros permanecem protegidos.'}</p>
  {accessScreen==='suspended'&&<button type="button" className="primary" onClick={()=>{setReactivationError('');setReactivationDialog(true)}}>Solicitar reativação</button>}
  <button type="button" onClick={()=>void db?.auth.signOut({scope:'local'})} className="secondary">Sair</button>
  {reactivationDialog&&accessScreen==='suspended'&&<PayrepConfirmDialog title="Reativar sua conta?" description="Deseja solicitar a reativação? A conta permanecerá sem acesso até ser aprovada, quando a política exigir. Os dados financeiros anteriormente excluídos não serão restaurados." confirmLabel="Confirmar reativação" busy={reactivationBusy} onClose={()=>setReactivationDialog(false)} onConfirm={()=>void requestReactivation()}>
   {reactivationError&&<p role="alert" className="error payrep-confirm-error">{reactivationError}</p>}
  </PayrepConfirmDialog>}
 </div></div>
 const metricRows=[
  ['Salário-base',brl(effective.salary)],['Triênio',brl(effective.trienio)],
  ...(monthHours.h60>0?[['Horas extras 60%',brl(extraParts.p60)] as [string,string]]:[]),
  ...(monthHours.h80>0?[['Horas extras 80%',brl(extraParts.p80)] as [string,string]]:[]),
  ...(monthHours.h100>0?[['Horas extras 100%',brl(extraParts.p100)] as [string,string]]:[]),
  ...(extraPay>0&&dsr?[['DSR sobre horas extras',brl(dsrPay)] as [string,string]]:[]),
  ['INSS',brl(payroll.inss)],['IRRF',brl(payroll.irrf)],
  ...(hasPension?[['Pensão estimada',brl(payroll.pension)]]:[]),['ESPP',brl(payroll.espp)],['Previdência individual',brl(payroll.privatePension)],
  ['Adiantamento',brl(payroll.advance)]
 ]
 const activeEvent=(kind:string)=>latestEffectiveEvent(events,kind,month)
 const cardDetails:Record<OverviewCardId,{value:string;note:string}>={
  gross:{value:brl(payroll.gross),note:'Salário + triênio + extras + DSR'},
   baseSalary:{value:brl(effective.salary),note:'Salário-base vigente'},
   trienio:{value:brl(effective.trienio),note:'Adicional por tempo de serviço'},
   privatePensionPercent:{value:formatEventValue(effective.privatePensionPercent,'privatePensionPercent')+'%',note:'Percentual da previdência individual'},
   dependents:{value:dependentsSnapshot?.dependents_total!=null?String(dependentsSnapshot.dependents_total):'—',
    note:dependentsSnapshot
     ?'Total do holerite'+(dependentTaxSnapshot?.dependents_irrf!=null
       ?' · '+dependentTaxSnapshot.dependents_irrf+' para IRRF':'')
     :'Total não identificado. Recupere os dados em Meus Holerites.'},
   esppPercent:{value:formatEventValue(effective.esppPercent,'esppPercent')+'%',note:'Percentual de contribuição ESPP'},
   fixedPension:{value:effective.pensionMethod==='fixed'?brl(effective.fixedPension):'—',note:effective.pensionMethod==='fixed'?'Valor de pensão fixa vigente':'Sem pensão fixa configurada'},
   advancePercent:{value:formatEventValue(effective.advancePercent,'advancePercent')+'%',note:'Percentual de adiantamento salarial'},
   salaryComposition:{value:'',note:''},
   competenceOvertime:{value:'',note:''},
  deductions:{value:brl(payroll.gross-payroll.netMonth),note:'INSS, IRRF, pensão e contribuições'},
  irrf:{value:brl(payroll.irrf),note:'Imposto de renda retido na fonte (estimado)'},
  inss:{value:brl(payroll.inss),note:'Contribuição previdenciária (estimada)'},
  fgts:{value:brl(payroll.fgts),note:'Informativo; não é desconto'},
  pensionPercent:{value:effective.pensionMethod==='old26'?formatEventValue(effective.pensionPercent,'pensionPercent')+'%':'—',note:effective.pensionMethod==='old26'?'Percentual vigente':'Cadastre o evento de pensão'},
  pensionAmount:{value:hasPension?brl(payroll.pension):'—',note:hasPension?'Estimativa da folha mensal':'Sem evento de pensão'},
  mealBenefit:{value:benefitEstimate?brl(benefitEstimate.total):'—',note:!mealEvent?'Cadastre o valor por dia útil':benefitEstimate?formatEventValue(effective.mealBenefit,'mealBenefit')+' por dia × '+benefitEstimate.days+' dias úteis ('+benefitReferenceMonth+')':base?'Calendário de feriados indisponível':'Configure sua Base'},
  fixedBenefit:{value:activeEvent('fixedBenefit')?brl(effective.fixedBenefit):'—',note:'Valor mensal fixo'},
  privatePension:{value:activeEvent('privatePensionPercent')||effective.privatePensionPercent?brl(payroll.privatePension):'—',note:'Percentual sobre o salário-base'},
  childcareBenefit:{value:activeEvent('childcareBenefit')?brl(effective.childcareBenefit):'—',note:'Valor mensal cadastrado'},
  espp:{value:activeEvent('esppPercent')||effective.esppPercent?brl(payroll.espp):'—',note:'Desconto ESPP na folha'}
 }
 const overviewSections={
   salaryComposition:<Panel title="Composição do salário" extra={<span className="pill">Estimativa 2026</span>}><div className="breakdown">{metricRows.map(([label,value])=><div key={label} className="break-row"><span>{label}</span><strong className={['INSS','IRRF','Pensão estimada','ESPP','Previdência individual','Adiantamento'].includes(label)?'muted':''}>{value}</strong></div>)}</div><div className="total-line"><span>Pagamento no fim do mês</span><strong>{brl(payroll.finalPayment)}</strong></div></Panel>,
   competenceOvertime:<Panel title="Horas extras na competência"><div className="hour-mini"><div><strong>{monthHours.h60.toFixed(1)}h</strong><span>Adicional 60%</span></div><div><strong>{monthHours.h80.toFixed(1)}h</strong><span>Adicional 80%</span></div><div><strong>{monthHours.h100.toFixed(1)}h</strong><span>Adicional 100%</span></div></div><div className="detail-hint"><Info size={16}/>São considerados os dias 16 do mês anterior até 15 do mês atual. DSR estimado automaticamente sobre as horas extras: {dsr?brl(dsrPay)+' ('+dsr.restDays+' repousos/feriados ÷ '+dsr.workingDays+' dias úteis)':'aguardando calendário de feriados'}. Sábados contam como dias úteis; confira a regra do seu acordo coletivo.</div><button className="text-button" onClick={()=>setSection('hours')}>Lançar jornada <ChevronRight size={15}/></button></Panel>
 }
 const accessiblePrimaryViews=nav.filter(item=>isAdmin||!item.id.startsWith('admin-')).map(item=>item.id) as MobilePrimaryView[]
 const renderPageBody=(section:Section)=> (
  <div className="page-body">
    {isDemo&&<div className="notice warning"><Info size={18}/><span><strong>Modo de demonstração.</strong> Os valores exibidos são fictícios e nada é salvo. Configure o Supabase para ativar contas e dados reais.</span></div>}
    {error&&<div className="notice danger payrep-feedback-toast" role="alert"><AlertTriangle size={18}/>{error}<button onClick={()=>setError('')}>Fechar</button></div>}
    {notice&&<div className="notice success payrep-feedback-toast" role="status"><CheckCircle2 size={18}/>{notice}<button onClick={()=>setNotice('')}>Fechar</button></div>}
    {section==='overview'&&<div className="stack">
     <div className="hero"><div><CompetencePicker month={month} onChange={setMonth}/><h2>Seu salário, com todos os detalhes.</h2><p>Projeção independente da folha. Valores efetivos são registrados separadamente pelo holerite.</p><button className="hero-link" onClick={()=>setSection('imports')}>Conferir com holerite <ArrowUpRight size={17}/></button></div><div className="hero-amount"><span>Líquido mensal estimado</span><strong>{brl(payroll.netMonth)}</strong></div></div>
     <OverviewCardsEditor cards={overviewCards} colors={overviewCardColors} details={cardDetails} sections={overviewSections}
       labels={Object.fromEntries(overviewCardDefinitions.map(([id,label])=>[id,label])) as Record<OverviewCardId,string>}
       onCommit={persistOverviewCards}
       onSaved={()=>setNotice('Disposição dos cartões salva com sucesso')}/>
     
     {actual&&<Panel title={'Recebimento registrado: '+monthLabel(month)}><div className="stats-grid three"><Stat name="Líquido no fechamento" value={actual.net===null?'A conferir':brl(actual.net)}/><Stat name="Adiantamento salarial" value={actual.salary_advance===null?'A conferir':brl(actual.salary_advance)}/><Stat name="Líquido mensal recebido" value={currentCash?.total===null?'A conferir':brl(currentCash?.total??actual.net_received??0)} note="Fechamento + adiantamento salarial + férias/13º antecipados, sem duplicar" tone="accent"/></div></Panel>}
     {currentCash&&currentCash.vacation>0&&<Panel title={'Férias contabilizadas: '+monthLabel(month)}><div className="stats-grid three"><Stat name="Férias e 13º antecipados" value={brl(currentCash.vacation)}/><Stat name="Status" value={currentCash.vacationState==='reconciled'?'Conciliado':currentCash.vacationState==='estimated'?'Estimado':currentCash.vacationState==='difference'?'Divergência':'Parcial'}/><Stat name="Líquido da competência" value={currentCash.total===null?'A conferir':brl(currentCash.total)} tone="accent"/></div><div className="detail-hint">{currentCash.vacationNote}</div></Panel>}{thirteenthThisMonth&&<Panel title={'13º salário: '+monthLabel(month)}><div className="stats-grid three"><Stat name="13º bruto" value={brl(thirteenthThisMonth.gross)}/><Stat name="IRRF 13º" value={brl(thirteenthThisMonth.irrf)}/><Stat name="13º adicional recebido" value={brl(thirteenthMonth)} tone="accent"/></div><div className="detail-hint">{thirteenthThisMonth.note}</div></Panel>}{pprMonth.length>0&&<Panel title={'PPR recebido: '+monthLabel(month)}><div className="stats-grid three"><Stat name="PPR bruto" value={brl(pprMonth.reduce((sum,s)=>sum+(s.gross_ppr||0),0))}/><Stat name="IRRF e outros descontos" value={brl(pprMonth.reduce((sum,s)=>sum+(s.debits||0),0))}/><Stat name="PPR líquido adicional" value={brl(pprMonth.reduce((sum,s)=>sum+(s.net||0),0))} tone="accent"/></div><div className="detail-hint">Este pagamento é separado da remuneração mensal e não altera o salário-base.</div></Panel>}
     
    </div>}
    {section==='history'&&<div className="stack"><div className="page-intro"><div><h2>Seus holerites em um só lugar</h2><p>Importação por competência, sem sobrescrever os documentos originais.</p></div><button className="primary" onClick={()=>{setPayslipTab('import');setSection('imports')}}><Upload size={17}/> Importar PDFs</button></div><div className="filterbar"><span>Período</span><PayrepSelect value={year} onChange={setYear} title="Período"><option value="all">Todos os anos</option>{months.map(y=><option key={y} value={y}>{y}</option>)}</PayrepSelect><span className="pill">{filtered.length} holerites</span></div><Panel title={year==='all'?'Resumo por ano':'Holerites de '+year}>
    {year==='all'?annual.length?<div className="stack">
 <div className="table-scroll"><table className="annual-salary-table"><thead><tr>
 <th>Ano</th><th>Proventos Bruto</th><th>Proventos Líquido</th><th>Férias (Bruto)</th>
 <th>13º (Bruto)</th><th>FGTS</th><th>IRRF (Total)</th><th>Triênio (Bruto)</th>
 <th>PPR (Bruto)</th><th>Pensão</th><th>Previdência</th><th>ESPP</th>
 </tr></thead><tbody>{annual.map(a=><tr key={a.year} className="clickable" onClick={()=>setYear(a.year)}>
 <td><strong>{a.year}</strong></td>
 <td><strong>{brl(a.gross)}</strong>{a.partial&&<span className="pill">Parcial</span>}</td>
 <td>{brl(a.netBeforeOtherDeductions)}</td>
 <td>{a.vacationGross?brl(a.vacationGross):'—'}</td>
 <td>{a.thirteenthGross?brl(a.thirteenthGross):'—'}</td>
 <td>{a.monthlyCount?brl(a.fgts):'—'}</td>
 <td>{brl(a.irrfTotal)}</td>
 <td>{a.monthlyCount?brl(a.trienio):'—'}</td>
 <td>{a.pprGross?brl(a.pprGross):'—'}</td>
 <td>{a.pension?brl(a.pension):'—'}</td>
 <td>{a.privatePension?brl(a.privatePension):'—'}</td>
 <td>{a.espp?brl(a.espp):'—'}</td>
 </tr>)}</tbody></table></div>
 <p className="subtle">Proventos Líquido = Proventos Bruto menos INSS e IRRF.
 Não é o depósito bancário, pois não deduz pensão, previdência, ESPP e outros descontos.
 Férias, 13º e PPR são conciliados para evitar duplicidade. Valores sem comprovação podem estar parciais.</p>
 </div>:<Empty text="Nenhum holerite importado ainda. Abra Importar holerites para começar."/>:
    filtered.length?<div className="table-scroll"><table><thead><tr><th>Competência</th><th>Tipo</th><th>Proventos</th><th>Descontos</th><th>IRRF PPR</th><th>IRRF 13º</th><th>Fechamento</th><th>Adiantamento salarial</th><th>Líquido recebido</th><th>Observação</th></tr></thead><tbody>{filtered.map(s=><tr key={s.id} onClick={()=>showStatement(s)} className="clickable"><td><strong>{monthLabel(s.period)}</strong></td><td>{s.document_type==='ppr'?<span className="pill">PPR</span>:s.document_type==='vacation'?<span className="pill">Férias</span>:s.document_type==='thirteenth'?<span className="pill">13º</span>:'Mensal'}</td><td>{s.credits===null?'—':brl(s.credits)}</td><td>{s.debits===null?'—':brl(s.debits)}</td><td>{s.document_type==='ppr'?brl(s.ppr_income_tax||0):'—'}</td><td>{s.document_type==='thirteenth'?brl(s.thirteenth_irrf):'—'}</td><td>{s.net===null?'—':brl(s.net)}</td><td>{s.document_type==='vacation'?'—':s.salary_advance===null?'A conferir':brl(s.salary_advance)}</td>
    <td>{s.document_type==='thirteenth'?<><strong>{brl(thirteenthLedger.occurrences.find(t=>t.statementId===s.id)?.cashAdditional??s.net??0)}</strong><div className="subtle">13º separado</div></>:s.document_type==='vacation'?<span className="subtle">Incluído na conciliação</span>:
       <div className="financial-value-status"><strong>{vacationLedger.byMonth.get(s.period)?.total===null?'A conferir':brl(vacationLedger.byMonth.get(s.period)?.total??s.net_received??0)}</strong>
       {vacationLedger.byMonth.get(s.period)?.vacationState&&<span className="pill vacation-status-pill">{vacationLedger.byMonth.get(s.period)?.vacationState==='reconciled'?'Férias conciliadas':'Férias estimadas ou pendentes'}</span>}</div>}
    </td><td>{s.warnings?.length?<span className="flag">Conferir</span>:<span className="ok">Conferido</span>}</td></tr>)}</tbody></table></div>:<Empty text="Não há holerites para este ano."/>}
    </Panel>{selectedStmt&&<Panel title={'Detalhes de '+(selectedStmt.document_type==='ppr'?'PPR · ':selectedStmt.document_type==='vacation'?'Férias · ':selectedStmt.document_type==='thirteenth'?'13º · ':'')+monthLabel(selectedStmt.period)} extra={<button className="secondary" onClick={()=>setSelectedStmt(null)}>Fechar</button>}>{selectedStmt.document_type==='thirteenth'?<div className="detail-hint">13º bruto: <strong>{selectedStmt.thirteenth_gross===null?'A conferir':brl(selectedStmt.thirteenth_gross)}</strong>; adiantamento descontado: {brl(selectedStmt.thirteenth_advance)}; INSS: {brl(selectedStmt.thirteenth_inss)}; IRRF: {brl(selectedStmt.thirteenth_irrf)}; pensão: {brl(selectedStmt.thirteenth_pension)}; líquido no fechamento: <strong>{selectedStmt.net===null?'A conferir':brl(selectedStmt.net)}</strong>. {thirteenthLedger.byYear.get(selectedStmt.period.slice(0,4))?.note}</div>:selectedStmt.document_type==='vacation'?<div className="detail-hint">Recibo complementar de férias: <strong>{selectedStmt.net===null?'A conferir':brl(selectedStmt.net)}</strong>. Período: {selectedStmt.vacation_start?dateBR(selectedStmt.vacation_start):'Não identificado'} a {selectedStmt.vacation_end?dateBR(selectedStmt.vacation_end):'Não identificado'}. Pagamento efetivo: {selectedStmt.payment_date?dateBR(selectedStmt.payment_date):'Não identificado'}. Este líquido substitui os adiantamentos já inferidos das folhas mensais correspondentes; não é somado novamente.</div>:selectedStmt.document_type==='ppr'?<div className="detail-hint">PPR bruto: <strong>{selectedStmt.gross_ppr===null?'A conferir':brl(selectedStmt.gross_ppr)}</strong>. IRRF PPR: <strong>{brl(selectedStmt.ppr_income_tax||0)}</strong>. Contribuição negocial: <strong>{brl(selectedStmt.ppr_union_contribution||0)}</strong>. Líquido pago: <strong>{selectedStmt.net===null?'A conferir':brl(selectedStmt.net)}</strong>. Data de pagamento: {selectedStmt.payment_date?dateBR(selectedStmt.payment_date):'Não identificada'}. Evento lançado separadamente.</div>:<div className="detail-hint">Líquido mensal: {selectedStmt.net===null?'A conferir':brl(selectedStmt.net)} (fechamento) + {selectedStmt.salary_advance===null?'A conferir':brl(selectedStmt.salary_advance)} (adiantamento salarial) = <strong>{selectedStmt.net_received===null?'A conferir':brl(selectedStmt.net_received)}</strong>. Férias identificadas na folha: {brl(vacationLedger.byMonth.get(selectedStmt.period)?.vacation??0)}. Total financeiro da competência: <strong>{vacationLedger.byMonth.get(selectedStmt.period)?.total===null?'A conferir':brl(vacationLedger.byMonth.get(selectedStmt.period)?.total??selectedStmt.net_received??0)}</strong>. O recibo complementar não duplica a contabilização.</div>}<div className="table-scroll"><table><thead><tr><th>Código</th><th>Rubrica original</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>{statementLines.map((l,i)=><tr key={i}><td>{l.code}</td><td>{l.description}</td><td>{l.side==='credit'?'Provento':l.side==='debit'?'Desconto':'Revisar'}</td><td>{brl(Number(l.amount))}</td></tr>)}</tbody></table></div>{selectedStmt.warnings?.map((w,i)=><div className="detail-hint" key={i}><AlertTriangle size={15}/>{w}</div>)}</Panel>}<VacationOverview ledger={vacationLedger} year={year}/><ThirteenthOverview ledger={thirteenthLedger} year={year}/>

 </div>}
        {section==='hours'&&<div className="stack">
     <div className="page-intro fortnight-page-intro">
      <div><h2>{workRegime==='trust'?'Jornada e saldo de horas':'Jornada e horas extras'}</h2>
       <p><strong>Base · {base?baseLabel(base):'Não configurada'}.</strong></p>
      </div>
      <div className="fortnight-page-navigation" aria-label="Selecionar quinzena">
       <button type="button" className="secondary" onClick={()=>setHoursAnchor(shiftFortnight(hoursAnchor,-1))}>
        <ChevronLeft size={17}/> Anterior
       </button>
       <button type="button" className="fortnight-period-trigger"
 title="Escolher quinzena, mês e ano" aria-label={'Selecionar quinzena: '+fortnightDisplay(hoursAnchor).dateRange}
 onClick={()=>setPeriodPickerOpen(true)}>
 <strong aria-live="polite">{fortnightDisplay(hoursAnchor).dateRange}</strong>
 <span>{fortnightDisplay(hoursAnchor).halfLabel}</span>
 </button>
       <button type="button" className="secondary" onClick={()=>setHoursAnchor(shiftFortnight(hoursAnchor,1))}>
        Próxima <ChevronRight size={17}/>
       </button>
      </div>
     </div>
     {periodPickerOpen&&<FortnightPeriodPicker anchor={hoursAnchor}
 onClose={()=>setPeriodPickerOpen(false)} onConfirm={next=>{setHoursAnchor(next);setPeriodPickerOpen(false)}}/>}
 {holidayStatus==='unconfigured'&&workRegime==='regular'&&<div className="notice warning"><Info size={18}/>
      Configure sua Base em Definições para calcular os feriados e as horas extras.</div>}
     {holidayCalendar?.coverage==='partial'&&<div className="notice warning">
      <Info size={18}/>{holidayCalendar.message}</div>}
     {holidayStatus==='loading'&&<div className="notice subtle-notice"><Info size={18}/>
      Carregando calendário de feriados para {base?baseLabel(base):'a Base'}...</div>}
     {holidayStatus==='failed'&&<div className="notice warning"><AlertTriangle size={18}/>
      Não foi possível preparar o calendário de feriados. Verifique sua conexão antes de calcular horas.</div>}
     <FortnightTimesheet anchor={hoursAnchor}
      records={records} holidayDates={holidayDates} policies={timeBankPolicies}
      workRegime={workRegime}
      baseName={base?baseLabel(base):'Não configurada'} onSaved={()=>refresh()}/>
    </div>}
    {section==='events'&&<div className="stack"><div className="page-intro"><div><h2>Parâmetros com data de início</h2><p>Alterações permanentes afetam as projeções a partir da vigência. Ocorrências pontuais não alteram o salário-base.</p></div></div><div className="two-col"><Panel title={eventId?'Editar evento':'Novo evento'}><form className="form" onSubmit={e=>{e.preventDefault();saveNewEvent()}}><label>Evento<PayrepSelect value={eventKind} disabled={Boolean(eventId&&events.find(e=>e.id===eventId)?.source_statement_id)} onChange={next=>{setEventKind(next);setPensionOptions({...defaultPensionRule})}} title="Tipo de evento">{eventsKinds.map(([id,label])=><option key={id} value={id}>{label}</option>)}</PayrepSelect></label><label>Valor / quantidade<input type="text" inputMode="decimal" required value={eventValue} onChange={e=>setEventValue(e.target.value)} onBlur={()=>setEventValue(value=>formatEventInput(value,eventKind))} placeholder={eventKind==='dependents'?'0':'0,00'} autoComplete="off"/></label>{eventKind==='mealBenefit'&&<div className="detail-hint"><Info size={16}/>Informe o valor diário. A previsão recebida em uma competência corresponde aos dias úteis do mês seguinte, excluindo sábados, domingos e feriados da Base.</div>}{eventKind==='pensionPercent'&&<div className="pension-criteria"><p className="subtle">Defina os critérios de incidência. A projeção mensal aplica os descontos selecionados; 13º, férias e PPR têm cálculos próprios, separados da folha mensal.</p><div className="pension-criteria-grid"><fieldset><legend>Excluir da base</legend>{(['excludeInss','excludeIrrf'] as const).map(k=><label className="checkbox-label" key={k}><input type="checkbox" checked={pensionOptions[k]} onChange={e=>setPensionOptions(v=>({...v,[k]:e.target.checked}))}/>{pensionRuleLabels[k]}</label>)}</fieldset><fieldset><legend>Incluir na base</legend>{(['includeOvertime','includeVacation','includeVacationThird','includeThirteenth','includePpr'] as const).map(k=><label className="checkbox-label" key={k}><input type="checkbox" checked={pensionOptions[k]} onChange={e=>setPensionOptions(v=>({...v,[k]:e.target.checked}))}/>{pensionRuleLabels[k]}</label>)}</fieldset></div></div>}<label>Data de início<PayrepDatePicker required value={eventDate} onChange={setEventDate} title="Data de início"/></label><label>Observação<textarea value={eventNote} onChange={e=>setEventNote(e.target.value)} rows={2} placeholder="Opcional"/></label><button className="primary" disabled={busy||!db} type="submit"><Plus size={17}/>{eventId?'Atualizar evento':'Adicionar evento'}</button></form></Panel><Panel title="Como funcionam as vigências"><div className="instruction"><div className="step">01</div><p>Cadastre uma mudança com o valor novo, não a diferença.</p></div><div className="instruction"><div className="step">02</div><p>A data define a primeira competência da nova regra. Eventos antigos permanecem no histórico.</p></div><div className="instruction"><div className="step">03</div><p>Importações de holerites sugerem mudanças, mas nunca criam eventos permanentes sem confirmação.</p></div></Panel></div><Panel title="Eventos cadastrados"><div className="filterbar events-filterbar"><label htmlFor="events-year-filter">Ano</label><PayrepSelect id="events-year-filter" value={eventsYear} onChange={setEventsYear} title="Ano do evento"><option value="all">Todos os anos</option>{eventYears.map(y=><option key={y} value={y}>{y}</option>)}</PayrepSelect><label htmlFor="events-type-filter">Evento</label><PayrepSelect id="events-type-filter" value={eventsKindFilter} onChange={setEventsKindFilter} title="Filtrar tipo de evento">
 <option value="all">Todos os eventos</option>{eventsKinds.map(([id,label])=><option key={id} value={id}>{label}</option>)}
 </PayrepSelect><span className="pill">{filteredEvents.length} evento(s)</span></div>{filteredEvents.length?<div className="table-scroll"><table className="events-table"><colgroup><col className="event-col-name"/><col className="event-col-date"/><col className="event-col-value"/><col className="event-col-status"/><col className="event-col-notes"/><col className="event-col-actions"/></colgroup><thead><tr><th>Evento</th><th>Vigência</th><th>Valor</th><th>Status</th><th>Observações</th><th>Ações</th></tr></thead><tbody>{filteredEvents.map(x=><tr key={x.id}><td>{eventsKinds.find(([id])=>id===x.kind)?.[1]||x.kind}</td><td>{dateBR(x.effective_date)}</td><td>{formatEventValue(x.value,x.kind)}</td><td>{x.source_statement_id?<span className="pill">{x.user_override?'Importado · editado':'Importado do PDF'}</span>:<span className="subtle">Manual</span>}</td><td className="events-notes-cell"><span className="events-note-preview" title={eventNotesText(x)}>{eventNotesText(x)||'—'}</span></td><td className="events-actions-cell"><button type="button" aria-label={'Editar '+(eventsKinds.find(([id])=>id===x.kind)?.[1]||x.kind)} title="Editar evento" className="icon-button" onClick={()=>{setEventId(x.id);setEventKind(x.kind);setEventDate(x.effective_date);setEventValue(formatEventValue(x.value,x.kind));setEventNote(x.kind==='pensionPercent'?parsePensionNotes(x.notes).note:x.notes);setPensionOptions(x.kind==='pensionPercent'?parsePensionNotes(x.notes).rule:{...defaultPensionRule})}}><Pencil size={15}/></button><button type="button" className="icon-button" aria-label={'Remover '+(eventsKinds.find(([id])=>id===x.kind)?.[1]||x.kind)} title="Remover evento" onClick={()=>setEventToDelete(x)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>:<Empty text={events.length?'Nenhum evento cadastrado para '+eventsYear+'.':'Nenhum evento cadastrado.'}/>}</Panel><VacationOverview ledger={vacationLedger} year={year}/><ThirteenthOverview ledger={thirteenthLedger} year={year}/> {eventToDelete&&<PayrepConfirmDialog title="Remover evento?"
  description={eventToDelete.source_statement_id
   ?'O evento deixará de afetar as projeções, mas o holerite e o histórico de importação serão preservados. Uma nova sincronização não recriará esse evento.'
   :'O evento manual será excluído do seu histórico e das projeções.'}
  confirmLabel="Remover evento" destructive busy={busy}
  onClose={()=>setEventToDelete(null)}
  onConfirm={()=>task(async()=>{
   await removeEvent(eventToDelete.id)
   if(eventId===eventToDelete.id)setEventId(undefined)
   await refresh()
   setEventToDelete(null)
  },'Evento removido')}/>}</div>}
    {section==='analytics'&&<AnalyticsDashboard userId={user?.id||null} year={year} onYearChange={setYear} years={months}
      statements={statements} lines={allLines} monthlyGraph={monthlyGraph}
      vacationLedger={vacationLedger} thirteenthLedger={thirteenthLedger} parameters={params}/>}
    {section==='income-tax'&&<TaxPreview userId={user?.id||null} statements={statements} lines={allLines} onSubscribe={()=>setSection('subscription')}/>} 
    {section==='imports'&&<div className="stack">
     <div className="page-intro"><div><h2>Meus Holerites</h2><p>Importe, visualize e gerencie seus documentos salariais em um único lugar.</p></div></div>
     <div className="payslip-tabs" role="tablist" aria-label="Áreas de Meus Holerites">
      <button type="button" role="tab" aria-selected={payslipTab==='documents'} className={payslipTab==='documents'?'active':''} onClick={()=>setPayslipTab('documents')}><FileText size={17}/> Meus documentos <span className="payslip-tab-count">{documentStatements.length}</span></button>
      <button type="button" role="tab" aria-selected={payslipTab==='import'} className={payslipTab==='import'?'active':''} onClick={()=>setPayslipTab('import')}><Upload size={17}/> Importar</button>
     </div>
     {payslipTab==='import'&&payslipAccess!=='full'?
      <section className="panel">
       <div className="panel-heading"><h2><ShieldCheck size={18}/> Importação de holerites | Full</h2></div>
       {payslipAccess==='loading'?<p>Verificando seu plano...</p>:
        <><p>{payslipAccess==='error'?'Não foi possível validar seu plano. A importação está bloqueada por segurança.':
          'A importação, o armazenamento de PDFs e a criação automática de eventos a partir dos holerites são exclusivos do Full. Seus documentos antigos continuam disponíveis na aba Meus documentos.'}</p>
         <button type="button" className="primary" onClick={()=>setSection('subscription')}>Ver plano Full</button></>}
      </section>
     :payslipTab==='import'?<div className="stack"><div className="page-intro"><div><h2>Importação inteligente de PDFs</h2><p>Reconhece folhas mensais, PPR, férias e 13º salário da Accenture. Os recibos de férias são opcionais; o recibo de 13º comprova os impostos exclusivos e é conciliado com adiantamentos anteriores.</p></div></div><Panel title="Selecionar holerites"><div className="dropzone"><Upload size={30}/><strong>Envie PDFs antigos ou novos</strong><p>É possível selecionar vários arquivos e importar documentos com várias páginas. Cada holerite identificado será salvo em um PDF individual.</p><label className="primary file-button">Selecionar PDFs<input multiple type="file" accept="application/pdf,.pdf" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length)previewFiles(files)}}/></label></div><div className="detail-hint"><ShieldCheck size={16}/>A leitura ocorre no navegador. O envio ao armazenamento privado acontece somente após você confirmar.</div></Panel>{previews.length>0&&<Panel title={'Prévia: '+previews.length+' competência(s)'} extra={<button className="secondary" onClick={()=>previewFiles(importFiles)}><RefreshCw size={15}/> Reler</button>}><div className="table-scroll"><table><thead><tr><th>Importar</th><th>Arquivo</th><th>Competência</th><th>Tipo</th><th>Formato</th><th>Proventos</th><th>Fechamento</th><th>Adiantamento salarial</th><th>Férias/13º antecipados</th><th>Líquido financeiro estimado</th><th>Resultado</th></tr></thead><tbody>{previews.map(s=>{const key=s.sourceFile+'#'+s.page;return <tr key={key}><td><input type="checkbox" checked={importSelected.includes(key)} disabled={duplicatePprPreview(s)} title={duplicatePprPreview(s)?'PPR já importado':undefined} onChange={e=>setImportSelected(v=>e.target.checked?[...v,key]:v.filter(x=>x!==key))}/></td><td>{s.sourceFile} (p. {s.page})</td><td>{s.period||'Não encontrada'}</td><td>{s.documentType==='ppr'?<span className="pill">PPR</span>:s.documentType==='vacation'?<span className="pill">Férias</span>:s.documentType==='thirteenth'?<span className="pill">13º</span>:s.documentType==='adjustment'?<span className="pill">{s.payrollSubtype==='totalizer'?'Totalizadora':s.payrollSubtype==='rectification'?'Retificadora':'Diferença'}</span>:'Mensal'}</td><td>{s.format==='old'?'Antigo':'Novo'}</td><td>{s.credits===null?'—':brl(s.credits)}</td><td>{s.net===null?'—':brl(s.net)}</td><td>{s.documentType==='thirteenth'?brl(s.thirteenthAdvance):s.documentType==='vacation'?'—':s.salaryAdvance===null?'A conferir':brl(s.salaryAdvance)}</td>
    <td>{s.documentType==='monthly'?brl(vacationAdvanceFromLines(s.lines)):'—'}</td>
    <td><strong>{s.documentType==='thirteenth'?brl(s.net??0):s.documentType==='vacation'?brl(s.net??0):s.documentType==='adjustment'?(s.payrollSubtype==='totalizer'?brl(s.net??0):'Referência, sem novo pagamento'):s.documentType==='monthly'&&s.netReceived!==null?brl(s.netReceived+vacationAdvanceFromLines(s.lines)):s.netReceived===null?'A conferir':brl(s.netReceived)}</strong>
      {s.documentType==='vacation'&&<div className="subtle">Valor do recibo; não somar novamente</div>}{s.documentType==='thirteenth'&&<div className="subtle">Fechamento do 13º; adiantamento será conciliado ao salvar</div>}
      {s.documentType==='monthly'&&vacationAdvanceFromLines(s.lines)>0&&<div className="subtle">Estimado; recibo opcional</div>}</td><td>{duplicatePprPreview(s)?<span className="flag">PPR duplicado, já importado</span>:s.warnings.length?<span title={s.warnings.join('; ')} className="flag">{s.warnings.length} aviso(s)</span>:<span className="ok">OK</span>}</td></tr>})}</tbody></table></div>{previews.some(s=>s.documentType==='adjustment')&&<div className="notice subtle-notice payslip-vacation-reconcile">
   <Info size={18}/><div><strong>Folhas complementares e retificações</strong>
    <p style={{margin:'5px 0 0'}}>DIFERENÇA e RETIFICADORA serão arquivadas como evidência, sem adicionar novo pagamento. Somente TOTALIZADORA, com data e totais consistentes, será adicionada uma vez aos proventos e recebimentos. As competências de origem só serão vinculadas quando as rubricas conferirem exatamente.</p>
   </div></div>}
   {previews.some(s=>s.documentType==='vacation'||(s.documentType==='monthly'&&vacationAdvanceFromLines(s.lines)>0))&&<div className="notice subtle-notice payslip-vacation-reconcile"><Info size={18}/><div><strong>Conciliação automática de férias</strong><p style={{margin:'5px 0 0'}}>A folha mensal é suficiente para registrar os adiantamentos identificados. O recibo de férias é opcional e confirma ou substitui esse valor. O pagamento antecipado nunca será contabilizado duas vezes. Caso exista diferença, ela será exibida no Histórico salarial.</p></div></div>}{previews.some(s=>s.documentType==='thirteenth')&&<div className="suggestion"><strong>13º salário: prévia do recibo anual</strong>{previews.filter(s=>s.documentType==='thirteenth').map(s=><div key={s.sourceFile+'#'+s.page}><span>{s.period}: bruto {s.thirteenthGross===null?'A conferir':brl(s.thirteenthGross)}; adiantamento anterior {brl(s.thirteenthAdvance)}; fechamento {s.net===null?'A conferir':brl(s.net)}; INSS {brl(s.thirteenthInss)}; IRRF exclusivo {brl(s.thirteenthIrrf)}; pensão {brl(s.thirteenthPension)}; pago em {s.paymentDate?dateBR(s.paymentDate):'data não identificada'}.</span></div>)}<small>Ao confirmar, o recibo ficará separado da folha mensal e será vinculado aos adiantamentos já contabilizados nas férias. O sistema não duplicará essas parcelas.</small></div>}{previews.some(s=>s.documentType==='ppr')&&<div className="suggestion"><strong>Evento PPR automático após confirmação</strong>{previews.filter(s=>s.documentType==='ppr').map(s=><div key={s.sourceFile+'#'+s.page}><span>{s.period}: PPR bruto {s.grossPpr===null?'Não encontrado':brl(s.grossPpr)}; IRRF PPR {brl(s.pprIncomeTax)}; contribuição negocial {brl(s.pprUnionContribution)}; líquido pago {s.net===null?'A conferir':brl(s.net)}; data {s.paymentDate?dateBR(s.paymentDate):'Não encontrada'}.</span></div>)}<small>O evento será criado apenas ao confirmar o documento, uma vez por holerite, e não altera a projeção salarial fixa.</small></div>}{suggestions.length>0&&<div className="suggestion"><strong>Possíveis mudanças encontradas</strong>{suggestions.map((s,i)=><div key={i}><span>{s.period}: {fieldNames[s.kind]||s.kind} → {brl(s.value)}. {s.reason}</span></div>)}<small>Alterações reconhecidas serão registradas automaticamente como eventos vinculados aos holerites, quando houver data de pagamento. Para documentos sem data, confirme uma data de referência provisória abaixo. Eventos manuais não serão alterados.</small></div>}{previews.some(s=>s.documentType==='monthly'&&!s.paymentDate&&importSelected.includes(s.sourceFile+'#'+s.page))&&<div className="detail-hint" role="group" aria-label="Data dos eventos automáticos">
 <Info size={18}/><div><strong>Data de pagamento não identificada em alguns holerites mensais</strong>
 <p>A criação de eventos exige uma data. O Payrep não inventará uma data de pagamento. Você pode escolher usar o último dia de cada competência como <strong>data de referência provisória</strong>, identificada como estimativa nos eventos, e corrigir depois.</p>
 <label className="checkbox-label"><input type="checkbox" checked={importUseCompetenceDate} onChange={e=>setImportUseCompetenceDate(e.target.checked)}/>Confirmo o uso da data provisória nos eventos dos holerites sem pagamento identificado.</label>
 </div></div>}<button className="primary payslip-import-confirm" disabled={busy||!db||importSelected.length===0} onClick={()=>task(async()=>{try{await saveStatements(previews,importFiles,importSelected,importUseCompetenceDate)}finally{await refresh()}setPreviews([]);setImportFiles([]);setImportSelected([]);setImportUseCompetenceDate(false);setPayslipTab('documents')},'Documentos salvos. Apenas as totalizadoras válidas entram como pagamento complementar; referências e retificações ficam separadas.')}><Upload size={17}/> Confirmar {importSelected.length} documento(s)</button>{!db&&<p className="subtle">Configure o banco para habilitar o salvamento.</p>}</Panel>}</div>:<PayslipDocuments statements={documentStatements} onRemoved={refresh}/>}
    </div>}
        {section==='admin'&&isAdmin&&<div className="stack"><div><button type="button" className="secondary" onClick={()=>setSection('admin-settings')}>Voltar às configurações</button></div><AdminDashboard/></div>}
    {section==='admin-support'&&isAdmin&&<AdminSupportTickets onBack={()=>setSection('admin-settings')}/>}
    {section==='admin-settings'&&isAdmin&&<AdminSettingsPage onNavigate={view=>setSection(view)}/>}
    {section==='admin-pep'&&isAdmin&&<AdminPepSettingsPage onBack={()=>setSection('admin-settings')}/>}
    {section==='admin-finance'&&isAdmin&&<AdminFinancePage/>}
    {section==='admin-plans'&&isAdmin&&<AdminPlansPage/>}
    {section==='profile'&&user&&<ProfilePage user={user} onBack={()=>setSection('overview')}/>}
    {section==='subscription'&&user&&<SubscriptionPage billingReturn={billingReturn} onBack={()=>{setBillingReturn(null);setSection('overview')}}/>}
    {section==='account-settings'&&user&&<AccountSecurityPage user={user} onBack={()=>setSection('overview')} onNavigateSubscription={()=>setSection('subscription')} onPayrollReset={async()=>{
      await refresh()
      setSelectedStmt(null);setStatementLines([]);setDocumentStatements([])
      setPreviews([]);setImportFiles([]);setImportSelected([])
      setPensionOptions({...defaultPensionRule});setOverviewCards([...defaultOverviewCards]);setOverviewCardColors({})
      setYear('all');setEventsYear('all');setHoursAnchor(todayInSaoPaulo());setMonth(currentMonth())
    }}/>}
    {section==='help'&&user&&<SupportPage user={user}/>}
    {section==='pep-personal'&&user&&<PersonalPepPage
     onBack={()=>setSection('overview')} onSubscribe={()=>setSection('subscription')}/>}
     {section==='definitions'&&<DefinitionsPage
      base={base} busy={busy} workRegime={workRegime}
      onSaveBase={next=>task(async()=>{if(!db)throw Error('Banco não configurado');await saveBase(next);await refresh()},
       'Base atualizada. O calendário será recalculado para a nova cidade.')}
      onSaveRegime={next=>task(async()=>{await saveWorkRegime(next);setWorkRegime(next)},
       next==='trust'?'Cargo de confiança ativado. Horas extras e novos movimentos do banco desabilitados.':
        'Jornada regular ativada. Horas extras e banco de horas habilitados.')}/>}

   </div>
 )
 return <div className={'app'+(sidebarCollapsed?' app--sidebar-collapsed':'')}>
  <aside id="payrep-sidebar" className={'sidebar'+(menu?' open':'')+(sidebarCollapsed?' sidebar--collapsed':'')}>
   <div className="sidebar-brand-row">
    <div className="brand brand--wordmark"><span className="brand-symbol-frame"><img src="/brand/payrep-symbol.svg" alt="Payrep" width="42" height="42"/></span><div className="brand-type"><strong>Payrep</strong><small>Controle salarial</small></div></div>
    <button type="button" className="sidebar-collapse-toggle"
     aria-label={sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral'}
     title={sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral'}
     aria-expanded={!sidebarCollapsed} aria-controls="payrep-sidebar-navigation"
     onClick={toggleDesktopSidebar}>
     {sidebarCollapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}
    </button>
   </div>
   <div className="nav-label">MENU PRINCIPAL</div>
   <nav id="payrep-sidebar-navigation">
     {nav.filter(n=>!n.id.startsWith('admin-')).map(n=>{const Icon=n.icon;return <button key={n.id}
      type="button" aria-label={n.label} aria-current={section===n.id?'page':undefined}
      className={section===n.id?'nav active':'nav'}
      onMouseEnter={event=>showSidebarTooltip(n.label,event.currentTarget)}
      onMouseLeave={()=>setSidebarTooltip(null)}
      onFocus={event=>showSidebarTooltip(n.label,event.currentTarget)}
      onBlur={()=>setSidebarTooltip(null)}
      onClick={()=>{if(n.id==='imports')setPayslipTab('documents');setSection(n.id);setMenu(false);setSidebarTooltip(null);setNotice('');setError('')}}>
      <Icon size={19}/><span className="sidebar-menu-label">{n.label}</span>{section===n.id&&<span className="nav-dot"/>}
     </button>})}
     {isAdmin&&<div className="admin-nav-separator" role="separator"><span>ADMINISTRATION</span></div>}
     {isAdmin&&nav.filter(n=>n.id.startsWith('admin-')).map(n=>{const Icon=n.icon;return <button key={n.id}
      type="button" aria-label={n.label} aria-current={section===n.id?'page':undefined}
      className={section===n.id?'nav active':'nav'}
      onMouseEnter={event=>showSidebarTooltip(n.label,event.currentTarget)}
      onMouseLeave={()=>setSidebarTooltip(null)}
      onFocus={event=>showSidebarTooltip(n.label,event.currentTarget)}
      onBlur={()=>setSidebarTooltip(null)}
      onClick={()=>{setSection(n.id);setMenu(false);setSidebarTooltip(null);setNotice('');setError('')}}>
      <Icon size={19}/><span className="sidebar-menu-label">{n.label}</span>{section===n.id&&<span className="nav-dot"/>}
     </button>})}
    </nav>
   <footer className="sidebar-footer" aria-label="Links institucionais">
    <span>© 2026 Payrep</span>
    <div className="sidebar-footer-links"><a href="/sobre" target="_blank" rel="noopener noreferrer">Sobre</a><a href="/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a><a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a></div>
   </footer>
  </aside>
  {sidebarCollapsed&&sidebarTooltip&&<div className="sidebar-item-tooltip" role="tooltip"
   style={{left:sidebarTooltip.left,top:sidebarTooltip.top}}>{sidebarTooltip.label}</div>}
  {menu&&<button type="button" className="sidebar-backdrop" aria-label="Fechar menu lateral" onClick={()=>setMenu(false)}/>}
  <main className="main">
   <header className="topbar"><button type="button" className="mobile-menu" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} aria-controls="payrep-sidebar" onClick={()=>setMenu(open=>!open)}><Menu size={22}/></button><div className="top-actions"><ProfileMenu user={user} onNavigate={view=>{setSection(view);setMenu(false)}}/></div></header>
   <AppPageBoundary key={section} onReturn={()=>setSection('overview')}>
   <PayrepMobileNavigationSurface
    accessibleViews={accessiblePrimaryViews}
    currentView={section as MobilePrimaryView}
    disabled={menu || !accessiblePrimaryViews.includes(section as MobilePrimaryView)}
    menuOpen={menu}
    navigationKey={section}
    onOpenMenu={()=>setMenu(true)}
    onNavigate={view=>{if(view==='imports')setPayslipTab('documents');setSection(view);setMenu(false);setNotice('');setError('')}}
    renderView={view=>renderPageBody(view)}
   >{renderPageBody(section)}</PayrepMobileNavigationSurface>
   </AppPageBoundary>
  </main>
 </div>
}
