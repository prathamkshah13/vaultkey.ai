import {ScanResult, Provider} from "./scanResult";
import { maskSecret } from "./maskSecret";
import { detectors } from "./detector";

export default function scanForSecrets(content : string): ScanResult[]{
    const findings : {offset: number, result: ScanResult}[] = [];
    for (const {provider, regex} of detectors){
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