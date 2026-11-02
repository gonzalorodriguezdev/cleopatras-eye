import React from 'react';
import type {Kind} from '../shared/contracts';
type ObjectValue=Record<string,unknown>;
const material=()=>({itemId:1,name:'',quantity:1});
export function blank(kind:Kind):ObjectValue{
 const at=new Date().toISOString();
 switch(kind){
 case 'trade':return {type:'buy',itemId:1,name:'',quantity:1,unitCopper:0,feesCopper:0,strategy:'flipping',at,note:''};
 case 'watch':return {itemId:1,name:'',entryCopper:0,targetCopper:0,budgetCopper:0,quantity:1,exitDate:'',thesis:'',risks:'',bearCopper:0,baseCopper:0,bullCopper:0};
 case 'recipe':return {name:'',profession:'Alchemy',output:material(),inputs:[material()],extraCostCopper:0,verified:false,evidence:'',note:''};
 case 'deRule':return {itemId:1,name:'',requiredSkill:0,verified:false,evidence:'',outcomes:[{probability:1,materials:[material()]}],note:''};
 case 'deResult':return {itemId:1,name:'',quantity:1,materials:[material()],at,note:''};
 case 'gathering':return {name:'',minutes:60,costCopper:0,materials:[material()],at,note:''};
 case 'event':return {name:'',at,note:'',evidence:''};
 case 'alert':return {itemId:1,name:'',direction:'below',thresholdCopper:0,enabled:true};
 }
}
const choices:Record<string,string[]>={type:['buy','sell','deposit-loss','cash-in','cash-out'],strategy:['flipping','stockpile','disenchanting','other'],direction:['below','above']};
const labels:Record<string,string>={at:'Date and time',unitCopper:'Unit price (copper)',feesCopper:'Actual fees / lost deposits (copper)',feeRate:'Auction cut (fraction: 0.05 = 5%)',openingCopper:'Opening gold balance (copper)',verified:'Verified specifically for Forever',feesVerified:'Auction cut verified for Forever',minRoi:'Minimum ROI (fraction: 0.20 = 20%)',exposureCopper:'Maximum investment per item (copper)',maxAgeHours:'Maximum price age (hours)',minScans:'Minimum prior scans',probability:'Outcome probability (0–1)',itemId:'Forever item ID',feeEvidence:'Source for auction fee',quantity:'Quantity'};
function label(key:string){return labels[key]??key.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()).replace('Copper','(copper)');}
export function Fields({value,onChange}:{value:ObjectValue;onChange:(v:ObjectValue)=>void}){
 return <div className="fields">{Object.entries(value).map(([key,v])=>{
 const set=(next:unknown)=>onChange({...value,[key]:next});
 if(Array.isArray(v))return <fieldset key={key}><legend>{label(key)}</legend>{v.map((row,i)=><div className="nested" key={i}><Fields value={row as ObjectValue} onChange={next=>set(v.map((x,j)=>i===j?next:x))}/><button type="button" onClick={()=>set(v.filter((_,j)=>i!==j))}>Remove row</button></div>)}<button type="button" onClick={()=>set([...v,key==='outcomes'?{probability:0.5,materials:[material()]}:material()])}>Add {key==='outcomes'?'outcome':'material'}</button></fieldset>;
 if(v!==null&&typeof v==='object')return <fieldset key={key}><legend>{label(key)}</legend><Fields value={v as ObjectValue} onChange={set}/></fieldset>;
 if(typeof v==='boolean')return <label className="check" key={key}><input type="checkbox" checked={v} onChange={e=>set(e.target.checked)}/>{label(key)}</label>;
 if(key==='at')return <label key={key}>{label(key)}<input type="datetime-local" value={typeof v==='string'?new Date(Date.parse(v)-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):''} onChange={e=>{if(e.target.value)set(new Date(e.target.value).toISOString());}}/></label>;
 if(choices[key])return <label key={key}>{label(key)}<select value={String(v)} onChange={e=>set(e.target.value)}>{choices[key].map(c=><option key={c}>{c}</option>)}</select></label>;
 if(['note','thesis','risks','evidence','feeEvidence'].includes(key))return <label className="wide" key={key}>{label(key)}<textarea value={String(v)} onChange={e=>set(e.target.value)}/></label>;
 return <label key={key}>{label(key)}<input type={typeof v==='number'?'number':'text'} step={['feeRate','minRoi','probability','maxAgeHours','minutes'].includes(key)?'any':'1'} value={String(v)} onChange={e=>set(typeof v==='number'?Number(e.target.value):e.target.value)}/></label>;
 })}</div>;
}
