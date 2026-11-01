import pytest
from app.services.scoring import compute_overall, compute_score


def test_compute_score_all_zeros():
    dims = {"relevance": 0, "accuracy": 0, "depth": 0, "clarity": 0}
    assert compute_score(dims) == 0


def test_compute_score_all_tens():
    dims = {"relevance": 10, "accuracy": 10, "depth": 10, "clarity": 10}
    # 0.20*10 + 0.35*10 + 0.25*10 + 0.20*10 = 2 + 3.5 + 2.5 + 2 = 10.0
    assert compute_score(dims) == 10


def test_compute_score_rounding():
    # 0.20*8 + 0.35*7 + 0.25*9 + 0.20*8
    # = 1.6 + 2.45 + 2.25 + 1.6 = 7.9 -> rounded to 8
    dims = {"relevance": 8, "accuracy": 7, "depth": 9, "clarity": 8}
    assert compute_score(dims) == 8

    # 0.20*5 + 0.35*5 + 0.25*5 + 0.20*5 = 5.0 -> 5
    dims2 = {"relevance": 5, "accuracy": 5, "depth": 5, "clarity": 5}
    assert compute_score(dims2) == 5

    # 0.20*6 + 0.35*6 + 0.25*7 + 0.20*6 = 1.2 + 2.1 + 1.75 + 1.2 = 6.25 -> 6
    dims3 = {"relevance": 6, "accuracy": 6, "depth": 7, "clarity": 6}
    assert compute_score(dims3) == 6


def test_compute_score_clamping():
    # Negative values clamp to 0
    neg_dims = {"relevance": -5, "accuracy": -10, "depth": 0, "clarity": 0}
    assert compute_score(neg_dims) == 0

    # Oversized values clamp to 10
    huge_dims = {"relevance": 20, "accuracy": 20, "depth": 20, "clarity": 20}
    assert compute_score(huge_dims) == 10

    # None or empty returns 0
    assert compute_score(None) == 0
    assert compute_score({}) == 0


def test_compute_overall_all_answered():
    # scores: [8, 9, 7], total: 3 -> mean = 24 / 3 = 8.0
    assert compute_overall([8, 9, 7], 3) == 8.0


def test_compute_overall_with_unanswered():
    # 1 answered with 8, planned total is 4 -> unanswered count as 0
    # effective: [8, 0, 0, 0] -> sum = 8, mean = 8 / 4 = 2.0
    assert compute_overall([8], 4) == 2.0
    assert compute_overall([8, None, None, None], 4) == 2.0


def test_compute_overall_rounding_and_precision():
    # scores: [7, 8, 8], total: 3 -> mean = 23 / 3 = 7.6666... -> rounded to 7.7
    assert compute_overall([7, 8, 8], 3) == 7.7


def test_compute_overall_edge_cases():
    # total 0
    assert compute_overall([], 0) == 0.0
    # all zeros
    assert compute_overall([0, 0, 0], 3) == 0.0

