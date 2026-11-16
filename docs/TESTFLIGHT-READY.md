# TestFlight 内测准备清单

> 背景：朋友（个人开发者账号）愿意用他的账号签名上架，先走 TestFlight 内测，收益与归属后续再拟协议。
> 本文只列**要做的事**与**谁做**，不含需要对方账号的敏感操作。

---

## 一、已经在仓库里改好的（本次）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| iOS 版本号对齐 | ✅ | 之前 iOS 是 `1.0 (1)`、Android 是 `0.28.2 (158)`；现已同步为 `0.28.2 (158)` |
| 版本单一来源脚本 | ✅ | `scripts/sync-version.cjs`：`package.json` + `versionCode` → iOS 工程；`--check` 可进 CI 防止再次漂移 |
| 导出合规 | ✅ | `Info.plist` 加 `ITSAppUsesNonExemptEncryption = false`（只用 HTTPS，属豁免） |
| Bundle ID | ✅ 保持不变 | `app.waymuse.student`，换团队不需要改，但**已装用户必须卸载重装** |
| 隐私用途描述 | ✅ 已有 | 麦克风、语音识别、日历、提醒均在 `Info.plist` |

---

## 二、必须在对方 Mac 上做的（有账号才做得了）

1. **Xcode 打开工程**：`ios/App/App.xcworkspace`
2. **Signing & Capabilities**：Team 选他的个人团队；Bundle Identifier 保持 `app.waymuse.student`；勾 Automatically manage signing
3. **Archive**：目标设备选 `Any iOS Device` → Product → Archive
4. **Distribute App** → App Store Connect → Upload
5. **App Store Connect 建 App 记录**：名称 WayMuse、主语言简体中文、Bundle ID 选上面那个、SKU 任意
6. **TestFlight**：建内部测试组，加测试员（对方账号可加到 100 人；外部测试需审核）

---

## 三、首次上传前必须补的产品项（否则审核会被拒）

| # | 问题 | 现状 | 处理 |
| --- | --- | --- | --- |
| 1 | **账号注销** | 有邮箱登录，但**没有注销入口**；`PrivacyPage.tsx:82` 还写着"还没有创建账户"（过时） | 苹果 5.1.1(v) 强制要求：App 内可删除账号。需服务端 `DELETE /api/me` + 设置页入口 + 隐私页文案更正 |
| 2 | 隐私政策 URL | 只有 App 内页面，没有公网 URL | App Store Connect 必填，需部署一个静态页（可用现有服务器） |
| 3 | 支持 URL | 同上 | 可先用邮箱页或 GitHub README |
| 4 | 审核备注 | 无 | 写清"游客可直接体验；邮箱登录需验证码；模型由服务端提供" |
| 5 | 演示账号 | 无 | 审核员需要能进：提供一个固定验证码或演示邮箱（服务端加白名单） |
| 6 | 中国区上架 | 未备案 | TestFlight 内测不要求；正式上架中国区需 App 备案，走之前要定 |

---

## 四、版本与 build 号规则（TestFlight 硬要求）

```
MARKETING_VERSION    = package.json.version（如 0.28.2）
CURRENT_PROJECT_VERSION = android versionCode（如 158）
```

- **每次上传 build 号必须比上一次大**，否则 App Store Connect 直接拒收
- 发版流程：改 `package.json` → 改 `build.gradle` 的 `versionCode`/`versionName` → 跑 `node scripts/sync-version.cjs` → 出包
- 已加 `--check`：CI 里可加一步 `node scripts/sync-version.cjs --check`，防止版本漂移再次发生

---

## 五、CI 现状与后续

现在 CI 产出的是 **unsigned IPA**，只能自签安装，不能上传 TestFlight。

上传需要签名，两条路：

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| A. 对方 Mac 手动 Archive（推荐先走这条） | 上面第二节，5 分钟一次 | 需要对方配合，每次发版都要他操作 |
| B. CI 自动签名上传 | 需要：分发证书 `.p12` + 描述文件 + App Store Connect API Key，放进 GitHub Secrets | 证书管理复杂，个人账号建议 A 稳定后再做 |

---

## 六、回归验证（上传前自检）

- [ ] 版本号显示 0.28.2，build 158
- [ ] 冷启动不闪退（真机，非模拟器）
- [ ] 无需登录即可聊天（游客）
- [ ] 邮箱登录能收到验证码
- [ ] 课表截图导入可用
- [ ] 语音朗读可出声；**ASR 仍待真机日志**，若不可用需在审核备注里说明"语音输入为试用"
- [ ] 断网时有可读错误，不白屏
- [ ] 备份导出 / 恢复可用（换签名重装前必须能用）

---

## 七、需要对方提供的信息

1. Team ID（10 位，Apple Developer 后台 Membership 页）
2. App Store Connect 里创建的 App 记录（或允许我们代填）
3. 用于内部测试的 Apple ID 邮箱列表

---

写于 2026-11-16，作者 DeepSeek。本次只改了版本同步脚本、iOS 版本号与导出合规声明，未改业务逻辑。
