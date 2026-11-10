import {useEffect,useMemo,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {LayoutDashboard,History,Clock3,CalendarClock,ChartNoAxesCombined,FileInput,Settings2,FileSpreadsheet,LogOut,Plus,Trash2,Pencil,FileText,ShieldCheck,AlertTriangle,CheckCircle2,Menu,ChevronRight,Upload,RefreshCw,Info,Save,ArrowUpRight,UsersRound,ArrowUp,ArrowDown} from 'lucide-react'
import {brl,calculatePayroll2026,defaults,type SalaryParameters} from './lib/money'
import {classifyHours,overtimeValue,type DayEntry} from './lib/calendar'
import {type BaseLocation,baseKey,baseLabel} from './lib/base'
import {loadHolidayCatalog,type HolidayCatalog} from './lib/holidayBase'
import {BasePicker} from './components/BasePicker'
import {TaxPreview} from './components/TaxPreview'
import {VacationOverview} from './components/VacationOverview'
import {ThirteenthOverview} from './components/ThirteenthOverview'
import {AnalyticsDashboard} from './components/AnalyticsDashboard'
import {AdminDashboard} from './components/AdminDashboard'
import {recordAppSession} from './lib/admin'
import {formatEventInput,formatEventValue,parseEventValue} from './lib/eventValue'
import {latestEffectiveEvent} from './lib/eventSources'
import {defaultPensionRule,encodePensionNotes,parsePensionNotes,pensionRuleLabels,type PensionRule} from './lib/pensionRule'
import {overviewCardDefinitions,defaultOverviewCards,normalizeOverviewCards,changeCardVisibility,moveOverviewCard,followingMonth,projectedMealBenefit,type OverviewCardId} from './lib/overview'
import {reconcileThirteenth} from './lib/thirteenthLedger'
import {remunerationSeries} from './lib/remunerationSeries'
import {reconcileVacations,vacationAdvanceFromLines,type StatementRubric} from './lib/vacation'
import {parsePdf,type ParsedStatement} from './lib/parse'
import {db,eventsKinds,eventCandidates,effectiveParams,getData,getMembership,removeEvent,removeTimeEntry,saveEvent,saveBase,saveOverviewCards,saveStatements,saveTimeEntry,type SalaryEvent,type SavedStatement} from './lib/data'
import {AuthGate,ChangePassword} from './components/AuthGate'
import {requiresPasswordSetup} from './lib/authRedirect'

type Section='overview'|'history'|'hours'|'events'|'analytics'|'income-tax'|'imports'|'settings'|'admin'
type TimeRecord=DayEntry&{id:string}
const nav=[
 {id:'overview',label:'Visão geral',icon:LayoutDashboard},
 {id:'history',label:'Histórico salarial',icon:History},
 {id:'hours',label:'Controle de horas',icon:Clock3},
 {id:'events',label:'Eventos e vigências',icon:CalendarClock},
 {id:'analytics',label:'Análises',icon:ChartNoAxesCombined},
 {id:'income-tax',label:'Informe IR (prévia)',icon:FileSpreadsheet},
 {id:'imports',label:'Importar holerites',icon:FileInput},
 {id:'settings',label:'Configurações',icon:Settings2},
 {id:'admin',label:'Gestão de usuários',icon:UsersRound}
] as const
const today=()=>new Date().toISOString().slice(0,10)
const currentMonth=()=>today().slice(0,7)
const monthLabel=(m:string)=>{const [y,mm]=m.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,mm-1,1)))}
const dateBR=(s:string)=>{const [y,m,d]=s.split('-');return d+'/'+m+'/'+y}
function Stat({name,value,note,tone}:{name:string;value:string;note?:string;tone?:string}){return <div className="stat"><span className="subtle">{name}</span><strong className={tone||''}>{value}</strong>{note&&<small>{note}</small>}</div>}
function Panel({title,extra,children}:{title:string;extra?:React.ReactNode;children:React.ReactNode}){return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{extra}</div>{children}</section>}
function Empty({text}:{text:string}){return <div className="empty"><FileText size={27}/><p>{text}</p></div>}
const fieldNames:Record<string,string>={salary:'Salário-base',trienio:'Triênio',dependents:'Dependentes',mealBenefit:'Vale-refeição (por dia útil)',fixedBenefit:'Vale-benefício',childcareBenefit:'Auxílio-creche',esppPercent:'ESPP (%)',privatePensionPercent:'Previdência (%)',privatePensionFixed:'Previdência (R$)',pensionPercent:'Pensão (%)',fixedPension:'Pensão fixa',advancePercent:'Adiantamento (%)'}

const percentageFields=new Set<keyof SalaryParameters>(['esppPercent','privatePensionPercent','pensionPercent','advancePercent'])
function displayEffectiveParameter(key:keyof SalaryParameters,value:number):string{
 if(key==='dependents')return formatEventValue(value,key)
 if(percentageFields.has(key))return formatEventValue(value,key)+'%'
 return brl(value)
}
const pensionMethods:Record<SalaryParameters['pensionMethod'],string>={
 old26:'Percentual sobre a base definida no evento de pensão',
 fixed:'Valor fixo informado',
 none:'Sem pensão'
}

