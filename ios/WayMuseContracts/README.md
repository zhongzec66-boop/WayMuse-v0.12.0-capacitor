# WayMuseContracts（跨端契约层，Swift）

把「必须和 TS 实现逐字一致」的纯函数放进一个独立 Swift Package：
不依赖 UIKit / SwiftUI / 网络，所以在任何 macOS 上 `swift test` 就能验，不需要 Xcode、不需要模拟器。

## 跑测试

```bash
swift test --package-path ios/WayMuseContracts
```

（macOS 上要求 Xcode 15+ 或 Command Line Tools；`swift test` 第一次会编译整个包，约十几秒。）

## 现在有什么

| 文件 | 内容 | 状态 |
|---|---|---|
| `Sources/WayMuseContracts/TopTask.swift` | 契约模型（id / text / done / deadline） | 完成 |
| `Sources/WayMuseContracts/TopTaskSelector.swift` | 「今日三件」选取规则 | 完成 |
| `Sources/WayMuseContracts/ReplyModel.swift` | 回复模型（Plan / MemoryEntry / ParsedCourse / DeadlineProposal） | 完成 |
| `Sources/WayMuseContracts/ReplyParser.swift` | 协议块解析（plans / memories / courses / choices / deadlines） | 完成 |
| `Sources/WayMuseContracts/CourseRecordParser.swift` | 单条课程记录规范化（weekday 折算、节次换算） | 完成 |
| `Tests/.../Top3ContractTests.swift` | 用共享 fixture 逐条跑 11 条用例 | 完成 |
| `Tests/.../ReplyParserTests.swift` | 协议块解析行为测试（11 条） | 完成 |
| `Tests/.../Fixtures/top3-cases.json` | 从 `docs/contract/` 复制的**同一份**用例 | 完成 |
| `Tests/.../Fixtures/course-parse-cases.json` | 课程解析 4 条用例 | **待移植**（文字解析 `parseCourseText` 未写） |

## 为什么是独立 Package，而不是塞进 App target

1. **零冲突**：壳（`ios/WayMuseNative`）由另一位 Codex 在写，这里不碰它的 `project.yml`。
2. **能单独验**：契约是纯逻辑，跑 `swift test` 秒级，不用等 Xcode 编译整个 App。
3. **两端同源**：fixture 直接复制 `docs/contract/*.json`，TS 那边的 `src/contractCases.test.ts` 与这里读的是同一批用例；谁改语义都会红。

## 接进 App（等壳稳定后一行）

```yaml
targets:
  WayMuseNative:
    dependencies:
      - package: WayMuseContracts
        path: ../WayMuseContracts
```

然后 `import WayMuseContracts`，用 `TopTaskSelector.select(tasks, today:)`。

## 行为约定（不要「优化」）

- 只看未完成；逾期（`deadline < today`）最前，按 deadline 升序。
- 有截止但未逾期次之，按 deadline 升序。
- 无截止最后，保持原数组顺序。
- **稳定排序**：同一天截止保持原数组顺序。Swift 的 `sorted` 不保证稳定，`stableSorted` 自己兜了。
- `today` 是本地日期键，按**字符串**比较；`deadline` 缺失或空串都算「无截止」（对齐 JS 里 `task.deadline && ...`）。
- `display`：`[top] + 原数组里除 top 外未完成的`，顺序不变。

## 待办

1. `parseCourseText`（**文字**课表解析）的 4 条用例移植——`parseCourseRecord`（单条记录）已完成，缺的是「一段文字切多行 + 节次换算 + failedLines 统计」。
2. APIClient：URLSession + SSE 行缓冲 + 401 refresh / 429 不重试 / 5xx 退避一次。
3. 接入 App 后，把 `TodayView` 与聊天卡片的数据源换成这个包。

参考：`docs/API-CONTRACT.md`、`docs/contract/`、`src/todayTop3.ts`。
