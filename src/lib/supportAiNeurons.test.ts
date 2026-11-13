import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {cloudflareNeuronsQuery,parseAiNeuronUsage} from '../../supabase/functions/support-ai-usage/metrics'

describe('Cloudflare Workers AI Neurons reader',()=>{
 it('parses provider reported neurons and keeps per-model details',()=>{
  const value=parseAiNeuronUsage({data:{viewer:{accounts:[{aiInferenceAdaptiveGroups:[
   {dimensions:{modelId:'@cf/google/gemma-4-26b-a4b-it'},sum:{totalNeurons:17.25}},
   {dimensions:{modelId:'@cf/baai/bge-m3'},sum:{totalNeurons:0.5}},
   {dimensions:{modelId:'@cf/google/gemma-4-26b-a4b-it'},sum:{totalNeurons:2.25}}
  ]}]}}})
  expect(value).toEqual({used:20,models:[
   {model:'@cf/google/gemma-4-26b-a4b-it',neurons:19.5},
   {model:'@cf/baai/bge-m3',neurons:0.5}
  ]})
 })
 it('allows a real zero reading only when the provider returns an empty group array',()=>{
  expect(parseAiNeuronUsage({data:{viewer:{accounts:[{aiInferenceAdaptiveGroups:[]}]}}}))
   .toEqual({used:0,models:[]})
  expect(parseAiNeuronUsage(null)).toBeNull()
  expect(parseAiNeuronUsage({data:{viewer:{accounts:[]}}})).toBeNull()
 })
 it('does not treat invalid provider responses or auth failures as zero usage',()=>{
  expect(parseAiNeuronUsage({errors:[{message:'Unauthorized'}]})).toBeNull()
  expect(parseAiNeuronUsage({data:{viewer:{accounts:[{aiInferenceAdaptiveGroups:[{sum:{totalNeurons:-5}}]}]}}})).toBeNull()
  expect(parseAiNeuronUsage({data:{viewer:{accounts:[{aiInferenceAdaptiveGroups:[{sum:{totalNeurons:'15'}}]}]}}})).toBeNull()
 })
 it('queries daily account-wide neurons using a fixed UTC date',()=>{
  const q=cloudflareNeuronsQuery('0123456789abcdef0123456789abcdef','2026-11-13')
  expect(q).toContain('aiInferenceAdaptiveGroups')
  expect(q).toContain('totalNeurons')
  expect(q).toContain('modelId')
  expect(q).toContain('date:"2026-11-13"')
  expect(()=>cloudflareNeuronsQuery('bad','2026-11-13')).toThrow()
  expect(()=>cloudflareNeuronsQuery('0123456789abcdef0123456789abcdef','2026-11-13\u0022}')).toThrow()
 })
 it('authenticates, restricts scope and does not disclose Cloudflare secrets',()=>{
  const source=readFileSync('supabase/functions/support-ai-usage/index.ts','utf8')
  expect(source).toContain('db.auth.getUser(bearer[1])')
  expect(source).toContain("member.role!=='admin'")
  expect(source).toContain("member.status!=='approved'")
  expect(source).toContain("CLOUDFLARE_AI_USAGE_API_TOKEN")
  expect(source).toContain("redirect:'manual'")
  expect(source).toContain('cache={day,expiry:Date.now()+10*60*1000,result}')
  expect(source).toContain("nrpqcrhschztdwbfgnyo.supabase.co")
  expect(source).toContain('status:\'not_configured\'')
  expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY\'\n')
 })
 it('shows account-wide usage separate from Payrep question quotas',()=>{
  const admin=readFileSync('src/components/AdminSettingsPage.tsx','utf8')
  const dashboard=readFileSync('src/components/AdminAiNeurons.tsx','utf8')
  expect(admin).toContain('<AdminAiNeurons/>')
  expect(dashboard).toContain('Consumo de Neurons (Cloudflare)')
  expect(dashboard).toContain('conta inteira')
  expect(dashboard).toContain('Neurons restantes')
  expect(dashboard).toContain('10 minutos')
 })
 it('contains no arbitrary daily quota maxima in the latest migration',()=>{
  const sql=readFileSync('supabase/migrations/0033_support_ai_remove_arbitrary_caps_hml.sql','utf8')
  const ui=readFileSync('src/lib/supportAiLimits.ts','utf8')
  expect(sql).toContain('alter column support_ai_user_daily_limit type bigint')
  expect(sql).not.toContain('p_global_limit < p_user_limit')
  expect(sql).not.toContain('between 1 and 300')
  expect(ui).not.toContain('perUserMax:100')
  expect(ui).not.toContain('globalMax:300')
 })
})
