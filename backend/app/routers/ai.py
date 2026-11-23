"""
AI API 路由 - 元景大模型调用
"""
import asyncio
import json
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from ..models.schemas import (
    NarrativeRequest, NarrativeResponse,
    UnitsRequest, UnitsResponse,
    RecommendRequest, RecommendResponse,
    BatchRecommendRequest, BatchRecommendResponse,
    TextSectionRequest as TextSectionReq,
    TextSectionResponse as TextSectionResp,
    TextSectionsBatchRequest, TextSectionsBatchResponse,
    OutlineRequest, OutlineResponse
)
from ..services.ai_service import ai_service
from ..services.ai_unit_task_service import ai_unit_task_service

router = APIRouter(prefix="/ai", tags=["AI"])
_background_unit_tasks = set()


async def run_ai_call(func, *args, **kwargs):
    """在线程中执行同步 AI 调用，避免阻塞 FastAPI 事件循环。"""
    return await asyncio.to_thread(func, *args, **kwargs)


@router.post("/narrative", response_model=NarrativeResponse)
async def generate_narrative(request: NarrativeRequest):
    """生成叙事方向方案"""
    try:
        options = await run_ai_call(
            ai_service.generate_narrative_options,
            theme=request.theme,
            exhibit_count=request.exhibit_count,
            exhibit_info=request.exhibit_info,
            additional_intent=request.additional_intent,
            narrative_rhythm=request.narrative_rhythm,
            unit_count=request.unit_count or 3,
            temperature=request.temperature,
            option_count=request.option_count,
        )
        return NarrativeResponse(options=options)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/units", response_model=UnitsResponse)
async def generate_units(request: UnitsRequest):
    """生成展览单元结构"""
    try:
        units = await run_ai_call(
            ai_service.generate_units,
            narrative=request.narrative,
            exhibit_count=request.exhibit_count,
            unit_count=request.unit_count or 3,
            exhibit_list=request.exhibit_list,
            narrative_rhythm=request.narrative_rhythm
        )
        return UnitsResponse(units=units)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _run_units_task(task_id: str, request: UnitsRequest) -> None:
    ai_unit_task_service.mark_running(task_id)
    try:
        units = await run_ai_call(
            ai_service.generate_units,
            narrative=request.narrative,
            exhibit_count=request.exhibit_count,
            unit_count=request.unit_count or 3,
            exhibit_list=request.exhibit_list,
            narrative_rhythm=request.narrative_rhythm,
        )
        ai_unit_task_service.mark_success(task_id, units)
    except Exception as error:
        ai_unit_task_service.mark_failed(task_id, error)


@router.post("/units/tasks")
async def start_units_task(request: UnitsRequest):
    """创建单元结构后台任务；每个任务只调用模型一次。"""
    task = ai_unit_task_service.create()
    background_task = asyncio.create_task(_run_units_task(task["task_id"], request))
    _background_unit_tasks.add(background_task)
    background_task.add_done_callback(_background_unit_tasks.discard)
    return task


