import logging
import socket
import ssl
import xmlrpc.client
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

_XMLRPC_TIMEOUT = 30  # seconds per XML-RPC call


class _TimeoutTransport(xmlrpc.client.SafeTransport):
    """SafeTransport with a per-connection socket timeout.

    The parent Transport.make_connection() passes ``timeout=self.timeout`` to
    HTTPSConnection.__init__().  We override the *instance* attribute so the
    parent picks it up — setting conn.timeout after make_connection() is too
    late because the socket has not been created yet.
    """

    def __init__(self, timeout: int, context: ssl.SSLContext):
        super().__init__(context=context)
        self.timeout = timeout  # shadows Transport.timeout class attribute

logger = logging.getLogger(__name__)


@dataclass
class OdooModule:
    id: int
    name: str
    shortdesc: Optional[str]
    installed_version: Optional[str]
    state: str
    # {dep_technical_name: dep_state_from_odoo}
    # version field does not exist on ir.module.module.dependency in Odoo 17
    dependencies: Dict[str, Optional[str]]
    # {dep_technical_name: installed_version} — resolved via self-lookup against modules_data
    dependency_versions: Dict[str, Optional[str]]


class OdooClient:
    def __init__(self, url: str, db: str, user: str, password: str):
        self.url = url.rstrip("/")
        self.db = db
        self.username = user
        self.password = password
        self.uid: Optional[int] = None
        self._models: Optional[xmlrpc.client.ServerProxy] = None
        self.last_error: Optional[str] = None

    def _get_proxy(self, endpoint: str) -> xmlrpc.client.ServerProxy:
        context = ssl._create_unverified_context()
        transport = _TimeoutTransport(timeout=_XMLRPC_TIMEOUT, context=context)
        return xmlrpc.client.ServerProxy(
            f"{self.url}/xmlrpc/2/{endpoint}", transport=transport
        )

    def connect(self) -> bool:
        self.last_error = None
        try:
            common = self._get_proxy("common")
            self.uid = common.authenticate(self.db, self.username, self.password, {})
            if self.uid:
                self._models = self._get_proxy("object")
                return True
            self.last_error = "Authentication failed - invalid credentials"
            return False
        except socket.timeout:
            self.last_error = f"Connection timed out after {_XMLRPC_TIMEOUT}s"
            logger.error(f"Odoo connection timeout: {self.last_error}")
            return False
        except ConnectionError as e:
            self.last_error = f"Connection refused - check URL and port: {e}"
            logger.error(f"Odoo connection error: {self.last_error}")
            return False
        except ssl.SSLError as e:
            self.last_error = f"SSL error - check TLS/SSL settings: {e}"
            logger.error(f"Odoo SSL error: {self.last_error}")
            return False
        except Exception as e:
            self.last_error = f"Odoo connection failed: {type(e).__name__}: {e}"
            logger.error(f"Odoo connection error: {self.last_error}")
            return False

    def fetch_modules(self) -> List[OdooModule]:
        if not self.uid or not self._models:
            raise ConnectionError("Not connected to Odoo server")

        m_fields = ["id", "name", "shortdesc", "installed_version", "state"]
        try:
            modules_data = self._models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "ir.module.module",
                "search_read",
                [[]],
                {"fields": m_fields},
            )
        except socket.timeout:
            raise ConnectionError(f"Timed out fetching modules after {_XMLRPC_TIMEOUT}s")

        # Odoo 17: ir.module.module.dependency has no "version" field.
        # Available fields: module_id, name, state, auto_install_required, depend_id.
        d_fields = ["module_id", "name", "state"]
        try:
            deps_data = self._models.execute_kw(
                self.db,
                self.uid,
                self.password,
                "ir.module.module.dependency",
                "search_read",
                [[]],
                {"fields": d_fields},
            )
        except socket.timeout:
            raise ConnectionError(f"Timed out fetching dependencies after {_XMLRPC_TIMEOUT}s")

        module_id_to_name = {m.get("id"): m.get("name") for m in modules_data}
        # Self-lookup: technical_name -> installed_version for resolving dep versions
        module_name_to_version: Dict[str, Optional[str]] = {
            m.get("name"): m.get("installed_version") for m in modules_data if m.get("name")
        }

        # {odoo_module_id: {dep_name: dep_state}}
        dependencies: Dict[int, Dict[str, Optional[str]]] = {}
        # {odoo_module_id: {dep_name: dep_installed_version}}
        dep_versions: Dict[int, Dict[str, Optional[str]]] = {}
        for dep in deps_data:
            mod_id = dep.get("module_id")[0] if dep.get("module_id") else None
            if mod_id and mod_id in module_id_to_name:
                if mod_id not in dependencies:
                    dependencies[mod_id] = {}
                    dep_versions[mod_id] = {}
                dep_name = dep.get("name", "")
                dep_state = dep.get("state") or None
                dependencies[mod_id][dep_name] = dep_state
                dep_versions[mod_id][dep_name] = module_name_to_version.get(dep_name)

        modules = []
        for m in modules_data:
            mod_id = m.get("id")
            modules.append(
                OdooModule(
                    id=mod_id,
                    name=m.get("name", ""),
                    shortdesc=m.get("shortdesc"),
                    installed_version=m.get("installed_version"),
                    state=m.get("state", "unknown"),
                    dependencies=dependencies.get(mod_id, {}),
                    dependency_versions=dep_versions.get(mod_id, {}),
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
