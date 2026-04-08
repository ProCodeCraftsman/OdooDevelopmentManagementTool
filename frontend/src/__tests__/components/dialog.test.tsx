import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";

describe("Dialog Component", () => {
  it("renders DialogOverlay with correct opacity class", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" />
        <DialogContent>
          <DialogTitle>Test Dialog</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("bg-black/80");
    expect(overlay.className).toContain("backdrop-blur-sm");
  });

  it("DialogOverlay has backdrop blur", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" />
      </Dialog>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("backdrop-blur-sm");
  });

  it("DialogOverlay has correct z-index", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" />
      </Dialog>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("z-50");
  });
});
