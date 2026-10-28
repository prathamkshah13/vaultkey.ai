import type { Provider } from "./scanResult"


export interface SavedFindingInput{
    provider: Provider
    maskedValue: string
    severity: "low"| "medium" | "high"
    lineNumber: number

}