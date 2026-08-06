"""
AI 服务 - DeepSeek API 调用 (OpenAI 兼容模式)
"""
import json
import re
import threading
import time
from typing import Optional, Dict, List, Any
from openai import OpenAI
from ..config import settings
from .. import prompts


class AIService:
    """DeepSeek AI 服务类 (使用 OpenAI 兼容模式)"""

    _ai_semaphore = threading.BoundedSemaphore(max(1, settings.ai_max_concurrent_requests))

    @staticmethod
    def _is_structure_only_unit(unit: Dict[str, Any]) -> bool:
        tag = str(unit.get("tag") or "").strip()
        return tag in {"序章", "尾声"}

    @staticmethod
    def _get_exhibit_time(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("time")
            or exhibit.get("era")
            or exhibit.get("年代")
            or exhibit.get("时间")
            or ""
        ).strip()

    @staticmethod
    def _get_exhibit_place(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("place")
            or exhibit.get("地点")
            or exhibit.get("origin")
            or exhibit.get("出土地")
            or exhibit.get("产地")
            or ""
        ).strip()

    @staticmethod
    def _get_exhibit_material(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("material")
            or exhibit.get("mat")
            or exhibit.get("材质")
            or ""
        ).strip()

    @staticmethod
    def _get_exhibit_other(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("other")
            or exhibit.get("size")
            or exhibit.get("sz")
            or exhibit.get("其他")
            or exhibit.get("尺寸")
            or ""
        ).strip()

    @staticmethod
    def _get_exhibit_intro(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("introduction")
            or exhibit.get("description")
            or exhibit.get("介绍")
            or exhibit.get("描述")
            or exhibit.get("简介")
            or ""
        ).strip()

    @staticmethod
    def _get_exhibit_name(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("name")
            or exhibit.get("名称")
            or exhibit.get("展品名称")
            or exhibit.get("文物名称")
            or ""
        ).strip()

    @staticmethod
    def _get_exhibit_id(exhibit: Dict[str, Any]) -> str:
        return str(
            exhibit.get("id")
            or exhibit.get("编号")
            or exhibit.get("ID")
            or exhibit.get("藏品号")
            or ""
        ).strip()

    @classmethod
    def _normalize_text(cls, value: Any) -> str:
        return re.sub(r"\s+", "", str(value or "").lower())

    @classmethod
    def _exhibit_identity(cls, exhibit: Dict[str, Any]) -> str:
        exhibit_id = cls._normalize_text(cls._get_exhibit_id(exhibit))
        if exhibit_id:
            return f"id:{exhibit_id}"
        name = cls._normalize_text(cls._get_exhibit_name(exhibit))
        time_text = cls._normalize_text(cls._get_exhibit_time(exhibit))
        material = cls._normalize_text(cls._get_exhibit_material(exhibit))
        place = cls._normalize_text(cls._get_exhibit_place(exhibit))
        return f"fallback:{name}|{time_text}|{material}|{place}"

    @classmethod
    def _exhibit_similarity_signature(cls, exhibit: Dict[str, Any]) -> str:
        name = cls._normalize_text(cls._get_exhibit_name(exhibit))
        # 去掉常见编号和括号内容，避免同一类展品带编号后被当成完全不同。
        name = re.sub(r"[（(].*?[）)]", "", name)
        name = re.sub(r"(之一|之二|之三|一|二|三|四|五|六|七|八|九|十|[0-9]+)$", "", name)
        material = cls._normalize_text(cls._get_exhibit_material(exhibit))
        time_text = cls._normalize_text(cls._get_exhibit_time(exhibit))
        return f"{name}|{material}|{time_text}"

    @classmethod
    def _tokenize_for_match(cls, value: Any) -> set:
        text = cls._normalize_text(value)
        tokens = set(re.findall(r"[\u4e00-\u9fff]{2,}|[a-z0-9]{2,}", text))
        # 中文短语没有分词库时，用 2-3 字滑窗补充，能覆盖“玉礼”“彩陶”等短词。
        chinese_text = "".join(re.findall(r"[\u4e00-\u9fff]+", text))
        for size in (2, 3):
            for index in range(0, max(0, len(chinese_text) - size + 1)):
                tokens.add(chinese_text[index:index + size])
        return tokens

    @classmethod
    def _score_exhibit_for_unit(cls, exhibit: Dict[str, Any], unit_theme: str, unit_description: str, narrative: Dict = None) -> float:
        narrative = narrative or {}
        unit_text = " ".join([
            str(unit_theme or ""),
            str(unit_description or ""),
            str(narrative.get("title", "") or ""),
            str(narrative.get("desc", "") or ""),
            str(narrative.get("logic", "") or ""),
        ])
        exhibit_text = " ".join([
            cls._get_exhibit_name(exhibit),
            cls._get_exhibit_time(exhibit),
            cls._get_exhibit_place(exhibit),
            cls._get_exhibit_material(exhibit),
            cls._get_exhibit_other(exhibit),
            cls._get_exhibit_intro(exhibit),
        ])
        unit_tokens = cls._tokenize_for_match(unit_text)
        exhibit_tokens = cls._tokenize_for_match(exhibit_text)
        overlap = unit_tokens & exhibit_tokens
        score = float(len(overlap) * 3)
        for field in (
            cls._get_exhibit_name(exhibit),
            cls._get_exhibit_time(exhibit),
            cls._get_exhibit_place(exhibit),
            cls._get_exhibit_material(exhibit),
        ):
            field_tokens = cls._tokenize_for_match(field)
            if unit_tokens & field_tokens:
                score += 2
        if cls._get_exhibit_intro(exhibit):
            score += 0.5
        return score

    @classmethod
    def _normalize_confidence(cls, confidence: Any = None, fallback_score: Optional[float] = None) -> int:
        if confidence is not None:
            try:
                numeric = int(round(float(confidence)))
                return max(1, min(5, numeric))
            except (TypeError, ValueError):
                pass
        if fallback_score is None:
            return 4
        if fallback_score >= 12:
            return 5
        if fallback_score >= 6:
            return 4
        if fallback_score > 0:
            return 3
        return 2

    @classmethod
    def _get_recommendation_confidence(cls, rec: Dict[str, Any], fallback_score: Optional[float] = None) -> int:
        return cls._normalize_confidence(
            rec.get("confidence")
            or rec.get("stars")
            or rec.get("score")
            or rec.get("rating"),
            fallback_score=fallback_score,
        )

    @classmethod
    def _format_recommended_exhibit(cls, exhibit: Dict[str, Any], confidence: Any = None, reason: str = "", fallback_score: Optional[float] = None) -> Dict[str, Any]:
        normalized_confidence = cls._normalize_confidence(confidence, fallback_score=fallback_score)
        return {
            **exhibit,
            "kept": True,
            "ctx": "AI推荐",
            "src": "AI推荐",
            "stars": normalized_confidence,
            "confidence": normalized_confidence,
            "reason": str(reason or "").strip(),
        }

    @classmethod
    def _describe_tension_level(cls, value: Any) -> str:
        """将数值张力映射为更可读的策展语义。"""
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            return "张力未知"

        if numeric_value >= 75:
            return "高张力"
        if numeric_value >= 55:
            return "偏高张力"
        if numeric_value >= 35:
            return "中段张力"
        return "低张力"

    @classmethod
    def _build_rhythm_instruction(
        cls,
        narrative_rhythm: Optional[Dict[str, Any]],
        section_type: str = "general"
    ) -> str:
        """将前端节奏配置转换为可读、可执行的提示词片段。"""
        if not narrative_rhythm:
            return ""
        if narrative_rhythm.get("enabled") is False:
            return ""

        points = narrative_rhythm.get("points") or []
        stages = narrative_rhythm.get("stages") or []
        summary = narrative_rhythm.get("summary") or ""

        if not points:
            return ""

        paired_points = []
        for index, value in enumerate(points):
            stage = stages[index] if index < len(stages) else f"阶段{index + 1}"
            paired_points.append(f"{stage}:{value}（{cls._describe_tension_level(value)}）")

        points_text = "，".join(paired_points)
        summary_text = f"\n- 节奏解读：{summary}" if summary else ""
        peak_value = max(points)
        valley_value = min(points)
        peak_stage = stages[points.index(peak_value)] if points.index(peak_value) < len(stages) else "高潮阶段"
        valley_stage = stages[points.index(valley_value)] if points.index(valley_value) < len(stages) else "低谷阶段"
        start_value = points[0]
        end_value = points[-1]

        if end_value > start_value + 12:
            trend_text = "整体走势为逐步抬升，后段应更有推进感与情绪聚焦。"
        elif end_value < start_value - 12:
            trend_text = "整体走势为由强转缓，后段应更注重沉淀、回看与收束。"
        else:
            trend_text = "整体走势较为均衡，应突出节奏层次而非单向拔高。"

        section_requirements = {
            "preface": (
                "- 这是展览序言，要重点承接前半段节奏：先建立背景与观看入口，再为后续高潮蓄势，避免一开篇就把情绪推满。\n"
                "- 序言结尾要形成明确的入场过渡，让观众自然进入第一单元。"
            ),
            "text_section": (
                "- 这是主体单元文案，要把节奏曲线落实到段落结构中：导言负责定位本单元在整条叙事线中的位置，重点展品解读负责推进、转折或聚焦，小结负责阶段性收束。\n"
                "- 当曲线进入高张力阶段时，语言更凝练、更具推进感；当曲线回落时，语言更沉着，更强调解释、回看与余味。"
            ),
            "epilogue": (
                "- 这是展览尾声，要承接高潮后的回响与收束，先提炼整场展览的精神重心，再将情绪缓缓落下，留下余韵而非再次另起高潮。\n"
                "- 尾声要与前文保持同一条节奏线，体现回望、升华和邀请再思考的结束感。"
            ),
            "general": (
                "- 请让文本结构与节奏阶段同步推进，不能只引用曲线而不落实到内容组织中。\n"
                "- 请让文风随张力变化：低张力阶段更舒展、说明性更强；高张力阶段更集中、句式更有推动力；转折处强化对比与视角切换。"
            ),
        }
        section_text = section_requirements.get(section_type, section_requirements["general"])

        return (
            "\n【叙事节奏要求】\n"
            "- 请参考用户在前端拖拽得到的节奏曲线来组织叙事推进。\n"
            f"- 各阶段张力值：{points_text}{summary_text}\n"
            f"- 节奏峰值出现在「{peak_stage}」，低谷出现在「{valley_stage}」。\n"
            f"- {trend_text}\n"
            "- 请同时控制“结构”和“文风”：段落安排、信息密度、句式长短、语气强弱都要服从这条曲线。\n"
            f"{section_text}\n"
            "- 生成内容时，不要机械复述这些规则，而要把它们内化为自然、连贯的策展表达。"
        )

    @classmethod
    def _sanitize_narrative_desc(cls, text: Any) -> str:
        """移除不适合直接暴露给用户的张力参数痕迹。"""
        desc = str(text or "").strip()
        if not desc:
            return ""

        desc = re.sub(r"[（(]\s*张力\s*[:：]?\s*\d+\s*[）)]", "", desc)
        desc = re.sub(r"张力\s*[:：]?\s*\d+", "", desc)
        desc = re.sub(r"(开场|铺垫|转折|深入|高潮|余韵)\s*[:：]?\s*\d+", r"\1", desc)
        desc = re.sub(r"[（(]\s*\d+\s*[）)]", "", desc)
        desc = re.sub(r"\s{2,}", " ", desc)
        desc = re.sub(r"([，、；。])[，、；。]+", r"\1", desc)
        return desc.strip(" ，,；;。")

    @staticmethod
    def _sanitize_narrative_title(text: Any) -> str:
        title = str(text or "").strip()
        title = re.sub(r"\s{2,}", " ", title)
        return title.strip(" \t\r\n-_:：，,。")
    
    @classmethod
    def _get_client(cls) -> OpenAI:
        """获取 OpenAI 客户端"""
        return OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=settings.ai_request_timeout_seconds,
        )

    @staticmethod
    def _log_ai(message: str) -> None:
        if settings.ai_debug_log_prompts:
            print(message)
    
    @classmethod
    def chat_completion(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> Dict[str, Any]:
        """
        调用 DeepSeek 模型进行对话补全
        
        Args:
            messages: 消息列表，格式为 [{"role": "user/assistant/system", "content": "..."}]
            model: 模型名称，默认使用环境变量 `DEEPSEEK_MODEL`
            temperature: 温度参数
            max_tokens: 最大 token 数
            **kwargs: 其他参数
        
        Returns:
            包含回复内容的字典
        """
        acquired = cls._ai_semaphore.acquire(timeout=settings.ai_queue_wait_timeout_seconds)
        if not acquired:
            raise TimeoutError("AI 服务当前并发较高，请稍后重试。")

        started_at = time.time()
        try:
            client = cls._get_client()
            resolved_model = model or settings.deepseek_model

            response = client.chat.completions.create(
                model=resolved_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
        finally:
            elapsed = time.time() - started_at
            print(f"[AI Service] chat_completion finished in {elapsed:.2f}s")
            cls._ai_semaphore.release()
        
        return {
            "content": response.choices[0].message.content,
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            }
        }
    
    @classmethod
    def generate_narrative_options(
        cls,
        theme: str,
        exhibit_count: int,
        exhibit_info: str,
        additional_intent: str = None,
        narrative_rhythm: Dict[str, Any] = None,
        unit_count: int = 3,
        temperature: float = 0.7
    ) -> List[Dict[str, str]]:
        """
        生成叙事方向方案
        
        Args:
            theme: 展览主题
            exhibit_count: 展品数量
            exhibit_info: 展品信息
            additional_intent: 补充策展意图
            unit_count: 单元数量
            temperature: AI温度参数
        
        Returns:
            叙事方案列表
        """
        random_suffix = str(int(time.time() * 1000))[-6:]
        normalized_theme = str(theme or "").strip()
        has_user_theme = bool(normalized_theme)
        theme_display = normalized_theme if has_user_theme else "（用户未填写，请基于展品池拟定题目）"
        theme_rule = (
            f'- 用户已提供展览主题，3个方案的title都必须直接使用「{normalized_theme}」，不要改字、不要扩写、不要另拟标题。'
            if has_user_theme else
            '- 用户未提供展览主题，请你基于展品池为每个方案拟定一个简洁、可展示的题目；3个方案的title必须彼此不同，且不能使用“策展主题”“未命名展览”“方案A”之类占位词。'
        )
        example_json = (
            f'[{{"title": "{normalized_theme}", "desc": "描述..."}}]'
            if has_user_theme else
            '[{"title": "玉礼与王朝秩序", "desc": "从礼制与权力象征切入，组织展品之间的制度线索。"}, {"title": "青铜时代的工艺回响", "desc": "从材料、铸造与纹饰演进切入，展现技术与审美的同步变化。"}]'
        )
        
        additional_info = f"\n补充策展意图：{additional_intent}" if additional_intent else ""
        rhythm_instruction = cls._build_rhythm_instruction(narrative_rhythm)
        system_prompt = prompts.NARRATIVE_SYSTEM + f"\n这是第{random_suffix}次请求，请给出独特的方案。建议设计{unit_count}个单元。"
        user_prompt = prompts.NARRATIVE_USER.format(
            theme=theme_display,
            exhibit_count=exhibit_count,
            exhibit_info=exhibit_info,
            additional_intent=additional_info,
            rhythm_instruction=rhythm_instruction,
            theme_rule=theme_rule,
            example_json=example_json,
        )
        
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature
        )
        
        try:
            content = result["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            options = json.loads(content.strip())
            normalized_options = []
            for index, option in enumerate(options[:3]):
                option_title = ""
                option_desc = ""
                if isinstance(option, dict):
                    option_title = cls._sanitize_narrative_title(option.get("title", ""))
                    option_desc = cls._sanitize_narrative_desc(option.get("desc", ""))
                normalized_options.append({
                    "title": normalized_theme if has_user_theme else (option_title or f"未命名方案 {index + 1}"),
                    "desc": option_desc
                })
            return normalized_options
        except Exception as e:
            if has_user_theme:
                return [
                    {"title": normalized_theme, "desc": "以文明交流为切入点，组织展品之间的互动关系。"},
                    {"title": normalized_theme, "desc": "以技术传播与工艺演进为主线，突出材料与制作方法的流动。"},
                    {"title": normalized_theme, "desc": "以艺术风格与审美共鸣为重点，强调不同地域之间的视觉呼应。"}
                ]
            return [
                {"title": "器物与文明的回声", "desc": "以文明交流为切入点，组织展品之间的互动关系。"},
                {"title": "工艺如何塑造时代", "desc": "以技术传播与工艺演进为主线，突出材料与制作方法的流动。"},
                {"title": "风格的迁徙与共鸣", "desc": "以艺术风格与审美共鸣为重点，强调不同地域之间的视觉呼应。"}
            ]
    
    @classmethod
    def generate_units(
        cls,
        narrative: Dict,
        exhibit_count: int,
        unit_count: int = 3,
        exhibit_list: List[Dict] = None,
        narrative_rhythm: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        生成展览单元结构
        
        Args:
            narrative: 选择的叙事方案
            exhibit_count: 展品数量
            unit_count: 单元数量
            exhibit_list: 展品列表
        
        Returns:
            单元列表
        """
        exhibit_list = exhibit_list or []
        exhibit_summary = "\n".join([
            f"- {ex.get('name', '未知展品')}: {cls._get_exhibit_time(ex)} {cls._get_exhibit_place(ex)} {cls._get_exhibit_material(ex)}"
            for ex in exhibit_list[:20]
        ])
        rhythm_instruction = cls._build_rhythm_instruction(narrative_rhythm)
        
        system_prompt = prompts.UNITS_SYSTEM
        user_prompt = prompts.UNITS_USER.format(
            narrative_title=narrative.get('title', ''),
            narrative_desc=narrative.get('desc', ''),
            narrative_logic=narrative.get('logic', ''),
            rhythm_instruction=rhythm_instruction,
            exhibit_count=exhibit_count,
            exhibit_list=exhibit_summary,
            unit_count=unit_count
        )
        
        cn_numbers = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]

        def regular_tag(index: int) -> str:
            if 1 <= index <= 10:
                return f"第{cn_numbers[index]}单元"
            return f"第{index}单元"

        expected_tags = ["序章"] + [regular_tag(i + 1) for i in range(max(unit_count, 0))] + ["尾声"]

        def compact_text(value: str, limit: int = 28) -> str:
            text = re.sub(r"\s+", "", str(value or "")).strip("，。；;、")
            return text[:limit]

        def fallback_unit_title(index: int, source: Dict[str, Any], expected_tag: str) -> str:
            if expected_tag in {"序章", "尾声"}:
                return expected_tag

            title_text = compact_text(source.get("title") or "")
            generic_titles = {
                "",
                expected_tag,
                "单元标题",
                "主题单元",
                "核心展示",
                "文化解读",
                "开篇",
                "总结",
            }
            if title_text and title_text not in generic_titles:
                return title_text

            for key in ("theme", "description", "narrative", "desc"):
                candidate = compact_text(source.get(key) or "")
                if candidate and candidate not in generic_titles:
                    return candidate[:18]

            return ""

        def fallback_item_count(index: int) -> int:
            if unit_count <= 0:
                return 0
            base = max(1, int(round(exhibit_count / unit_count)))
            return base

        def extract_units(value: Any) -> Optional[List[Dict[str, Any]]]:
            if isinstance(value, list):
                return value
            if not isinstance(value, dict):
                return None
            for key in ("units", "data", "result", "items", "sections"):
                nested = value.get(key)
                if isinstance(nested, list):
                    return nested
                if isinstance(nested, dict):
                    extracted = extract_units(nested)
                    if extracted:
                        return extracted
            return None

        def parse_units_content(content: str) -> List[Dict[str, Any]]:
            candidates = []

            if "```json" in content:
                candidates.append(content.split("```json", 1)[1].split("```", 1)[0].strip())
            if "```" in content:
                candidates.append(content.split("```", 1)[1].split("```", 1)[0].strip())
            candidates.append(content)

            list_start = content.find("[")
            list_end = content.rfind("]")
            if list_start != -1 and list_end != -1 and list_end > list_start:
                candidates.append(content[list_start:list_end + 1].strip())

            for candidate in candidates:
                if not candidate:
                    continue
                try:
                    parsed = json.loads(candidate)
                    parsed_units = extract_units(parsed)
                    if isinstance(parsed_units, list):
                        return parsed_units
                except Exception:
                    continue

            raise ValueError("units response is not a valid JSON array")

        def normalize_units(parsed_units: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            if len(parsed_units) < len(expected_tags):
                raise ValueError("units response has fewer units than expected")

            normalized_units: List[Dict[str, Any]] = []
            fallback_narratives = {
                "序章": "交代主题缘起与观看入口，为正文展开蓄势。",
                "尾声": "回望全文主旨，完成情绪收束与余韵延展。",
            }

            for index, expected_tag in enumerate(expected_tags):
                source = parsed_units[index] if index < len(parsed_units) and isinstance(parsed_units[index], dict) else {}
                if not source:
                    raise ValueError(f"unit {expected_tag} is missing")

                is_structure_only = expected_tag in {"序章", "尾声"}
                narrative_text = str(
                    source.get("narrative")
                    or source.get("desc")
                    or source.get("description")
                    or ""
                ).strip()
                description_text = str(
                    source.get("description")
                    or source.get("narrative")
                    or source.get("desc")
                    or ""
                ).strip()
                title_text = fallback_unit_title(index, source, expected_tag)

                if not is_structure_only and not title_text:
                    raise ValueError(f"unit {expected_tag} title is not meaningful")
                if not is_structure_only and not (narrative_text or description_text):
                    raise ValueError(f"unit {expected_tag} narrative is empty")

                normalized_unit: Dict[str, Any] = {
                    "tag": expected_tag,
                    "title": title_text or expected_tag,
                    "description": description_text or narrative_text or fallback_narratives.get(expected_tag, ""),
                    "narrative": narrative_text or description_text or fallback_narratives.get(expected_tag, ""),
                    "theme": str(source.get("theme") or "").strip(),
                }

                if not is_structure_only:
                    try:
                        normalized_unit["items"] = int(source.get("items") or 0) or fallback_item_count(index)
                    except Exception:
                        normalized_unit["items"] = fallback_item_count(index)

                normalized_units.append(normalized_unit)

            return normalized_units

        try:
            result = cls.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.4,
                max_tokens=1800,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            print(f"[AI Service] units json_object call failed, retrying without response_format: {e}")
            result = cls.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.4,
                max_tokens=1800,
            )

        try:
            content = str(result.get("content") or "").strip()
            return normalize_units(parse_units_content(content))
        except Exception as e:
            print(f"[AI Service] units generation failed: {e}")
            raise ValueError("单元结构生成失败：AI 未返回合格结构，请重新生成本步。")
    
    @classmethod
    def recommend_exhibits(
        cls,
        exhibit_pool: List[Dict],
        unit_theme: str,
        unit_description: str,
        narrative: Dict = None,
        min_count: int = 5,
        max_count: int = 10
    ) -> List[Dict[str, Any]]:
        """
        为单元推荐展品
        
        Args:
            exhibit_pool: 展品池
            unit_theme: 单元主题
            unit_description: 单元描述
            narrative: 叙事方案
            min_count: 建议最少推荐数量
            max_count: 最大推荐数量
        
        Returns:
            推荐展品列表（带置信度）
        """
        exhibit_info = "\n".join([
            f"{i+1}. {cls._get_exhibit_name(ex) or '未知'} ({cls._get_exhibit_time(ex)}, {cls._get_exhibit_place(ex)}, {cls._get_exhibit_material(ex)}) - {cls._get_exhibit_intro(ex)[:80]}"
            for i, ex in enumerate(exhibit_pool)
        ])
        
        if narrative is None:
            narrative = {}
        
        system_prompt = prompts.RECOMMEND_SYSTEM
        user_prompt = prompts.RECOMMEND_USER.format(
            unit_title=unit_theme,
            unit_desc=unit_description,
            narrative_title=narrative.get('title', ''),
            exhibit_pool=exhibit_info,
            total_exhibits=len(exhibit_pool),
            items_min_count=min_count,
            items_max_count=max_count,
            items_count=max_count
        )
        
        cls._log_ai(f"[AI Service] ====== SENDING TO AI ======")
        cls._log_ai(f"System: {system_prompt}")
        cls._log_ai(f"User: {user_prompt}")
        cls._log_ai(f"======================================")
        
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.5,
            max_tokens=1000
        )
        
        try:
            content = result["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            recommendations = json.loads(content.strip())
            
            cls._log_ai(f"[AI Service] Raw recommendations from AI: {recommendations}")
            cls._log_ai(f"[AI Service] max_count: {max_count}")
            
            recommended = []
            for rec in recommendations[:max_count]:
                idx = rec.get("exhibit_index", 0)
                pool_index = None
                original_index = None

                # 优先按提示词约定兼容 1-based 索引，同时兼容模型偶发返回 0-based 的情况
                if isinstance(idx, int) and 1 <= idx <= len(exhibit_pool):
                    pool_index = idx - 1
                    original_index = idx
                elif isinstance(idx, int) and 0 <= idx < len(exhibit_pool):
                    pool_index = idx
                    original_index = idx + 1

                if pool_index is not None:
                    exhibit = exhibit_pool[pool_index].copy()
                    fallback_score = cls._score_exhibit_for_unit(exhibit, unit_theme, unit_description, narrative)
                    exhibit["original_index"] = original_index
                    exhibit["confidence"] = cls._get_recommendation_confidence(rec, fallback_score=fallback_score)
                    exhibit["reason"] = str(rec.get("reason", "") or "").strip()
                    recommended.append(exhibit)
            
            return recommended
        except Exception as e:
            return [
                {
                    **ex,
                    "original_index": i + 1,
                    "confidence": cls._normalize_confidence(
                        fallback_score=cls._score_exhibit_for_unit(ex, unit_theme, unit_description, narrative)
                    ),
                    "reason": ""
                }
                for i, ex in enumerate(exhibit_pool[:max_count])
            ]
    
    @classmethod
    def recommend_exhibits_batch(
        cls,
        units: List[Dict],
        exhibit_pool: List[Dict],
        narrative: Dict
    ) -> Dict[str, Any]:
        """
        批量为所有单元推荐展品
        
        Args:
            units: 单元列表（每个单元包含items字段指定展品数量）
            exhibit_pool: 展品池
            narrative: 叙事方案
        
        Returns:
            包含recommendations和leftovers的字典
        """
        recommendations = {}
        used_indices = set()
        used_identities = set()
        used_similarity_signatures = set()

        def find_original_index(exhibit: Dict[str, Any]) -> Optional[int]:
            identity = cls._exhibit_identity(exhibit)
            for original_index, original_exhibit in enumerate(exhibit_pool):
                if original_index in used_indices:
                    continue
                if cls._exhibit_identity(original_exhibit) == identity:
                    return original_index
            return None

        def append_exhibit(
            unit_exhibits: List[Dict[str, Any]],
            exhibit: Dict[str, Any],
            confidence: Any = None,
            reason: str = "",
            allow_similar: bool = False,
            fallback_score: Optional[float] = None,
        ) -> bool:
            if len(unit_exhibits) >= unit_items:
                return False
            identity = cls._exhibit_identity(exhibit)
            if identity in used_identities:
                return False
            similarity_signature = cls._exhibit_similarity_signature(exhibit)
            if similarity_signature in used_similarity_signatures and not allow_similar:
                return False
            original_index = find_original_index(exhibit)
            if original_index is None:
                return False
            used_indices.add(original_index)
            used_identities.add(identity)
            if similarity_signature:
                used_similarity_signatures.add(similarity_signature)
            unit_exhibits.append(cls._format_recommended_exhibit(exhibit, confidence, reason, fallback_score=fallback_score))
            return True
        
        for idx, unit in enumerate(units):
            unit_theme = unit.get('title', '')
            unit_desc = unit.get('description') or unit.get('desc', '')
            unit_items_min = int(unit.get('itemsMin') or unit.get('items_min') or min(unit.get('items', 5), 5))
            unit_items = int(unit.get('itemsMax') or unit.get('items_max') or unit.get('items', 5))
            unit_items_min = max(0, min(unit_items_min, unit_items))

            future_min = 0
            for future_unit in units[idx + 1:]:
                if cls._is_structure_only_unit(future_unit):
                    continue
                future_max = int(future_unit.get('itemsMax') or future_unit.get('items_max') or future_unit.get('items', 5))
                future_unit_min = int(future_unit.get('itemsMin') or future_unit.get('items_min') or min(future_unit.get('items', 5), 5))
                future_min += max(0, min(future_unit_min, future_max))

            available_count = len(exhibit_pool) - len(used_indices)
            if future_min > 0 and available_count > unit_items_min:
                unit_items = min(unit_items, max(unit_items_min, available_count - future_min))
            
            cls._log_ai(f"[AI Service] Unit {idx}: {unit_theme}, items: {unit_items_min}-{unit_items}")
            
            unit_key = str(unit.get('id', idx))

            if cls._is_structure_only_unit(unit):
                recommendations[unit_key] = []
                cls._log_ai(f"[AI Service] Unit {idx}: skipped because it is {unit.get('tag')}")
                continue
            
            remaining_pool = [ex for i, ex in enumerate(exhibit_pool) if i not in used_indices]
            
            if len(remaining_pool) == 0:
                recommendations[unit_key] = []
                continue
            
            unit_recommendations = cls.recommend_exhibits(
                exhibit_pool=remaining_pool,
                unit_theme=unit_theme,
                unit_description=unit_desc,
                narrative=narrative,
                min_count=unit_items_min,
                max_count=unit_items
            )
            
            cls._log_ai(f"[AI Service] Unit {idx}: got {len(unit_recommendations)} recommendations")
            
            unit_exhibits = []
            for rec in unit_recommendations:
                # 使用 original_index 如果存在，否则使用 exhibit_index
                exhibit_idx = rec.get('original_index', rec.get('exhibit_index', 0))
                cls._log_ai(f"[AI Service] Processing rec: exhibit_idx={exhibit_idx}, remaining_pool len={len(remaining_pool)}")
                # 直接从 remaining_pool 获取展品
                if 0 < exhibit_idx <= len(remaining_pool):
                    ex = remaining_pool[exhibit_idx - 1]
                    cls._log_ai(f"[AI Service] Got exhibit: {cls._get_exhibit_name(ex)}")
                    fallback_score = cls._score_exhibit_for_unit(ex, unit_theme, unit_desc, narrative)
                    append_exhibit(
                        unit_exhibits,
                        ex,
                        confidence=cls._get_recommendation_confidence(rec, fallback_score=fallback_score),
                        reason=rec.get("reason", ""),
                        allow_similar=False,
                        fallback_score=fallback_score,
                    )
                else:
                    cls._log_ai(f"[AI Service] Index out of range! exhibit_idx={exhibit_idx}, remaining_pool len={len(remaining_pool)}")

            # AI 偶发少给、空给或给相似展品时，用代码按相关性补齐到下限。
            target_min = min(unit_items_min, unit_items, len(exhibit_pool) - len(used_indices) + len(unit_exhibits))
            if len(unit_exhibits) < target_min:
                fallback_candidates = []
                for original_index, exhibit in enumerate(exhibit_pool):
                    if original_index in used_indices:
                        continue
                    identity = cls._exhibit_identity(exhibit)
                    if identity in used_identities:
                        continue
                    signature = cls._exhibit_similarity_signature(exhibit)
                    score = cls._score_exhibit_for_unit(exhibit, unit_theme, unit_desc, narrative)
                    similarity_penalty = 1 if signature in used_similarity_signatures else 0
                    fallback_candidates.append((similarity_penalty, -score, original_index, exhibit))

                fallback_candidates.sort(key=lambda item: (item[0], item[1], item[2]))
                for similarity_penalty, negative_score, _, exhibit in fallback_candidates:
                    if len(unit_exhibits) >= target_min:
                        break
                    score = -negative_score
                    reason = "根据单元主题与展品信息自动补充，保证该单元展品数量与叙事覆盖。"
                    append_exhibit(
                        unit_exhibits,
                        exhibit,
                        confidence=None,
                        reason=reason,
                        allow_similar=bool(similarity_penalty),
                        fallback_score=score,
                    )
            
            recommendations[unit_key] = unit_exhibits
            cls._log_ai(f"[AI Service] Unit {idx}: final unit_exhibits count = {len(unit_exhibits)}")
        
        leftovers = [ex for i, ex in enumerate(exhibit_pool) if i not in used_indices]
        
        cls._log_ai(f"[AI Service] Final recommendations: {recommendations}")
        print(f"[AI Service] recommendations done: used_indices={len(used_indices)}, total_exhibits={len(exhibit_pool)}, leftovers={len(leftovers)}")
        
        return {
            "recommendations": recommendations,
            "leftovers": leftovers
        }
    
    @classmethod
    def generate_text_section(
        cls,
        unit: Dict,
        exhibits: List[Dict],
        narrative: Dict,
        narrative_rhythm: Dict[str, Any] = None
    ) -> str:
        """
        生成单元文本内容
        
        Args:
            unit: 单元信息
            exhibits: 单元展品列表
            narrative: 叙事方案
        
        Returns:
            HTML格式的文本内容
        """
        exhibit_info = "\n".join([
            f"- {ex.get('name', '未知')}: 时间={cls._get_exhibit_time(ex)}；地点={cls._get_exhibit_place(ex)}；材质={cls._get_exhibit_material(ex)}；其他={cls._get_exhibit_other(ex)}；介绍={cls._get_exhibit_intro(ex)}"
            for ex in exhibits
        ])
        rhythm_instruction = cls._build_rhythm_instruction(narrative_rhythm, section_type="text_section")
        
        system_prompt = prompts.TEXT_SYSTEM
        user_prompt = prompts.TEXT_USER.format(
            unit_title=unit.get('title', ''),
            unit_desc=unit.get('description', ''),
            exhibit_names=exhibit_info,
            narrative_title=narrative.get('title', ''),
            rhythm_instruction=rhythm_instruction
        )
        
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        return result["content"]

    @staticmethod
    def _strip_json_fence(content: str) -> str:
        text = str(content or "").strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    @classmethod
    def generate_text_sections_batch(
        cls,
        exhibition_title: str,
        sections: List[Dict],
        kept_exhibits: Dict[str, List[Dict]],
        narrative: Dict,
        narrative_rhythm: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        sections_meta = []
        for index, section in enumerate(sections or []):
            section_key = str(section.get("key") if section.get("key") is not None else index)
            section_kind = str(section.get("kind") or section.get("type") or "unit").strip()
            unit = section.get("unit") if isinstance(section.get("unit"), dict) else {}
            title = section.get("title") or unit.get("title") or f"段落 {index + 1}"
            unit_exhibits = (
                section.get("exhibits")
                if isinstance(section.get("exhibits"), list)
                else kept_exhibits.get(section_key) or kept_exhibits.get(str(unit.get("id"))) or []
            )
            sections_meta.append({
                "key": section_key,
                "title": title,
                "kind": section_kind,
                "description": section.get("description") or unit.get("description") or unit.get("desc") or unit.get("narrative") or "",
                "exhibits": unit_exhibits,
            })

        if not sections_meta:
            raise ValueError("整套文本生成失败：缺少 sections 参数。")

        def summarize_exhibit(exhibit: Dict[str, Any]) -> str:
            intro = cls._get_exhibit_intro(exhibit)
            if len(intro) > 140:
                intro = intro[:140] + "..."
            return (
                f"- {exhibit.get('name') or '未知展品'}；"
                f"年代={cls._get_exhibit_time(exhibit)}；"
                f"地点={cls._get_exhibit_place(exhibit)}；"
                f"材质={cls._get_exhibit_material(exhibit)}；"
                f"介绍={intro}"
            )

        section_blocks = []
        for section in sections_meta:
            kind = str(section["kind"]).lower()
            if kind in {"unit", "text_section", "section", "主体单元"}:
                exhibit_lines = "\n".join(summarize_exhibit(exhibit) for exhibit in section.get("exhibits", [])[:10])
                section_blocks.append(
                    f"key: {section['key']}\n"
                    f"title: {section['title']}\n"
                    f"type: 主体单元\n"
                    f"description: {section.get('description', '')}\n"
                    f"exhibits:\n{exhibit_lines or '- 无'}"
                )
            else:
                section_blocks.append(
                    f"key: {section['key']}\n"
                    f"title: {section['title']}\n"
                    f"type: {section['kind']}"
                )

        rhythm_instruction = cls._build_rhythm_instruction(narrative_rhythm, section_type="text_section")
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": prompts.TEXT_BATCH_SYSTEM},
                {"role": "user", "content": prompts.TEXT_BATCH_USER.format(
                    exhibition_title=exhibition_title,
                    narrative_title=narrative.get("title", ""),
                    narrative_desc=narrative.get("desc", ""),
                    rhythm_instruction=rhythm_instruction,
                    sections_input="\n\n".join(section_blocks),
                )}
            ],
            temperature=0.65,
            max_tokens=8000,
        )

        raw_content = cls._strip_json_fence(result["content"])
        try:
            data = json.loads(raw_content)
        except Exception:
            match = re.search(r"\{[\s\S]*\}", raw_content)
            if not match:
                raise ValueError("整套文本生成失败：模型未返回 JSON。")
            data = json.loads(match.group(0))

        sections = data.get("sections")
        if not isinstance(sections, list):
            raise ValueError("整套文本生成失败：模型返回缺少 sections。")

        expected_keys = [section["key"] for section in sections_meta]
        by_key = {str(section.get("key")): section for section in sections if section.get("key") is not None}
        missing_keys = [key for key in expected_keys if key not in by_key]
        if missing_keys:
            raise ValueError(f"整套文本生成失败：缺少段落 {', '.join(missing_keys)}。")

        normalized = []
        for meta in sections_meta:
            section = by_key[meta["key"]]
            text = str(section.get("text") or "").strip()
            if not text:
                raise ValueError(f"整套文本生成失败：段落 {meta['title']} 内容为空。")
            if not text.startswith("<"):
                text = f"<p>{text}</p>"
            exhibits = section.get("exhibits") if isinstance(section.get("exhibits"), list) else []
            normalized.append({
                "key": meta["key"],
                "title": section.get("title") or meta["title"],
                "text": text,
                "exhibits": exhibits,
                "edited": False,
            })

        return normalized
    
    @classmethod
    def generate_preface(
        cls,
        exhibition_title: str,
        narrative: Dict,
        unit_count: int,
        narrative_rhythm: Dict[str, Any] = None
    ) -> str:
        """
        生成展览序言
        
        Args:
            exhibition_title: 展览标题
            narrative: 叙事方案
            unit_count: 单元数量
        
        Returns:
            HTML格式的序言内容
        """
        rhythm_instruction = cls._build_rhythm_instruction(narrative_rhythm, section_type="preface")
        system_prompt = prompts.PREFACE_SYSTEM
        user_prompt = prompts.PREFACE_USER.format(
            exhibition_title=exhibition_title,
            narrative_title=narrative.get('title', ''),
            narrative_desc=narrative.get('desc', ''),
            unit_count=unit_count,
            rhythm_instruction=rhythm_instruction
        )
        
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        content = result["content"]
        try:
            json_match = content.strip()
            if json_match.startswith("```json"):
                json_match = json_match[7:]
            if json_match.startswith("```"):
                json_match = json_match[3:]
            if json_match.endswith("```"):
                json_match = json_match[:-3]
            json_match = json_match.strip()
            data = json.loads(json_match)
            return f"<p>{data.get('content', '')}</p>"
        except Exception:
            return f"<p>{content}</p>"
    
    @classmethod
    def generate_epilogue(
        cls,
        exhibition_title: str,
        narrative: Dict,
        unit_count: int,
        narrative_rhythm: Dict[str, Any] = None
    ) -> str:
        """
        生成展览尾声
        
        Args:
            exhibition_title: 展览标题
            narrative: 叙事方案
            unit_count: 单元数量
        
        Returns:
            HTML格式的尾声内容
        """
        rhythm_instruction = cls._build_rhythm_instruction(narrative_rhythm, section_type="epilogue")
        system_prompt = prompts.EPILOGUE_SYSTEM
        user_prompt = prompts.EPILOGUE_USER.format(
            exhibition_title=exhibition_title,
            narrative_title=narrative.get('title', ''),
            narrative_desc=narrative.get('desc', ''),
            unit_count=unit_count,
            rhythm_instruction=rhythm_instruction
        )
        
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        content = result["content"]
        try:
            json_match = content.strip()
            if json_match.startswith("```json"):
                json_match = json_match[7:]
            if json_match.startswith("```"):
                json_match = json_match[3:]
            if json_match.endswith("```"):
                json_match = json_match[:-3]
            json_match = json_match.strip()
            data = json.loads(json_match)
            return f"<p>{data.get('content', '')}</p>"
        except Exception:
            return f"<p>{content}</p>"
    
    @classmethod
    def generate_outline(
        cls,
        units: List[Dict],
        text_sections: List[Dict],
        narrative: Dict
    ) -> Dict[str, Any]:
        """
        生成展览大纲
        
        Args:
            units: 单元列表
            text_sections: 文本段落列表
            narrative: 叙事方案
        
        Returns:
            大纲结构
        """
        units_info = "\n".join([
            f"- {u.get('tag', '')}: {u.get('title', '')}"
            for u in units
        ])
        
        sections_info = "\n".join([
            f"- {s.get('title', '')}"
            for s in text_sections
        ])
        theme = narrative.get('title', '展览')
        
        system_prompt = prompts.OUTLINE_SYSTEM
        user_prompt = prompts.OUTLINE_USER.format(
            theme=theme,
            narrative_title=narrative.get('title', ''),
            narrative_desc=narrative.get('desc', ''),
            units_summary=f"{units_info}\n\n相关文本段落：\n{sections_info}"
        )
        
        result = cls.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.6,
            max_tokens=2000
        )
        
        try:
            content = result["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            return json.loads(content.strip())
        except Exception as e:
            return {
                "title": f"展览：{narrative.get('title', '展览')}",
                "toc": [{"id": f"unit{i+1}", "title": u.get("title", ""), "page": i+1} for i, u in enumerate(units)],
                "sections": {}
            }


ai_service = AIService()
