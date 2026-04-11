import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Server,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  ClipboardList,
  Sliders,
  Sun,
  Moon,
  GitBranch,
  FileStack,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const mainNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Development Requests", href: "/development-requests", icon: ClipboardList },
  { title: "Release Plans (RP)", href: "/release-plans", icon: GitBranch },
];

const drNavItems = [
  { title: "Dev Requests (DR)", href: "/development-requests", icon: ClipboardList },
  { title: "DR Module Lines", href: "/development-requests/lines", icon: FileStack },
];

const serverEnvNavItems = [
  { title: "Version Reports", href: "/reports/comparison", icon: FileText },
  { title: "Server Envs", href: "/environments", icon: Server },
  { title: "Module Master", href: "/modules", icon: Package },
];

const settingsNavItems = [
  { title: "Environments", href: "/settings/environments", icon: Server },
  { title: "Control Parameters", href: "/settings/control-parameters", icon: Sliders },
  { title: "Users", href: "/settings/users", icon: Users },
  { title: "Roles", href: "/settings/roles", icon: Shield },
];

interface NavItemProps {
  item: typeof mainNavItems[0];
  collapsed: boolean;
  isMobile: boolean;
  onClick?: () => void;
}

function NavItem({ item, collapsed, isMobile, onClick }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  const Icon = item.icon;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          onClick={onClick}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
          {!collapsed && !isMobile && <span>{item.title}</span>}
        </Link>
      </TooltipTrigger>
      {collapsed && !isMobile && <TooltipContent side="right">{item.title}</TooltipContent>}
    </Tooltip>
  );
}

interface SettingsNavItemProps {
  item: typeof settingsNavItems[0];
  collapsed: boolean;
  isMobile: boolean;
  onClick?: () => void;
}

function SettingsNavItem({ item, collapsed, isMobile, onClick }: SettingsNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ml-4 mr-2",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && !isMobile && <span>{item.title}</span>}
    </Link>
  );
}

interface ServerEnvNavItemProps {
  item: typeof serverEnvNavItems[0];
  collapsed: boolean;
  isMobile: boolean;
  onClick?: () => void;
}

function ServerEnvNavItem({ item, collapsed, isMobile, onClick }: ServerEnvNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ml-4 mr-2",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && !isMobile && <span>{item.title}</span>}
    </Link>
  );
}

function DrNavItem({ item, collapsed, isMobile, onClick }: ServerEnvNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ml-4 mr-2",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && !isMobile && <span>{item.title}</span>}
    </Link>
  );
}

interface NavContentProps {
  collapsed: boolean;
  isMobile: boolean;
  isAdmin: boolean;
  settingsExpanded: boolean;
  serverEnvExpanded: boolean;
  drExpanded: boolean;
  onToggleSettings: () => void;
  onToggleServerEnv: () => void;
  onToggleDr: () => void;
  onItemClick?: () => void;
}

