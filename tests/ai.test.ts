import {it,expect,vi} from 'vitest';
import {analyzeReport} from '../server/ai';
it('sends only the supplied report with bounded output and storage disabled',async()=>{
 const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Insufficient evidence'}]}]})));
 const result=await analyzeReport('test-key','test-model','Question',{source:'fixture'},mock);
 const [url,options]=mock.mock.calls[0];expect(url).toBe('https://api.openai.com/v1/responses');expect(JSON.parse(options.body).store).toBe(false);expect(JSON.parse(options.body).max_output_tokens).toBe(2000);expect(result.text).toBe('Insufficient evidence');
});
it('redacts upstream error content',async()=>{const mock=vi.fn().mockResolvedValue(new Response('secret echoed by upstream',{status:401}));await expect(analyzeReport('secret','test','q',{},mock)).rejects.toThrow('HTTP 401');});
