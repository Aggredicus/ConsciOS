const QR_MODULE_URL='https://cdn.jsdelivr.net/gh/kazuhikoarase/qrcode-generator@83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/js/dist/qrcode.mjs';
let modulePromise=null;

async function loadQrModule(){
  modulePromise??=import(QR_MODULE_URL);
  return modulePromise;
}

export async function renderQr(target,text,{cellSize=4,margin=16}={}){
  if(typeof text!=='string'||text.length===0)throw new TypeError('QR text is required');
  const {qrcode}=await loadQrModule();
  const qr=qrcode(0,'L');qr.addData(text);qr.make();
  target.innerHTML=qr.createSvgTag(cellSize,margin,'ConsciOS swarm pairing QR');
  const svg=target.querySelector('svg');if(svg){svg.setAttribute('role','img');svg.setAttribute('aria-label','ConsciOS swarm pairing QR');svg.style.maxWidth='100%';svg.style.height='auto';svg.style.background='white'}
  return {moduleCount:qr.getModuleCount(),characters:text.length,moduleUrl:QR_MODULE_URL};
}

export {QR_MODULE_URL};
