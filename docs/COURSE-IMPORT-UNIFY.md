# 课表导入入口统一：现状盘点与拟改方案

> 任务来源：Codex seq 83。「先梳理现有入口和拟改文件，给可核方案再写」。
> 本文只做盘点与方案，不含代码改动。基线：`feat/native-compose` @ `d629a0f`。

---

## 一、现在有几条导入路径（六条，三套解析）

> A–E 是用户主动触发的入口，F 是模型返回后转入的同一条确认路径。

| # | 入口 | 触发位置 | 解析实现 | 预览/确认 | 写入 |
| --- | --- | --- | --- | --- | --- |
| A | Today「粘贴课表文字」 | `TodayPage.tsx:312` 按钮 → `onImportCourses`；`WayMuseReference.tsx:416` 设 `courseImportOpen=true`，Sheet 渲染在 `:539`、`onSave` 在 `:542` | `courseImport.ts` 的 `parseCourseText` | 有（Sheet 内结果列表 + 失败行） | `onSave` → `WayMuseReference.tsx:542` 追加 |
| B | 计划页「批量导入」 | `TaskPage.tsx:165` | **`TaskPage.tsx:40` 自己写的 `parseCourseLines`** | 无（直接写入） | `TaskPage.tsx:170` 直接 `setCourses` |
| C | 计划页「录入一节课」 | `TaskPage.tsx:474` 起的手写弹层 | 用户手填字段 | 无 | `TaskPage.tsx:149` 直接 `setCourses` |
| D | 聊天：粘贴文字 | `ChatPage.tsx:365`（≥2 门才出卡，`:366`） | `parseCourseText`（≥2 门才出卡） | 有（`courseProposal` 确认卡，`ChatPage.tsx:1422`） | 确认后 `toCourses` 追加 |
| E | 聊天：发图片 | `ChatPage.tsx:361` | **不解析**，只 `setImageCourseHint(true)` 提示 | 无 | 无 |
| F | 聊天：模型返回 `<courses>` | `ChatPage.tsx:485`、`645`；标签解析在 `src/agent.ts` 的 `parseReply` | 服务端模型解析 | 有（同一张确认卡） | 同上 |

**核心问题**：A/D/F 共用 `courseImport.ts`，B 是**第二套独立实现**，C 是**第三套手填**，E 干脆没接解析。同样一段课表文字，从不同入口进，结果可能不同。

---

## 二、两套解析的差异（可核）

| 能力 | `courseImport.parseCourseText`（A/D/F 用） | `TaskPage.parseCourseLines`（B 用） |
| --- | --- | --- |
| 单行识别 | 有 `parseCourseLine` | 自写实现 |
| 表格模式（一行一节次、列是周一到周日） | 有 `parseCourseTableLine`（`courseImport.ts:198`） | 无 |
| 失败行回传 | 有（`failedLines`，逐行） | 无逐行回传；一行都没认出时只给一句「没认出任何一行」 |
| 单双周 / 周次 | 支持 | 视实现而定 |
| 去重 | 由调用方处理 | 无 |

也就是说：**表格模式只有 A 支持**，用户在计划页粘表格会解析失败或漏课。

---

## 三、目标：一条管线

```
输入（文字 / 图片 / 模型返回）
   ↓
parse      courseImport.ts（唯一解析层，已有单测）
   ↓
validate   weekday 1-7、start<end、名称非空
   ↓
dedupe     同一份课表内 + 与已有课程（name+weekday+start）
   ↓
preview    CourseImportSheet 的结果列表（含失败行、可删单条）
   ↓
save       一次性写回（追加 / 覆盖由调用方选）
```

**一条规则**：任何入口都不直接 `setCourses`，只把 `ParsedCourse[]` 交给同一个 Sheet（或同一个 `applyCourses()`）。

---

## 四、拟改文件（先不动代码，等确认）

