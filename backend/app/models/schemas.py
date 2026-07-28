"""
Pydantic 模型 - 请求和响应数据结构定义
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ==================== 认证模型 ====================

class EmailAuthRequest(BaseModel):
    """发送邮箱验证码"""
    email: str = Field(..., description="邮箱")


class EmailOtpVerifyRequest(BaseModel):
    """校验邮箱验证码并登录"""
    email: str = Field(..., description="邮箱")
    code: str = Field(..., description="邮箱验证码")


# ==================== 项目模型 ====================

class ProjectBase(BaseModel):
    """项目基础模型"""
    title: str = Field(..., description="项目标题")
    user_id: Optional[str] = Field(None, description="用户ID")
    theme: Optional[str] = Field(None, description="展览主题")
    narrative: Optional[Dict[str, Any]] = Field(None, description="叙事方案")
    narrative_options: Optional[List[Dict[str, Any]]] = Field(None, description="叙事方案选项")
    llm_params: Optional[Dict[str, Any]] = Field(None, description="LLM参数")
    step: int = Field(1, description="当前步骤")
    status: str = Field("in_progress", description="项目状态")
    exhibit_count: Optional[int] = Field(None, description="展品数量")
    selected_narrative: Optional[int] = Field(None, description="选中的叙事方案索引")
    exhibition_title: Optional[str] = Field(None, description="展览标题")
    uploaded_exhibits: Optional[List[Dict[str, Any]]] = Field(None, description="上传的展品")
    units: Optional[List[Dict[str, Any]]] = Field(None, description="单元列表")
    kept_exhibits: Optional[Dict[str, Any]] = Field(None, description="保留的展品")
    text_sections: Optional[List[Dict[str, Any]]] = Field(None, description="文本段落")
    exhibit_confirmations: Optional[Dict[str, Any]] = Field(None, description="展品确认")
    time: Optional[str] = Field(None, description="最近编辑时间")


class ProjectCreate(ProjectBase):
    """创建项目请求"""
    pass


class ProjectUpdate(BaseModel):
    """更新项目请求"""
    title: Optional[str] = None
    theme: Optional[str] = None
    narrative: Optional[Dict[str, Any]] = None
    narrative_options: Optional[List[Dict[str, Any]]] = None
    step: Optional[int] = None
    status: Optional[str] = None
    exhibit_count: Optional[int] = None
    time: Optional[str] = None
    selected_narrative: Optional[int] = None
    llm_params: Optional[Dict[str, Any]] = None
    units: Optional[List[Dict[str, Any]]] = None
    kept_exhibits: Optional[Dict[str, Any]] = None
    exhibition_title: Optional[str] = None
    uploaded_exhibits: Optional[List[Dict[str, Any]]] = None
    text_sections: Optional[List[Dict[str, Any]]] = None
    exhibit_confirmations: Optional[Dict[str, Any]] = None


class ProjectResponse(ProjectBase):
    """项目响应"""
    id: str = Field(..., description="项目ID")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# ==================== 单元模型 ====================

class UnitBase(BaseModel):
    """单元基础模型"""
    project_id: str = Field(..., description="项目ID")
    tag: str = Field(..., description="单元标签，如'第一单元'")
    title: str = Field(..., description="单元标题")
    description: Optional[str] = Field(None, description="单元描述")
    theme: Optional[str] = Field(None, description="单元主题关键词")
    order: int = Field(0, description="排序顺序")
    confirmed: bool = Field(False, description="是否已确认")


class UnitCreate(UnitBase):
    """创建单元请求"""
    pass


class UnitUpdate(BaseModel):
    """更新单元请求"""
    tag: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None
    order: Optional[int] = None
    confirmed: Optional[bool] = None
    items: Optional[int] = Field(None, description="展品数量")


class UnitResponse(UnitBase):
    """单元响应"""
    id: str = Field(..., description="单元ID")
    items: Optional[int] = Field(None, description="展品数量")

    class Config:
        from_attributes = True


# ==================== 展品模型 ====================

class ExhibitBase(BaseModel):
    """展品基础模型"""
    user_id: Optional[str] = Field(None, description="用户ID")
    project_id: Optional[str] = Field(None, description="项目ID")
    unit_id: Optional[str] = Field(None, description="单元ID")
    name: str = Field(..., description="展品名称")
    time: Optional[str] = Field(None, description="时间")
    place: Optional[str] = Field(None, description="地点")
    material: Optional[str] = Field(None, description="材质")
    introduction: Optional[str] = Field(None, description="介绍")
    image_url: Optional[str] = Field(None, description="图片")
    thumbnail_url: Optional[str] = Field(None, description="缩略图")
    storage_bucket: Optional[str] = Field(None, description="图片所在存储桶")
    storage_path: Optional[str] = Field(None, description="图片存储路径")
    thumbnail_storage_path: Optional[str] = Field(None, description="缩略图存储路径")
    other: Optional[str] = Field(None, description="其他信息")
    weight: Optional[int] = Field(None, description="推荐权重")
    source: Optional[str] = Field(None, description="来源")
    confidence: Optional[int] = Field(None, description="置信度")
    kept: bool = Field(True, description="是否保留")
    manual: bool = Field(False, description="是否手动添加")


class ExhibitCreate(ExhibitBase):
    """创建展品请求"""
    pass


class ExhibitUpdate(BaseModel):
    """更新展品请求"""
    name: Optional[str] = None
    time: Optional[str] = None
    place: Optional[str] = None
    material: Optional[str] = None
    introduction: Optional[str] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    storage_bucket: Optional[str] = None
    storage_path: Optional[str] = None
    thumbnail_storage_path: Optional[str] = None
    other: Optional[str] = None
    weight: Optional[int] = None
    source: Optional[str] = None
    confidence: Optional[int] = None
    kept: Optional[bool] = None
    unit_id: Optional[str] = None


class ExhibitResponse(ExhibitBase):
    """展品响应"""
    id: str = Field(..., description="展品ID")

    class Config:
        from_attributes = True


# ==================== 文本段落模型 ====================

class TextSectionBase(BaseModel):
    """文本段落基础模型"""
    project_id: str = Field(..., description="项目ID")
    unit_id: Optional[str] = Field(None, description="单元ID")
    title: str = Field(..., description="段落标题")
    content: str = Field(..., description="HTML内容")
    order: int = Field(0, description="排序顺序")
    is_ai: bool = Field(True, description="是否AI生成")
    edited: bool = Field(False, description="是否被编辑")


class TextSectionCreate(TextSectionBase):
    """创建文本段落请求"""
    pass


class TextSectionUpdate(BaseModel):
    """更新文本段落请求"""
    title: Optional[str] = None
    content: Optional[str] = None
    order: Optional[int] = None
    edited: Optional[bool] = None


class TextSectionResponse(TextSectionBase):
    """文本段落响应"""
    id: str = Field(..., description="段落ID")

    class Config:
        from_attributes = True


# ==================== AI 请求/响应模型 ====================

class NarrativeRequest(BaseModel):
    """生成叙事方向请求"""
    theme: str = Field(..., description="展览主题")
    exhibit_count: int = Field(..., description="展品数量")
    exhibit_info: str = Field(..., description="展品信息摘要")
    additional_intent: Optional[str] = Field(None, description="补充策展意图")
    narrative_rhythm: Optional[Dict[str, Any]] = Field(None, description="叙事节奏配置")
    unit_count: Optional[int] = Field(3, description="单元数量")
    temperature: Optional[float] = Field(0.9, description="AI温度参数，控制生成随机性")


class NarrativeResponse(BaseModel):
    """叙事方向响应"""
    options: List[Dict[str, str]] = Field(..., description="叙事方案列表")


class UnitsRequest(BaseModel):
    """生成单元结构请求"""
    narrative: Dict[str, str] = Field(..., description="选择的叙事方案")
    exhibit_count: int = Field(..., description="展品数量")
    unit_count: Optional[int] = Field(3, description="单元数量")
    exhibit_list: List[Dict[str, Any]] = Field(..., description="展品列表")
    narrative_rhythm: Optional[Dict[str, Any]] = Field(None, description="叙事节奏配置")


class UnitsResponse(BaseModel):
    """单元结构响应"""
    units: List[Dict[str, Any]] = Field(..., description="单元列表")


class RecommendRequest(BaseModel):
    """推荐展品请求"""
    exhibit_pool: List[Dict[str, Any]] = Field(..., description="展品池")
    unit_theme: str = Field(..., description="单元主题")
    unit_description: str = Field(..., description="单元描述")
    min_count: int = Field(5, description="建议最少推荐数量")
    max_count: int = Field(10, description="最大推荐数量")


class RecommendResponse(BaseModel):
    """推荐展品响应"""
    recommendations: List[Dict[str, Any]] = Field(..., description="推荐展品列表")


class BatchRecommendRequest(BaseModel):
    """批量推荐展品请求"""
    units: List[Dict[str, Any]] = Field(..., description="单元列表")
    exhibit_pool: List[Dict[str, Any]] = Field(..., description="展品池")
    narrative: Dict[str, str] = Field(..., description="叙事方案")


class BatchRecommendResponse(BaseModel):
    """批量推荐展品响应"""
    recommendations: Dict[str, List[Dict[str, Any]]] = Field(..., description="每个单元的推荐展品，key为单元id")
    leftovers: List[Dict[str, Any]] = Field(..., description="未被推荐的剩余展品")


class TextSectionRequest(BaseModel):
    """生成文本内容请求"""
    unit: Dict[str, Any] = Field(..., description="单元信息")
    exhibits: List[Dict[str, Any]] = Field(..., description="展品列表")
    narrative: Dict[str, str] = Field(..., description="叙事方案")
    narrative_rhythm: Optional[Dict[str, Any]] = Field(None, description="叙事节奏配置")


class TextSectionResponse(BaseModel):
    """生成文本内容响应"""
    content: str = Field(..., description="HTML格式的文本内容")


class TextSectionsBatchRequest(BaseModel):
    """批量生成 Step4 全部文本请求"""
    exhibition_title: str = Field(..., description="展览标题")
    sections: List[Dict[str, Any]] = Field(..., description="需要生成的文本段落配置")
    kept_exhibits: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict, description="各单元已确认展品")
    narrative: Dict[str, Any] = Field(default_factory=dict, description="叙事方案")
    narrative_rhythm: Optional[Dict[str, Any]] = Field(None, description="叙事节奏配置")


class TextSectionsBatchResponse(BaseModel):
    """批量生成 Step4 全部文本响应"""
    sections: List[Dict[str, Any]] = Field(..., description="Step4 文本段落")


class OutlineRequest(BaseModel):
    """生成大纲请求"""
    units: List[Dict[str, Any]] = Field(..., description="单元列表")
    text_sections: List[Dict[str, Any]] = Field(..., description="文本段落列表")
    narrative: Dict[str, str] = Field(..., description="叙事方案")


class OutlineResponse(BaseModel):
    """生成大纲响应"""
    outline: Dict[str, Any] = Field(..., description="大纲结构")


# ==================== 通用响应模型 ====================

class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str = Field(..., description="消息内容")
    success: bool = Field(True, description="是否成功")


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误信息")
    detail: Optional[str] = Field(None, description="详细错误信息")
