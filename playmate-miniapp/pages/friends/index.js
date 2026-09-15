const s=require('../../utils/store'); const ui=require('../../utils/ui');
Page({data:{items:[]},onShow(){ui.run(()=>this.setData({items:s.list().filter(a=>s.wishes().includes(a.id))}));},again(e){getApp().publishDraft=s.get(e.currentTarget.dataset.id);wx.switchTab({url:'/pages/publish/index'});},discover(){wx.switchTab({url:'/pages/discover/index'});}});
