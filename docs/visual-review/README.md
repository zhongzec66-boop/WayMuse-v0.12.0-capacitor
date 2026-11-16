# 视觉回归（docs/visual-review）

这个目录放**视觉验收**用的清单、种子数据和每版报告，供 Doubao 跑截图矩阵、Denise 复核。

| 文件 | 谁维护 | 说明 |
| --- | --- | --- |
| `视觉验收清单-草稿.md` | Denise Muse（只读交付，由 DeepSeek 原样提交） | 全局通过标准 G1–G9、屏幕 × 状态矩阵、分包必查项、报告格式 |
| `seed.json` | DeepSeek | 截图用种子数据：课表 / 作业 / 考试 / 记忆 |
| `reports/` | Doubao | 每版一份，命名 `DeepSeek_视觉回归_<版本>.md`，差异行格式见清单第四节 |

## 怎么跑（当前可行方式）

1. **Web 模式（Windows 可全自动）**：用 `vite build` 产物 + headless Chrome 截全套。验不到原生 Tab 栏、原生输入框、安全区。
2. **Android**：模拟器 + `adb exec-out screencap`；有 Appium 可进二级页。
3. **iOS**：Windows 无法跑模拟器，只能真机人工点，程序负责收集截图。

## 版本与产物

每次出包的 run id、commit、包大小记在 `reports/` 对应文件开头，避免"两个包版本号相同"这类问题再次出现。
