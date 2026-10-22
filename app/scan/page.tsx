"use client"
import { useState} from "react"
import scanForSecrets from "../../lib/scanner"
import { ScanResult } from "@/lib/scanResult"

export default function ScanPage() {
    const [code, setCode] = useState("")
    const [results, setResults] = useState <ScanResult[]>([])

    async function explainRisk (index: number){
        const updatedResults = [...results]
        updatedResults[index] = {...updatedResults[index], isLoadingExplanation: true, explanationError: undefined}
        setResults(updatedResults)
        try {

            const response = await fetch("/api/risk-score", {
            method : "POST",
            headers: {
                "Content-Type" : "application/json"
            },
            body : JSON.stringify({
                provider: results[index].provider
            })
        })

        const data = await response.json()
        if (!response.ok){
            throw new Error("Unable to generate  risk explanation")
        }
        const explanation = data.explanation
        const finalResults = [... updatedResults]
        finalResults[index] = {
            ...finalResults[index],
            explanation: explanation,
            isLoadingExplanation: false
        }
        setResults(finalResults)

            
        } catch {
            // we will handle failure here next 
            const errorResults = [...updatedResults]
            errorResults[index] = {
                ...errorResults[index], 
                isLoadingExplanation: false,
                explanationError: "Unable to generate the explanation"
            }

            setResults(errorResults)
        }

        // updatedResults[index] = {...updatedResults[index], explanation: explanation, isLoadingExplanation: false} 
        // setResults(updatedResults)
    }

    return (
        <main className="min-h-screen bg-black text-white p-8">
            <h1 className = "text-4xl font-bold mb-8 text-white"> 
                Scan your <span className="text-blue-500">code</span>
            </h1>
            <textarea 
            className = "w-full h-48 bg-gray-900 text-white p-4 rounded-lg"
            placeholder="paste your code here ..."
            value = {code}
            onChange = {(e) => setCode(e.target.value)}
            />
          <button 
          className = "mt-4 bg-blue-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors duration-300"
          onClick = {() => {console.log("Button Clicked")
             setResults(scanForSecrets(code))}}
          >
            Scan for Leaks
          </button>
         <div className = "mt-8 space-y-4">
            {results.map((result, index) => (
                <div key = {index} className = "mb-4 p-4 bg-gray-800 rounded-lg"> 
                    <p className= "space-y-2">
                    {result.provider}
                    </p>
                   <p className= "space-y-2" > {result.maskedValue} </p>
                    <p className= "space-y-2"> {result.lineNumber} </p>
                    <p className = "text-red-400">
                        {result.severity}
                    </p>
                    <button
                        className ="mt-2 bg-purple-600 text-white px-4 py-2 rounded -lg txt-sm hover: bg-purple-800 transition-colors duration-300"
                        onClick = { () => explainRisk(index)}
                        >
                        Explain this Risk
                    </button>
                    {result.isLoadingExplanation && <p> Loading Explanation </p>}
                    {result.explanation && <p> {result.explanation}</p>}
                    {result.explanationError && <p className="text-red-400">{result. explanationError}</p>}
                </div>
            ))}
         </div>
        </main>
    )
}