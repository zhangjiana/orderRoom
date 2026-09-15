# 智维云软著工作流产物

## 软件点子

软件名称：智维云 - 社区物业设备巡检与工单协同平台

定位：面向物业公司、园区运维团队、社区工程部的 Web 管理系统，用于管理公共设备、巡检计划、维修工单、人员排班和运营报表。

核心页面：

1. 驾驶舱
2. 设备台账
3. 巡检任务管理
4. 巡检计划管理
5. 空间地图
6. 工单中心
7. 数据报表
8. 人员与系统设置

## 已完成流程

1. 使用 Chrome 打开 Google Stitch。
2. 输入“智维云”中型 SaaS 后台管理系统需求。
3. Stitch 生成 8 个页面设计稿。
4. 全选设计稿并导出到 AI Studio。
5. AI Studio 成功接收 17 个附件，但构建阶段连续两次返回内部错误。
6. 回到 Stitch 选择 `.zip` 导出，下载并解压到本地。

## 本地产物

- `local-code/index.html`：本地索引页，可集中查看 8 个页面。
- `local-code/stitch_xianyubot_v2/_*/code.html`：Stitch 导出的页面代码。
- `local-code/stitch_xianyubot_v2/_*/screen.png`：Stitch 导出的页面截图。
- `stitch-export/stitch_xianyubot_v2.zip`：Stitch 原始导出压缩包。
- `design-assets/stitch-canvas.png`：Stitch 画布截图。
- `design-assets/ai-studio-error.png`：AI Studio 内部错误截图。
- `design-assets/ai-studio-page-assets/`：AI Studio 页面已加载资源打包结果。

## 说明

AI Studio 没有生成可下载应用代码，因此本地代码来自 Stitch 的 `.zip` 导出，而不是 AI Studio 生成项目。当前材料已经包含静态页面源码和对应截图，可作为软著材料整理的基础。
