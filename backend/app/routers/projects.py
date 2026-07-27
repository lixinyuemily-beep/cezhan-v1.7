"""
项目 API 路由
"""
from typing import List, Optional
from fastapi import APIRouter, Header, HTTPException, Query
from ..models.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    UnitCreate, UnitUpdate, UnitResponse,
    TextSectionCreate, TextSectionUpdate, TextSectionResponse,
    MessageResponse
)
from ..services.database_projects_service import projects_db
from ..services.request_user_service import request_user_service

router = APIRouter(prefix="/projects", tags=["项目"])


def _require_authenticated_user_id(
    authorization: Optional[str],
    user_id: Optional[str] = None,
) -> str:
    authenticated_user_id = request_user_service.get_authenticated_user_id(authorization)
    if not authenticated_user_id:
        raise HTTPException(status_code=401, detail="请先登录后访问项目数据")
    normalized_user_id = str(user_id or "").strip()
    if normalized_user_id and normalized_user_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="不能访问其他用户的项目数据")
    return authenticated_user_id


# ==================== 项目操作 ====================

@router.get("")
async def get_projects(
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """获取项目列表"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        projects = projects_db.get_projects(effective_user_id)
        return projects
    except HTTPException:
        raise
    except Exception as e:
        print(e)  # 打印详细错误信息
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}")
async def get_project(project_id: str, authorization: Optional[str] = Header(None)):
    """获取单个项目"""
    user_id = _require_authenticated_user_id(authorization)
    project = projects_db.get_project(project_id, user_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.post("", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, authorization: Optional[str] = Header(None)):
    """创建新项目"""
    try:
        user_id = _require_authenticated_user_id(authorization, project.user_id)
        project_data = project.model_dump()
        project_data["user_id"] = user_id
        new_project = projects_db.create_project(project_data)
        return new_project
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project: ProjectUpdate, authorization: Optional[str] = Header(None)):
    """更新项目"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        update_data = {k: v for k, v in project.model_dump().items() if v is not None}
        updated = projects_db.update_project(project_id, update_data, user_id)
        if not updated:
            raise HTTPException(status_code=404, detail="项目不存在")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(project_id: str, authorization: Optional[str] = Header(None)):
    """删除项目"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        success = projects_db.delete_project(project_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="项目不存在")
        return MessageResponse(message="项目删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 完成项目操作 ====================

@router.post("/{project_id}/complete", response_model=MessageResponse)
async def complete_project(project_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """完成项目，保存到完成项目表"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        project = projects_db.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        completed_data = {
            "project_id": project_id,
            "user_id": user_id,
            "title": project.get("title", ""),
            "narrative_title": data.get("narrative_title", ""),
            "units": data.get("units", []),
            "text_sections": data.get("text_sections", []),
            "kept_exhibits": data.get("kept_exhibits", []),
            "exhibition_title": data.get("exhibition_title", ""),
            "narrative": data.get("narrative", {}),
            "narrative_options": data.get("narrative_options", []),
            "selected_narrative": data.get("selected_narrative", 0),
            "llm_params": data.get("llm_params", {}),
            "uploaded_exhibits": data.get("uploaded_exhibits", []),
            "exhibit_confirmations": data.get("exhibit_confirmations", {}),
        }
        
        completed_project = projects_db.create_completed_project(completed_data)
        final_snapshot = {
            **projects_db._build_project_snapshot(project),
            "completed_project_id": completed_project.get("id") if completed_project else None,
            "status": "completed",
            "narrative_title": completed_data["narrative_title"],
            "units": completed_data["units"],
            "text_sections": completed_data["text_sections"],
            "kept_exhibits": completed_data["kept_exhibits"],
            "exhibition_title": completed_data["exhibition_title"],
            "narrative": completed_data["narrative"],
            "narrative_options": completed_data["narrative_options"],
            "selected_narrative": completed_data["selected_narrative"],
            "llm_params": completed_data["llm_params"],
            "uploaded_exhibits": completed_data["uploaded_exhibits"],
            "exhibit_confirmations": completed_data["exhibit_confirmations"],
        }
        projects_db.try_record_project_version(
            project_id=project_id,
            user_id=user_id,
            snapshot_type="final",
            snapshot=final_snapshot,
            previous_snapshot=projects_db._build_project_snapshot(project),
            changed_fields=sorted(completed_data.keys()),
            source="project_complete",
        )
        
        projects_db.delete_project(project_id, user_id)
        
        return MessageResponse(message="项目已完成")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/completed/list", response_model=List[dict])
