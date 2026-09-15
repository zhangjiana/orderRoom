const d = require('./domain');
const KEY = 'playmate-local-v1';
const ME = 'local-parent';
const dateText = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
function seed() {
  const weekend = new Date(); weekend.setDate(weekend.getDate() + ((6 - weekend.getDay() + 7) % 7 || 7));
  const titles = ['一起滑进快乐周末', '去公园，收集秋天', '小小画家户外写生'];
  const activities = titles.map((title, i) => {
    const a = d.create({title, location:['社区公园 · 活动广场','社区公园 · 林荫入口','社区公园 · 公共草坪'][i], date:dateText(weekend), time:['16:00','10:00','15:00'][i], minAge:4+i, maxAge:8, minFamilies:2, capacity:4, category:d.categories[i], note:['带上滑板车和头盔，一起慢慢骑。家长全程陪同，遇雨取消。','找一片喜欢的落叶，认识身边的树。请自带饮水，家长陪同。','自带纸笔，把看到的秋天画下来。材料自行准备。'][i]}, `demo-${i}`);
    a.demo = true;
    if (i === 0) a.members.push('demo-friend');
    return a;
  });
  return { activities, profile: { nickname:'', age:6 }, wishes:[] };
}
function read() { const data = wx.getStorageSync(KEY); if (data) return data; const initial = seed(); save(initial); return initial; }
function save(data) { wx.setStorageSync(KEY, data); }
function decorate(a) { return Object.assign({}, a, { state:d.status(a), count:a.members.length, remaining:a.capacity-a.members.length, joined:a.members.includes(ME), owned:a.host===ME, symbol:({'户外运动':'🛴','自然探索':'🌿','创意手作':'🎨','轻松游玩':'🪁'})[a.category], canJoin:!a.cancelled && Date.now()<a.startAt && a.members.length<a.capacity && !a.members.includes(ME), canLeave:!a.cancelled && Date.now()<a.startAt && a.members.includes(ME) }); }
function list() { return read().activities.map(decorate).sort((a,b)=>a.startAt-b.startAt); }
function get(id) { return list().find(a=>a.id===id); }
function update(id, action) { const data=read(); const index=data.activities.findIndex(a=>a.id===id); if(index<0) throw new Error('未找到活动'); data.activities[index]=action(data.activities[index]); save(data); }
function join(id) { const data=read(); if(!data.profile.nickname) throw new Error('请先在家庭资料中填写家长昵称'); update(id,a=>d.join(a,ME,data.profile.age)); }
function leave(id) { update(id,a=>d.leave(a,ME)); }
function publish(input) { const data=read(); const a=d.create(input,ME); if(data.profile.age<a.minAge || data.profile.age>a.maxAge) throw new Error('请将自己孩子的年龄包含在活动范围内'); data.activities.unshift(a); save(data); return a.id; }
function profile(value) { const data=read(); if(value) { const nickname=String(value.nickname||'').trim(); const age=Number(value.age); if(!nickname || nickname.length>20 || !Number.isInteger(age) || age<1 || age>17) throw new Error('请填写家长昵称和 1～17 岁的孩子年龄'); data.profile={nickname,age}; save(data); } return data.profile; }
function wish(id) { const data=read(); const a=data.activities.find(a=>a.id===id); if(!a || !a.members.includes(ME) || d.status(a)!=='已结束') throw new Error('参加过的活动结束后才能登记再约意愿'); if(!data.wishes.includes(id)) data.wishes.push(id); save(data); }
module.exports={ME,dateText,list,get,join,leave,publish,profile,wish,wishes:()=>read().wishes};
