import { Provider} from "./scanResult";

// Define a Detector type with two fields: provider has type Provider; regex has type RegExp. RegExp is TypeScript’s type for a regular-expression 
// object.

// Move the three existing rule objects exactly as they are from the pattern array in scanner.ts into an exported array called detectors. 
// Keep /g on every regex: matchAll needs it.

// In scanner.ts, import detectors, remove the old pattern array, and change the loop to iterate over detectors.

type Detector = {
    provider : Provider
    regex: RegExp
}

export const detectors: Detector[] = [
    {provider: "openai", regex: /sk-[a-zA-Z0-9]{20,}/g},
    {provider: "anthropic", regex: /sk-ant-[a-zA-Z0-9]{20,}/g},
    {provider: "aws", regex: /AKIA[a-zA-Z0-9]{16}/g},
    {provider: "github", regex: /ghp_[a-zA-Z0-9]{36}/g},
    // GitHub fine-grained PAT: prefix is "github_pat_" (underscore), body is 82 chars.
    // The trailing (?!...) lookahead stops a longer alphanumeric/underscore run from matching only its first 82 chars.
    {provider: "github", regex: /github_pat_[0-9a-zA-Z_]{82}(?![0-9a-zA-Z_])/g},
    // gho_/ghu_/ghr_ share ghp_'s documented shape: 4-char prefix + 36 alphanumeric chars (github.blog, 2021 token format change).
    {provider: "github", regex: /gho_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g},
    {provider: "github", regex: /ghu_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g},
    {provider: "github", regex: /ghr_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g},
    {provider: "stripe", regex: /sk_live_[A-Za-z0-9]{24,}/g},
    {provider: "stripe", regex: /sk_test_[A-Za-z0-9]{24,}/g},
    // Slack bot token: xoxb- + numeric workspace id + "-" + numeric bot id + "-" + 24-char secret.
    {provider: "slack", regex: /xoxb-[0-9]{10,14}-[0-9]{10,14}-[A-Za-z0-9]{24}(?![A-Za-z0-9])/g},
    // Google/Gemini API key: "AIza" + 35 chars from [0-9A-Za-z_-]. This project already calls the Gemini API (lib/riskScorer.ts),
    {provider: "google", regex: /AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g},
    // npm access token: "npm_" + 36 alphanumeric chars (github.blog announcement of npm's 2021 token format change).
    {provider: "npm", regex: /npm_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g}
]               