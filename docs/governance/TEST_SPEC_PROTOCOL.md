# 规格驱动测试协议（Spec-Driven Testing Protocol）

## 背景

传统 TDD 存在一个隐患：规格由计划文档直接指定测试代码，实现者只是"抄写"，而非"推导"。
规格含混时，测试通过但行为未被真正约束。

**本协议的核心思路：先把约束变成命题（规格），再把命题变成测试（验证）。**

类比数学证明：先确立公理和约束（不变量），再构造验证方法（测试），最后写证明本身（实现代码）。

---

## 调用时机与流程

每当需要为函数 / 方法 / 模块编写测试时，在写任何测试代码之前执行本协议。

**工作流**：

```
Controller
  ↓ 派发任务描述
Test-Spec 子代理（执行 Phase 0–5）
  ↓ 输出"测试规格文档"
Implementer 子代理（照规格写测试 → 红；写实现 → 绿）
  ↓
Spec Reviewer / Code Quality Reviewer（同原有流程）
```

Implementer 子代理不得自行修改规格；发现规格有误时向 Controller 报告 `NEEDS_CONTEXT`。

---

## 阶段 0：复杂度分级（Phase 0）

| 级别        | 判断条件                     | 执行阶段                        |
| ----------- | ---------------------------- | ------------------------------- |
| **Simple**  | 纯函数，无外部依赖，无状态   | Phase 1 + 4                     |
| **Medium**  | 有外部依赖，但自身无状态     | Phase 1 + 3 + 4                 |
| **Complex** | 有状态 / 业务关键 / 并发风险 | Phase 1 + 2 + 3 + 4（+ 5 可选） |

**快速判断规则**：

- 依赖 Redis / DB / HTTP 外部调用 → 至少 Medium
- 有 `@Injectable()` + 构造函数依赖注入 → 至少 Medium
- 涉及金额 / 库存 / 权限 / 消息幂等 / 状态流转 → Complex

---

## Phase 1：不变量（Invariants）[必做]

**核心问题**："无论传什么输入，哪些命题必须永远为真？"

三类不变量：

| 类型       | 典型例子                                  |
| ---------- | ----------------------------------------- |
| 错误不变量 | 函数永不抛出 / 只抛特定类型异常           |
| 值域不变量 | 返回值 >= 0；输出长度 = 输入长度；非 null |
| 业务不变量 | 状态只能单向流转；TTL 固定；金额不为负    |

**输出格式**：

```
I1: [全称命题]  →  测试描述: "should always [命题]"
I2: [全称命题]  →  测试描述: "should always [命题]"
...
```

**注意**：不变量是对所有输入都成立的全称命题（∀）。只对某些输入成立的是 Phase 4 的边界条件，不要放在这里。

---

## Phase 2：状态机（State Transitions）[有状态时做]

**核心问题**："合法的状态转移有哪些？哪些转移应该被拒绝？"

**输出格式**：

```
合法转移: (状态A, 事件E) → 状态B
  测试: "should transition from A to B when E"

非法转移: (状态A, 事件E) → 拒绝
  测试: "should reject E when in state A"
```

**附加检查**：

- 是否存在"终态"（不可再转移的状态）？
- 是否存在可以跳过的中间状态？（通常应拒绝）
- 并发触发同一转移，结果是否幂等？

---

## Phase 3：红队攻击（Adversarial Scenarios）[有外部依赖时做]

**核心问题**："如果运气很差或依赖出错，哪里会断？"

固定检查清单（逐条过，不可跳过）：

| 场景类型     | 具体问题                                                             |
| ------------ | -------------------------------------------------------------------- |
| **幂等性**   | 同样参数调用两次，结果是否可预期？第二次是覆盖还是报错？             |
| **并发**     | 两个调用同时操作同一资源，哪条数据留下？是否有竞态条件？             |
| **局部失败** | 依赖在执行途中挂掉，主流程如何响应？是否有部分写入的脏数据？         |
| **顺序乱序** | 事件提前或延迟到达是否破坏正确性？回调先于主流程到达？               |
| **输入注入** | 特殊字符（`:` `/` `#` `\0` 超长字符串）是否破坏 key 格式或解析逻辑？ |
| **损坏数据** | 外部系统返回格式损坏的数据（非法 JSON、截断字符串），是否安全降级？  |
| **时钟漂移** | 涉及 TTL / 时间戳时，时钟跳变或 NTP 修正是否影响正确性？             |

