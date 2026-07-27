# 项目全局问题沉淀与处理准则

本文档记录本项目开发过程中已经暴露过的重要问题、误判和修复方式。后续维护本项目时，应优先参考这里的处理准则，避免重复踩坑。

## AI-001 DeepSeek 配置读取失败

**现象**
- `.env` 中已经填写 `DEEPSEEK_API_KEY`，但后端仍报 `Missing credentials`。

**错误判断**
- 一开始只检查了 `.env` 是否填写，没有第一时间确认运行时进程是否真的读到了环境变量。

**真实原因**
- 后端配置使用 `os.getenv()` 读取变量，但没有显式加载 `backend/.env`。
- 运行时进程环境中没有 `DEEPSEEK_API_KEY`，导致 OpenAI SDK 认为缺少凭证。

**修复方式**
- 在 `backend/app/config.py` 中显式加载后端 `.env`：

```python
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")
```

- DeepSeek key 支持兼容兜底：

```python
deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY", "")
```

**以后处理准则**
- 遇到“已填 `.env` 但运行时报缺配置”时，必须先验证运行时值，而不是只看文件内容。
- 最小验证命令应打印：
  - key 是否存在，不打印完整密钥
  - base_url
  - model

---

## AI-002 DeepSeek Base URL 与模型名应按实际供应商配置

**现象**
- 从元景切到 DeepSeek 后，需要确认 Base URL 与模型名。

**错误判断**
- 之前曾使用不够确定的默认配置，例如 `deepseek-chat` 或带 `/v1` 的 Base URL。

**最终配置**

```env
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

**以后处理准则**
- 切换模型供应商时，不应凭 OpenAI-compatible 经验猜默认值。
- 必须确认三项：
  - `API_KEY`
  - `BASE_URL`
  - `MODEL`
- `/health` 应返回当前 AI provider 与 model，便于排查当前进程到底使用了哪个模型。

---

## AI-003 接口调用成功但业务内容为空或解析失败

**现象**
- DeepSeek 后台显示接口调用成功，也消耗了 tokens。
- 前端仍报：

```text
单元结构生成失败：模型未返回有效的单元结构，请重试。
最后一次错误：units response is not a valid JSON array
```

**我的错误**
- 没有第一时间检查 DeepSeek 原始响应中的 `finish_reason`、`usage`、`message.content`、`reasoning_content`。
- 让用户多次前端重试，浪费了时间。

**真实原因**
- `deepseek-v4-flash` 会产生较多 `reasoning_content`。
- 原来单元结构生成使用默认 `max_tokens=2000`。
- 调用返回 `finish_reason=length`，说明输出被长度限制截断。
- 大量 token 被推理内容占用，最终 `message.content` 为空或 JSON 不完整。

**修复方式**
- 对“单元结构生成”单独提高 token 上限：

```python
result = cls.chat_completion(
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    temperature=0.7,
    max_tokens=12000,
)
```

**以后处理准则**
- 遇到“供应商侧成功，但业务解析失败”时，第一时间检查：
  - `finish_reason`
  - `usage.prompt_tokens`
  - `usage.completion_tokens`
  - `usage.total_tokens`
  - `message.content`
  - `message.reasoning_content`
- 如果 `finish_reason=length`，应优先判断 token 上限不足，而不是让用户反复重试。
- 对结构化 JSON 生成任务，应使用更高的 `max_tokens`，并尽量缩短 prompt 或展品摘要。

---

## AI-004 生成失败时不应返回“看起来成功”的假结果

**现象**
- Step 2 单元结构显示：
  - `序章`
  - `第一单元`
  - `第二单元`
  - `第三单元`
  - `尾声`
- 叙事定位显示为通用文案：
  - `承担正文叙事推进，需根据展品主题进一步细化。`

**我的错误**
- 后端 `generate_units()` 解析失败时返回了兜底单元结构。
- 这导致用户看到的是“看起来生成成功”的错误结果，而不是明确失败提示。

**真实原因**
- 模型返回空内容或不完整 JSON。
- 后端捕获异常后走 fallback。
- 前端收到 fallback 后正常展示，造成误导。

**修复方式**
- 取消单元结构生成失败时的伪成功 fallback。
- 保留一次自动重试。
- 两次仍失败时，明确抛出错误：

```python
raise ValueError(
    f"单元结构生成失败：模型未返回有效的单元结构，请重试。"
    f"{f' 最后一次错误：{last_error}' if last_error else ''}"
)
```

**以后处理准则**
- 对核心 AI 生成结果，不能用“假结果”掩盖失败。
- 可以 fallback 的场景：
  - 非关键展示
  - 示例/预览
  - 明确标记为系统兜底
- 不可以 fallback 的场景：
  - 会保存进项目状态的数据
  - 会进入后续流程的数据
  - 用户会误以为是 AI 正常生成的内容

---

## UNIT-001 单元结构字段映射混乱

**现象**
- “单元描述”和“叙事定位”显示不准确。
- 后端 prompt 要求返回：
  - `description`
  - `narrative`
- 前端主要用 `desc` 展示，容易混用。

**我的错误**
- 一开始没有把“生成字段”和“前端展示字段”逐层对齐。

**修复方式**
- 前端生成单元结构时统一映射：

```js
const narrativeText = String(u.narrative || u.desc || u.description || '').trim();
const descriptionText = String(u.description || u.desc || u.narrative || '').trim();

