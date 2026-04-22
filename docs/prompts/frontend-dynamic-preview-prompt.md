# Frontend Dynamic Preview Prompt

占位文件。

后面你补充这个 prompt 时，建议重点约束：
- pageConfig 到 UI 的映射规则
- section 布局规则
- 方法表单渲染规则
- 钱包连接与网络校验规则
- 读方法 / 写方法交互流程
- 结果展示、错误提示、风险提示样式口径
- 危险方法的默认展示策略

当前最相关代码位置：
- `src/components/PreviewPage.tsx`
- `src/components/MethodCard.tsx`
- `src/components/WalletBar.tsx`
- `src/lib/contract.ts`
- `src/lib/wallet.ts`
