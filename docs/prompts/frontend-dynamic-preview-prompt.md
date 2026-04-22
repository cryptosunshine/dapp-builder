# 前端动态预览提示词

请实现 dapp-builder 的前端 MVP。

目标：
提供一个输入页和一个预览页。

页面 1：创建任务页
功能：
- 表单输入：
  - contractAddress
  - chain（默认 Conflux eSpace Testnet）
  - skill
  - model
  - apiKey
- 点击提交后调用：
  POST /api/tasks
- 跳转到任务详情页

页面 2：任务详情 / 预览页
路由：
- /tasks/:taskId
- /app/:taskId

功能：
1. 轮询任务状态：
   GET /api/tasks/:taskId

2. 显示任务阶段：
   - pending
   - running
   - success
   - failed

3. 成功后读取 pageConfig，并动态渲染：
   - 页面标题
   - 风险提示
   - 只读方法区
   - 写方法区
   - 调用结果展示区

4. 页面必须包含：
   - 钱包连接
   - 网络检查（chainId=71）
   - 合约方法交互表单
   - loading / error / success 状态

技术要求：
- React
- 组件化设计
- 先做最简版 UI，不追求美化
- 方法渲染以 pageConfig 为准，不要写死业务逻辑

请优先输出：
- 页面结构
- 组件结构
- pageConfig 对应的渲染规则
- 表单与方法调用方式
