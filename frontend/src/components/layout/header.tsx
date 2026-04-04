import { useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/modules": "Module Master",
  "/environments": "Environments",
  "/reports/comparison": "Comparison Report",
  "/settings/environments": "Manage Environments",
};

export function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Odoo Auditor";

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
