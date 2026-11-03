'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isReviewStatus, type ReviewStatus } from '@/lib/reviewStatus'

type Finding = {
    id: string
    provider: string
    masked_value: string
    severity: string
    line_number: number
    review_status: ReviewStatus
}

type ScanDetails = {
    scan: { id: string; created_at: string }
    findings: Finding[]
}

export default function ScanDetailPage() {
    const { id } = useParams<{ id: string }>()
    return <ScanDetailsView key={id} id={id} />
}

function ScanDetailsView({ id }: { id: string }) {
    const [details, setDetails] = useState<ScanDetails | null>(null)
    const [loadError, setLoadError] = useState('')
    const [saveError, setSaveError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            try {
                const response = await fetch(`/api/scans/${encodeURIComponent(id)}`, { signal: controller.signal })
                if (!response.ok) {
                    const message = response.status === 401 ? 'Sign in to view this scan.'
                        : response.status === 404 ? 'Scan not found.' : 'Could not load this scan.'
                    throw new Error(message)
                }
                const data: ScanDetails = await response.json()
                if (!controller.signal.aborted) setDetails(data)
            } catch (error) {
                if (!controller.signal.aborted) {
                    setLoadError(error instanceof Error ? error.message : 'Could not load this scan.')
                }
            }
        }
        void load()
        return () => controller.abort()
    }, [id])

    async function saveReview(findingId: string, status: string) {
        if (saving || !isReviewStatus(status)) return
        setSaving(true)
        setSaveError('')
        try {
            const response = await fetch(`/api/findings/${encodeURIComponent(findingId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewStatus: status }),
            })
            if (!response.ok) throw new Error('Save failed')
            const { finding }: { finding: Pick<Finding, 'id' | 'review_status'> } = await response.json()
            setDetails(current => current && ({
                ...current,
                findings: current.findings.map(row => row.id === finding.id ? { ...row, ...finding } : row),
            }))
        } catch {
            setSaveError('Could not save the review status. Try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <main>
            <Link href="/history">Back to scan history</Link>
            <h1>Scan Details</h1>
            {loadError && <p role="alert">{loadError}</p>}
            {!details && !loadError && <p role="status">Loading scan…</p>}
            {details && (
                <>
                    <p>Scan ID: {details.scan.id}</p>
                    {details.findings.length === 0 && <p>No findings.</p>}
                    {saveError && <p role="alert">{saveError}</p>}
                    {saving && <p role="status">Saving review…</p>}
                    <ul>
                        {details.findings.map(finding => (
                            <li key={finding.id}>
                                <p>{finding.provider} · {finding.masked_value} · {finding.severity} · Line {finding.line_number}</p>
                                <label>
                                    Review status
                                    <select value={finding.review_status} disabled={saving}
                                        onChange={event => void saveReview(finding.id, event.target.value)}>
                                        <option value="open">Open</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="ignored">Ignored</option>
                                    </select>
                                </label>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </main>
    )
}
