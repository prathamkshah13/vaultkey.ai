export type Provider = "openai"|"anthropic"|"aws"|"github"|"stripe"|"slack"|"google"|"npm"

export interface ScanResult {
    provider: Provider
    maskedValue: string
    lineNumber: number
    severity: "low" | "medium" | "high"
    explanation? : string
    isLoadingExplanation? : boolean
    explanationError?: string
}