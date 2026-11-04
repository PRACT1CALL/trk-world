const test=require('node:test');
const assert=require('node:assert/strict');
const {createState,joinHome,award,publicHome}=require('../game-state');
const T1='a'.repeat(64),T2='b'.repeat(64);
test('two unique players get different house plots',()=>{
 const state=createState();const a=joinHome(state,{token:T1,nick:'Player1',uni:'wsuk',skin:'w1'});
 const b=joinHome(state,{token:T2,nick:'Игрок2',uni:'ayu',skin:'a1'});
 assert.equal(a.error,undefined);assert.equal(b.error,undefined);
 assert.notEqual(a.home.lot,b.home.lot);assert.equal(state.homes.length,2);
});
test('same owner can rejoin and a different device cannot claim a used nick',()=>{
 const state=createState();const a=joinHome(state,{token:T1,nick:'Ахмад',uni:'wsuk',skin:'w2'});
 assert.equal(joinHome(state,{token:T1,nick:'Ахмад',uni:'wsuk',skin:'w2'}).home.lot,a.home.lot);
 assert.equal(joinHome(state,{token:T2,nick:'Ахмад',uni:'wsuk',skin:'w2'}).code,'nick_taken');
});
test('quests award once and are retained in state',()=>{
 const state=createState();const a=joinHome(state,{token:T1,nick:'Player1',uni:'wsuk',skin:'w1'});
 assert.equal(award(state,a.owner,'joined').xp,20);
 assert.equal(award(state,a.owner,'joined'),null);
 assert.equal(award(state,a.owner,'jump').xp,45);
 assert.equal(createState({homes:state.homes}).homes[0].xp,45);
 assert.ok(!('owner' in publicHome(state.homes[0])));
});
test('validate nick, token and skin',()=>{
 const state=createState();assert.equal(joinHome(state,{token:'q',nick:'Player1'}).code,'invalid_token');
 assert.equal(joinHome(state,{token:T1,nick:'<script>'}).code,'invalid_nick');
 assert.equal(joinHome(state,{token:T1,nick:'Player2',uni:'wsuk',skin:'fake'}).skin,'w1');
});


test('follow reward is exactly +1 XP and can only be claimed once', () => {
  const {createState,joinHome,award,QUEST_XP} = require('../game-state');
  const state=createState();
  const joined=joinHome(state,{token:'c'.repeat(64),nick:'Subscriber',uni:'guest',skin:'g1'});
  assert.equal(QUEST_XP.follow,1);
  const home=award(state,joined.owner,'follow');
  assert.equal(home.xp,1);
  assert.equal(award(state,joined.owner,'follow'),null);
  assert.equal(state.homes[0].xp,1);
});
