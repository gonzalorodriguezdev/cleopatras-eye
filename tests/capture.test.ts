import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SavedVariablesCapture} from '../server/capture';
it('archives stable binary bytes without execution and deduplicates repeated polls',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'fai-capture-'));
 try {
  const source=path.join(dir,'source.lua'),dest=path.join(dir,'archive');
  const bytes=Buffer.from([65,0,255,34,10]);await writeFile(source,bytes);
  const capture=new SavedVariablesCapture(source,dest);
  await capture.poll();expect(capture.status.lastCapturedAt).toBeNull();
  await capture.poll();await capture.poll();
  const files=await readdir(dest);expect(files.length).toBe(2);
  expect(await readFile(path.join(dest,files.find(f=>f.endsWith('.lua'))!))).toEqual(bytes);
  await writeFile(source,'changed');await capture.poll();await capture.poll();
  expect((await readdir(dest)).length).toBe(4);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