return {
  desc: narrativeText,
  narrative: narrativeText,
  description: descriptionText,
};
```

**以后处理准则**
- 后端 AI 返回字段、数据库字段、前端展示字段必须有明确映射。
- 同一业务概念不要随意混用多个字段名。
- 如果保留兼容字段，应明确优先级：
  - `narrative` 优先作为叙事定位
  - `description` 优先作为单元描述
  - `desc` 仅作为前端旧字段兼容

---

## DEBUG-001 调试时不应让用户承担重复验证成本

**现象**
- 用户已经指出“接口模型调用成功，但仍然报错”。
- 我没有马上检查原始响应结构和 token 截断，而是让用户多次重试。

**我的错误**
- 过度依赖用户前端复现。
- 没有第一时间用后端脚本或日志确认：
  - 原始响应结构
  - token 使用量
  - 截断原因
  - 解析失败位置

**正确方式**
- 先在后端直接复现并收集证据。
- 明确告诉用户：
  - 是接口失败
  - 还是接口成功但内容不可用
  - 是解析失败
  - 还是前端回显问题

**以后处理准则**
- 对 AI 调用问题，应优先服务端直接验证，不让用户承担反复点击成本。
- 用户提供截图或供应商后台证据后，应先结合原始响应判断，不应继续让用户盲目重试。
- 每次让用户重试前，必须说明这次重试要验证什么假设。

---

## UX-001 错误提示必须区分“调用失败”和“内容不可用”

**现象**
- 用户看到的是“生成失败”，但供应商后台看到调用成功。
- 这会造成困惑：到底是 API 没通，还是生成内容不符合要求？

**真实分类**
- API 调用失败：
  - key 错误
  - base_url 错误
  - 网络错误
  - 超时
- API 调用成功但内容不可用：
  - `content` 为空
  - `finish_reason=length`
  - JSON 不完整
  - 字段缺失
  - 返回了自然语言而非 JSON

**以后处理准则**
- 错误文案应尽量说明类别：
  - `模型调用失败，请检查 API 配置或网络。`
  - `模型返回内容为空，请稍后重试或提高输出 token 上限。`
  - `模型返回结构不完整，请重试。`
  - `模型返回内容不是有效 JSON，请重试。`

---

## UX-002 列表编辑入口应贴近用户决策点

**现象**
- Step 2 的“添加单元”按钮原来放在页面顶部右上角。
- 用户通常是在浏览完整个单元结构，尤其看到尾声之后，才判断是否需要新增单元。
- 顶部入口与用户决策位置相距较远，不符合“看完后顺手操作”的交互习惯。

**问题**
- 顶部按钮更像全局动作，但“新增单元”其实是对当前结构列表的局部编辑。
- 用户完成结构审阅后，需要回到顶部才能新增，增加了认知和操作成本。

**修复方式**
- 移除 Step 2 顶部右上角的“添加单元”按钮。
- 在单元列表尾部、尾声之后增加一个轻量的列表内添加入口：
  - 视觉上属于单元结构列表的一部分
  - 面积应小于单元卡片，避免低频辅助操作抢占主要内容空间
  - 用户看完尾声后可以直接新增单元
  - 文案保持简单，不暴露“在尾声前插入”等内部排序细节
  - 新增后仍通过排序逻辑进入正确结构位置
- 同时修复新增编号逻辑：新增单元编号按正文单元数量计算，不把序章和尾声算进去。

**以后处理准则**
- 列表类编辑动作应尽量放在用户浏览和判断的上下文附近。
- 对“添加一项”这类操作，入口优先放在列表尾部或相关分组尾部，而不是页面全局角落。
- 文案应描述用户目标，例如“添加单元”，不要把内部实现细节直接暴露给用户。
- 控件面积要匹配操作权重；低频辅助操作不应做成与主要内容卡片等高、等宽的视觉块。
- 结构类页面的按钮位置应服务于用户审阅顺序：先看内容，再做局部编辑，最后提交进入下一步。

---

## Global Rules

1. **配置问题先查运行时，不只看文件。**
2. **AI 调用成功不等于业务成功，必须检查 `content` 和 `finish_reason`。**
3. **结构化生成失败不能伪装成成功结果。**
4. **关键流程不使用误导性 fallback。**
5. **让用户重试前，必须明确这次重试验证什么。**
6. **能在后端脚本复现的问题，不应让用户反复点页面。**
7. **字段映射要逐层对齐：prompt -> 后端 -> API -> 前端 -> 存储。**
8. **涉及 token 限制时，应主动建议调整 `max_tokens` 或压缩 prompt。**
9. **列表编辑入口应贴近用户做出编辑判断的位置。**
10. **UI 控件面积要匹配操作权重，避免低频辅助操作抢占主要内容空间。**
