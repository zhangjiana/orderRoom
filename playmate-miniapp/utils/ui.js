function run(action) { try { return action(); } catch(error) { wx.showModal({title:'暂时未能完成',content:error.message || '本地存储不可用，请稍后重试',showCancel:false}); return null; } }
function detail(e) { wx.navigateTo({url:`/pages/detail/index?id=${e.currentTarget.dataset.id}`}); }
module.exports={run,detail};
