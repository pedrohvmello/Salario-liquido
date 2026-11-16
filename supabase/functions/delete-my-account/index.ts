// PRD: retained for compatibility only. Hard deletion is no longer an
// in-app operation; users can suspend their account through payslip-reset.
// Do not delete auth.users, storage objects, or payroll data from here.
const origins=new Set(['https://payrep.com.br','https://www.payrep.com.br','https://payrep.vercel.app'])
Deno.serve(req=>{
 const incoming=req.headers.get('origin')||'https://payrep.com.br'
 const allowed=origins.has(incoming)
 const headers={
  'Access-Control-Allow-Origin':allowed?incoming:'https://payrep.com.br',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'Vary':'Origin'
 }
 if(!allowed)return new Response(JSON.stringify({error:'Origem não autorizada.'}),{status:403,headers})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Método não permitido.'}),{status:405,headers})
 return new Response(JSON.stringify({
  error:'A exclusão permanente antiga não está disponível no aplicativo. Use Segurança para excluir dados ou suspender a conta.',
  code:'legacy_deletion_disabled'
 }),{status:410,headers})
})
