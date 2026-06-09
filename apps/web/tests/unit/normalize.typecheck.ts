import {
  ensureArray,
  ensureBoolean,
  ensureDateString,
  ensureNumber,
  ensureObject,
  ensureString,
  normalizeApiItems,
} from "@/lib/normalize";

const emptyArray: unknown[] = ensureArray(null);
const fallbackArray: number[] = ensureArray<number>(undefined, [7]);
const itemsArray: string[] = ensureArray<string>({ items: ["a", "b"] });
const dataArray: string[] = normalizeApiItems<string>({ data: ["c"] });
const nestedArray: number[] = normalizeApiItems<number>({ results: [1, 2] });
const objectValue: { status: string } = ensureObject({ status: "ready" }, { status: "fallback" });
const fallbackObject: { status: string } = ensureObject(null, { status: "fallback" });
const finiteNumber: number = ensureNumber("42", 0);
const fallbackNumber: number = ensureNumber(Number.NaN, 5);
const stringValue: string = ensureString(12, "fallback");
const booleanValue: boolean = ensureBoolean("true", false);
const dateString: string = ensureDateString("not-a-date", "2026-06-05T00:00:00.000Z");

if (
  emptyArray.length !== 0 ||
  fallbackArray[0] !== 7 ||
  itemsArray.length !== 2 ||
  dataArray[0] !== "c" ||
  nestedArray.length !== 2 ||
  objectValue.status !== "ready" ||
  fallbackObject.status !== "fallback" ||
  finiteNumber !== 42 ||
  fallbackNumber !== 5 ||
  stringValue !== "12" ||
  booleanValue !== true ||
  dateString !== "2026-06-05T00:00:00.000Z"
) {
  throw new Error("Normalization helpers must provide safe defaults and array extraction.");
}