export default function App(){
 const [section,setSection]=useState<Section>('overview')
 const [menu,setMenu]=useState(false)
 const [user,setUser]=useState<User|null>(null)
 const [authReady,setAuthReady]=useState(!db)
 const [passwordSetup,setPasswordSetup]=useState(()=>requiresPasswordSetup(window.__salaryAuthIntent))
 const [allowed,setAllowed]=useState(false)
 const [isAdmin,setIsAdmin]=useState(false)
 const [accessStatus,setAccessStatus]=useState<'pending'|'approved'|'suspended'|'rejected'>('pending')
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [busy,setBusy]=useState(false)
 const [month,setMonth]=useState(currentMonth())
 const [year,setYear]=useState('all')
 const [statements,setStatements]=useState<SavedStatement[]>([])
 const [allLines,setAllLines]=useState<StatementRubric[]>([])
 const [events,setEvents]=useState<SalaryEvent[]>([])
 const [records,setRecords]=useState<TimeRecord[]>([])
 const [base,setBase]=useState<BaseLocation|null>(null)
 const [holidayCalendar,setHolidayCalendar]=useState<HolidayCatalog|null>(null)
 const [holidayStatus,setHolidayStatus]=useState<'unconfigured'|'loading'|'ready'|'failed'>('unconfigured')
 const [params,setParams]=useState<SalaryParameters>(!db?{...defaults,salary:9500,trienio:100,dependents:1,esppPercent:5,privatePensionFixed:190,pensionMethod:'none'}:defaults)
 const [selectedStmt,setSelectedStmt]=useState<SavedStatement|null>(null)
 const [statementLines,setStatementLines]=useState<Array<{code:string;description:string;amount:number;side:string}>>([])
 const [importFiles,setImportFiles]=useState<File[]>([])
 const [previews,setPreviews]=useState<ParsedStatement[]>([])
 const [importSelected,setImportSelected]=useState<string[]>([])
 const [eventId,setEventId]=useState<string|undefined>()
 const [eventKind,setEventKind]=useState('salary')
 const [eventValue,setEventValue]=useState('')
 const [eventDate,setEventDate]=useState(today())
 const [eventNote,setEventNote]=useState('')
 const [pensionOptions,setPensionOptions]=useState<PensionRule>({...defaultPensionRule})
 const [overviewCards,setOverviewCards]=useState<OverviewCardId[]>([...defaultOverviewCards])
 const [entryId,setEntryId]=useState<string|undefined>()
 const [entry,setEntry]=useState<DayEntry>({date:today(),start:'09:00',lunchStart:'12:00',lunchEnd:'13:00',end:'18:00',holidayOverride:null})

 useEffect(()=>{
  if(!db)return
  db.auth.getSession().then(({data})=>{setUser(data.session?.user||null);setAuthReady(true)})
  const {data:subscription}=db.auth.onAuthStateChange((event,session)=>{
   setUser(session?.user||null)
   if(event==='PASSWORD_RECOVERY')setPasswordSetup(true)
   if(event==='SIGNED_OUT')setPasswordSetup(false)
  })
  return ()=>subscription.subscription.unsubscribe()
 },[])
 const refresh=async()=>{
  if(!db||!user)return
  const membership=await getMembership()
  const active=membership?.active===true
  setAllowed(active)
  setIsAdmin(active&&membership?.role==='admin')
  setAccessStatus(membership?.status??'pending')
  if(!active)return
  // Metrics are supplementary: a monitoring error must never block payroll access.
  void recordAppSession().catch(()=>{})
  const d=await getData()
  setStatements(d.statements);setAllLines(d.lines);setEvents(d.events)
  setRecords(d.entries.map(x=>({id:x.id,date:x.date,start:x.start_at.slice(0,5),lunchStart:x.lunch_start.slice(0,5),lunchEnd:x.lunch_end.slice(0,5),end:x.end_at.slice(0,5),holidayOverride:x.holiday_override})))
  setParams({...defaults,...d.settings})
  setOverviewCards(normalizeOverviewCards(d.overviewCards))
  setBase(d.base)
 }
 useEffect(()=>{if(user)refresh().catch(e=>setError(e.message));else{setAllowed(false);setIsAdmin(false);setStatements([]);setAllLines([]);setEvents([]);setRecords([])}},[user])
 const task=async(fn:()=>Promise<void>,success:string)=>{
  setBusy(true);setError('');setNotice('')
  try{await fn();setNotice(success)}catch(e){setError(e instanceof Error?e.message:'Falha inesperada')}finally{setBusy(false)}
 }
 const benefitReferenceMonth=followingMonth(month)
 const holidayYears=useMemo(()=>[...new Set([Number(entry.date.slice(0,4)),Number(month.slice(0,4)),Number(benefitReferenceMonth.slice(0,4)),...records.map(r=>Number(r.date.slice(0,4)))])].sort(),[records,entry.date,month,benefitReferenceMonth])
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
 const computedHours=useMemo(()=>holidayDates?records.flatMap(r=>{try{return [{...r,calc:classifyHours(r,holidayDates)}]}catch{return []}}):[],[records,holidayDates])
 const monthHours=useMemo(()=>computedHours.filter(x=>x.calc.payMonth===month).reduce((a,x)=>({h60:a.h60+x.calc.h60,h80:a.h80+x.calc.h80,h100:a.h100+x.calc.h100}),{h60:0,h80:0,h100:0}),[computedHours,month])
 const effective=useMemo(()=>effectiveParams(params,events,month),[params,events,month])
 const latestPension=useMemo(()=>latestEffectiveEvent(events,'pensionPercent',month),[events,month])
 const pensionRule=useMemo(()=>latestPension?parsePensionNotes(latestPension.notes).rule:{...defaultPensionRule},[latestPension])
 const extraPay=overtimeValue(monthHours,effective.salary+effective.trienio)
 const payroll=useMemo(()=>calculatePayroll2026({...effective,overtimePay:extraPay,pensionRule}),[effective,extraPay,pensionRule])
 const mealEvent=useMemo(()=>latestEffectiveEvent(events,'mealBenefit',month),[events,month])
 const hasPension=effective.pensionMethod!=='none'
 const benefitEstimate=useMemo(()=>mealEvent&&holidayDates?projectedMealBenefit(effective.mealBenefit,month,holidayDates):null,[mealEvent,effective.mealBenefit,month,holidayDates])
 const months=useMemo(()=>[...new Set(statements.map(s=>s.period.slice(0,4)))].sort().reverse(),[statements])
 const filtered=useMemo(()=>statements.filter(s=>year==='all'||s.period.startsWith(year)).sort((a,b)=>b.period.localeCompare(a.period)),[statements,year])
 const vacationLedger=useMemo(()=>reconcileVacations(statements,allLines),[statements,allLines])
 const thirteenthLedger=useMemo(()=>reconcileThirteenth(statements,allLines),[statements,allLines])
 const annual=useMemo(()=>{
  type AnnualItem={year:string;credits:number;net:number;closing:number;advance:number;vacation:number;vacationCount:number;unreconciled:number;missing:number;fgts:number;count:number;pprCount:number;pprGross:number;pprNet:number;pprIrrf:number;thirteenthGross:number;thirteenthNet:number;thirteenthIrrf:number;thirteenthAdvance:number;thirteenthCount:number;totalFinancial:number}
  const map:Record<string,AnnualItem>={}
  const ensure=(y:string):AnnualItem=>map[y]??(map[y]={year:y,credits:0,net:0,closing:0,advance:0,vacation:0,vacationCount:0,unreconciled:0,missing:0,fgts:0,count:0,pprCount:0,pprGross:0,pprNet:0,pprIrrf:0,thirteenthGross:0,thirteenthNet:0,thirteenthIrrf:0,thirteenthAdvance:0,thirteenthCount:0,totalFinancial:0})
  for(const s of statements){
   const y=s.document_type==='ppr'&&s.payment_date?s.payment_date.slice(0,4):s.period.slice(0,4)
   const item=ensure(y)
   if(s.document_type==='ppr'){
    item.pprCount++;item.pprGross+=s.gross_ppr||0;item.pprNet+=s.net||0;item.pprIrrf+=s.ppr_income_tax||0
   }else if(s.document_type==='monthly'){
    item.credits+=s.credits||0;item.closing+=s.net||0;item.advance+=s.salary_advance||0
    item.fgts+=s.fgts||0;item.count++
   }
  }
  for(const month of vacationLedger.months){
   const item=ensure(month.period.slice(0,4))
   if(month.total===null)item.missing++
   else item.net+=month.total
  }
  for(const t of thirteenthLedger.occurrences){
   const item=ensure(t.year)
   item.thirteenthCount++
   item.thirteenthGross+=t.gross
   item.thirteenthNet+=t.cashAdditional
   item.thirteenthAdvance+=t.advance
   item.thirteenthIrrf+=t.irrf
  }
  for(const o of vacationLedger.occurrences){
   const item=ensure(o.month.slice(0,4))
   item.vacation+=o.booked;item.vacationCount++
   if(o.state!=='reconciled')item.unreconciled++
  }
  for(const item of Object.values(map))item.totalFinancial=item.net+item.thirteenthNet+item.pprNet
  return Object.values(map).sort((a,b)=>a.year.localeCompare(b.year))
 },[statements,vacationLedger,thirteenthLedger])
 const monthlyGraph=useMemo(()=>{
  const months=vacationLedger.months.map(x=>{
   const statement=statements.find(s=>s.document_type==='monthly'&&s.period===x.period)
   return {period:x.period,bruto:statement?.credits??null,liquido:x.total,ferias:x.vacation}
  })
  return remunerationSeries(months,year)
 },[vacationLedger,statements,year])
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
 const showStatement=(s:SavedStatement)=>task(async()=>{
  setSelectedStmt(s)
  if(!db){setStatementLines([]);return}
  const {data,error}=await db.from('statement_lines').select('code,description,amount,side').eq('statement_id',s.id).order('ordinal')
  if(error)throw error;setStatementLines(data||[])
 },'Detalhes carregados')
 const previewFiles=(items:File[])=>task(async()=>{
  setImportFiles(items)
  const result=(await Promise.all(items.map(parsePdf))).flat()
  setPreviews(result);setImportSelected(result.filter(x=>x.warnings.length===0).map(x=>x.sourceFile+'#'+x.page))
 },'Leitura concluída. Revise antes de salvar.')
 const saveNewEvent=()=>task(async()=>{
  if(!db)throw Error('Conecte o banco para persistir eventos')
  const value=parseEventValue(eventValue,eventKind)
  if(value===null)throw Error('Valor inválido. Informe um número no formato 15.340,57 (duas casas decimais) ou uma quantidade inteira para dependentes.')
  await saveEvent({...(eventId?{id:eventId}:{}),kind:eventKind,value,effective_date:eventDate,notes:eventNote})
  setEventId(undefined);setEventValue('');setEventNote('');await refresh()
 },'Evento salvo')
 const saveEntry=()=>task(async()=>{
  if(!holidayDates)throw Error('Calendário de feriados ainda não disponível')
  classifyHours(entry,holidayDates)
  if(!db)throw Error('Conecte o banco para persistir horários')
  await saveTimeEntry(entry,entryId)
  setEntryId(undefined);await refresh()
 },'Jornada salva')
 const isDemo=!db
 if(!authReady)return <div className="centered"><div className="spinner"/>Carregando...</div>
 if(db&&!user)return <AuthGate/>
 if(db&&user&&passwordSetup)return <div className="auth-background"><div className="auth-card"><ShieldCheck size={33}/><h1>Defina sua senha</h1><p>O link autenticou sua conta temporariamente. Antes de acessar o painel, escolha a senha que será usada nos próximos logins.</p><ChangePassword onComplete={()=>{setPasswordSetup(false);setSection('overview');window.history.replaceState(null,'',window.location.pathname)}}/><button type="button" className="text-button" onClick={()=>db?.auth.signOut()}>Sair sem definir a senha</button></div></div>
 if(db&&user&&!allowed)return <div className="auth-background"><div className="auth-card"><ShieldCheck size={34}/><h1>{accessStatus==='suspended'?'Acesso suspenso':accessStatus==='rejected'?'Cadastro não aprovado':'Conta aguardando liberação'}</h1><p>{accessStatus==='suspended'?'O administrador suspendeu o acesso desta conta.':accessStatus==='rejected'?'Seu cadastro não foi aprovado pelo administrador.':'Seu cadastro foi recebido e aguarda aprovação do administrador.'} Seus dados financeiros não estão acessíveis no momento. Entre em contato com o administrador para obter mais informações.</p><button onClick={()=>db?.auth.signOut()} className="secondary">Sair</button>{error&&<p className="error">{error}</p>}</div></div>
 const metricRows=[
  ['Salário-base',brl(effective.salary)],['Triênio',brl(effective.trienio)],
  ['Horas extras (sem DSR)',brl(extraPay)],['INSS',brl(payroll.inss)],['IRRF',brl(payroll.irrf)],
  ['Pensão estimada',brl(payroll.pension)],['ESPP',brl(payroll.espp)],['Previdência individual',brl(payroll.privatePension)],
  ['Adiantamento',brl(payroll.advance)]
 ]
 return <div className="app">
  <aside className={menu?'sidebar open':'sidebar'}>
   <div className="brand brand--wordmark"><span className="brand-symbol-frame"><img src="/brand/payrep-symbol.svg" alt="" width="42" height="42"/></span><div className="brand-type"><strong>Payrep</strong><small>Controle salarial</small></div></div>
   <div className="nav-label">MENU PRINCIPAL</div>
   <nav>{nav.filter(n=>n.id!=='admin'||isAdmin).map(n=>{const Icon=n.icon;return <button key={n.id} className={section===n.id?'nav active':'nav'} onClick={()=>{setSection(n.id);setMenu(false);setNotice('');setError('')}}><Icon size={19}/>{n.label}{section===n.id&&<span className="nav-dot"/>}</button>})}</nav>
   <div className="side-bottom"><div className="lock-box"><ShieldCheck size={18}/><div><strong>Ambiente privado</strong><small>Dados isolados por usuário</small></div></div><div className="account"><div className="avatar">{(user?.email||'SL').slice(0,2).toUpperCase()}</div><div><strong>{user?.email?.split('@')[0]||'Demonstração'}</strong><small>{isDemo?'Sem dados salvos':'Conta individual'}</small></div>{db&&<button title="Sair" onClick={()=>db?.auth.signOut()}><LogOut size={17}/></button>}</div></div>
  </aside>
  <main className="main">
   <header className="topbar"><button className="mobile-menu" onClick={()=>setMenu(!menu)}><Menu size={22}/></button><div><span className="eyebrow">PAINEL FINANCEIRO</span><h1>{nav.find(n=>n.id===section)?.label}</h1></div><div className="top-actions"><span className="period-label">Competência</span><input className="month-input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><div className="circle-avatar">{(user?.email||'S').charAt(0).toUpperCase()}</div></div></header>
   <div className="page-body">
    {isDemo&&<div className="notice warning"><Info size={18}/><span><strong>Modo de demonstração.</strong> Os valores exibidos são fictícios e nada é salvo. Configure o Supabase para ativar contas e dados reais.</span></div>}
    {error&&<div className="notice danger"><AlertTriangle size={18}/>{error}<button onClick={()=>setError('')}>Fechar</button></div>}
    {notice&&<div className="notice success"><CheckCircle2 size={18}/>{notice}<button onClick={()=>setNotice('')}>Fechar</button></div>}
    {section==='overview'&&<div className="stack">
     <div className="hero"><div><div className="hero-kicker">PROJEÇÃO DE {monthLabel(month).toUpperCase()}</div><h2>Seu salário, com todos os detalhes.</h2><p>Projeção independente da folha. Valores efetivos são registrados separadamente pelo holerite.</p><button className="hero-link" onClick={()=>setSection('imports')}>Conferir com holerite <ArrowUpRight size={17}/></button></div><div className="hero-amount"><span>Líquido mensal estimado</span><strong>{brl(payroll.netMonth)}</strong><small>Antes de descontar o adiantamento quinzenal</small></div></div>
     <div className="stats-grid"><Stat name="Remuneração bruta" value={brl(payroll.gross)} note="Salário + triênio + extras"/><Stat name="Descontos totais" value={brl(payroll.gross-payroll.netMonth)} note="INSS, IR, pensão e contribuições"/><Stat name="Pagamento final estimado" value={brl(payroll.finalPayment)} note="Após o adiantamento" tone="accent"/><Stat name="FGTS informativo" value={brl(payroll.fgts)} note="Não descontado do salário"/></div>
     <div className="two-col"><Panel title="Composição do salário" extra={<span className="pill">Estimativa 2026</span>}><div className="breakdown">{metricRows.map(([label,value],i)=><div key={label} className="break-row"><span>{label}</span><strong className={i>=3&&i<=8?'muted':''}>{value}</strong></div>)}</div><div className="total-line"><span>Pagamento no fim do mês</span><strong>{brl(payroll.finalPayment)}</strong></div></Panel>
     <Panel title="Horas extras na competência"><div className="hour-mini"><div><strong>{monthHours.h60.toFixed(1)}h</strong><span>Adicional 60%</span></div><div><strong>{monthHours.h80.toFixed(1)}h</strong><span>Adicional 80%</span></div><div><strong>{monthHours.h100.toFixed(1)}h</strong><span>Adicional 100%</span></div></div><div className="detail-hint"><Info size={16}/>São considerados os dias 16 do mês anterior até 15 do mês atual. O DSR ainda não está automatizado nesta versão.</div><button className="text-button" onClick={()=>setSection('hours')}>Lançar jornada <ChevronRight size={15}/></button></Panel></div>
     {actual&&<Panel title={'Recebimento registrado: '+monthLabel(month)}><div className="stats-grid three"><Stat name="Líquido no fechamento" value={actual.net===null?'A conferir':brl(actual.net)}/><Stat name="Adiantamento salarial" value={actual.salary_advance===null?'A conferir':brl(actual.salary_advance)}/><Stat name="Líquido mensal recebido" value={currentCash?.total===null?'A conferir':brl(currentCash?.total??actual.net_received??0)} note="Fechamento + adiantamento salarial + férias/13º antecipados, sem duplicar" tone="accent"/></div></Panel>}
     {currentCash&&currentCash.vacation>0&&<Panel title={'Férias contabilizadas: '+monthLabel(month)}><div className="stats-grid three"><Stat name="Férias e 13º antecipados" value={brl(currentCash.vacation)}/><Stat name="Status" value={currentCash.vacationState==='reconciled'?'Conciliado':currentCash.vacationState==='estimated'?'Estimado':currentCash.vacationState==='difference'?'Divergência':'Parcial'}/><Stat name="Líquido da competência" value={currentCash.total===null?'A conferir':brl(currentCash.total)} tone="accent"/></div><div className="detail-hint">{currentCash.vacationNote}</div></Panel>}{thirteenthThisMonth&&<Panel title={'13º salário: '+monthLabel(month)}><div className="stats-grid three"><Stat name="13º bruto" value={brl(thirteenthThisMonth.gross)}/><Stat name="IRRF 13º" value={brl(thirteenthThisMonth.irrf)}/><Stat name="13º adicional recebido" value={brl(thirteenthMonth)} tone="accent"/></div><div className="detail-hint">{thirteenthThisMonth.note}</div></Panel>}{pprMonth.length>0&&<Panel title={'PPR recebido: '+monthLabel(month)}><div className="stats-grid three"><Stat name="PPR bruto" value={brl(pprMonth.reduce((sum,s)=>sum+(s.gross_ppr||0),0))}/><Stat name="IRRF e outros descontos" value={brl(pprMonth.reduce((sum,s)=>sum+(s.debits||0),0))}/><Stat name="PPR líquido adicional" value={brl(pprMonth.reduce((sum,s)=>sum+(s.net||0),0))} tone="accent"/></div><div className="detail-hint">Este pagamento é separado da remuneração mensal e não altera o salário-base.</div></Panel>}
     <div className="notice subtle-notice"><Info size={18}/>A simulação de pensão pelos 26% é uma hipótese baseada na folha antiga, não uma validação da determinação judicial. Férias e 13º exigem cálculo separado.</div>
    </div>}
    {section==='history'&&<div className="stack"><div className="page-intro"><div><h2>Seus holerites em um só lugar</h2><p>Importação por competência, sem sobrescrever os documentos originais.</p></div><button className="primary" onClick={()=>setSection('imports')}><Upload size={17}/> Importar PDFs</button></div><div className="filterbar"><span>Período</span><select value={year} onChange={e=>setYear(e.target.value)}><option value="all">Todos os anos</option>{months.map(y=><option key={y} value={y}>{y}</option>)}</select><span className="pill">{filtered.length} holerites</span></div><Panel title={year==='all'?'Resumo por ano':'Holerites de '+year}>
    {year==='all'?annual.length?<div className="table-scroll"><table><thead><tr><th>Ano</th><th>Folhas mensais</th><th>Proventos registrados</th><th>Líquido no fechamento</th><th>Adiantamentos</th><th>Férias e 13º antecipados</th><th>Líquido mensal recebido</th><th>13º adicional</th><th>IRRF 13º</th><th>PPR líquido adicional</th><th>IRRF PPR</th><th>Total financeiro*</th><th>FGTS registrado</th></tr></thead><tbody>{annual.map(a=><tr key={a.year} onClick={()=>setYear(a.year)} className="clickable"><td><strong>{a.year}</strong></td><td>{a.count}</td><td>{brl(a.credits)}</td><td>{brl(a.closing)}</td><td>{brl(a.advance)}</td><td>{a.vacationCount?brl(a.vacation):'—'}</td><td><div className="financial-value-status"><span>{a.missing?'A conferir ('+a.missing+' mês(es))':brl(a.net)}</span>{a.unreconciled>0&&<span className="pill">{a.unreconciled} férias pendentes</span>}</div></td><td>{a.thirteenthCount?brl(a.thirteenthNet):'—'}</td><td>{a.thirteenthCount?brl(a.thirteenthIrrf):'—'}</td><td>{a.pprCount?brl(a.pprNet):'—'}</td><td>{a.pprCount?brl(a.pprIrrf):'—'}</td><td><strong>{a.missing?'Parcial':brl(a.totalFinancial)}</strong></td><td>{brl(a.fgts)}</td></tr>)}</tbody></table></div>:<Empty text="Nenhum holerite importado ainda. Abra Importar holerites para começar."/>:
    filtered.length?<div className="table-scroll"><table><thead><tr><th>Competência</th><th>Tipo</th><th>Proventos</th><th>Descontos</th><th>IRRF PPR</th><th>IRRF 13º</th><th>Fechamento</th><th>Adiantamento salarial</th><th>Líquido recebido</th><th>Observação</th></tr></thead><tbody>{filtered.map(s=><tr key={s.id} onClick={()=>showStatement(s)} className="clickable"><td><strong>{monthLabel(s.period)}</strong></td><td>{s.document_type==='ppr'?<span className="pill">PPR</span>:s.document_type==='vacation'?<span className="pill">Férias</span>:s.document_type==='thirteenth'?<span className="pill">13º</span>:'Mensal'}</td><td>{s.credits===null?'—':brl(s.credits)}</td><td>{s.debits===null?'—':brl(s.debits)}</td><td>{s.document_type==='ppr'?brl(s.ppr_income_tax||0):'—'}</td><td>{s.document_type==='thirteenth'?brl(s.thirteenth_irrf):'—'}</td><td>{s.net===null?'—':brl(s.net)}</td><td>{s.document_type==='vacation'?'—':s.salary_advance===null?'A conferir':brl(s.salary_advance)}</td>
    <td>{s.document_type==='thirteenth'?<><strong>{brl(thirteenthLedger.occurrences.find(t=>t.statementId===s.id)?.cashAdditional??s.net??0)}</strong><div className="subtle">13º separado</div></>:s.document_type==='vacation'?<span className="subtle">Incluído na conciliação</span>:
       <div className="financial-value-status"><strong>{vacationLedger.byMonth.get(s.period)?.total===null?'A conferir':brl(vacationLedger.byMonth.get(s.period)?.total??s.net_received??0)}</strong>
       {vacationLedger.byMonth.get(s.period)?.vacationState&&<span className="pill vacation-status-pill">{vacationLedger.byMonth.get(s.period)?.vacationState==='reconciled'?'Férias conciliadas':'Férias estimadas ou pendentes'}</span>}</div>}
    </td><td>{s.warnings?.length?<span className="flag">Conferir</span>:<span className="ok">Conferido</span>}</td></tr>)}</tbody></table></div>:<Empty text="Não há holerites para este ano."/>}
    </Panel>{selectedStmt&&<Panel title={'Detalhes de '+(selectedStmt.document_type==='ppr'?'PPR · ':selectedStmt.document_type==='vacation'?'Férias · ':selectedStmt.document_type==='thirteenth'?'13º · ':'')+monthLabel(selectedStmt.period)} extra={<button className="secondary" onClick={()=>setSelectedStmt(null)}>Fechar</button>}>{selectedStmt.document_type==='thirteenth'?<div className="detail-hint">13º bruto: <strong>{selectedStmt.thirteenth_gross===null?'A conferir':brl(selectedStmt.thirteenth_gross)}</strong>; adiantamento descontado: {brl(selectedStmt.thirteenth_advance)}; INSS: {brl(selectedStmt.thirteenth_inss)}; IRRF: {brl(selectedStmt.thirteenth_irrf)}; pensão: {brl(selectedStmt.thirteenth_pension)}; líquido no fechamento: <strong>{selectedStmt.net===null?'A conferir':brl(selectedStmt.net)}</strong>. {thirteenthLedger.byYear.get(selectedStmt.period.slice(0,4))?.note}</div>:selectedStmt.document_type==='vacation'?<div className="detail-hint">Recibo complementar de férias: <strong>{selectedStmt.net===null?'A conferir':brl(selectedStmt.net)}</strong>. Período: {selectedStmt.vacation_start?dateBR(selectedStmt.vacation_start):'Não identificado'} a {selectedStmt.vacation_end?dateBR(selectedStmt.vacation_end):'Não identificado'}. Pagamento efetivo: {selectedStmt.payment_date?dateBR(selectedStmt.payment_date):'Não identificado'}. Este líquido substitui os adiantamentos já inferidos das folhas mensais correspondentes; não é somado novamente.</div>:selectedStmt.document_type==='ppr'?<div className="detail-hint">PPR bruto: <strong>{selectedStmt.gross_ppr===null?'A conferir':brl(selectedStmt.gross_ppr)}</strong>. IRRF PPR: <strong>{brl(selectedStmt.ppr_income_tax||0)}</strong>. Contribuição negocial: <strong>{brl(selectedStmt.ppr_union_contribution||0)}</strong>. Líquido pago: <strong>{selectedStmt.net===null?'A conferir':brl(selectedStmt.net)}</strong>. Data de pagamento: {selectedStmt.payment_date?dateBR(selectedStmt.payment_date):'Não identificada'}. Evento lançado separadamente.</div>:<div className="detail-hint">Líquido mensal: {selectedStmt.net===null?'A conferir':brl(selectedStmt.net)} (fechamento) + {selectedStmt.salary_advance===null?'A conferir':brl(selectedStmt.salary_advance)} (adiantamento salarial) = <strong>{selectedStmt.net_received===null?'A conferir':brl(selectedStmt.net_received)}</strong>. Férias identificadas na folha: {brl(vacationLedger.byMonth.get(selectedStmt.period)?.vacation??0)}. Total financeiro da competência: <strong>{vacationLedger.byMonth.get(selectedStmt.period)?.total===null?'A conferir':brl(vacationLedger.byMonth.get(selectedStmt.period)?.total??selectedStmt.net_received??0)}</strong>. O recibo complementar não duplica a contabilização.</div>}<div className="table-scroll"><table><thead><tr><th>Código</th><th>Rubrica original</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>{statementLines.map((l,i)=><tr key={i}><td>{l.code}</td><td>{l.description}</td><td>{l.side==='credit'?'Provento':l.side==='debit'?'Desconto':'Revisar'}</td><td>{brl(Number(l.amount))}</td></tr>)}</tbody></table></div>{selectedStmt.warnings?.map((w,i)=><div className="detail-hint" key={i}><AlertTriangle size={15}/>{w}</div>)}</Panel>}<VacationOverview ledger={vacationLedger} year={year}/><ThirteenthOverview ledger={thirteenthLedger} year={year}/></div>}
    {section==='hours'&&<div className="stack"><div className="page-intro"><div><h2>Jornada e horas extras</h2><p>Até 8h em dias úteis, duas primeiras horas extras a 60%, excedente a 80% e domingos/feriados a 100%. <strong>Base · {base?baseLabel(base):'Não configurada'}.</strong></p></div></div>{holidayStatus==='unconfigured'&&<div className="notice warning"><Info size={18}/>Configure sua Base em Configurações antes de registrar horários e calcular feriados.</div>}{holidayCalendar&&<div className={holidayCalendar.coverage==='partial'?'notice warning':'notice subtle-notice'}><Info size={18}/>{holidayCalendar.message}</div>}{holidayStatus==='loading'&&<div className="notice subtle-notice"><Info size={18}/>Carregando calendário de feriados para {base?baseLabel(base):'a Base'}...</div>}{holidayStatus==='failed'&&<div className="notice warning"><AlertTriangle size={18}/>Não foi possível preparar o calendário de feriados. Verifique sua conexão antes de lançar horas.</div>}<div className="stats-grid three"><Stat name="Extras 60% na folha" value={monthHours.h60.toFixed(2)+' h'}/><Stat name="Extras 80% na folha" value={monthHours.h80.toFixed(2)+' h'}/><Stat name="Extras 100% na folha" value={monthHours.h100.toFixed(2)+' h'}/></div><div className="two-col"><Panel title={entryId?'Editar jornada':'Registrar jornada'}><form className="form" onSubmit={e=>{e.preventDefault();saveEntry()}}><label>Data<input type="date" required value={entry.date} onChange={e=>setEntry({...entry,date:e.target.value,holidayOverride:null})}/></label><div className="form-grid">{[['Entrada','start'],['Início do almoço','lunchStart'],['Fim do almoço','lunchEnd'],['Saída','end']].map(([label,key])=><label key={key}>{label}<input type="time" required value={entry[key as keyof DayEntry] as string} onChange={e=>setEntry({...entry,[key]:e.target.value})}/></label>)}</div><label className="checkbox-label"><input type="checkbox" checked={entry.holidayOverride??(holidayDates?.has(entry.date)??false)} onChange={e=>setEntry({...entry,holidayOverride:e.target.checked})}/>Considerar feriado neste dia</label><button type="button" className="text-button" onClick={()=>setEntry({...entry,holidayOverride:null})}>Usar calendário automático de {base?baseLabel(base):'sua Base'}</button><div className="detail-hint"><Info size={16}/>A classificação automática pode ser alterada. Ponto facultativo não equivale a feriado. A Base cadastrada é usada quando não existe um ajuste manual na data.</div><button className="primary" disabled={busy||!db||!holidayDates} type="submit"><Save size={17}/> Salvar jornada</button></form></Panel><Panel title="Fechamento e competência"><div className="timeline"><div><strong>16 a 31</strong><span>Mês anterior</span></div><ChevronRight size={21}/><div><strong>01 a 15</strong><span>Mês atual</span></div><ChevronRight size={21}/><div><strong>Pagamento</strong><span>Mês atual</span></div></div><div className="detail-hint"><Info size={16}/>Os valores de DSR, banco de horas e jornadas noturnas estão planejados, mas ainda não são calculados automaticamente. A regra de 220h é provisória.</div></Panel></div><Panel title="Registros de ponto"><div className="table-scroll">{computedHours.length?<table><thead><tr><th>Data</th><th>Horários</th><th>60%</th><th>80%</th><th>100%</th><th>Folha</th><th>Ações</th></tr></thead><tbody>{computedHours.map(x=><tr key={x.id}><td>{dateBR(x.date)}</td><td>{x.start} a {x.end}</td><td>{x.calc.h60.toFixed(2)}h</td><td>{x.calc.h80.toFixed(2)}h</td><td>{x.calc.h100.toFixed(2)}h</td><td>{x.calc.payMonth}</td><td><button className="icon-button" onClick={()=>{setEntryId(x.id);setEntry(x)}}><Pencil size={15}/></button><button className="icon-button" onClick={()=>task(async()=>{await removeTimeEntry(x.id);await refresh()},'Registro excluído')}><Trash2 size={15}/></button></td></tr>)}</tbody></table>:<Empty text="Ainda não há registros de jornada."/ >}</div></Panel></div>}
    {section==='events'&&<div className="stack"><div className="page-intro"><div><h2>Parâmetros com data de início</h2><p>Alterações permanentes afetam as projeções a partir da vigência. Ocorrências pontuais não alteram o salário-base.</p></div></div><div className="two-col"><Panel title={eventId?'Editar evento':'Novo evento'}><form className="form" onSubmit={e=>{e.preventDefault();saveNewEvent()}}><label>Evento<select value={eventKind} onChange={e=>setEventKind(e.target.value)}>{eventsKinds.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Valor / quantidade<input type="text" inputMode="decimal" required value={eventValue} onChange={e=>setEventValue(e.target.value)} onBlur={()=>setEventValue(value=>formatEventInput(value,eventKind))} placeholder={eventKind==='dependents'?'0':'0,00'} autoComplete="off"/></label><label>Data de início<input type="date" required value={eventDate} onChange={e=>setEventDate(e.target.value)}/></label><label>Observação<textarea value={eventNote} onChange={e=>setEventNote(e.target.value)} rows={2} placeholder="Opcional"/></label><button className="primary" disabled={busy||!db} type="submit"><Plus size={17}/>{eventId?'Atualizar evento':'Adicionar evento'}</button></form></Panel><Panel title="Como funcionam as vigências"><div className="instruction"><div className="step">01</div><p>Cadastre uma mudança com o valor novo, não a diferença.</p></div><div className="instruction"><div className="step">02</div><p>A data define a primeira competência da nova regra. Eventos antigos permanecem no histórico.</p></div><div className="instruction"><div className="step">03</div><p>Importações de holerites sugerem mudanças, mas nunca criam eventos permanentes sem confirmação.</p></div></Panel></div><Panel title="Eventos cadastrados">{events.length?<div className="table-scroll"><table><thead><tr><th>Evento</th><th>Vigência</th><th>Valor</th><th>Observações</th><th>Ações</th></tr></thead><tbody>{events.map(x=><tr key={x.id}><td>{eventsKinds.find(([id])=>id===x.kind)?.[1]||x.kind}</td><td>{dateBR(x.effective_date)}</td><td>{formatEventValue(x.value,x.kind)}</td><td>{x.notes}{x.source_statement_id&&<span className="pill">Importado do PDF</span>}</td><td>{x.source_statement_id?<span className="subtle">Vinculado ao holerite</span>:<><button className="icon-button" onClick={()=>{setEventId(x.id);setEventKind(x.kind);setEventDate(x.effective_date);setEventValue(formatEventValue(x.value,x.kind));setEventNote(x.notes)}}><Pencil size={15}/></button><button className="icon-button" onClick={()=>task(async()=>{await removeEvent(x.id);await refresh()},'Evento excluído')}><Trash2 size={15}/></button></>}</td></tr>)}</tbody></table></div>:<Empty text="Nenhum evento cadastrado."/ >}</Panel><VacationOverview ledger={vacationLedger} year={year}/><ThirteenthOverview ledger={thirteenthLedger} year={year}/></div>}
    {section==='analytics'&&<AnalyticsDashboard year={year} onYearChange={setYear} years={months}
      statements={statements} lines={allLines} monthlyGraph={monthlyGraph}
      vacationLedger={vacationLedger} thirteenthLedger={thirteenthLedger} parameters={params}/>}
    {section==='income-tax'&&<TaxPreview userId={user?.id||null} statements={statements}/>}
    {section==='imports'&&<div className="stack"><div className="page-intro"><div><h2>Importação inteligente de PDFs</h2><p>Reconhece folhas mensais, PPR, férias e 13º salário da Accenture. Os recibos de férias são opcionais; o recibo de 13º comprova os impostos exclusivos e é conciliado com adiantamentos anteriores.</p></div></div><Panel title="Selecionar holerites"><div className="dropzone"><Upload size={30}/><strong>Envie PDFs antigos ou novos</strong><p>É possível selecionar vários arquivos e importar documentos com várias páginas.</p><label className="primary file-button">Selecionar PDFs<input multiple type="file" accept="application/pdf,.pdf" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length)previewFiles(files)}}/></label></div><div className="detail-hint"><ShieldCheck size={16}/>A leitura ocorre no navegador. O envio ao armazenamento privado acontece somente após você confirmar.</div></Panel>{previews.length>0&&<Panel title={'Prévia: '+previews.length+' competência(s)'} extra={<button className="secondary" onClick={()=>previewFiles(importFiles)}><RefreshCw size={15}/> Reler</button>}><div className="table-scroll"><table><thead><tr><th>Importar</th><th>Arquivo</th><th>Competência</th><th>Tipo</th><th>Formato</th><th>Proventos</th><th>Fechamento</th><th>Adiantamento salarial</th><th>Férias/13º antecipados</th><th>Líquido financeiro estimado</th><th>Resultado</th></tr></thead><tbody>{previews.map(s=>{const key=s.sourceFile+'#'+s.page;return <tr key={key}><td><input type="checkbox" checked={importSelected.includes(key)} onChange={e=>setImportSelected(v=>e.target.checked?[...v,key]:v.filter(x=>x!==key))}/></td><td>{s.sourceFile} (p. {s.page})</td><td>{s.period||'Não encontrada'}</td><td>{s.documentType==='ppr'?<span className="pill">PPR</span>:s.documentType==='vacation'?<span className="pill">Férias</span>:s.documentType==='thirteenth'?<span className="pill">13º</span>:'Mensal'}</td><td>{s.format==='old'?'Antigo':'Novo'}</td><td>{s.credits===null?'—':brl(s.credits)}</td><td>{s.net===null?'—':brl(s.net)}</td><td>{s.documentType==='thirteenth'?brl(s.thirteenthAdvance):s.documentType==='vacation'?'—':s.salaryAdvance===null?'A conferir':brl(s.salaryAdvance)}</td>
    <td>{s.documentType==='monthly'?brl(vacationAdvanceFromLines(s.lines)):'—'}</td>
    <td><strong>{s.documentType==='thirteenth'?brl(s.net??0):s.documentType==='vacation'?brl(s.net??0):s.documentType==='monthly'&&s.netReceived!==null?brl(s.netReceived+vacationAdvanceFromLines(s.lines)):s.netReceived===null?'A conferir':brl(s.netReceived)}</strong>
      {s.documentType==='vacation'&&<div className="subtle">Valor do recibo; não somar novamente</div>}{s.documentType==='thirteenth'&&<div className="subtle">Fechamento do 13º; adiantamento será conciliado ao salvar</div>}
      {s.documentType==='monthly'&&vacationAdvanceFromLines(s.lines)>0&&<div className="subtle">Estimado; recibo opcional</div>}</td><td>{s.warnings.length?<span title={s.warnings.join('; ')} className="flag">{s.warnings.length} aviso(s)</span>:<span className="ok">OK</span>}</td></tr>})}</tbody></table></div>{previews.some(s=>s.documentType==='vacation'||(s.documentType==='monthly'&&vacationAdvanceFromLines(s.lines)>0))&&<div className="notice subtle-notice"><Info size={18}/><div><strong>Conciliação automática de férias</strong><p style={{margin:'5px 0 0'}}>A folha mensal é suficiente para registrar os adiantamentos identificados. O recibo de férias é opcional e confirma ou substitui esse valor. O pagamento antecipado nunca será contabilizado duas vezes. Caso exista diferença, ela será exibida no Histórico salarial.</p></div></div>}{previews.some(s=>s.documentType==='thirteenth')&&<div className="suggestion"><strong>13º salário: prévia do recibo anual</strong>{previews.filter(s=>s.documentType==='thirteenth').map(s=><div key={s.sourceFile+'#'+s.page}><span>{s.period}: bruto {s.thirteenthGross===null?'A conferir':brl(s.thirteenthGross)}; adiantamento anterior {brl(s.thirteenthAdvance)}; fechamento {s.net===null?'A conferir':brl(s.net)}; INSS {brl(s.thirteenthInss)}; IRRF exclusivo {brl(s.thirteenthIrrf)}; pensão {brl(s.thirteenthPension)}; pago em {s.paymentDate?dateBR(s.paymentDate):'data não identificada'}.</span></div>)}<small>Ao confirmar, o recibo ficará separado da folha mensal e será vinculado aos adiantamentos já contabilizados nas férias. O sistema não duplicará essas parcelas.</small></div>}{previews.some(s=>s.documentType==='ppr')&&<div className="suggestion"><strong>Evento PPR automático após confirmação</strong>{previews.filter(s=>s.documentType==='ppr').map(s=><div key={s.sourceFile+'#'+s.page}><span>{s.period}: PPR bruto {s.grossPpr===null?'Não encontrado':brl(s.grossPpr)}; IRRF PPR {brl(s.pprIncomeTax)}; contribuição negocial {brl(s.pprUnionContribution)}; líquido pago {s.net===null?'A conferir':brl(s.net)}; data {s.paymentDate?dateBR(s.paymentDate):'Não encontrada'}.</span></div>)}<small>O evento será criado apenas ao confirmar o documento, uma vez por holerite, e não altera a projeção salarial fixa.</small></div>}{suggestions.length>0&&<div className="suggestion"><strong>Possíveis mudanças encontradas</strong>{suggestions.map((s,i)=><div key={i}><span>{s.period}: {fieldNames[s.kind]||s.kind} → {brl(s.value)}. {s.reason}</span></div>)}<small>As mudanças NÃO serão criadas automaticamente. Use a tela Eventos após verificar cada vigência.</small></div>}<button className="primary" disabled={busy||!db||importSelected.length===0} onClick={()=>task(async()=>{await saveStatements(previews,importFiles,importSelected);await refresh();setPreviews([])},'Holerites importados com valores originais preservados')}><Upload size={17}/> Confirmar {importSelected.length} documento(s)</button>{!db&&<p className="subtle">Configure o banco para habilitar o salvamento.</p>}</Panel>}</div>}
    {section==='admin'&&isAdmin&&<AdminDashboard/>}
    {section==='settings'&&<div className="stack"><div className="page-intro"><div><h2>Configurações pessoais</h2><p>Base de trabalho, parâmetros salariais e preferências. Cada pessoa configura sua própria localização.</p></div></div><Panel title="Base"><BasePicker current={base} busy={busy} onSave={next=>task(async()=>{if(!db)throw Error('Banco não configurado');await saveBase(next);await refresh()},'Base atualizada. O calendário será recalculado para a nova cidade.')}/></Panel><Panel title="Remuneração e descontos"><div className="form"><div className="settings-readonly-heading">
      <p className="subtle">Valores efetivos da competência <strong>{monthLabel(month)}</strong>. Para alterar, cadastre um evento em <button type="button" className="text-button" onClick={()=>setSection('events')}>Eventos e vigências</button>.</p>
    </div>
    <div className="form-grid">{(Object.keys(fieldNames) as Array<keyof SalaryParameters>).map(k=>{
      const latest=latestEffectiveEvent(events,k,month)
      const value=Number(effective[k])
      return <div key={k} className="settings-readonly-field">
        <span className="settings-readonly-label">{fieldNames[k]}</span>
        <strong className="settings-readonly-value">{displayEffectiveParameter(k,value)}</strong>
        <small className="settings-readonly-source">{latest?'Evento vigente desde '+dateBR(latest.effective_date):'Valor-base anterior, sem evento vigente'}</small>
      </div>
    })}</div>
    <div className="settings-readonly-field settings-pension-method">
      <span className="settings-readonly-label">Regra de pensão</span>
      <strong className="settings-readonly-value">{pensionMethods[effective.pensionMethod]}</strong>
      <small className="settings-readonly-source">Regra técnica existente, ainda sem evento específico de vigência</small>
    </div>
    <div className="detail-hint"><Info size={16}/>Os valores são carregados automaticamente do evento mais recente vigente até a competência selecionada. Quando não existe evento para um campo, permanece o valor-base previamente cadastrado. Para modificá-los, utilize Eventos e vigências.</div>
  </div></Panel><Panel title="Senha e primeiro acesso"><ChangePassword/></Panel><Panel title="Conta e privacidade"><div className="instruction"><ShieldCheck size={22}/><p>Cada registro é vinculado ao usuário autenticado. O banco utiliza políticas de isolamento por conta. Cadastros públicos estão desativados.</p></div>{user&&<p className="subtle">Conectado como {user.email}</p>}<p className="subtle">Convites ainda são administrados no painel do provedor de autenticação. Não há painel de convites nesta versão.</p></Panel></div>}
   </div>
  </main>
 </div>
}