@router.get("/units/tasks/{task_id}")
async def get_units_task(task_id: str):
    """短轮询查询单元结构后台任务。"""
    try:
        task = ai_unit_task_service.get(task_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
    if not task:
        raise HTTPException(status_code=404, detail="单元结构生成任务不存在或已过期")
    return task


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_exhibits(request: RecommendRequest):
    """推荐展品"""
    try:
        recommendations = await run_ai_call(
            ai_service.recommend_exhibits,
            exhibit_pool=request.exhibit_pool,
            unit_theme=request.unit_theme,
            unit_description=request.unit_description,
            min_count=request.min_count,
            max_count=request.max_count
        )
        return RecommendResponse(recommendations=recommendations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend-batch", response_model=BatchRecommendResponse)
async def recommend_exhibits_batch(request: BatchRecommendRequest):
    """批量为所有单元推荐展品"""
    try:
        result = await run_ai_call(
            ai_service.recommend_exhibits_batch,
            units=request.units,
            exhibit_pool=request.exhibit_pool,
            narrative=request.narrative
        )
        return BatchRecommendResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text-section", response_model=TextSectionResp)
async def generate_text_section(request: TextSectionReq):
    """生成单元文本内容"""
    try:
        content = await run_ai_call(
            ai_service.generate_text_section,
            unit=request.unit,
            exhibits=request.exhibits,
            narrative=request.narrative,
            narrative_rhythm=request.narrative_rhythm,
            revision_instruction=request.revision_instruction,
            current_text=request.current_text
        )
        return TextSectionResp(content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text-sections-batch", response_model=TextSectionsBatchResponse)
async def generate_text_sections_batch(request: TextSectionsBatchRequest):
    """一次性生成 Step4 全部策展文本，优先保证全文逻辑连贯"""
    try:
        sections = await run_ai_call(
            ai_service.generate_text_sections_batch,
            exhibition_title=request.exhibition_title,
            sections=request.sections,
            kept_exhibits=request.kept_exhibits,
            narrative=request.narrative,
            narrative_rhythm=request.narrative_rhythm
        )
        return TextSectionsBatchResponse(sections=sections)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExhibitWritingRequest(BaseModel):
    action: Literal["draft", "infer_rule"]
    exhibits: List[Dict[str, Any]] = Field(default_factory=list, max_length=100)
    instruction: str = Field(default="", max_length=10000)
    original: str = Field(default="", max_length=10000)
    edited: str = Field(default="", max_length=10000)


def _normalize_exhibit_statement(statement, sources):
    if not isinstance(statement, dict) or not isinstance(statement.get("text"), str):
        raise ValueError("invalid exhibit statement")
    text = statement["text"].strip()
    if not text:
        raise ValueError("empty exhibit statement")
    references = []
    candidates = statement.get("references")
    for candidate in candidates if isinstance(candidates, list) else []:
        if not isinstance(candidate, dict):
            continue
        source_id, field = candidate.get("source_id"), candidate.get("field")
        if not isinstance(source_id, str) or not isinstance(field, str):
            continue
        source = sources.get(source_id)
        if not source:
            continue
        value = source["fields"].get(field)
        if not isinstance(value, str) or not value.strip():
            continue
        reference = {
            "sourceId": source_id, "field": field, "label": source["label"],
            "locator": source["locator"], "value": value,
        }
        if reference not in references:
            references.append(reference)
    kind = "interpretation" if statement.get("kind") == "interpretation" else "fact"
    return {"text": text, "kind": kind, "references": references}


def _build_exhibit_description(entry, exhibit):
    source_records = exhibit.get("source_records")
    if not isinstance(source_records, list):
        source_records = []
    sources = {
        str(source["id"]): source for source in source_records
        if isinstance(source, dict) and source.get("id")
        and isinstance(source.get("label"), str) and source["label"].strip()
        and isinstance(source.get("locator"), str) and source["locator"].strip()
        and isinstance(source.get("fields"), dict)
    }
    statements = entry.get("statements")
    if isinstance(statements, list) and statements:
        judgments = [_normalize_exhibit_statement(statement, sources) for statement in statements]
    else:
        # Older model output is still readable, with no reference treated as verified.
        judgments = [_normalize_exhibit_statement({"text": entry.get("text")}, sources)]
    return {
        "key": str(exhibit["entryKey"]),
        "text": "".join(judgment["text"] for judgment in judgments),
        "judgments": judgments,
    }


@router.post("/exhibit-descriptions")
async def write_exhibit_descriptions(request: ExhibitWritingRequest):
    if request.action == "infer_rule":
        prompt = (
            "逐项归纳策展人编辑样稿时作出的表达调整。每条给出写法和是否可迁移到其他展品。"
            "只针对该件展品的事实或术语解释设为 reusable=false，禁止补造内容。"
            '只返回 JSON 数组，例如 [{"text":"年代放在第一句","reusable":true}]。'
        )
        context = {"original": request.original, "edited": request.edited}
    else:
        if not request.exhibits:
            raise HTTPException(status_code=422, detail="请选择有资料的展品")
        prompt = (
            "依据提供的馆藏资料写展品说明，每件一条，不得补造事实。"
            "按用户确认的写法写作。将正文拆为有序、完整带标点的句子，每句单独标出类型及依据。"
            "fact 是可核对的事实，interpretation 是需策展人判断的阐释或推断。"
            "依据只填这件展品提供的 source_records 中真实存在的 id 和 fields 键。无法对应就用空数组。"
            '只返回 JSON 数组，每项为 {"key":"对应 entryKey","statements":[{"text":"一句正文。",'
            '"kind":"fact","references":[{"source_id":"资料 id","field":"字段键"}]}]}。'
        )
        context = {"exhibits": request.exhibits, "instruction": request.instruction}
    result = await run_ai_call(
        ai_service.chat_completion,
        messages=[{"role": "system", "content": prompt},
                  {"role": "user", "content": json.dumps(context, ensure_ascii=False)}],
        temperature=0.4,
        max_tokens=6000,
    )
    content = str(result.get("content") or "").strip()
    if request.action == "infer_rule":
        try:
            suggestions = json.loads(ai_service._strip_json_fence(content))
            if not isinstance(suggestions, list):
                raise ValueError("expected a list")
            rules = [
                {"text": item["text"].strip(), "reusable": item.get("reusable") is True}
                for item in suggestions[:12]
                if isinstance(item, dict) and isinstance(item.get("text"), str) and item["text"].strip()
            ]
            if rules:
                return {"rules": rules}
        except (ValueError, TypeError):
            pass
        raise HTTPException(status_code=502, detail="未能逐项归纳写法，请重试")
    try:
        entries = json.loads(ai_service._strip_json_fence(content))
        exhibits = {str(item["entryKey"]): item for item in request.exhibits}
        if not isinstance(entries, list) or len(entries) != len(exhibits) or len(exhibits) != len(request.exhibits):
            raise ValueError("unexpected entry count")
        by_key = {str(item["key"]): item for item in entries}
        if set(by_key) != set(exhibits):
            raise ValueError("unexpected entry keys")
        return [_build_exhibit_description(by_key[key], exhibit) for key, exhibit in exhibits.items()]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail="展品说明结果与请求的展品不匹配")


class NarrativeComparisonRequest(BaseModel):
    options: List[Dict[str, Any]] = Field(min_length=2, max_length=8)
    records: List[Dict[str, str]] = Field(default_factory=list, max_length=200)
    unit_count: int = Field(default=3, ge=1, le=20)


@router.post("/narrative-comparison")
async def compare_narrative_options(request: NarrativeComparisonRequest):
    prompt = (
        "为提供的每个叙事方向拟定可比较的概要，保持输入顺序和各方向主旨。"
        "每个方向给出单元划分、各单元论点、拟用展品、资料缺口。"
        "展品只能使用资料中的 key。不要推荐某方向，不补造资料。"
        '只输出 JSON 数组，每项为 {"units":[{"title":"单元标题","claim":"论点",'
        '"record_keys":["资料 key"]}],"gaps":["资料缺口"]}。'
    )
    result = await run_ai_call(
        ai_service.chat_completion,
        messages=[{"role": "system", "content": prompt},
                  {"role": "user", "content": json.dumps(request.model_dump(), ensure_ascii=False)}],
        temperature=0.4,
        max_tokens=6000,
    )
    try:
        overviews = json.loads(ai_service._strip_json_fence(result.get("content")))
        if not isinstance(overviews, list) or len(overviews) != len(request.options):
            raise ValueError("incorrect overview count")
        records = {item["key"]: item["name"] for item in request.records}
        return [{
            "units": [{
                "title": unit["title"], "claim": unit["claim"],
                "exhibits": [records[key] for key in unit["record_keys"]],
            } for unit in overview["units"]],
            "gaps": overview["gaps"],
        } for overview in overviews]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail="概要与方案或展品资料不匹配")


@router.post("/preface")
async def generate_preface(exhibition_title: str, unit_count: int, narrative_title: str = "", narrative_desc: str = "", narrative_rhythm: Optional[str] = None):
    """生成展览序言"""
    try:
        narrative = {"title": narrative_title, "desc": narrative_desc}
        rhythm = json.loads(narrative_rhythm) if narrative_rhythm else None
        content = await run_ai_call(
            ai_service.generate_preface,
            exhibition_title=exhibition_title,
            narrative=narrative,
            unit_count=unit_count,
            narrative_rhythm=rhythm
        )
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/epilogue")
async def generate_epilogue(exhibition_title: str, unit_count: int, narrative_title: str = "", narrative_desc: str = "", narrative_rhythm: Optional[str] = None):
    """生成展览尾声"""
    try:
        narrative = {"title": narrative_title, "desc": narrative_desc}
        rhythm = json.loads(narrative_rhythm) if narrative_rhythm else None
        content = await run_ai_call(
            ai_service.generate_epilogue,
            exhibition_title=exhibition_title,
            narrative=narrative,
            unit_count=unit_count,
            narrative_rhythm=rhythm
        )
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outline", response_model=OutlineResponse)
async def generate_outline(request: OutlineRequest):
    """生成展览大纲"""
    try:
        outline = await run_ai_call(
            ai_service.generate_outline,
            units=request.units,
            text_sections=request.text_sections,
            narrative=request.narrative
        )
        return OutlineResponse(outline=outline)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def ai_health():
    """AI 服务健康检查"""
    return {"status": "ok", "service": "deepseek"}
