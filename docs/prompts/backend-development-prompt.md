# Backend Development Prompt

占位文件。

后面你补充这个 prompt 时，建议重点约束：
- 任务创建与状态流转
- ABI 获取策略
- 失败重试 / 错误返回
- pageConfig 输出结构稳定性
- warnings / dangerousMethods 的生成规范
- 可维护性和扩展性要求

当前最相关代码位置：
- `server/routes/tasks.ts`
- `server/services/abi.ts`
- `server/services/analyzer.ts`
- `server/services/page-config.ts`
- `server/services/task-store.ts`
