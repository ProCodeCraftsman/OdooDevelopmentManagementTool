import ssl
import xmlrpc.client
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class OdooModule:
    id: int
    name: str
    shortdesc: Optional[str]
    installed_version: Optional[str]
    state: str


class OdooClient:
    def __init__(self, url: str, db: str, user: str, password: str):
        self.url = url.rstrip("/")
        self.db = db
        self.username = user
        self.password = password
        self.uid: Optional[int] = None
        self._models: Optional[xmlrpc.client.ServerProxy] = None

    def _get_proxy(self, endpoint: str) -> xmlrpc.client.ServerProxy:
        context = ssl._create_unverified_context()
        return xmlrpc.client.ServerProxy(
            f"{self.url}/xmlrpc/2/{endpoint}", context=context
        )

    def connect(self) -> bool:
        try:
            common = self._get_proxy("common")
            self.uid = common.authenticate(self.db, self.username, self.password, {})
            if self.uid:
                self._models = self._get_proxy("object")
                return True
            return False
        except Exception:
            return False

    def fetch_modules(self) -> List[OdooModule]:
        if not self.uid or not self._models:
            raise ConnectionError("Not connected to Odoo server")

        m_fields = ["id", "name", "shortdesc", "installed_version", "state"]
        modules_data = self._models.execute_kw(
            self.db,
            self.uid,
            self.password,
            "ir.module.module",
            "search_read",
            [[]],
            {"fields": m_fields},
        )

        modules = []
        for m in modules_data:
            modules.append(
                OdooModule(
                    id=m.get("id"),
                    name=m.get("name", ""),
                    shortdesc=m.get("shortdesc"),
                    installed_version=m.get("installed_version"),
                    state=m.get("state", "unknown"),
                )
            )
        return modules

    def fetch_raw_data(self) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if not self.uid or not self._models:
            raise ConnectionError("Not connected to Odoo server")

        m_fields = ["id", "name", "shortdesc", "installed_version", "state"]
        modules = self._models.execute_kw(
            self.db,
            self.uid,
            self.password,
            "ir.module.module",
            "search_read",
            [[]],
            {"fields": m_fields},
        )

        d_fields = ["module_id", "name"]
        deps = self._models.execute_kw(
            self.db,
            self.uid,
            self.password,
            "ir.module.module.dependency",
            "search_read",
            [[]],
            {"fields": d_fields},
        )

        return modules, deps
