export type ReviewStatus = "open" | "resolved" | "ignored"

export const REVIEW_STATUSES: readonly ReviewStatus[] = ["open", "resolved", "ignored"]

export function isReviewStatus(value: unknown): value is ReviewStatus {
    return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value)
}
