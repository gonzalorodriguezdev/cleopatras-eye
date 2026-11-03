import {readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Raw evidence only. Never execute Lua or infer scan time from file modification time.
export class SavedVariablesCapture {
  private previous?: string;
  private captured?: string;
  private busy = false;
  private successfulStatus?: {state:string;lastCapturedAt:string|null;error:string|null};
  status = {state: 'waiting', lastCapturedAt: null as string|null, error: null as string|null};
  constructor(private source: string, private destination: string, private process?: (bytes:Buffer)=>Promise<{state:string}>) {}
  async poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const before = await stat(this.source);
      if (before.size > 64 * 1024 * 1024) throw Error('SavedVariables exceeds 64 MB capture limit');
      const bytes = await readFile(this.source);
      const after = await stat(this.source);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) return;
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (hash !== this.previous) { this.previous = hash; return; }
      if (hash === this.captured) { if(this.successfulStatus)this.status=this.successfulStatus; return; }
      await mkdir(this.destination, {recursive:true});
      const file = path.join(this.destination, hash + '.lua');
      try { await writeFile(file, bytes, {flag:'wx'}); } catch(e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      }
      const capturedAt = new Date().toISOString();
      try {
        await writeFile(path.join(this.destination, hash+'.json'), JSON.stringify({hash,capturedAt,source:this.source,sourceModifiedAt:after.mtime.toISOString(),bytes:bytes.length,phase:'unclassified',market:'unverified',priceImport:this.process?'processed separately; consult capture status':'archive only'},null,2), {flag:'wx'});
      } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
      const result=this.process?await this.process(bytes):{state:'archived'};
      this.captured = hash;
      this.status = {state:result.state,lastCapturedAt:capturedAt,error:null};
      this.successfulStatus=this.status;
    } catch(e) { this.status = (e as NodeJS.ErrnoException).code==='ENOENT'
      ? {...this.status,state:'Waiting for first saved file — scan, then /reload or logout',error:null}
      : {...this.status,state:'error',error:e instanceof Error?e.message:'Capture failed'}; }
    finally { this.busy = false; }
  }
}
