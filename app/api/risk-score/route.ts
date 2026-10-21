import {scoreRisk} from "@/lib/riskScorer"


// This represents a server endpoint. When the browser sends request, Next.js gives that request to our post function. 
export async function POST (request: Request){
    let body

    try {
        body = await request.json()
    } catch {
        return Response.json (
            { error : "Invalid JSON"},
            {status: 400}
        )
    }
    const provider = body.provider

    const  allowedProvider = ["openai", "anthropic", "aws"]

    if (typeof provider != "string" || !allowedProvider.includes(provider)){
        return Response.json(
            {error : "Unsupported or missing provider"},
            {status: 400}
        )
    }
    try{
        const explanation = await scoreRisk(provider)
    return Response.json({
        explanation: explanation
    })
    }
    catch {
        return Response.json(
            {error: "Unable to generate risk explanation"},
            {status: 502}  //502 : Server could not get valid answer from the upstram service 
        )
    }
    
}