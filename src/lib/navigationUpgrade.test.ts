import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
describe('Payrep navigation and Pep upgrade',()=>{
 it('orders payslips and events immediately after Overview in the main menu',()=>{
  const src=readFileSync('src/App.tsx','utf8')
  const entries=[...src.matchAll(/\{id:'(overview|imports|events|history|hours)',label:/g)].slice(0,5).map(x=>x[1])
  expect(entries).toEqual(['overview','imports','events','history','hours'])
 })
 it('advertises real Basic/Full benefits without an inactive back action or invented fixed price',()=>{
  const src=readFileSync('src/components/PersonalPepPage.tsx','utf8')
  const block=src.split("if(!usage?.unlimited&&usage?.effectivePlan==='free')")[1].split("return <SupportAiChat")[0]
  expect(block).toContain('Ver planos e preços')
  expect(block).toContain('pep-upgrade-plan-full')
  expect(block).toContain('onClick={onSubscribe}')
  expect(block).not.toContain('onClick={onBack}')
  expect(block).not.toContain('R
 })
})
)
  expect(block).toContain('<PepMascot variant="header" videoUrl={pepVideoUrl}')
  expect(block).toContain('pep-upgrade-video-showcase')
  expect(block).toContain('src="/media/pep-apresentacao.mp4"')
  expect(block).toContain('poster="/media/pep-apresentacao-poster.webp"')
  expect(block).toContain('controls playsInline preload="metadata"')
 })
})
