import { describe, it, expect } from "vitest";
import {
  calculateConfidence,
  type ConfidenceSignal,
} from "../../../../src/detection/harness/helpers";
import { DetectionConfidence } from "../../../../src/detection/harness/types";

interface ConfidenceCase {
  readonly name: string;
  readonly signals: readonly ConfidenceSignal[];
  readonly expected: DetectionConfidence;
}

const cases: ConfidenceCase[] = [
  {
    name: "two found high-reliability signals -> High",
    signals: [
      { reliability: "high", found: true },
      { reliability: "high", found: true },
    ],
    expected: DetectionConfidence.High,
  },
  {
    name: "three found high-reliability signals -> High",
    signals: [
      { reliability: "high", found: true },
      { reliability: "high", found: true },
      { reliability: "high", found: true },
    ],
    expected: DetectionConfidence.High,
  },
  {
    name: "one found high signal + one found medium signal -> High",
    signals: [
      { reliability: "high", found: true },
      { reliability: "medium", found: true },
    ],
    expected: DetectionConfidence.High,
  },
  {
    name: "one found high signal + one found low signal -> High",
    signals: [
      { reliability: "high", found: true },
      { reliability: "low", found: true },
    ],
    expected: DetectionConfidence.High,
  },
  {
    name: "single found high-reliability signal alone -> Medium",
    signals: [{ reliability: "high", found: true }],
    expected: DetectionConfidence.Medium,
  },
  {
    name: "two found medium signals agree (no high) -> Medium",
    signals: [
      { reliability: "medium", found: true },
      { reliability: "medium", found: true },
    ],
    expected: DetectionConfidence.Medium,
  },
  {
    name: "two found low signals agree (no high) -> Medium",
    signals: [
      { reliability: "low", found: true },
      { reliability: "low", found: true },
    ],
    expected: DetectionConfidence.Medium,
  },
  {
    name: "one found medium + one found low (no high) -> Medium",
    signals: [
      { reliability: "medium", found: true },
      { reliability: "low", found: true },
    ],
    expected: DetectionConfidence.Medium,
  },
  {
    name: "single found medium signal alone -> Low",
    signals: [{ reliability: "medium", found: true }],
    expected: DetectionConfidence.Low,
  },
  {
    name: "single found low signal alone -> Low",
    signals: [{ reliability: "low", found: true }],
    expected: DetectionConfidence.Low,
  },
  {
    name: "empty signal array -> None",
    signals: [],
    expected: DetectionConfidence.None,
  },
  {
    name: "all signals not found -> None",
    signals: [
      { reliability: "high", found: false },
      { reliability: "medium", found: false },
      { reliability: "low", found: false },
    ],
    expected: DetectionConfidence.None,
  },
  {
    name: "mixed reliability with not-found entries interspersed: only one found high counts -> Medium",
    signals: [
      { reliability: "high", found: true },
      { reliability: "high", found: false },
      { reliability: "medium", found: false },
      { reliability: "low", found: false },
    ],
    expected: DetectionConfidence.Medium,
  },
  {
    name: "mixed reliability with not-found entries interspersed: found high + found low counts -> High",
    signals: [
      { reliability: "high", found: false },
      { reliability: "high", found: true },
      { reliability: "medium", found: false },
      { reliability: "low", found: true },
    ],
    expected: DetectionConfidence.High,
  },
  {
    name: "mixed reliability with not-found entries interspersed: two found non-high, rest not found -> Medium",
    signals: [
      { reliability: "high", found: false },
      { reliability: "medium", found: true },
      { reliability: "low", found: true },
      { reliability: "low", found: false },
    ],
    expected: DetectionConfidence.Medium,
  },
  {
    name: "mixed reliability with not-found entries interspersed: single found low, rest not found -> Low",
    signals: [
      { reliability: "high", found: false },
      { reliability: "medium", found: false },
      { reliability: "low", found: true },
    ],
    expected: DetectionConfidence.Low,
  },
];

describe("calculateConfidence", () => {
  it.each(cases)("$name", ({ signals, expected }) => {
    expect(calculateConfidence(signals)).toBe(expected);
  });
});
