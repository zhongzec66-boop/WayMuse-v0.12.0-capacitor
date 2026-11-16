# TestFlight 首包：只读核查结果

> 按 Codex seq 100 要求：只读核查 Bundle ID、各 target 的 Team/entitlements、归档导出、App Store Connect 权限、隐私与加密声明，列出缺口与需账号持有人操作的步骤。
> **签名密钥、生产配置、实际上传均未进行**，也没有为这次首包新增任何能力。

---

## 一、工程现状（本地只读读出）

| 项 | 现状 | 判断 |
| --- | --- | --- |
| App target | `App`（`com.apple.product-type.application`） | 正常 |
| Widget target | `WayMuseWidget`（`com.apple.product-type.app-extension`） | 正常 |
| Bundle ID（App） | `app.waymuse.student` | 正常，换团队不需要改 |
| Bundle ID（Widget） | `app.waymuse.student.WayMuseWidget` | 需在对方团队下同时注册（自动签名会建） |
| `DEVELOPMENT_TEAM` | **未设置** | 缺口：必须由账号持有人设置 |
| `CODE_SIGN_STYLE` | `Automatic`（4 处） | 正常，但要求 Xcode 已登录对方账号 |
| `CODE_SIGN_IDENTITY` | `"iPhone Developer"`（旧写法） | Xcode 会映射为 Apple Development，可用 |
| `.entitlements` 文件 | **一个都没有** | 与「不扩能力」一致：无 Push / HealthKit / App Groups |
| Live Activities | `NSSupportsLiveActivities`，ActivityKit 进程内使用，无 App Group | 不需要额外 entitlement |
| 部署目标 | App `15.0`；Widget `16.2` | 允许（Widget 独立要求 16.2+） |
| 版本号 | `0.28.2 (158)`（本次已从 `1.0 (1)` 对齐） | 已修 |
| 导出合规 | `ITSAppUsesNonExemptEncryption = false`（本次新增） | 已修 |
| App 图标 | `AppIcon-512@2x.png` 实测 1024×1024 RGB | 符合 App Store 要求 |
| `ExportOptions.plist` | 不存在 | 缺口（仅影响 `xcodebuild -exportArchive`，手动上传不需要） |
| 隐私用途描述 | 麦克风、语音识别、日历（3 种）、提醒事项 | 已具备；**无相机/相册声明**，代码里也没有摄像头调用（iOS 走系统选择器），不需要 |

---

## 二、需要账号持有人做的（我这边做不了）

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | 在 Xcode 里登录他的 Apple ID，Team 选他的个人团队 | 自动签名会据此创建 App ID 与描述文件 |
| 2 | 确认 `app.waymuse.student` 与 `.WayMuseWidget` 两个 App ID 能建在他的团队下 | 若已被其他团队占用，需改名（会影响已装用户） |
| 3 | 在 App Store Connect 建 App 记录 | 名称、主语言、SKU、Bundle ID |
| 4 | 建 TestFlight 内部测试组并加测试员邮箱 | 内部测试无需审核 |
| 5 | Archive → Distribute → Upload | 同一次操作还要选「上传到 App Store Connect」 |

**权限边界（Codex 提醒、我确认成立）**：App Store Connect 里的用户角色（Developer / App Manager 等）**不等于**开发者账号的证书与描述文件权限。仅被邀请进 ASC，不代表能在本地用团队证书签名。

**签名路径不是唯一的**：本地 Xcode 登录团队账号是一种；CI / 委托签名（证书 + 描述文件 + App Store Connect API Key 放进 Secrets）同样可行。本文以「本地手动 Archive」为**首包最短路径**，不是硬性要求；后续应评估 CI 签名以降低对账号持有人的依赖。

---

## 三、需要我方补的产品与材料缺口

| # | 缺口 | 严重度 | 说明 |
| --- | --- | --- | --- |
| 1 | **账号注销** | 高（审核硬门槛） | 有邮箱登录就必须能删账号（苹果 5.1.1(v)）。现有 `PrivacyPage.tsx:82` 还写着"还没有创建账户"，已过时 |
| 2 | 隐私政策 URL | 高 | App Store Connect 必填，需要一个公网可访问页面（可用现有服务器静态托管） |
| 3 | 支持 URL | 中 | 同上 |
| 4 | 审核备注 + 演示账号 | 中 | 说明游客可直接体验、邮箱登录需验证码、模型由服务端提供；最好给固定演示码 |
| 5 | 中国区正式上架备案 | 中（内测不影响） | TestFlight 内测不需要 App 备案；正式上架中国区需要 |

---

## 四、更正我之前的绝对表述（Codex 指出的两处）

1. **「换签名主体必然要卸载且丢数据」** —— 表述过强。准确说法：
   - 若新包的 Team/签名与已装包不同，同一 Bundle ID 无法覆盖安装，需先卸载；iOS 卸载会删掉 App 容器，**本地数据随之丢失**，除非事先导出。
   - 若从同一团队、同一签名后续升级则不存在此问题。
   - TestFlight 安装本身在卸载后重装也遵循同一规则。
   - 结论：**有条件成立**，不是"必然"。

2. **「转移一定走苹果审核」** —— 表述过强。准确说法：
   - App Transfer 只是"换到另一个账号"的一种路径，且苹果按官方条件审核，不是自动通过；也可能不符合条件（例如某些能力或账号状态）。
   - 也可以一直留在对方账号下运营，不转移。是否转移取决于归属方案，不是技术必经。

---

## 五、结论与建议顺序

1. **先只做内测**：首包用最短路径（对方 Mac 上 Archive 上传）；CI 签名作为后续优化项评估，不是禁区。
2. **首包前只补两件产品项**：账号注销 + 隐私政策 URL。其余（备案、推送、HealthKit）不进首包。
3. 我这边已完成且只需复核的：版本号对齐、`sync-version.cjs` 防漂移、导出合规声明、本核查文档。
4. 相关 PR：#5（TestFlight 准备）。

---

核查人：DeepSeek。核查方式：本地工程文件只读解析 + 代码检索；未执行任何签名、上传或账号操作。
