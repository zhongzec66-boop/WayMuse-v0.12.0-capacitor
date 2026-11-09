# WayMuse v0.12.0 源码

这是当前演示版的完整项目源码，包含聊天、方案卡片、计划、Today、记忆、角色和设置，以及健康/日历/学习资料的连接演示。

## 本地运行

需要 Node.js 22.12 或更新版本及 npm。解压后在本目录运行：

```bash
npm ci
npm run dev -- --host 0.0.0.0
```

手机和电脑连接同一局域网，用终端显示的局域网地址访问。HTTPS 下才可使用需要安全上下文的浏览器能力，如麦克风。

## 构建并部署到你的服务器

```bash
npm run build
```

将 dist 目录中的全部文件上传到服务器静态网站目录，并配置 HTTPS。网站没有服务端数据库；测试数据保存在当前浏览器，不会自动跨设备或跨域名迁移。

## 体验路径

未配置模型时会使用明确标注的本地示例回复。点击“明天考试……”体验短段回复 → 选择方案 → 加入计划 → 查看或撤回。左上角设置可修改名字、头像、陪伴风格和模型配置。

## 真实模型与能力边界

在设置中填写你自己的 Base URL、模型和 API Key，再保存。当前模型请求由浏览器直接发起，服务商需允许相应跨域请求；本项目不附带 API Key。正式多人测试建议先部署后端模型代理和账号隔离，不能把共享密钥写入前端。

iOS 健康、系统日历、提醒事项、快捷指令及外部学习 App 尚未真正接通，仅有清晰标注的预览和模拟资料导入。语音不是原生按住说话体验。真实模型方案生成及 iPhone Safari 全流程仍需实测。

## 文件说明

- src：React + TypeScript 页面、Agent 方案协议及本地存储
- public：静态资源
- docs/reports/companion-agent-demo.md：本轮功能及部署说明
- README-original.md：原项目历史说明，部分版本描述可能过期
- LICENSE / NOTICE / THIRD_PARTY_NOTICES.md：许可与第三方声明

源码版本：117f33e8e128e37b5571e46eafb9ab56907e1c46
本压缩包不含 node_modules、Git 历史、平台托管配置或运行密钥。安装依赖后即可构建。


## License

MIT — see [LICENSE](LICENSE).

本项目不包含 OpenMinis、nanoMuse 或其他 GPL 项目的代码。历史上的 GPL 声明来自项目模板，
已于 2026-11 核实并替换，第三方组件见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

### 关于未来换许可证

作者保留在后续版本改用其他许可证（例如商业化时改为 Apache-2.0）的权利。
已经发布的 MIT 版本不可撤回；贡献者条款见 [CONTRIBUTING.md](CONTRIBUTING.md)。
