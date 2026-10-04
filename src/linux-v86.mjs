const DEFAULT_ASSETS=Object.freeze({
  library:'https://copy.sh/v86/build/libv86.js',
  wasm:'https://copy.sh/v86/build/v86.wasm',
  bios:'https://copy.sh/v86/bios/seabios.bin',
  vgaBios:'https://copy.sh/v86/bios/vgabios.bin',
  bzImage:'https://i.copy.sh/buildroot-bzimage68.bin'
});
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src===src);
    if(existing&&globalThis.V86)return resolve();
    const script=existing??document.createElement('script');
    if(!existing){script.src=src;script.async=true;document.head.appendChild(script)}
    script.addEventListener('load',resolve,{once:true});
    script.addEventListener('error',()=>reject(new Error('Unable to load v86 library.')),{once:true});
  });
}
export function createLinuxController({output,input,panel,assets=DEFAULT_ASSETS}={}){
  let emulator=null;let phase='stopped';
  const write=text=>{if(!output)return;output.textContent+=text;output.scrollTop=output.scrollHeight};
  if(input)input.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||!emulator)return;
    const command=input.value;input.value='';write(`\n$ ${command}\n`);emulator.serial0_send(`${command}\n`);
  });
  return Object.freeze({
    status:()=>`Linux VM: ${phase}`,
    start:async()=>{
      if(emulator)return 'Linux VM is already running.';
      phase='loading';if(panel)panel.hidden=false;write('Loading v86 and minimal Linux assets...\n');
      try{
        await loadScript(assets.library);
        if(!globalThis.V86)throw new Error('v86 loaded without a V86 global.');
        emulator=new globalThis.V86({
          wasm_path:assets.wasm,memory_size:64*1024*1024,vga_memory_size:2*1024*1024,
          bios:{url:assets.bios},vga_bios:{url:assets.vgaBios},bzimage:{url:assets.bzImage,async:false},
          filesystem:{},cmdline:'tsc=reliable mitigations=off random.trust_cpu=on',
          autostart:true,disable_keyboard:true
        });
        emulator.add_listener('serial0-output-byte',byte=>{const char=String.fromCharCode(byte);if(char!=='\r')write(char)});
        phase='running';input?.focus();return 'Linux VM started. Boot output is shown in the Linux panel.';
      }catch(error){
        emulator=null;phase='error';write(`\nLinux boot failed: ${error.message}\n`);
        return `Linux VM failed to start: ${error.message}`;
      }
    },
    stop:async()=>{
      if(!emulator){phase='stopped';return 'Linux VM is not running.'}
      try{emulator.stop()}catch{}
      emulator=null;phase='stopped';write('\n[VM stopped]\n');return 'Linux VM stopped.';
    }
  });
}
