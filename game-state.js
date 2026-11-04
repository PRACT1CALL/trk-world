'use strict';
const crypto = require('crypto');
const LOT_LIMIT = 65; // V8/V9 terrain contains 65 available residential plots.
const QUEST_XP = Object.freeze({
  joined:20,jump:25,walk:45,guide_wsuk:65,guide_ayu:65,
  visit_mall:45,visit_yasawi:45,visit_hospital:35,visit_garden:35,visit_mosque:35,
  invite:85,follow:1,story:85
});
function publicHome(h){return {nick:h.nick,lot:h.lot,uni:h.uni,xp:h.xp,done:[...h.done]};}
function cleanName(value){if(typeof value!=='string')return null;const s=value.trim().replace(/\s+/g,' ');return s.length>=2&&s.length<=25&&/^[\p{L}\p{N} _.-]+$/u.test(s)?s:null;}
function validUni(v){return ['wsuk','ayu','guest'].includes(v)?v:'guest'}
function validSkin(uni,id){const approved={wsuk:['w1','w2','w3'],ayu:['a1','a2','a3'],guest:['g1','g2','g3','g4']};return approved[uni].includes(id)?id:approved[uni][0]}
function finiteLimit(x,min,max,otherwise=0){return Number.isFinite(x)?Math.max(min,Math.min(max,x)):otherwise}
function createState(saved={}){
  const all=Array.isArray(saved.homes)?saved.homes:[];
  const usedLots=new Set(), usedNick=new Set();
  const homes=[];
  for(const h of all){
    if(!h||typeof h.owner!=='string'||!/^([0-9a-f]{64})$/.test(h.owner))continue;
    const name=cleanName(h.nick);
    if(!name||usedNick.has(name.toLocaleLowerCase('ru'))||!Number.isInteger(h.lot)||h.lot<0||h.lot>=LOT_LIMIT||usedLots.has(h.lot))continue;
    usedNick.add(name.toLocaleLowerCase('ru'));usedLots.add(h.lot);
    const done=Array.isArray(h.done)?[...new Set(h.done.filter(id=>Object.hasOwn(QUEST_XP,id)))]:[];
    homes.push({owner:h.owner,nick:name,lot:h.lot,uni:validUni(h.uni),done,xp:done.reduce((sum,id)=>sum+QUEST_XP[id],0)});
  }
  return {homes};
}
function tokenHash(token){return crypto.createHash('sha256').update(token).digest('hex')}
function joinHome(state,input){
  if(typeof input.token!=='string'||!/^[0-9a-f]{64}$/.test(input.token))return {error:'Недействительный ключ устройства',code:'invalid_token'};
  const nick=cleanName(input.nick);
  if(!nick)return {error:'Ник: от 2 до 25 букв или цифр',code:'invalid_nick'};
  const uni=validUni(input.uni),skin=validSkin(uni,input.skin),owner=tokenHash(input.token);
  const existing=state.homes.find(h=>h.nick.toLocaleLowerCase('ru')===nick.toLocaleLowerCase('ru'));
  if(existing&&existing.owner!==owner)return {error:'Этот ник уже занят. Выбери другой.',code:'nick_taken'};
  let home=existing || state.homes.find(h=>h.owner===owner);
  let created=false,renamed=false;
  if(home&&home.owner===owner&&home.nick!==nick){home.nick=nick;renamed=true}
  if(!home){const used=new Set(state.homes.map(h=>h.lot));let lot=0;while(lot<LOT_LIMIT&&used.has(lot))lot++;
    if(lot===LOT_LIMIT)return {error:'Пока нет свободных участков',code:'no_lots'};
    home={owner,nick,uni,lot,done:[],xp:0};state.homes.push(home);created=true;
  }
  return {home,created,renamed,uni,skin,owner,nick:home.nick};
}
function award(state,owner,id){
  if(typeof id!=='string'||!Object.hasOwn(QUEST_XP,id))return null;
  const home=state.homes.find(h=>h.owner===owner);
  if(!home||home.done.includes(id))return null;
  home.done.push(id);home.xp+=QUEST_XP[id];return publicHome(home);
}
module.exports={LOT_LIMIT,QUEST_XP,publicHome,createState,joinHome,award,finiteLimit,cleanName};
