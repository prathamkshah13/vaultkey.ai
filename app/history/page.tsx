'use client'
import { useEffect,useState } from "react"
type Scan = {
    id: string
    created_at: string
}

type HistoryState = | {status: 'loading'} | {status: 'success'; scans: Scan[]} |
{status: 'error'; message: string}

export default function HistoryPage(){
    //history is the current Value, setHistory asks react to render with new

    const [history, setHistory] = useState<HistoryState>({status: 'loading'})

    useEffect (() => {
        const controller = new AbortController()

        // put the async work inside the effect so the effect can return cleanup
        async function loadScans(){
            try {
                // A fetch with no method sends getRequest
                const response = await fetch('/api/scans', {
                    signal: controller.signal,

                })

                if (response.status === 401){
                    setHistory({ status: 'error', message : 'Sign in too see your scans'})
                    return
                }

                // fetch can return an HTTP error, so we check the status properly
                if(!response.ok){
                    throw new Error('Could not load scan history')
                }

                // Read the response body as JSON, then store the array for the next render
                const data : {scans : Scan[]}= await response.json()
                setHistory({ status: 'success', scans: data.scans})
            } catch {
                // Cancellation is expected during clean up. Error for other failure
                if (!controller.signal.aborted){
                    setHistory({ status: 'error', message: 'Could not load scan history'})
                }
            }
        }

        void loadScans()
        return () => controller.abort()
    }, [])

    return (
        <main>
            <h1>Scan History</h1>

            {history.status === 'loading' && <p> loading scans ...</p>}
            {history.status === 'error' && <p role="alert">{history.message}</p>}

            {history.status === 'success' &&
            (history.scans.length === 0 ?( <p> No saves scans yet</p> ): (
                <ul>
                    {/* map turns each scan into a row. Its ID gives React a stable key */}
                    {history.scans.map((scan) =>(
                        <li key = {scan.id}>
                            {new Date(scan.created_at).toLocaleString()}.{scan.id}
                        </li>
                    ))}
                </ul>
            ))}
        </main>
    )
}
