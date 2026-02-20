import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { priority: _priority, ...rest } = props;
    return <img alt="" {...rest} />;
  },
}));

describe("Home Page", () => {
  it("renders starter content and primary links", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("To get started, edit the page.tsx file.");
    expect(html).toContain("Deploy Now");
    expect(html).toContain("Documentation");
  });
});
