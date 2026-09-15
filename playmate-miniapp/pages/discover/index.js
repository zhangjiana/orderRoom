const store=require('../../utils/store');
const ui=require('../../utils/ui');
Page({
  data:{items:[], categories:['全部','户外运动','自然探索','创意手作','轻松游玩'], category:'全部', ageFilter:false, error:''},
  onShow(){this.refresh();},
  refresh(){ui.run(()=>{const p=store.profile(); const items=store.list().filter(a=>!['已取消','未成行','已结束','进行中'].includes(a.state)).filter(a=>this.data.category==='全部'||a.category===this.data.category).filter(a=>!this.data.ageFilter||(p.age>=a.minAge&&p.age<=a.maxAge)); this.setData({items,age:p.age});});},
  filter(e){this.setData({category:e.currentTarget.dataset.value});this.refresh();},
  toggleAge(){this.setData({ageFilter:!this.data.ageFilter});this.refresh();},
  open:ui.detail,
  publish(){wx.switchTab({url:'/pages/publish/index'});},
  profile(){wx.navigateTo({url:'/pages/profile/index'});}
});
