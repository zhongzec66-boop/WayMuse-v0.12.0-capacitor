# 贡献指南

## 提交 PR 即表示你同意

1. 你的贡献以 **MIT** 许可证授权给本项目；
2. 你授予维护者一项**再许可权**：可以在未来的版本中把项目整体改为其他许可证
   （例如商业化时改用 Apache-2.0）并再发布。

这样做的原因：如果项目以后要换许可证，需要所有版权持有者同意；提前写清楚比事后追溯所有贡献者容易得多。

## 已经发布的版本不会变

MIT 是不可撤回的：**已经以 MIT 发布的版本永远是 MIT**。换许可证只影响之后的版本。

## 代码风格

- TypeScript strict，`npm run typecheck && npm run lint && npm run format:check` 必须全绿
- 不新增 `!important`，颜色/字号/圆角只用 `src/styles/tokens.css` 里的 token
- 用户可见文案用中文，不要出现「小助手」「智能体」这类词
- 不编造数据：拿不到的信息就说没有

## 提交前

```bash
npm run typecheck
npm run lint
npm run build
```

涉及 iOS/Android 原生改动时，说明改了哪些文件、为什么必须改原生。
