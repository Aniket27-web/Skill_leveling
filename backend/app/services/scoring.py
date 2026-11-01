from typing import Any, Dict, List, Optional


def compute_score(dimensions: Optional[Dict[str, Any]]) -> int:
    """Compute question score from dimensional ratings (0-10 each).

    Formula:
        round(0.20 * relevance + 0.35 * accuracy + 0.25 * depth + 0.20 * clarity)
    Clamped strictly between 0 and 10.
    """
    if not dimensions:
        return 0

    relevance = float(dimensions.get("relevance", 0))
    accuracy = float(dimensions.get("accuracy", 0))
    depth = float(dimensions.get("depth", 0))
    clarity = float(dimensions.get("clarity", 0))

    raw = (
        0.20 * relevance
        + 0.35 * accuracy
        + 0.25 * depth
        + 0.20 * clarity
    )
    score = int(round(raw))
    return max(0, min(10, score))


def compute_overall(scores: List[Optional[int]], total: int) -> float:
    """Compute overall session score as the rounded mean over ALL planned questions.

    Formula:
        round(mean(score of ALL planned questions), 1)
    Unanswered questions count as 0.
    """
    if total <= 0:
        return 0.0

    effective_scores: List[int] = []
    for i in range(total):
        if i < len(scores) and scores[i] is not None:
            effective_scores.append(scores[i])
        else:
            effective_scores.append(0)

    mean_val = sum(effective_scores) / float(total)
    return round(mean_val, 1)

