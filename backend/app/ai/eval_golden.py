import json
import math
import os
import sys
from pathlib import Path

# Support running both as `python -m app.ai.eval_golden` and direct execution
try:
    from .evaluator import evaluate_answer
    from .errors import AIUnavailableError, AIInvalidResponseError
except ImportError:
    # If run directly as script
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from app.ai.evaluator import evaluate_answer
    from app.ai.errors import AIUnavailableError, AIInvalidResponseError


def _compute_composite(scores: dict) -> int:
    val = (
        0.20 * scores.get("relevance", 0)
        + 0.35 * scores.get("accuracy", 0)
        + 0.25 * scores.get("depth", 0)
        + 0.20 * scores.get("clarity", 0)
    )
    return max(0, min(10, round(val)))


def find_golden_file() -> Path:
    candidates = [
        Path("golden_set/answers.json"),
        Path.cwd() / "golden_set" / "answers.json",
        Path(__file__).resolve().parents[3] / "golden_set" / "answers.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("Could not find golden_set/answers.json")


def main():
    golden_path = find_golden_file()
    with open(golden_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    provider_name = os.getenv("LLM_PROVIDER", "fake")
    print(f"Running Golden Set Evaluation ({len(cases)} items) against provider: {provider_name.upper()}\n")
    print(f"{'ID':<12} | {'Category':<10} | {'Human':<6} | {'Model':<6} | {'Diff':<5} | Status")
    print("-" * 60)

    dim_errors = {"relevance": [], "accuracy": [], "depth": [], "clarity": []}
    overall_errors = []
    failures = 0

    for item in cases:
        item_id = item["id"]
        category = item["category"]
        question = item["question"]
        answer = item["answer"]
        difficulty = item["difficulty"]
        human_scores = item["human_scores"]
        human_overall = _compute_composite(human_scores)

        try:
            eval_res = evaluate_answer(
                question_text=question,
                category=category,
                answer_text=answer,
                difficulty=difficulty,
            )
            model_scores = {
                "relevance": eval_res.dimensions.relevance,
                "accuracy": eval_res.dimensions.accuracy,
                "depth": eval_res.dimensions.depth,
                "clarity": eval_res.dimensions.clarity,
            }
            model_overall = _compute_composite(model_scores)
            diff = model_overall - human_overall
            overall_errors.append(abs(diff))

            for dim in dim_errors:
                dim_errors[dim].append(abs(model_scores[dim] - human_scores[dim]))

            print(f"{item_id:<12} | {category:<10} | {human_overall:<6} | {model_overall:<6} | {diff:+5} | OK")
        except (AIUnavailableError, AIInvalidResponseError, Exception) as exc:
            failures += 1
            print(f"{item_id:<12} | {category:<10} | {human_overall:<6} | {'ERR':<6} | {'N/A':<5} | {type(exc).__name__}")

    total_valid = len(cases) - failures
    if total_valid > 0:
        mae = sum(overall_errors) / len(overall_errors)
        variance = sum((e - mae) ** 2 for e in overall_errors) / len(overall_errors)
        std_dev = math.sqrt(variance)
    else:
        mae = float("nan")
        std_dev = float("nan")

    failure_rate = (failures / len(cases)) * 100.0

    print("\n" + "=" * 60)
    print("GOLDEN SET BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total Cases Tested     : {len(cases)}")
    print(f"Successful Evaluations : {total_valid}")
    print(f"Parse / Service Fails  : {failures} ({failure_rate:.1f}%)")
    print(f"Mean Absolute Error    : {mae:.2f} points (out of 10)")
    print(f"Score Error Spread (SD): {std_dev:.2f}")
    print("-" * 60)
    for dim, errors in dim_errors.items():
        dim_mae = sum(errors) / len(errors) if errors else 0.0
        print(f"  Dimension [{dim:<9}] MAE: {dim_mae:.2f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
