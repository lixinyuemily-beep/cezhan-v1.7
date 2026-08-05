"""
展品 API 路由
"""
from typing import List, Optional
from fastapi import APIRouter, File, Header, HTTPException, Query, UploadFile
from ..models.schemas import (
    ExhibitCreate, ExhibitUpdate, ExhibitResponse, ExhibitBatchCreateResponse, MessageResponse
)
from ..services.database_exhibits_service import exhibits_db
from ..services.exhibit_import_service import exhibit_import_service
from ..services.request_user_service import request_user_service
from ..services.storage_service import storage_service

router = APIRouter(prefix="/exhibits", tags=["展品"])


def _require_authenticated_user_id(
    authorization: Optional[str],
    user_id: Optional[str] = None,
) -> str:
    authenticated_user_id = request_user_service.get_authenticated_user_id(authorization)
    if not authenticated_user_id:
        raise HTTPException(status_code=401, detail="请先登录后访问展品数据")
    normalized_user_id = str(user_id or "").strip()
    if normalized_user_id and normalized_user_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="不能访问其他用户的展品数据")
    return authenticated_user_id


@router.get("", response_model=List[ExhibitResponse])
async def get_exhibits(
    project_id: Optional[str] = Query(None, description="项目ID"),
    unit_id: Optional[str] = Query(None, description="单元ID"),
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """获取展品列表"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        exhibits = exhibits_db.get_exhibits(project_id, unit_id, effective_user_id)
        return exhibits
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", response_model=List[ExhibitResponse])
async def get_all_exhibits(
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """获取当前用户的展品知识库"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        exhibits = exhibits_db.get_all_exhibits(effective_user_id)
        return exhibits
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/all", response_model=MessageResponse)
async def delete_all_exhibits(
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """清空当前用户所有展品"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        exhibits = exhibits_db.get_all_exhibits(effective_user_id)
        storage_paths = [
            path for exhibit in exhibits
            for path in (exhibit.get("storage_path"), exhibit.get("thumbnail_storage_path"))
            if path
        ]
        storage_service.remove_files(storage_paths)
        exhibits_db.delete_all_exhibits(effective_user_id)
        return {"success": True, "message": "已清空所有展品"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=List[ExhibitResponse])
async def search_exhibits(
    keyword: str = Query(..., description="搜索关键词"),
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """搜索展品"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        exhibits = exhibits_db.search_exhibits(keyword, effective_user_id)
        return exhibits
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-template")
async def parse_exhibit_template(
    file: UploadFile = File(...),
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """解析固定模板展品表格"""
    effective_user_id = _require_authenticated_user_id(authorization, user_id)
    return await exhibit_import_service.parse_upload(file, effective_user_id)


@router.get("/parse-template-tasks/{task_id}")
async def get_parse_exhibit_template_task(
    task_id: str,
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """查询异步解析任务状态"""
    effective_user_id = _require_authenticated_user_id(authorization, user_id)
    return await exhibit_import_service.get_parse_task(task_id, effective_user_id)


@router.get("/{exhibit_id}", response_model=ExhibitResponse)
async def get_exhibit(
    exhibit_id: str,
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """获取单个展品"""
    effective_user_id = _require_authenticated_user_id(authorization, user_id)
    exhibit = exhibits_db.get_exhibit(exhibit_id, effective_user_id)
    if not exhibit:
        raise HTTPException(status_code=404, detail="展品不存在")
    return exhibit


@router.post("", response_model=ExhibitResponse)
async def create_exhibit(
    exhibit: ExhibitCreate,
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """创建展品"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, exhibit.user_id or user_id)
        exhibit_data = exhibit.model_dump()
        exhibit_data["user_id"] = effective_user_id
        duplicate = exhibits_db.find_duplicate_exhibit(exhibit_data, effective_user_id)
        if duplicate:
            return duplicate
        new_exhibit = exhibits_db.create_exhibit(exhibit_data)
        return new_exhibit
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{exhibit_id}", response_model=ExhibitResponse)
async def update_exhibit(
    exhibit_id: str,
    exhibit: ExhibitUpdate,
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """更新展品"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        update_data = {k: v for k, v in exhibit.model_dump().items() if v is not None}
        current = exhibits_db.get_exhibit(exhibit_id, effective_user_id)
        if not current:
            raise HTTPException(status_code=404, detail="展品不存在")
        candidate = {**current, **update_data}
        candidate["user_id"] = effective_user_id
        duplicate = exhibits_db.find_duplicate_exhibit(candidate, effective_user_id)
        if duplicate and duplicate.get("id") != exhibit_id:
            return duplicate
        updated = exhibits_db.update_exhibit(exhibit_id, update_data, effective_user_id)
        if not updated:
            raise HTTPException(status_code=404, detail="展品不存在")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{exhibit_id}", response_model=MessageResponse)
async def delete_exhibit(
    exhibit_id: str,
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """删除展品"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        exhibit = exhibits_db.get_exhibit(exhibit_id, effective_user_id)
        if not exhibit:
            raise HTTPException(status_code=404, detail="展品不存在")
        storage_service.remove_files([exhibit.get("storage_path"), exhibit.get("thumbnail_storage_path")])
        success = exhibits_db.delete_exhibit(exhibit_id, effective_user_id)
        if not success:
            raise HTTPException(status_code=404, detail="展品不存在")
        return MessageResponse(message="展品删除成功")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=ExhibitBatchCreateResponse)
async def create_exhibits_batch(
    exhibits: List[ExhibitCreate],
    user_id: Optional[str] = Query(None, description="用户ID"),
    authorization: Optional[str] = Header(None),
):
    """批量创建展品"""
    try:
        effective_user_id = _require_authenticated_user_id(authorization, user_id)
        created = []
        duplicate_count = 0
        input_duplicate_count = 0
        existing_keys = {
            exhibits_db.get_deduplication_key(exhibit)
            for exhibit in exhibits_db.get_all_exhibits(effective_user_id)
        }
        seen_input_keys = set()
        for exhibit in exhibits:
            exhibit_data = exhibit.model_dump()
            exhibit_data["user_id"] = effective_user_id
            deduplication_key = exhibits_db.get_deduplication_key(exhibit_data)
            if deduplication_key in seen_input_keys:
                input_duplicate_count += 1
                continue
            seen_input_keys.add(deduplication_key)
            if deduplication_key in existing_keys:
                duplicate_count += 1
                continue
            new_exhibit = exhibits_db.create_exhibit(exhibit_data)
            if new_exhibit:
                existing_keys.add(deduplication_key)
                created.append(new_exhibit)
        return ExhibitBatchCreateResponse(
            exhibits=created,
            created_count=len(created),
            duplicate_count=duplicate_count,
            input_duplicate_count=input_duplicate_count,
            total_count=len(exhibits),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
