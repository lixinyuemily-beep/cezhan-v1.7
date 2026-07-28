"""
展品域数据库服务 - 展品知识库与项目展品
"""
import unicodedata
from typing import Dict, List, Optional

from ..config import settings
from .database import DatabaseClientProvider


class ExhibitsDatabaseService(DatabaseClientProvider):
    """展品域相关的数据访问能力。"""

    @staticmethod
    def _normalize_search_text(value: Optional[str]) -> str:
        return " ".join(
            unicodedata.normalize("NFKC", str(value or "")).strip().lower().split()
        )

    @classmethod
    def _normalize_key_text(cls, value: Optional[str]) -> str:
        normalized = cls._normalize_search_text(value)
        return "" if normalized in {"-", "—", "无", "暂无", "null", "none", "undefined"} else normalized

    @classmethod
    def _get_search_text(cls, exhibit: Dict) -> str:
        return " ".join(
            text for text in [
                cls._normalize_search_text(exhibit.get("id")),
                cls._normalize_search_text(exhibit.get("name")),
                cls._normalize_search_text(exhibit.get("time")),
                cls._normalize_search_text(exhibit.get("place")),
                cls._normalize_search_text(exhibit.get("material")),
                cls._normalize_search_text(exhibit.get("introduction")),
                cls._normalize_search_text(exhibit.get("other")),
                cls._normalize_search_text(exhibit.get("image_url")),
                cls._normalize_search_text(exhibit.get("thumbnail_url")),
            ] if text
        )

    @classmethod
    def _get_search_keywords(cls, keyword: str) -> List[str]:
        return [
            token for token in cls._normalize_search_text(keyword).split(" ")
            if token
        ]

    @classmethod
    def get_deduplication_key(cls, exhibit: Dict) -> str:
        # 图片上传后会生成新的存储 URL，同一展品重复导入时 URL 不稳定；
        # 去重以用户可感知的展品语义字段为准。
        return "|".join(
            cls._normalize_key_text(exhibit.get(field))
            for field in ("name", "time", "place", "material", "introduction", "other")
        )

    @classmethod
    def deduplicate_exhibits(cls, exhibits: List[Dict]) -> List[Dict]:
        seen_keys = set()
        unique_exhibits = []
        for exhibit in exhibits:
            key = cls.get_deduplication_key(exhibit)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            unique_exhibits.append(exhibit)
        return unique_exhibits

    @classmethod
    def get_exhibits(
        cls,
        project_id: Optional[str] = None,
        unit_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_exhibits).select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        if project_id:
            query = query.eq("project_id", project_id)
        if unit_id:
            query = query.eq("unit_id", unit_id)
        return query.execute().data or []

    @classmethod
    def get_all_exhibits(cls, user_id: Optional[str] = None) -> List[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_exhibits).select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        exhibits = query.order("created_at", desc=True).execute().data or []
        return cls.deduplicate_exhibits(exhibits)

    @classmethod
    def search_exhibits(cls, keyword: str, user_id: Optional[str] = None) -> List[Dict]:
        keywords = cls._get_search_keywords(keyword)
        if not keywords:
            return cls.get_all_exhibits(user_id)

        exhibits = cls.get_all_exhibits(user_id)
        matched = [
            exhibit for exhibit in exhibits
            if all(token in cls._get_search_text(exhibit) for token in keywords)
        ]
        return cls.deduplicate_exhibits(matched)

    @classmethod
    def get_exhibit(cls, exhibit_id: str, user_id: Optional[str] = None) -> Optional[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_exhibits).select("*").eq("id", exhibit_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.limit(1).execute()
        return result.data[0] if result.data else None

    @classmethod
    def find_duplicate_exhibit(cls, exhibit_data: Dict, user_id: Optional[str] = None) -> Optional[Dict]:
        target_key = cls.get_deduplication_key(exhibit_data)
        for exhibit in cls.get_all_exhibits(user_id):
            if cls.get_deduplication_key(exhibit) == target_key:
                return exhibit
        return None

    @classmethod
    def create_exhibit(cls, exhibit_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_exhibits).insert(exhibit_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def update_exhibit(
        cls,
        exhibit_id: str,
        exhibit_data: Dict,
        user_id: Optional[str] = None,
    ) -> Optional[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_exhibits).update(exhibit_data).eq("id", exhibit_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return result.data[0] if result.data else None

    @classmethod
    def delete_exhibit(cls, exhibit_id: str, user_id: Optional[str] = None) -> bool:
        client = cls.get_client()
        query = client.table(settings.table_exhibits).delete().eq("id", exhibit_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return bool(result.data)

    @classmethod
    def delete_all_exhibits(cls, user_id: Optional[str] = None) -> bool:
        client = cls.get_client()
        query = client.table(settings.table_exhibits).delete().neq("id", "00000000-0000-0000-0000-000000000000")
        if user_id:
            query = query.eq("user_id", user_id)
        query.execute()
        return True


exhibits_db = ExhibitsDatabaseService()