每个场景打标记：

```
[UNIT]   → 用 mock 依赖即可验证，写单元测试
[INTEG]  → 需要真实依赖，归入集成测试，此处跳过
[SKIP]   → 基础设施已保证（如 Redis SET 原子性），记录跳过原因
```

**只写 `[UNIT]` 场景的测试代码。**

---

## Phase 4：边界条件（Boundary Conditions）[必做]

**原则**：只对**影响分支逻辑**的参数做边界测试；纯透传参数跳过。

| 参数类型       | 必测边界                                                |
| -------------- | ------------------------------------------------------- |
| 字符串         | `''`，`'  '`（纯空格），含 `:` `/` `#` 等特殊字符，超长 |
| 数组           | `[]`（空），`[单元素]`，含重复元素                      |
| 数字           | `0`，`-1`，`NaN`，`Infinity`，`Number.MAX_SAFE_INTEGER` |
| 可空值         | `null`，`undefined`（两者行为是否相同？）               |
| 枚举 / Map Key | 所有已知合法值 + 至少一个未知/非法值                    |
| 嵌套对象       | 缺少可选字段，存在额外未知字段                          |

**缩减规则**：若参数在当前函数内没有分支，只是传递给下一层，则跳过（下一层的测试应覆盖它）。

---

## Phase 5：性质测试（Properties）[可选]

**核心问题**："对所有合法输入，哪些结构性命题成立？"

表达格式：`∀ 满足前置条件 P 的输入 x，f(x) 满足后置条件 Q`

常见性质模板：

```
序列化往返：  ∀ x, decode(encode(x)) deepEqual x
幂等性：      ∀ x, f(f(x)) === f(x)
写后读一致：  ∀ params, record(params); query(params) !== null
映射有意义：  ∀ known key k in MAP, MAP[k] !== k（映射不是恒等函数）
单调性：      ∀ x ≤ y, f(x) ≤ f(y)
长度不变：    ∀ x, transform(x).length === x.length
```

实现方式：

- 有 fast-check → 写 property test（推荐用于 Simple 级纯函数）
- 无 fast-check → 用 3–5 个覆盖不同"形状"的参数化用例（`it.each`）

---

## 测试规格产出格式（Test-Spec 子代理输出）

Test-Spec 子代理产出的是**规格表**，不是测试代码。格式：

```markdown
# 测试规格：[模块名 / 函数名]

## 复杂度：[Simple / Medium / Complex]

**判断依据**：[一句话说明为什么这个级别]

## Phase 1：不变量

| ID  | 命题 | 测试描述          |
| --- | ---- | ----------------- |
| I1  | ...  | should always ... |
| I2  | ...  | should always ... |

## Phase 2：状态转移（适用时填写，否则删除此节）

| 当前状态 | 事件 | 目标状态 | 测试描述 |
| -------- | ---- | -------- | -------- |

## Phase 3：红队场景

| 场景 | 类别 | 测试描述   | 预期行为 |
| ---- | ---- | ---------- | -------- |
| ...  | UNIT | ...        | ...      |
| ...  | SKIP | — 跳过原因 | —        |

## Phase 4：边界条件

| 参数 | 边界值 | 预期行为 |
| ---- | ------ | -------- |

## Phase 5：性质（适用时填写，否则删除此节）

| 命题 | 表达式 | 测试方式 |
| ---- | ------ | -------- |

## 测试套件结构

describe('[模块名]', () => {
describe('invariants', () => { /_ I1, I2, ... _/ })
describe('state transitions', () => { /_ S1, S2, ... _/ }) // 若适用
describe('adversarial inputs', () => { /_ A1, A2, ... _/ })
describe('boundary conditions', () => { /_ B1, B2, ... _/ })
describe('properties', () => { /_ P1, P2, ... _/ }) // 若适用
})
```

