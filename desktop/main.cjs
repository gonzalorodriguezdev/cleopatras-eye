const {app,BrowserWindow,Menu,Tray,nativeImage,dialog,session}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const root=fs.existsSync(path.join(__dirname,'local-config.json')) ? require('./local-config.json').project : path.resolve(__dirname,'..');
const origin='http://127.0.0.1:4312';
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.disableHardwareAcceleration();
let win,tray,quitting=false,starting=false;
app.setName('Cleopatra’s Eye');
app.setAppUserModelId('local.forever.auction.intelligence');
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(win){win.show();win.focus();}});
 app.on('before-quit',()=>{quitting=true;});
 app.on('window-all-closed',()=>{});
 app.whenReady().then(async()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  const icon=nativeImage.createFromPath(path.join(__dirname,'icon.png'));
  win=new BrowserWindow({title:'Cleopatra’s Eye',width:1320,height:880,minWidth:760,minHeight:560,backgroundColor:'#0b1018',icon,show:!process.argv.includes('--background')&&!smoke,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.removeMenu();
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  tray=new Tray(icon.resize({width:32,height:32}));
  tray.setToolTip('Cleopatra’s Eye');
  tray.setContextMenu(Menu.buildFromTemplate([
   {label:'Open Cleopatra’s Eye',click:()=>{win.show();win.focus();}},
   {label:'Retry connection',click:()=>void connect()},
   {type:'separator'},
   {label:'Quit desktop app',click:()=>app.quit()}
  ]));
  tray.on('double-click',()=>{win.show();win.focus();});
  await connect();
 }).catch(fail);
}
function fail(error){
 fs.mkdirSync(path.join(root,'logs'),{recursive:true});
 fs.appendFileSync(path.join(root,'logs','desktop-error.log'),new Date().toISOString()+' '+error.message+'\n');
 if(smoke){app.exit(1);return;}
 dialog.showErrorBox('Unable to open Cleopatra’s Eye','The app could not connect. Use Retry connection from the tray menu. Details are in the project logs folder.');
}
async function connect(){
 if(starting)return;
 starting=true;
 try{
  await win.loadFile(path.join(__dirname,'starting.html'));
  let connected=false;
  try{const result=await fetch(origin+'/api/status',{signal:AbortSignal.timeout(3000)});connected=(await result.json()).database==='connected';}catch{}
  if(!connected){
   await new Promise((resolve,reject)=>{
    const child=spawn('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-File',path.join(root,'scripts','start-background.ps1'),'-BackendOnly'],{cwd:root,windowsHide:true,stdio:'ignore'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Backend startup failed')));
   });
  }
  const response=await fetch(origin+'/api/status',{signal:AbortSignal.timeout(5000)});
  if((await response.json()).database!=='connected')throw Error('Database unavailable');
  await win.loadURL(origin);
  if(smoke){
   for(let attempt=0;attempt<40;attempt++){
    const ready=await win.webContents.executeJavaScript('!document.body.textContent.includes("Connecting to your workspace")');
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   const uiError=await win.webContents.executeJavaScript('document.querySelector("[role=alert]")?.textContent');
   if(uiError)throw Error('Workspace UI error: '+uiError);
   const pages=['Market research','Opportunities','Disenchanting','Professions','Farming','Raid watchlist','Alerts','Reports & AI','Import center','Settings','Overview'];
   for(const page of pages){
    await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent===${JSON.stringify(page)}).click()`);
    await new Promise(resolve=>setTimeout(resolve,80));
    const heading=await win.webContents.executeJavaScript('document.querySelector("h1")?.textContent');
    if(heading!==page)throw Error('Navigation failed: '+page);
   }
   const title=await win.webContents.executeJavaScript('document.querySelector("h1")?.textContent');
   if(title!=='Overview')throw Error('Dashboard did not render');
   win.show();
   await new Promise(resolve=>setTimeout(resolve,700));
   const image=await win.webContents.capturePage();
   fs.mkdirSync(path.join(root,'logs'),{recursive:true});
   fs.writeFileSync(path.join(root,'logs','desktop-preview.png'),image.toPNG());
   fs.writeFileSync(path.join(root,'logs','desktop-smoke.json'),JSON.stringify({dashboard:title,pagesChecked:pages,database:'connected',sandbox:true,nodeIntegration:false}));
   win.close();if(win.isDestroyed())throw Error('Close should hide to tray');
   win.show();win.hide();app.quit();
  }
 }catch(error){fail(error);}finally{starting=false;}
}
