import dotenv from "dotenv"
dotenv.config({path:".env.local"})

// console.log("GEMINI_API_KEY", process.env.GEMINI_API_KEY)

export async function scoreRisk(provider: string, apiKey: string): Promise<string>{
    const key = process.env.GEMINI_API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`
    const prompt = `You are a security expert. You are given an API key and the provider it belongs to. 
    You need to assess the risk level of this API key being leaked. The risk levels are low, medium, and high. 
    Provide only the risk level as your answer.Provide the risk level What an attacker could do with this specific type of key 
    What the developer should do right now Keep it to 2-3 sentences. The provider is: ${provider}.`
    // Gemini shape is : contents -> array -> object -> parts -> array -> object -> text
    const body = {
        contents:[
            {
                parts: [
                    {
                        text: prompt
                    }
                ]
            }
        ]
    }
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    const data = await response.json()
    const result = data.candidates[0].content.parts[0].text
    return result
}
// Fetch is the JS way to make an HTTP request. It returns a promise that resolves to the response of the request.

// Tests: 
scoreRisk("openai", "sk-fake123").then(result => console.log(result)).catch(err => console.error(err))