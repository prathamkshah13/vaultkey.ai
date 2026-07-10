import {ScanResult, Provider} from "./scanResult";
export default function scanForSecrets(content : string): ScanResult[]{
    const result : ScanResult[] = [];
    const pattern = [{provider: "openai", regex: /sk-[a-zA-Z0-9]{20,}/g},
        {provider: "anthropic", regex: /sk-ant-[a-zA-Z0-9]{20,}/g}, 
        {provider: "aws", regex: /AKIA[a-zA-Z0-9]{16}/g}];
    for (const {provider, regex} of pattern){
        const matches = content.match(regex);
        if (matches){
            for (const match of matches){
                result.push({provider: provider as Provider, apiKey: match, lineNumber: 0, severity: "high"});
                
            }
        }
    }
    return result;
}