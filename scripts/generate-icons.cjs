const sharp = require('sharp');
const {readFile,writeFile,mkdir} = require('node:fs/promises');
const path = require('node:path');

const base = path.resolve(__dirname, '..');
const publicDir = path.join(base, 'public');
const source = path.join(publicDir, 'brand', 'payrep-symbol.svg');

async function icon(svg, size, {scale = .84, background = '#ffffff', transparent = false} = {}) {
  const pixel = Math.round(size * scale);
  const logo = await sharp(svg, {density:350})
    .resize(pixel, pixel, {fit:'contain',background:'#00000000'})
    .png().toBuffer();
  const base = sharp({create:{width:size,height:size,channels:4,background:transparent?'#00000000':background}});
  return base.composite([{input:logo,left:Math.floor((size-pixel)/2),top:Math.floor((size-pixel)/2)}]).png().toBuffer();
}

function ico(buffers, sizes) {
  const count = buffers.length;
  const header = Buffer.alloc(6 + count * 16);
  header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(count,4);
  let offset = header.length;
  for(let i=0;i<count;i++){
    const n = sizes[i], at = 6+i*16;
    header.writeUInt8(n === 256 ? 0 : n,at);
    header.writeUInt8(n === 256 ? 0 : n,at+1);
    header.writeUInt8(0,at+2);header.writeUInt8(0,at+3);
    header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);
    header.writeUInt32LE(buffers[i].length,at+8);header.writeUInt32LE(offset,at+12);
    offset += buffers[i].length;
  }
  return Buffer.concat([header,...buffers]);
}

async function main(){
  const svg=await readFile(source);
  await mkdir(publicDir,{recursive:true});
  const faviconSizes = [16,32,48];
  const small=[];
  for(const size of faviconSizes){
    const data=await icon(svg,size,{scale:.91,transparent:true});
    small.push(data);
    await writeFile(path.join(publicDir,'favicon-'+size+'x'+size+'.png'),data);
  }
  await writeFile(path.join(publicDir,'favicon.ico'),ico(small,faviconSizes));
  const specs = [
    ['apple-touch-icon.png',180,.76,'#faf6ff'],
    ['icon-192.png',192,.82,'#faf6ff'],
    ['icon-512.png',512,.82,'#faf6ff'],
    ['icon-maskable-192.png',192,.64,'#f4e8ff'],
    ['icon-maskable-512.png',512,.64,'#f4e8ff'],
    ['mstile-150x150.png',150,.76,'#faf6ff'],
  ];
  for(const [file,size,scale,background] of specs){
    await writeFile(path.join(publicDir,file),await icon(svg,size,{scale,background}));
  }
  process.stdout.write('Ícones Payrep gerados.\n');
}
main().catch(err=>{console.error(err);process.exitCode=1});
