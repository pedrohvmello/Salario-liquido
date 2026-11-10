/** Human-readable, non-lossy axis labels for Brazilian currency charts.
 * Rounding directly to whole thousands turned every low-value tick into "0k".
 * Keep three decimals after scaling to preserve distinct Recharts tick values.
 */
const numberBR=(value:number,maxDecimals:number)=>new Intl.NumberFormat('pt-BR',{
 maximumFractionDigits:maxDecimals,minimumFractionDigits:0
}).format(value)
export function formatMoneyAxisTick(input:number|string):string{
 const value=Number(input)
 if(!Number.isFinite(value))return '—'
 if(value===0)return '0'
 const abs=Math.abs(value)
 if(abs>=1_000_000)return numberBR(value/1_000_000,3)+' mi'
 if(abs>=1_000)return numberBR(value/1_000,3)+' mil'
 return numberBR(value,3)
}
