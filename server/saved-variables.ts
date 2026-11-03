// A bounded data-only reader. No Lua runtime, eval, function calls or global access.
export type Value=number|boolean|null|Buffer|Map<string,Value>;
export function savedVariables(bytes:Buffer):Map<string,Value>{
 if(bytes.length>64*1024*1024)throw Error('SavedVariables exceeds 64 MB');
 const text=bytes.toString('latin1');let i=0,nodes=0;
 const fail=()=>{throw Error(`Unsupported or incomplete SavedVariables near byte ${i}`);};
 function space(){while(i<text.length){if(/\s/.test(text[i])){i++;continue;}if(text.slice(i,i+2)==='--'){while(i<text.length&&text[i]!=='\n')i++;continue;}break;}}
 function identifier(){const match=/^[A-Za-z_][A-Za-z_0-9]*/.exec(text.slice(i));if(!match)return fail();i+=match[0].length;return match[0];}
 function expect(c:string){space();if(text[i++]!==c)fail();}
 function value(depth=0):Value{
  if(depth>32||++nodes>2000000)throw Error('SavedVariables complexity limit');space();const c=text[i++];
  if(c==='"'||c==="'"){const out:number[]=[];let closed=false;while(i<text.length){let code=text.charCodeAt(i++);if(code===c.charCodeAt(0)){closed=true;break;}if(code===92){const esc=text[i++];if(/[0-9]/.test(esc)){let digits=esc;while(digits.length<3&&/[0-9]/.test(text[i]??''))digits+=text[i++];code=Number(digits);if(code>255)fail();}else{const escapes:Record<string,number>={n:10,r:13,t:9,a:7,b:8,f:12,v:11,'\\':92,'"':34,"'":39,'\n':10};if(!(esc in escapes))fail();code=escapes[esc];}}out.push(code);}if(!closed)fail();return Buffer.from(out);}
  if(c==='{'){const result=new Map<string,Value>();let index=1;while(true){space();if(text[i]==='}'){i++;return result;}let key:string,v:Value;if(text[i]==='['){i++;const k=value(depth+1);if(typeof k!=='number'&&!Buffer.isBuffer(k))fail();key=Buffer.isBuffer(k)?k.toString('utf8'):String(k);expect(']');expect('=');v=value(depth+1);}else if(/^[A-Za-z_][A-Za-z_0-9]*\s*=/.test(text.slice(i))){key=identifier();expect('=');v=value(depth+1);}else{key=String(index++);v=value(depth+1);}if(result.has(key))throw Error('Duplicate SavedVariables key');result.set(key,v);space();if(text[i]===','||text[i]===';'){i++;continue;}if(text[i]!=='}')fail();}}
  i--;const numeric=/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));if(numeric){i+=numeric[0].length;const n=Number(numeric[0]);if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)fail();return n;}
  const word=identifier();if(word==='true')return true;if(word==='false')return false;if(word==='nil')return null;return fail();
 }
 const globals=new Map<string,Value>();while(true){space();if(i>=text.length)return globals;const key=identifier();expect('=');if(globals.has(key))fail();globals.set(key,value());space();if(text[i]===';')i++;}
}
export function cbor(bytes:Buffer):Value{
 let i=0,nodes=0;
 function take(n:number){if(n<0||n>bytes.length-i)throw Error('Truncated CBOR');const b=bytes.subarray(i,i+n);i+=n;return b;}
 function length(ai:number){if(ai<24)return ai;if(ai===24)return take(1).readUInt8();if(ai===25)return take(2).readUInt16BE();if(ai===26)return take(4).readUInt32BE();if(ai===27){const n=Number(take(8).readBigUInt64BE());if(!Number.isSafeInteger(n))throw Error('Unsafe CBOR integer');return n;}throw Error('Unsupported CBOR length');}
 function read(depth=0):Value{
  if(depth>32||++nodes>2000000)throw Error('CBOR complexity limit');const head=take(1)[0],type=head>>5,ai=head&31;
  if(type===7){if(ai===20)return false;if(ai===21)return true;if(ai===22)return null;if(ai===26||ai===27){const n=ai===26?take(4).readFloatBE():take(8).readDoubleBE();if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)throw Error('Invalid CBOR number');return n;}throw Error('Unsupported CBOR simple value');}
  if(type===0)return length(ai);if(type===1)return -1-length(ai);
  if(type===2||type===3){if(ai!==31)return Buffer.from(take(length(ai)));const parts:Buffer[]=[];while(bytes[i]!==255){const chunk=read(depth+1);if(!Buffer.isBuffer(chunk))throw Error('Invalid CBOR string chunk');parts.push(chunk);}take(1);return Buffer.concat(parts);}
  if(type===4||type===5){const size=ai===31?null:length(ai);if(size!==null&&size>1000000)throw Error('CBOR collection limit');const map=new Map<string,Value>();let count=0;while(size===null?bytes[i]!==255:count<size){const key=type===4?++count:read(depth+1);if(type===5)count++;if(typeof key!=='number'&&!Buffer.isBuffer(key))throw Error('Invalid CBOR map key');const text=Buffer.isBuffer(key)?key.toString('utf8'):String(key);if(map.has(text))throw Error('Duplicate CBOR key');map.set(text,read(depth+1));}if(size===null)take(1);return map;}
  throw Error('Unsupported CBOR type');
 }
 const result=read();if(i!==bytes.length)throw Error('Trailing CBOR bytes');return result;
}
export function table(value:Value|undefined):Map<string,Value>{if(!(value instanceof Map))throw Error('Expected saved table');return value;}
export function string(value:Value|undefined){if(!Buffer.isBuffer(value))throw Error('Expected saved string');return value.toString('utf8');}