| 文件 | 改动 | 规模 |
| --- | --- | --- |
| `src/courseImport.ts` | 新增 `validateCourses` / `dedupeCourses` 两个纯函数（带单测） | +60 行 |
| `src/pages/CourseImportSheet.tsx` | 增加 `mode`（追加/覆盖）、`initialText`、`onSave` 统一；图片识别结果也进同一份结果列表 | +40 行 |
| `src/pages/TaskPage.tsx` | 删掉 `parseCourseLines`（L40-），「批量导入」改为打开 Sheet；单节录入弹层保留但写入走 `applyCourses` | −80 / +20 |
| `src/pages/TodayPage.tsx` | 不动（已经是 Sheet 入口） | 0 |
| `src/pages/ChatPage.tsx` | 图片分支改为调用 `parseCourseImage` 后再走确认卡；确认卡的保存逻辑与 Sheet 共用 `applyCourses` | +25 / −10 |
| `src/WayMuseReference.tsx` | 提供 `applyCourses(list, {mode})` 单一写入口 | +15 |

**不动的**：数据结构（`Course` 不变）、存储格式、服务端接口（`/api/course/parse-image` 不变）、任何数据库。

---

## 五、迁移步骤（每步可独立回滚）

1. **加纯函数**：`validateCourses` / `dedupeCourses` + 单测（不改任何调用方）。
2. **Sheet 统一**：加 `mode` / `initialText`，Today 行为不变（默认追加）。
3. **计划页切换**：删除 `parseCourseLines`，批量导入改为 Sheet；单节录入保留。
4. **聊天图片接 OCR**：`parseCourseImage` → 结果进确认卡，失败给可重试提示。
5. **删重复代码**：确认无引用后删除旧函数与旧弹层里重复的校验。

每步一个 PR，前一步合并后再做下一步。

---

## 六、测试计划

**单测**（新增）
- `validateCourses`：weekday 越界、start≥end、空名称、缺字段
- `dedupeCourses`：同课表内重复、与已有课程重复、不同周次不算重复
- `parseCourseText` 表格模式回归（已有测试基础上补 2 条）

**手动（三入口同一段文字，结果必须一致）**
1. 粘贴同一份 5 行课表：Today / 计划页 / 聊天 → 都认出 5 门
2. 粘贴表格（一行一节次）：三个入口都不丢课
3. 同一份课表导入两次：不产生重复课程
4. 截图导入：识别结果与文字导入一致
5. 失败行：三个入口都显示"这 2 行没看懂"

**回归**
- `npx vitest run` 183+ 全过；`tsc` / `eslint` / `build` 通过
- 双端真机各跑一遍导入流程（Android 无原生 Tab 栏，注意浮层让位）

---

## 七、风险与不做什么

| 风险 | 缓解 |
| --- | --- |
| 删除 `parseCourseLines` 后行为变化 | 先加测试覆盖它的现有能力，再删 |
| 聊天图片走 OCR 增加等待 | 显示"正在识别…"，可取消；失败保留原图片消息 |
| 去重误删用户想要的重复课程 | 只对"完全同 name+weekday+start"去重，且预览里可恢复 |

**不做**：不改 `Course` 结构、不做服务端课表同步、不做多学期、不引入第三方课表导入。

---

## 八、Codex 已定的三条（2026-11-16 seq 87）

1. 计划页「批量导入」**直接打开共用的 `CourseImportSheet`**。
2. **保留单节手填入口**，但复用相同的校验与去重。
3. 聊天课表截图：**先自动识别并展示预览，必须用户确认后写入**；识别失败给可编辑 / 手动录入退路。

实施顺序（每步一个可回滚提交）：

1. 纯函数与测试 → `src/courseApply.ts`（`validateCourses` / `dedupeCourses` / `prepareCourses`）
2. Sheet 支持 `mode` / `initialText`
3. 计划页批量导入切到 Sheet，删 `parseCourseLines`
4. 聊天截图自动识别 → 预览确认
5. 清理重复校验

## 九、实施前留档：最初提出的三个待定问题

1. **入口形态**：计划页的「批量导入」是否直接改成打开同一个 Sheet（我倾向是），还是保留原地弹层但换解析器？
2. **单节录入**：`TaskPage` 的手填弹层保留吗？（我倾向保留，它解决"只加一节课"的场景，但校验要复用纯函数）
3. **聊天图片**：发送课表截图时，是否**自动**走 OCR 并出确认卡（会多一次请求），还是仍要点一下"识别成课表"？

---

写于 2026-11-16，作者 DeepSeek。未改任何代码。
