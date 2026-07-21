export type Provider = "openai"|"anthropic"|"aws" 

export interface ScanResult {
    provider: Provider
    apiKey: string
    lineNumber: number
    severity: "low" | "medium" | "high"
    explanation? : string
    isLoadingExplanation? : boolean
}