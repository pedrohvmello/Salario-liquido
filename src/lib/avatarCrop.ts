export type Offset={x:number;y:number}
export function cropScale(size:number,w:number,h:number,zoom=1){
 if(size<=0||w<=0||h<=0)throw Error('Dimensões inválidas')
 return Math.max(size/w,size/h)*Math.max(1,zoom)
}
/** Clamp offsets so the crop never exposes empty space. */
export function cropOffsetClamp(offset:Offset,size:number,drawW:number,drawH:number):Offset{
 const maxX=Math.max(0,(drawW-size)/2),maxY=Math.max(0,(drawH-size)/2)
 return {x:Math.max(-maxX,Math.min(maxX,offset.x)),y:Math.max(-maxY,Math.min(maxY,offset.y))}
}
