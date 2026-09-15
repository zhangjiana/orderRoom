const test=require('node:test');const assert=require('node:assert/strict');
let data;
global.wx={getStorageSync:()=>data?structuredClone(data):null,setStorageSync:(key,value)=>{data=structuredClone(value);}};
const s=require('../utils/store');
test('资料、报名、退出在模块重载后仍保存',()=>{data=null;s.profile({nickname:'测试家长',age:6});const a=s.list()[0];s.join(a.id);delete require.cache[require.resolve('../utils/store')];const restored=require('../utils/store');assert.equal(restored.get(a.id).joined,true);assert.equal(restored.profile().nickname,'测试家长');restored.leave(a.id);assert.equal(restored.get(a.id).joined,false);});
test('存储失败不会误报成功或更改已保存状态',()=>{data=null;const before=s.list();const original=wx.setStorageSync;wx.setStorageSync=()=>{throw new Error('storage full');};assert.throws(()=>s.profile({nickname:'不会保存',age:6}),/storage full/);wx.setStorageSync=original;assert.equal(s.profile().nickname,'');assert.equal(s.list().length,before.length);});
test('再约意愿要求确实参加且已经结束',()=>{data=null;const a=s.list()[0];assert.throws(()=>s.wish(a.id),/结束/);s.profile({nickname:'测试家长',age:6});s.join(a.id);data.activities.find(x=>x.id===a.id).startAt=Date.now()-7200000;data.activities.find(x=>x.id===a.id).endAt=Date.now()-3600000;s.wish(a.id);s.wish(a.id);assert.equal(s.wishes().length,1);});