async def get_completed_projects(
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """获取已完成项目列表"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        projects = projects_db.get_completed_projects(effective_user_id)
        return projects
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/completed/{project_id}", response_model=dict)
async def get_completed_project(project_id: str, authorization: Optional[str] = Header(None)):
    """获取已完成项目详情"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        project = projects_db.get_completed_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="完成项目不存在")
        return project
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/versions", response_model=List[dict])
async def get_project_versions(project_id: str, authorization: Optional[str] = Header(None)):
    """获取项目的原始、过程和最终版本快照"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        versions = projects_db.get_project_versions(project_id, user_id)
        if not versions:
            current_project = projects_db.get_project(project_id, user_id)
            completed_project = projects_db.get_completed_project(project_id, user_id)
            if not current_project and not completed_project:
                raise HTTPException(status_code=404, detail="项目不存在")
        return versions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/completed/{project_id}", response_model=MessageResponse)
async def delete_completed_project(project_id: str, authorization: Optional[str] = Header(None)):
    """删除已完成项目"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        success = projects_db.delete_completed_project(project_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="完成项目不存在")
        return MessageResponse(message="完成项目删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 单元操作 ====================

@router.get("/{project_id}/units", response_model=List[UnitResponse])
async def get_units(project_id: str, authorization: Optional[str] = Header(None)):
    """获取项目的所有单元"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        project = projects_db.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        units = projects_db.get_units(project_id)
        return units
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/units", response_model=UnitResponse)
async def create_unit(unit: UnitCreate, authorization: Optional[str] = Header(None)):
    """创建单元"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        project = projects_db.get_project(unit.project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        unit_data = unit.model_dump()
        new_unit = projects_db.create_unit(unit_data)
        return new_unit
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/units/{unit_id}", response_model=UnitResponse)
async def update_unit(unit_id: str, unit: UnitUpdate, authorization: Optional[str] = Header(None)):
    """更新单元"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        existing_unit = projects_db.get_unit(unit_id)
        if not existing_unit:
            raise HTTPException(status_code=404, detail="单元不存在")
        project = projects_db.get_project(existing_unit.get("project_id"), user_id)
        if not project:
            raise HTTPException(status_code=404, detail="单元不存在")
        update_data = {k: v for k, v in unit.model_dump().items() if v is not None}
        updated = projects_db.update_unit(unit_id, update_data)
        if not updated:
            raise HTTPException(status_code=404, detail="单元不存在")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/units/{unit_id}", response_model=MessageResponse)
async def delete_unit(unit_id: str, authorization: Optional[str] = Header(None)):
    """删除单元"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        existing_unit = projects_db.get_unit(unit_id)
        if not existing_unit:
            raise HTTPException(status_code=404, detail="单元不存在")
        project = projects_db.get_project(existing_unit.get("project_id"), user_id)
        if not project:
            raise HTTPException(status_code=404, detail="单元不存在")
        success = projects_db.delete_unit(unit_id)
        if not success:
            raise HTTPException(status_code=404, detail="单元不存在")
        return MessageResponse(message="单元删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 文本段落操作 ====================

@router.get("/{project_id}/text-sections", response_model=List[TextSectionResponse])
async def get_text_sections(project_id: str, authorization: Optional[str] = Header(None)):
    """获取项目的所有文本段落"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        project = projects_db.get_project(project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        sections = projects_db.get_text_sections(project_id)
        return sections
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text-sections", response_model=TextSectionResponse)
async def create_text_section(section: TextSectionCreate, authorization: Optional[str] = Header(None)):
    """创建文本段落"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        project = projects_db.get_project(section.project_id, user_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        section_data = section.model_dump()
        new_section = projects_db.create_text_section(section_data)
        return new_section
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/text-sections/{section_id}", response_model=TextSectionResponse)
async def update_text_section(section_id: str, section: TextSectionUpdate, authorization: Optional[str] = Header(None)):
    """更新文本段落"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        existing_section = projects_db.get_text_section(section_id)
        if not existing_section:
            raise HTTPException(status_code=404, detail="文本段落不存在")
        project = projects_db.get_project(existing_section.get("project_id"), user_id)
        if not project:
            raise HTTPException(status_code=404, detail="文本段落不存在")
        update_data = {k: v for k, v in section.model_dump().items() if v is not None}
        updated = projects_db.update_text_section(section_id, update_data)
        if not updated:
            raise HTTPException(status_code=404, detail="文本段落不存在")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/text-sections/{section_id}", response_model=MessageResponse)
async def delete_text_section(section_id: str, authorization: Optional[str] = Header(None)):
    """删除文本段落"""
    try:
        user_id = _require_authenticated_user_id(authorization)
        existing_section = projects_db.get_text_section(section_id)
        if not existing_section:
            raise HTTPException(status_code=404, detail="文本段落不存在")
        project = projects_db.get_project(existing_section.get("project_id"), user_id)
        if not project:
            raise HTTPException(status_code=404, detail="文本段落不存在")
        success = projects_db.delete_text_section(section_id)
        if not success:
            raise HTTPException(status_code=404, detail="文本段落不存在")
        return MessageResponse(message="文本段落删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
