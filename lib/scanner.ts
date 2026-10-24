import {ScanResult, Provider} from "./scanResult";
import { maskSecret } from "./maskSecret";

export default function scanForSecrets(content : string): ScanResult[]{
    const findings : {offset: number, result: ScanResult}[] = [];
    const pattern = [{provider: "openai", regex: /sk-[a-zA-Z0-9]{20,}/g},
        {provider: "anthropic", regex: /sk-ant-[a-zA-Z0-9]{20,}/g},
        {provider: "aws", regex: /AKIA[a-zA-Z0-9]{16}/g}];
    for (const {provider, regex} of pattern){
        const matches = content.matchAll(regex);

        for (const match of matches){
            const offset = match.index ?? 0;
            const lineNumber = content.slice(0, offset).split("\n").length
            findings.push({offset, result: {provider: provider as Provider, maskedValue: maskSecret(match[0]), lineNumber:lineNumber, severity: "high"}});

        }

    }
    findings.sort((a, b) => a.offset - b.offset);
    return findings.map(f => f.result);
}