function NavContent({ collapsed, isMobile, isAdmin, settingsExpanded, serverEnvExpanded, drExpanded, onToggleSettings, onToggleServerEnv, onToggleDr, onItemClick }: NavContentProps) {
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const isSettingsActive = location.pathname.startsWith("/settings");
  const isServerEnvActive = ["/modules", "/environments", "/reports/comparison"].some(
    (path) => location.pathname === path || location.pathname.startsWith(path + "/")
  );
  const isDrActive = location.pathname.startsWith("/development-requests");

  const toggleTheme = useCallback(() => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  }, [theme, setTheme]);

  return (
    <>
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        <NavItem key={mainNavItems[0].href} item={mainNavItems[0]} collapsed={collapsed} isMobile={isMobile} onClick={onItemClick} />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to="/development-requests"
              onClick={onToggleDr}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isDrActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <ClipboardList className="h-5 w-5" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Requests</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      drExpanded && "rotate-180"
                    )}
                  />
                </>
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Requests</TooltipContent>}
        </Tooltip>

        <div className={cn("overflow-hidden transition-all", drExpanded ? "max-h-96" : "max-h-0")}>
          <div className="mt-1 space-y-0.5">
            {drNavItems.map((item) => (
              <DrNavItem key={item.href} item={item} collapsed={collapsed} isMobile={isMobile} onClick={onItemClick} />
            ))}
          </div>
        </div>

        <NavItem key={mainNavItems[2].href} item={mainNavItems[2]} collapsed={collapsed} isMobile={isMobile} onClick={onItemClick} />

        <div className="my-2 border-t" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to="/reports/comparison"
              onClick={onToggleServerEnv}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isServerEnvActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Server className="h-5 w-5" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Server Environments</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      serverEnvExpanded && "rotate-180"
                    )}
                  />
                </>
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Server Environments</TooltipContent>}
        </Tooltip>

        <div className={cn("overflow-hidden transition-all", serverEnvExpanded ? "max-h-96" : "max-h-0")}>
          <div className="mt-1 space-y-0.5">
            {serverEnvNavItems.map((item) => (
              <ServerEnvNavItem key={item.href} item={item} collapsed={collapsed} isMobile={isMobile} onClick={onItemClick} />
            ))}
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="my-2 border-t" />

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to="/settings/environments"
                  onClick={onToggleSettings}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isSettingsActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Settings className="h-5 w-5" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Settings</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          settingsExpanded && "rotate-180"
                        )}
                      />
                    </>
                  )}
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
            </Tooltip>

            <div className={cn("overflow-hidden transition-all", settingsExpanded ? "max-h-96" : "max-h-0")}>
              <div className="mt-1 space-y-0.5">
                {settingsNavItems.map((item) => (
                  <SettingsNavItem key={item.href} item={item} collapsed={collapsed} isMobile={isMobile} onClick={onItemClick} />
                ))}
              </div>
            </div>
          </>
        )}
      </nav>

      <div className="border-t p-2 space-y-1 sticky bottom-0 bg-background">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {isAdmin ? "Admin" : "User"}
                </p>
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleTheme}
                  >
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4" />
                    ) : theme === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Theme: {theme === "system" ? "System" : theme.charAt(0).toUpperCase() + theme.slice(1)}
                </TooltipContent>
              </Tooltip>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                logout();
                onItemClick?.();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleTheme}
                >
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : theme === "light" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Theme: {theme === "system" ? "System" : theme.charAt(0).toUpperCase() + theme.slice(1)}
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    logout();
                    onItemClick?.();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userToggledSettings, setUserToggledSettings] = useState(false);
  const [settingsExpandedState, setSettingsExpandedState] = useState(false);
  const [userToggledServerEnv, setUserToggledServerEnv] = useState(false);
  const [serverEnvExpandedState, setServerEnvExpandedState] = useState(false);
  const [userToggledDr, setUserToggledDr] = useState(false);
  const [drExpandedState, setDrExpandedState] = useState(false);
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.roles?.some((r) => r.permissions?.includes("system:manage")) ?? false;

  const settingsExpanded = userToggledSettings
    ? settingsExpandedState
    : location.pathname.startsWith("/settings");

  const isServerEnvActive = ["/modules", "/environments", "/reports/comparison"].some(
    (path) => location.pathname === path || location.pathname.startsWith(path + "/")
  );
  const serverEnvExpanded = userToggledServerEnv
    ? serverEnvExpandedState
    : isServerEnvActive;

  const isDrActive = location.pathname.startsWith("/development-requests");
  const drExpanded = userToggledDr
    ? drExpandedState
    : isDrActive;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setUserToggledSettings(true);
    setSettingsExpandedState(prev => !prev);
  }, []);

  const handleToggleServerEnv = useCallback(() => {
    setUserToggledServerEnv(true);
    setServerEnvExpandedState(prev => !prev);
  }, []);

  const handleToggleDr = useCallback(() => {
    setUserToggledDr(true);
    setDrExpandedState(prev => !prev);
  }, []);

  const handleMobileNavClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
          <span className="font-semibold text-lg">GPS Odoo Tracker</span>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="text-left">Odoo Auditor</SheetTitle>
            </SheetHeader>
            <NavContent
              collapsed={false}
              isMobile={isMobile}
              isAdmin={isAdmin}
              settingsExpanded={settingsExpanded}
              serverEnvExpanded={serverEnvExpanded}
              drExpanded={drExpanded}
              onToggleSettings={handleToggleSettings}
              onToggleServerEnv={handleToggleServerEnv}
              onToggleDr={handleToggleDr}
              onItemClick={handleMobileNavClick}

            />
          </SheetContent>
        </Sheet>
        <div className="h-14" />
      </>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-background transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <span className="font-semibold text-lg">GPS Odoo Tracker</span>
        )}
        {collapsed && <span className="font-semibold text-lg">GT</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <NavContent
        collapsed={collapsed}
        isMobile={isMobile}
        isAdmin={isAdmin}
        settingsExpanded={settingsExpanded}
        serverEnvExpanded={serverEnvExpanded}
        drExpanded={drExpanded}
        onToggleSettings={handleToggleSettings}
        onToggleServerEnv={handleToggleServerEnv}
        onToggleDr={handleToggleDr}
      />
    </aside>
  );
}
