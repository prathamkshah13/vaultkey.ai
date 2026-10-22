import {ScanResult, Provider} from "./scanResult";
import { maskSecret } from "./maskSecret";

export default function scanForSecrets(content : string): ScanResult[]{
    const result : ScanResult[] = [];
    const pattern = [{provider: "openai", regex: /sk-[a-zA-Z0-9]{20,}/g},
        {provider: "anthropic", regex: /sk-ant-[a-zA-Z0-9]{20,}/g}, 
        {provider: "aws", regex: /AKIA[a-zA-Z0-9]{16}/g}];
    for (const {provider, regex} of pattern){
        const matches = content.matchAll(regex);
        
        for (const match of matches){
            const lineNumber = content.slice(0, match.index).split("\n").length
            result.push({provider: provider as Provider, maskedValue: maskSecret(match[0]), lineNumber:lineNumber, severity: "high"});
                
        }
        
    }
    return result;
}