import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from "@/components/ui/dialog";

describe("Dialog Component", () => {
  it("renders DialogOverlay with correct opacity class", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" />
        <DialogContent>
          <DialogTitle>Test Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).toContain("bg-black/95");
    expect(overlay.className).not.toContain("bg-black/80");
    expect(overlay.className).not.toContain("bg-black/60");
  });

  it("DialogOverlay does not have backdrop-blur", () => {
    render(
      <Dialog open>
        <DialogOverlay data-testid="overlay" />
      </Dialog>
    );

    const overlay = screen.getByTestId("overlay");
    expect(overlay.className).not.toContain("backdrop-blur");
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
