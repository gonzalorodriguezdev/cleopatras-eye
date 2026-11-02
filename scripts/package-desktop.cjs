const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'.desktop');
fs.mkdirSync(runtime,{recursive:true});
fs.cpSync(path.join(root,'node_modules/electron/dist'),runtime,{recursive:true});
fs.copyFileSync(path.join(runtime,'electron.exe'),path.join(runtime,'ForeverAuctionIntelligence.exe'));
const target=path.join(runtime,'resources/app');fs.mkdirSync(target,{recursive:true});
for(const file of ['main.cjs','starting.html','icon.png'])fs.copyFileSync(path.join(root,'desktop',file),path.join(target,file));
fs.writeFileSync(path.join(target,'package.json'),JSON.stringify({name:'forever-auction-intelligence',version:'0.2.0',main:'main.cjs'}));
fs.writeFileSync(path.join(target,'local-config.json'),JSON.stringify({project:root}));
console.log('Local desktop executable ready: '+path.join(runtime,'ForeverAuctionIntelligence.exe'));

