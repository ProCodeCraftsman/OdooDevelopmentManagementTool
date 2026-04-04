import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetContent, SheetOverlay } from "@/components/ui/sheet";

describe("Sheet Component", () => {
  it("renders SheetOverlay with correct opacity class", () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay" />
        <SheetContent>Test Sheet</SheetContent>
      </Sheet>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("bg-black/95");
    expect(overlay.className).not.toContain("bg-black/80");
    expect(overlay.className).not.toContain("bg-black/60");
  });

  it("SheetOverlay does not have backdrop-blur", () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay" />
      </Sheet>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).not.toContain("backdrop-blur");
  });

  it("SheetOverlay has correct z-index", () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay" />
      </Sheet>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("z-50");
  });
});
