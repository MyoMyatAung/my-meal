import { describe, it, expect } from "vitest"
import { buildWarningCards } from "./warning-cards"

describe("buildWarningCards", () => {
  it("returns an empty array when no warnings exist", () => {
    expect(buildWarningCards([], [])).toEqual([])
  })

  it("passes generation warnings through one-to-one", () => {
    const result = buildWarningCards(["w1", "w2"], [])
    expect(result).toEqual([
      { id: "generation-0", message: "w1", scope: "generation", dates: [] },
      { id: "generation-1", message: "w2", scope: "generation", dates: [] },
    ])
  })

  it("deduplicates identical entry warnings and merges dates", () => {
    const result = buildWarningCards([], [
      { date: "2026-07-01", entryWarnings: ["repeat"] },
      { date: "2026-07-03", entryWarnings: ["repeat"] },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: "edit-repeat",
      message: "repeat",
      scope: "edit",
      dates: ["2026-07-01", "2026-07-03"],
    })
  })

  it("keeps generation and edit warnings together", () => {
    const result = buildWarningCards(["generation warning"], [
      { date: "2026-07-02", entryWarnings: ["edit warning"] },
    ])

    expect(result).toEqual([
      {
        id: "generation-0",
        message: "generation warning",
        scope: "generation",
        dates: [],
      },
      {
        id: "edit-edit warning",
        message: "edit warning",
        scope: "edit",
        dates: ["2026-07-02"],
      },
    ])
  })
})