---

## 示例：ResolutionExplainService

### Phase 0 — 复杂度判断

依赖 Redis（Medium），涉及 key 构造 + TTL 固定 + 错误吞没（Complex）→ **Complex**

### Phase 1 — 不变量（7 条）

| ID  | 命题                                      | 测试描述                                                |
| --- | ----------------------------------------- | ------------------------------------------------------- |
| I1  | `record()` 永不抛出                       | should not throw when redis.set rejects                 |
| I2  | `query()` 永不抛出                        | should return null when redis.get rejects               |
| I3  | TTL 始终 = 604800                         | should always call SET with EX 604800                   |
| I4  | `explainVersion` 始终 = `'1'`             | should always write explainVersion '1'                  |
| I5  | 已知 reason 映射为中文（映射不是恒等）    | should return Chinese text for all known reason codes   |
| I6  | 未知 reason 回退为原始值（不丢数据）      | should fall back to raw reason string for unknown codes |
| I7  | `filtered` 的 `configId` 来自 `config.id` | should map configId from StorePlayConfig.id             |

### Phase 3 — 红队场景

| 场景                      | 类别 | 测试描述                                                   | 预期行为                               |
| ------------------------- | ---- | ---------------------------------------------------------- | -------------------------------------- |
| `redis.set` 抛出          | UNIT | should silently fail when Redis write throws               | 函数返回 void，不抛出                  |
| `redis.get` 返回损坏 JSON | UNIT | should return null when stored value is invalid JSON       | 返回 null                              |
| `traceId` 含冒号          | UNIT | should produce consistent key when traceId contains colons | `buildKey` 输出与 `query` 使用同一 key |
| 并发写同一 key            | SKIP | Redis SET 是原子操作，后写覆盖先写，行为确定               | —                                      |

### Phase 4 — 边界条件

| 参数                 | 边界值          | 预期行为                                 |
| -------------------- | --------------- | ---------------------------------------- |
| `filtered`           | `[]`            | `snapshot.filtered = []`                 |
| `winner`             | `null`          | `snapshot.winner = null`                 |
| `memberId`           | `undefined`     | JSON 序列化后 `memberId` 字段缺失        |
| `reason`             | `'unknown_xyz'` | `reasonText = 'unknown_xyz'`（fallback） |
| 全部 4 个已知 reason | 逐一传入        | 各自映射正确中文                         |

### 对比结论

|            | 现有测试    | 本规格产出 |
| ---------- | ----------- | ---------- |
| 不变量覆盖 | 1 条（TTL） | 7 条       |
| 红队覆盖   | 0           | 2 条 UNIT  |
| 边界覆盖   | 0           | 5 条       |
| 总用例数   | 3           | ~14        |

---

## 与 subagent-driven-development 的集成方式

当前 subagent-driven-development 流程在派发 Implementer 之前，插入 Test-Spec 子代理：

```
[Controller]
  1. 读取任务描述
  2. → 派发 Test-Spec 子代理（输入：任务描述 + 相关代码上下文）
  3. ← 收到测试规格文档
  4. → 派发 Implementer 子代理（输入：任务描述 + 测试规格文档）
  5. ← Implementer 报告 DONE
  6. → Spec Reviewer（验证实现是否覆盖规格中每一行测试描述）
  7. → Code Quality Reviewer（同原流程）
```

Spec Reviewer 的额外检查项：

- 规格中每条测试描述是否都有对应的 `it(...)` 实现？
- 是否有测试描述被删除或弱化？

---

## 精简模式（Quick Mode）

对 Simple 级函数，允许跳过子代理，直接在 Implementer prompt 中内嵌以下 checklist：

```
在写测试之前，先列出：
1. 不变量（全称命题）：至少 2 条
2. 边界条件：每个有分支的参数至少 2 个边界
然后写测试，再写实现。
```
