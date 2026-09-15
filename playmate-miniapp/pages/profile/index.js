const s=require('../../utils/store');const ui=require('../../utils/ui');
Page({data:{nickname:'',age:6},onLoad(){ui.run(()=>this.setData(s.profile()));},field(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value});},save(){ui.run(()=>{s.profile({nickname:this.data.nickname,age:Number(this.data.age)});wx.showToast({title:'已保存'});});}});
