# Agent Execution Prompt

占位文件。

后面你补充这个 prompt 时，建议重点约束：
- 如何基于 ABI 判断合约类型
- skill 是否匹配的判定标准
- warnings 的生成口径
- dangerousMethods 的识别边界
- methods / sections 的组织方式
- 何时允许 LLM 改写标题、描述、标签
- 何时必须回退到 deterministic output

当前最相关代码位置：
- `server/services/agent.ts`
- `server/services/analyzer.ts`
- `server/services/page-config.ts`
- `server/services/llm.ts`
