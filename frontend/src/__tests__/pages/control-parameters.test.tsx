import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsControlParametersPage } from "@/pages/settings/control-parameters";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("Control Parameters Page", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("renders the page with page title", async () => {
    render(<SettingsControlParametersPage />, { wrapper });

    expect(screen.getByRole("heading", { name: "Control Parameters" })).toBeInTheDocument();
  });

  it("renders all four tabs", async () => {
    render(<SettingsControlParametersPage />, { wrapper });

    expect(screen.getByRole("tab", { name: "Request Types" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Request States" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Priorities" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Categories" })).toBeInTheDocument();
  });

  it("renders the Show Archived toggle", async () => {
    render(<SettingsControlParametersPage />, { wrapper });

    expect(screen.getByText("Show Archived")).toBeInTheDocument();
  });

  it("has Add buttons for each tab section", async () => {
    render(<SettingsControlParametersPage />, { wrapper });

    const addButtons = screen.getAllByRole("button", { name: /Add/i });
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it("clicking on a tab changes the selected tab", async () => {
    render(<SettingsControlParametersPage />, { wrapper });

    const prioritiesTab = screen.getByRole("tab", { name: "Priorities" });
    await userEvent.click(prioritiesTab);

    expect(prioritiesTab).toHaveAttribute("data-state", "active");
  });
});
