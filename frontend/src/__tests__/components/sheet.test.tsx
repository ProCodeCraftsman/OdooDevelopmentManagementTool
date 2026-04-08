import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetOverlay,
  SheetTitle,
} from "@/components/ui/sheet";

describe("Sheet Component", () => {
  it("renders SheetOverlay with correct opacity class", () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay" />
        <SheetContent>
          <SheetTitle>Test Sheet</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("bg-black/80");
    expect(overlay.className).toContain("backdrop-blur-sm");
  });

  it("SheetOverlay has backdrop blur", () => {
    render(
      <Sheet open>
        <SheetOverlay data-testid="overlay" />
      </Sheet>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("backdrop-blur-sm");
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
