# 端上沙盒：能力清单与工具层对齐

> 调研对象：[OpenMinis](https://github.com/iherwo/OpenMinis)（GPLv3，iOS + Android 开源 Agent）
> 目的：判断"给 Agent 一个能跑命令的沙盒"对 WayMuse 是不是真需求，以及如果要接，接口怎么对齐。
> 证据来源：README 与 iSH-ARM64 说明（未逐行读其 Swift/Kotlin 源码，标注为「文档所述」）。

---

## 0. 结论先行

1. **OpenMinis 的沙盒不是 WASM，是 iSH**（iOS，用户态 CPU 解释器）+ **PRoot**（Android，用户态 chroot）。
2. 它跑的是**真 Alpine Linux**：`apk` / `pip` / `npm` / `git` / `ffmpeg` 都能用，离线可用。
3. 代价：iOS 上**慢 3–30 倍**（Python 2–77×），耗电明显；Android 接近原生。
4. **对 WayMuse 而言，端上沙盒大概率是伪需求。** 学生场景真正高频的是"把课表整理成日历""把笔记结构化"这类**可枚举的数据处理**，服务端一个函数就够，不需要给用户一台 Linux。
5. 建议：**先做服务端工具层**（成本可控、可迭代），端上沙盒作为后续实验，不要一开始就背 iSH 的包体积与 GPL 约束。

---

## 1. 两端的真实实现

| | iOS | Android |
| --- | --- | --- |
| 引擎 | [iSH ARM64 fork](https://github.com/OpenMinis/ish-arm64) | [PRoot fork](https://github.com/OpenMinis/proot) |
| 原理 | AArch64 客户机指令 → 预编译 ARM64 gadget 函数 → 尾调用链（**Asbestos**，非 JIT，无运行时生成代码） | 用户态 chroot，**不模拟 CPU**，直接跑原生二进制 |
| 根文件系统 | Alpine 3.21 aarch64（`fakefs` + 真实 FS + bind mounts） | Alpine rootfs |
| 上架合规 | 因为没有 JIT/代码生成，可上 App Store（iSH 本体已验证） | 无限制 |

> 关键认知：**iOS 能上架的"Linux"一定是解释器或模拟器**，不是虚拟机。所以"iPhone 上装 Docker"这件事不存在。

---

## 2. 能力清单（文档所述）

### 2.1 能跑

| 类别 | 具体 |
| --- | --- |
| 包管理器 | `apk`、`pip`、`npm`、`npx`、`uv` |
| 语言 | Python 3、Node.js 22、Go、Perl、Ruby、Lua |
| 开发工具 | `git`、`curl`、`wget`、`ssh`、`vim`、`nano` |
| 构建 | `gcc`、`g++`、`cmake`、`make`、`meson` |
| 数据工具 | `sqlite3`、`jq`、`yt-dlp`、`ffmpeg`（通过 native offload 跑原生） |
| 网络 | `curl`、`wget`、`dig`、`netstat`、`ss` |
| Node 生态 | Express、Axios、lodash、dayjs、uuid… |

### 2.2 跑不了

- GUI（无 X11/Wayland）
- Docker / 容器（无内核 namespace）
- 内核模块
- 硬件直通（无 `/dev/gpu`、无 USB）

### 2.3 性能预期（引用其 benchmark，客机视角）

| 负载 | iOS ARM64 相对原生 |
| --- | --- |
| C 纯计算 | 0.5–30× |
| Shell 管道 | 1–127× |
| Python | 2–77× |
| Go（启动） | 2.4–5.5× |
| Node.js | 5–22× |

**读法**：小脚本（<1 秒）体验可接受；跑 `pip install`、编译、处理大文件会明显卡。

---

## 3. 它对外暴露的 Agent 接口

### 3.1 `ISHShellExecutor`（ObjC，流式）

```objc
[ISHShellExecutor executeCommand:@"pip install requests"
                    lineCallback:^(NSString *line, BOOL isStdErr) { /* 逐行流式 */ }
                      completion:^(ISHShellExecutionResult *result) { /* exitCode */ }];
```

### 3.2 `DebugServer`（JSON-RPC over HTTP）

```bash
curl localhost:1234 -d '{"jsonrpc":"2.0","id":1,"method":"guest.exec","params":{"command":"python3 --version"}}'
curl localhost:1234 -d '{"jsonrpc":"2.0","id":1,"method":"fs.readdir","params":{"path":"/usr/bin"}}'
curl localhost:1234 -d '{"jsonrpc":"2.0","id":1,"method":"task.list"}'
```

### 3.3 其他

- **Native Offload**：`execve` 拦截，把 `ffmpeg` 等重活路由到原生实现
- **Bind Mounts**：把宿主目录（如 App Documents）只读/读写挂进沙盒，文件不出设备

---

## 4. 对齐到 WayMuse 的工具层

现在的工具其实只有三个（都在客户端、靠 `<plans>` / `<memories>` 协议）：

```
task.*      写入/完成（已实现：planTasks → tasks）
memory.*    写入/删除（已实现：<memories> → memories）
course.*    仅读取（Today 展示）
```

引入沙盒后应扩展为：

| 工具 | 参数 | 返回 | 落在哪 |
| --- | --- | --- | --- |
| `sandbox.exec` | `{ command, timeoutMs, cwd? }` | `{ stdout, stderr, exitCode, truncated }` | 服务端容器（首选）/ 端上 iSH |
| `sandbox.fs.read` | `{ path }` | `{ content, mime }` | 同上 |
| `sandbox.fs.write` | `{ path, content }` | `{ ok }` | 同上（需用户确认） |
| `health.daily` | `{ date }` | `{ sleepHours, steps, workoutMinutes }` | 端上聚合后回传 |
| `usage.daily` | `{ date }` | `{ studyMinutes, switches }` | Android 端上；iOS 不做 |

**关键设计**：`sandbox.*` 与 `task.*` 一样是"工具"，**不是新页面**。模型自己决定用不用，你能单独限流、单独关掉。

### 4.1 若走端上 iSH（路线 A）

需要一个 Capacitor 插件，接口建议：

```ts
interface SandboxPlugin {
  exec(o: { command: string; timeoutMs?: number }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  onOutput(cb: (o: { chunk: string; isErr: boolean }) => void): Promise<Handle>;
  readFile(o: { path: string }): Promise<{ content: string }>;
  writeFile(o: { path: string; content: string }): Promise<void>;
  mountAppDocuments(o: { alias: string }): Promise<void>;
}
```

注意：**它跑在端上，等于把任意命令执行权交给了 App**，安全边界必须由你自己兜（第 5 节）。

---

## 5. 安全边界（无论端上还是服务端）

| 项 | 要求 |
| --- | --- |
| 网络 | **默认完全禁止**；需要时白名单放行，走代理出口 |
| 文件 | 每次会话独立工作目录，结束销毁；绝不挂载 App 私有目录 |
| 资源 | CPU 1 核 / 内存 512MB / 单次 30s / 磁盘 100MB |
| 命令来源 | 模型生成的命令**先展示再执行**，用户点确认 |
| 黑名单 | `rm -rf /`、外网 `curl`、包管理器、`sudo`、`chmod 777` |
| 输出 | 单次上限 64KB，超出截断并标注 |
| 审计 | 每条命令 + 退出码 + 耗时留 trace，可回放 |

> 端上沙盒尤其危险：一旦模型幻觉出 `rm -rf ~`，而你 bind mount 了 Documents，用户的笔记就没了。**必须挂载到独立子目录并默认只读。**

---

## 6. 三个真实用例该走哪条路

| 用例 | 是否需要沙盒 | 原因 |
| --- | --- | --- |
| 课表截图 → 结构化课程 | ❌ 服务端函数 | 本质是 OCR + 结构化，沙盒帮不上 |
| CSV/ICS 课表导入 | ❌ 服务端或纯前端 | 解析逻辑固定，写死函数比跑 Python 稳 |
| 文献引用格式校对 | ❌ 服务端 LLM | 纯文本处理，无需文件系统 |
| 批量整理笔记/重命名附件 | ✅ 需要 | 涉及真实文件遍历与批量改写 |
| 跑学生自己写的脚本 | ✅ 需要 | 这是唯一真正需要"环境"的场景 |

**判断标准**：需求能枚举成函数 → 服务端函数；需求是"用户想跑任意东西" → 才需要沙盒。

---

## 7. 建议路线

| 阶段 | 做什么 | 验收 |
| --- | --- | --- |
| P0 | 服务端工具层（`sandbox.exec` 先跑 Docker 容器 + 禁网 + 30s 超时） | 一条命令能跑通并把 stdout 回给模型 |
| P1 | 健康数据（睡眠/步数/运动）端上只读 + 日汇总 | Today 能按睡眠调整任务强度 |
| P2 | 端上沙盒实验（iSH fork，仅内部 TestFlight） | 离线能跑 `python3` 处理本地笔记 |

**不要一开始就做 P2**：包体积 + GPL + 性能三重成本，而需求尚未验证。

---

## 8. 许可证提醒

- iSH：**GPLv3**；PRoot：**GPLv2**；OpenMinis：**GPLv3**
- 内置它们 → 你的 App 必须 GPL
- WayMuse 当前 `package.json` 已是 `GPL-3.0-or-later`，**目前兼容**；若将来做闭源版，此路不通

---

最后更新：2026-11-09
