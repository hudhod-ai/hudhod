import { describe, expect, it } from "vitest";

import * as sdk from "./index";

describe("@hudhod/sdk public runtime API", () => {
  it("exposes only intentional runtime helpers", () => {
    expect(Object.keys(sdk).sort()).toEqual([
      "defineExtension",
      "isHudhodError",
    ]);
  });
});
