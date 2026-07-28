"""
AI API 路由 - 元景大模型调用
"""
import asyncio
import json
from typing import Optional
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

router = APIRouter(prefix="/ai", tags=["AI"])


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
            temperature=request.temperature
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
            narrative_rhythm=request.narrative_rhythm
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
