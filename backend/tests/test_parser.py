import pytest
from pydantic import ValidationError
from app.ai.gateway import extract_balanced_json, parse_and_validate
from app.ai.schemas import DimensionScores, GeneratedQuestion, Evaluation


def test_parser_clean_json():
    raw = '{"text": "Explain Python GIL", "category": "skill", "source_ref": "skill: Python"}'
    q = parse_and_validate(raw, GeneratedQuestion)
    assert q.category == "skill"
    assert q.source_ref == "skill: Python"


def test_parser_fenced_json():
    raw = '```json\n{"text": "Explain Python GIL", "category": "skill", "source_ref": "skill: Python"}\n```'
    q = parse_and_validate(raw, GeneratedQuestion)
    assert q.text == "Explain Python GIL"


def test_parser_trailing_prose():
    raw = (
        'Here is the requested question for the candidate:\n'
        '{"text": "How do you handle deadlocks?", "category": "experience", "source_ref": "experience: Acme"}\n'
        'I hope this matches your needs.'
    )
    q = parse_and_validate(raw, GeneratedQuestion)
    assert q.category == "experience"
    assert "deadlocks" in q.text


def test_parser_nested_braces():
    raw = (
        '{"dimensions": {"relevance": 7, "accuracy": 8, "depth": 6, "clarity": 9}, '
        '"strengths": ["Solid answer"], "improvements": ["Add metrics"], '
        '"missed_points": [], "ideal_outline": ["Point 1", "Point 2", "Point 3"], '
        '"prompt_version": "evaluate_v1"}'
    )
    ev = parse_and_validate(raw, Evaluation)
    assert ev.dimensions.accuracy == 8
    assert ev.dimensions.clarity == 9
    assert ev.strengths == ["Solid answer"]


def test_parser_missing_keys():
    # Missing source_ref
    raw = '{"text": "Explain B-Trees", "category": "skill"}'
    with pytest.raises(ValidationError):
        parse_and_validate(raw, GeneratedQuestion)


def test_parser_dimension_11():
    raw = '{"relevance": 11, "accuracy": 5, "depth": 5, "clarity": 5}'
    with pytest.raises(ValidationError) as exc:
        parse_and_validate(raw, DimensionScores)
    assert "less than or equal to 10" in str(exc.value)


def test_parser_empty_string():
    with pytest.raises(ValueError):
        parse_and_validate("", GeneratedQuestion)


def test_parser_null():
    with pytest.raises(ValueError):
        parse_and_validate("null", GeneratedQuestion)
