"""
项目域数据库服务 - 项目、单元、完成项目、文本段落
"""
from typing import Any, Dict, List, Optional

from ..config import settings
from .database import DatabaseClientProvider


class ProjectsDatabaseService(DatabaseClientProvider):
    """项目域相关的数据访问能力。"""

    PROJECT_SNAPSHOT_FIELDS = [
        "id",
        "user_id",
        "title",
        "theme",
        "narrative",
        "narrative_options",
        "step",
        "status",
        "exhibit_count",
        "time",
        "exhibition_title",
        "uploaded_exhibits",
        "units",
        "kept_exhibits",
        "text_sections",
        "exhibit_confirmations",
        "selected_narrative",
        "llm_params",
        "created_at",
        "updated_at",
    ]

    @classmethod
    def _build_project_snapshot(cls, project: Optional[Dict]) -> Dict[str, Any]:
        if not project:
            return {}
        return {
            field: project.get(field)
            for field in cls.PROJECT_SNAPSHOT_FIELDS
            if field in project
        }

    @classmethod
    def _get_next_project_version(cls, project_id: str) -> int:
        client = cls.get_client()
        result = (
            client.table(settings.table_project_versions)
            .select("version")
            .eq("project_id", project_id)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
        latest = result.data[0]["version"] if result.data else 0
        return int(latest or 0) + 1

    @classmethod
    def record_project_version(
        cls,
        project_id: str,
        user_id: Optional[str],
        snapshot_type: str,
        snapshot: Dict[str, Any],
        previous_snapshot: Optional[Dict[str, Any]] = None,
        changed_fields: Optional[List[str]] = None,
        source: str = "system",
    ) -> Optional[Dict]:
        client = cls.get_client()
        version_data = {
            "project_id": project_id,
            "user_id": user_id,
            "version": cls._get_next_project_version(project_id),
            "snapshot_type": snapshot_type,
            "source": source,
            "changed_fields": changed_fields or [],
            "previous_snapshot": previous_snapshot,
            "snapshot": snapshot,
        }
        result = client.table(settings.table_project_versions).insert(version_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def try_record_project_version(cls, *args, **kwargs) -> Optional[Dict]:
        try:
            return cls.record_project_version(*args, **kwargs)
        except Exception as e:
            print(f"[project_versions] failed to record version: {e}")
            return None

    @classmethod
    def get_projects(cls, user_id: Optional[str] = None) -> List[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_projects).select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        return query.order("created_at", desc=True).execute().data or []

    @classmethod
    def get_project(cls, project_id: str, user_id: Optional[str] = None) -> Optional[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_projects).select("*").eq("id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return result.data[0] if result.data else None

    @classmethod
    def create_project(cls, project_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_projects).insert(project_data).execute()
        project = result.data[0] if result.data else None
        if project:
            cls.try_record_project_version(
                project_id=project["id"],
                user_id=project.get("user_id"),
                snapshot_type="original",
                snapshot=cls._build_project_snapshot(project),
                source="project_create",
            )
        return project

    @classmethod
    def update_project(
        cls,
        project_id: str,
        project_data: Dict,
        user_id: Optional[str] = None,
    ) -> Optional[Dict]:
        client = cls.get_client()
        previous_project = cls.get_project(project_id, user_id)
        query = client.table(settings.table_projects).update(project_data).eq("id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        updated_project = result.data[0] if result.data else None
        if updated_project:
            cls.try_record_project_version(
                project_id=project_id,
                user_id=updated_project.get("user_id") or user_id,
                snapshot_type="revision",
                snapshot=cls._build_project_snapshot(updated_project),
                previous_snapshot=cls._build_project_snapshot(previous_project),
                changed_fields=sorted(project_data.keys()),
                source="project_update",
            )
        return updated_project

    @classmethod
    def delete_project(cls, project_id: str, user_id: Optional[str] = None) -> bool:
        client = cls.get_client()
        query = client.table(settings.table_projects).delete().eq("id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return bool(result.data)

    @classmethod
    def get_units(cls, project_id: str) -> List[Dict]:
        client = cls.get_client()
        result = (
            client.table(settings.table_units)
            .select("*")
            .eq("project_id", project_id)
            .order("order")
            .execute()
        )
        return result.data or []

    @classmethod
    def get_unit(cls, unit_id: str) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_units).select("*").eq("id", unit_id).limit(1).execute()
        return result.data[0] if result.data else None

    @classmethod
    def create_unit(cls, unit_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_units).insert(unit_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def update_unit(cls, unit_id: str, unit_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_units).update(unit_data).eq("id", unit_id).execute()
        return result.data[0] if result.data else None

    @classmethod
    def delete_unit(cls, unit_id: str) -> bool:
        client = cls.get_client()
        result = client.table(settings.table_units).delete().eq("id", unit_id).execute()
        return bool(result.data)

    @classmethod
    def create_completed_project(cls, project_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_completed_projects).insert(project_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def get_completed_projects(cls, user_id: Optional[str] = None) -> List[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_completed_projects).select("*")
        if user_id:
            return query.eq("user_id", user_id).order("created_at", desc=True).execute().data or []
        return query.order("created_at", desc=True).execute().data or []

    @classmethod
    def get_completed_project(
        cls,
        project_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_completed_projects).select("*").eq("project_id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        if result.data:
            return result.data[0]

        query = client.table(settings.table_completed_projects).select("*").eq("id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return result.data[0] if result.data else None

    @classmethod
    def delete_completed_project(cls, project_id: str, user_id: Optional[str] = None) -> bool:
        client = cls.get_client()
        query = client.table(settings.table_completed_projects).delete().eq("project_id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        if result.data:
            return True

        query = client.table(settings.table_completed_projects).delete().eq("id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return bool(result.data)

    @classmethod
    def get_project_versions(
        cls,
        project_id: str,
        user_id: Optional[str] = None,
    ) -> List[Dict]:
        client = cls.get_client()
        query = client.table(settings.table_project_versions).select("*").eq("project_id", project_id)
        if user_id:
            query = query.eq("user_id", user_id)
        return query.order("version").execute().data or []

    @classmethod
    def get_text_sections(cls, project_id: str) -> List[Dict]:
        client = cls.get_client()
        result = (
            client.table(settings.table_text_sections)
            .select("*")
            .eq("project_id", project_id)
            .order("order")
            .execute()
        )
        return result.data or []

    @classmethod
    def get_text_section(cls, section_id: str) -> Optional[Dict]:
        client = cls.get_client()
        result = (
            client.table(settings.table_text_sections)
            .select("*")
            .eq("id", section_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    @classmethod
    def create_text_section(cls, section_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_text_sections).insert(section_data).execute()
        return result.data[0] if result.data else None

    @classmethod
    def update_text_section(cls, section_id: str, section_data: Dict) -> Optional[Dict]:
        client = cls.get_client()
        result = client.table(settings.table_text_sections).update(section_data).eq("id", section_id).execute()
        return result.data[0] if result.data else None

    @classmethod
    def delete_text_section(cls, section_id: str) -> bool:
        client = cls.get_client()
        result = client.table(settings.table_text_sections).delete().eq("id", section_id).execute()
        return bool(result.data)


projects_db = ProjectsDatabaseService()
