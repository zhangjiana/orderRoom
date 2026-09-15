const categories = ['户外运动', '自然探索', '创意手作', '轻松游玩'];
function status(a, now = Date.now()) {
  if (a.cancelled) return '已取消';
  if (now >= a.startAt && a.members.length < a.minFamilies) return '未成行';
  if (now >= a.endAt) return '已结束';
  if (now >= a.startAt) return '进行中';
  return a.members.length >= a.minFamilies ? '已成行' : '待成行';
}
function create(input, host, now = Date.now()) {
  const a = Object.assign({}, input);
  for (const key of ['title', 'location']) {
    a[key] = String(a[key] || '').trim();
    if (!a[key] || a[key].length > 60) throw new Error('请填写 1～60 字的活动名称和公共地点');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !/^\d{2}:\d{2}$/.test(a.time)) throw new Error('请选择有效时间');
  const [y, m, day] = a.date.split('-').map(Number);
  const [h, minute] = a.time.split(':').map(Number);
  const dt = new Date(y, m - 1, day, h, minute);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day || h > 23 || minute > 59 || dt.getTime() <= now) throw new Error('请选择未来的有效时间');
  for (const key of ['minAge', 'maxAge', 'capacity', 'minFamilies']) {
    a[key] = Number(a[key]);
    if (!Number.isInteger(a[key])) throw new Error('年龄和家庭数量须为整数');
  }
  if (a.minAge < 1 || a.maxAge > 17 || a.minAge > a.maxAge) throw new Error('请检查年龄范围');
  if (a.minFamilies < 2 || a.capacity > 10 || a.capacity < a.minFamilies) throw new Error('家庭数量应为 2～10，容量不能小于成行人数');
  if (!categories.includes(a.category)) throw new Error('请选择活动类型');
  a.note = String(a.note || '').trim();
  if (a.note.length > 300) throw new Error('活动说明最多 300 字');
  return Object.assign(a, { id: `${now}-${Math.random().toString(36).slice(2, 9)}`, host, members: [host], startAt: dt.getTime(), endAt: dt.getTime() + 3600000, cancelled: false });
}
function join(a, user, age, now = Date.now()) {
  if (a.cancelled || now >= a.startAt) throw new Error('该活动已停止报名');
  if (a.members.includes(user)) throw new Error('你已经报名了');
  if (a.members.length >= a.capacity) throw new Error('活动已满员');
  if (!Number.isInteger(age) || age < a.minAge || age > a.maxAge) throw new Error('孩子年龄不在本次活动范围内');
  return Object.assign({}, a, { members: a.members.concat(user) });
}
function leave(a, user, now = Date.now()) {
  if (now >= a.startAt || a.cancelled) throw new Error('活动已开始或关闭，无法取消');
  if (!a.members.includes(user)) throw new Error('你尚未报名');
  return Object.assign({}, a, user === a.host ? { cancelled: true } : { members: a.members.filter(id => id !== user) });
}
module.exports = { categories, status, create, join, leave };
