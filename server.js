'use strict';
// One Node process serves both TRK World and its live multiplayer room.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const {WebSocketServer} = require('ws');
const {createState,joinHome,award,publicHome,finiteLimit} = require('./game-state');
const PORT=Number(process.env.PORT)||3000;
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const STATE_FILE=path.join(DATA_DIR,'state.json');
const MAX_PLAYERS=40;
fs.mkdirSync(DATA_DIR,{recursive:true});
let initial={};try{initial=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'))}catch(_){}
const state=createState(initial);
let saveTimer=null;
function writeState(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null}const temp=STATE_FILE+'.tmp';fs.writeFileSync(temp,JSON.stringify({homes:state.homes},null,2));fs.renameSync(temp,STATE_FILE)}
function scheduleSave(){if(saveTimer)return;saveTimer=setTimeout(()=>{try{writeState()}catch(err){console.error('Failed to save state',err)}},250)}
const server=http.createServer((req,res)=>{
 if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:true,online:users.size,homes:state.homes.length}))}
 if(!['/','/index.html'].includes(req.url)){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found')}
 const stream=fs.createReadStream(path.join(__dirname,'public','index.html'));
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 stream.on('error',()=>res.destroy());stream.pipe(res);
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
const users=new Map();
const publicPlayer=p=>({id:p.id,nick:p.nick,uni:p.uni,skin:p.skin,x:p.x,y:p.y,z:p.z,yaw:p.yaw,moving:p.moving});
function send(ws,data){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))}
function broadcast(msg,except=null){for(const p of users.values())if(p.ws!==except)send(p.ws,msg)}
function disconnect(ws){if(!ws.player)return;const p=ws.player;if(users.get(p.id)===p){users.delete(p.id);broadcast({type:'left',id:p.id})}ws.player=null}
function replyError(ws,code,message){send(ws,{type:'error',code,message})}
server.on('upgrade',(req,socket,head)=>{
 if(req.url!=='/ws'){socket.destroy();return}
 if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host){socket.destroy();return}}catch(_){socket.destroy();return}}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
 ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{
  let data;try{data=JSON.parse(raw.toString('utf8'))}catch(_){return replyError(ws,'bad_json','Неправильный формат сообщения')}
  if(!data||typeof data!=='object')return;
  if(data.type==='join'){
   if(ws.player)return;
   if(users.size>=MAX_PLAYERS)return replyError(ws,'full','В городе сейчас слишком много игроков');
   const result=joinHome(state,data);
   if(result.error)return replyError(ws,result.code,result.error);
   // The server accepts only positions inside the virtual Turkistan scene.
   const p={id:crypto.randomUUID(),ws,owner:result.owner,nick:result.nick,uni:result.uni,skin:result.skin,
    x:finiteLimit(data.x,-515,475),y:0,z:finiteLimit(data.z,-365,340),yaw:finiteLimit(data.yaw,-1000,1000),moving:false,lastMove:0};
   for(const old of users.values())if(old.owner===p.owner){old.ws.close(4000,'Logged in elsewhere');disconnect(old.ws)}
   const others=[...users.values()].map(publicPlayer);
   users.set(p.id,p);ws.player=p;
   send(ws,{type:'welcome',id:p.id,players:others,homes:state.homes.map(publicHome)});
   broadcast({type:'joined',player:publicPlayer(p)},ws);
   if(result.created||result.renamed){scheduleSave();broadcast({type:'home',home:publicHome(result.home)},ws)}
   return;
  }
  const p=ws.player;if(!p)return;
  if(data.type==='move'){
   const now=Date.now();if(now-p.lastMove<70)return;p.lastMove=now;
   p.x=finiteLimit(data.x,-512,472,p.x);p.z=finiteLimit(data.z,-362,337,p.z);p.y=finiteLimit(data.y,0,15,p.y);p.yaw=finiteLimit(data.yaw,-10000,10000,p.yaw);p.moving=!!data.moving;
   broadcast({type:'move',id:p.id,x:p.x,z:p.z,y:p.y,yaw:p.yaw,moving:p.moving},ws);
   return;
  }
  if(data.type==='quest'){
   const home=award(state,p.owner,data.id);if(home){scheduleSave();broadcast({type:'home',home});}return;
  }
 });
 ws.on('close',()=>disconnect(ws));ws.on('error',()=>disconnect(ws));
});
const ping=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
server.listen(PORT,'0.0.0.0',()=>console.log(`TRK World ONLINE running on port ${PORT}`));
function shutdown(){clearInterval(ping);try{writeState()}catch(e){console.error(e)}server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
