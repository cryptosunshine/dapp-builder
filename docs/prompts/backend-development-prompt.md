# 后端开发提示词

请实现 dapp-builder 的后端 MVP。

目标：
提供任务接口，接收前端输入，调用 agent，保存结果，并返回任务状态和 pageConfig。

功能要求：
1. 提供创建任务接口：
   POST /api/tasks

   请求体：
   {
     "contractAddress": "",
     "chainId": 71,
     "skill": "",
     "model": "",
     "apiKey": ""
   }

   返回：
   {
     "taskId": "",
     "status": "pending"
   }

2. 提供查询任务接口：
   GET /api/tasks/:taskId

   返回：
   {
     "taskId": "",
     "status": "pending|running|success|failed",
     "progress": "",
     "summary": "",
     "pageConfig": {},
     "error": ""
   }

3. 创建任务后，后端应异步执行：
   - 获取 ABI
   - 调用 agent 分析合约
   - 生成 pageConfig
   - 存储结果

4. 任务状态至少包括：
   - pending
   - running
   - success
   - failed

5. 任务执行阶段建议包含：
   - fetching_abi
   - analyzing_contract
   - generating_page_config
   - completed

6. 代码要求：
   - 结构清晰
   - 便于后续接 Redis / DB
   - 先用最简单可运行方式实现
   - API key 只用于本次任务，不长期保存
   - 错误处理必须明确

请优先输出：
- 项目目录结构
- API 路由
- task service
- agent service
- ABI fetch service
- 数据结构定义
