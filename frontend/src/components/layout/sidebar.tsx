import { useState, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
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
  { title: "Modules", href: "/modules", icon: Package },
  { title: "Environments", href: "/environments", icon: Server },
  { title: "Reports", href: "/reports/comparison", icon: FileText },
];

const settingsNavItems = [
  { title: "Environments", href: "/settings/environments", icon: Server },
  { title: "Users", href: "/settings/users", icon: Users },
  { title: "Roles", href: "/settings/roles", icon: Shield },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.is_admin ?? false;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith("/settings")) {
      setSettingsExpanded(true);
    }
  }, [location.pathname]);

  const isSettingsActive = location.pathname.startsWith("/settings");

  const NavItem = ({ item, onClick }: { item: typeof mainNavItems[0]; onClick?: () => void }) => {
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
            <span>{item.title}</span>
          </Link>
        </TooltipTrigger>
        {collapsed && !isMobile && <TooltipContent side="right">{item.title}</TooltipContent>}
      </Tooltip>
    );
  };

  const SettingsNavItem = ({ item, onClick }: { item: typeof settingsNavItems[0]; onClick?: () => void }) => {
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
        <span>{item.title}</span>
      </Link>
    );
  };

  const NavContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <nav className="flex-1 space-y-1 p-2">
        {mainNavItems.map((item) => (
          <NavItem key={item.href} item={item} onClick={onItemClick} />
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t" />
            
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSettingsExpanded(!settingsExpanded)}
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
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
            </Tooltip>

            {!collapsed && (
              <div className={cn("overflow-hidden transition-all", settingsExpanded ? "max-h-96" : "max-h-0")}>
                <div className="mt-1 space-y-0.5">
                  {settingsNavItems.map((item) => (
                    <SettingsNavItem key={item.href} item={item} onClick={onItemClick} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </nav>

      <div className="border-t p-2">
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
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4">
          <span className="font-semibold text-lg">Odoo Auditor</span>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="text-left">Odoo Auditor</SheetTitle>
            </SheetHeader>
            <NavContent onItemClick={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="h-14" />
      </>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-white transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <span className="font-semibold text-lg">Odoo Auditor</span>
        )}
        {collapsed && <span className="font-semibold text-lg">OA</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <NavContent />
    </aside>
  );
}
