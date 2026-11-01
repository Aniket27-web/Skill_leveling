import json
import logging
import os
import random
import re
import sys
import time
from typing import Any, Type, TypeVar
from pydantic import BaseModel, ValidationError

from .errors import AIUnavailableError, AIInvalidResponseError
from .providers import get_provider, BaseLLMProvider

T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger("ai_gateway")


def extract_balanced_json(text: str) -> str:
    """Strip markdown code fences and locate the first balanced {...} string."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    start = cleaned.find("{")
    if start == -1:
        raise ValueError("No opening brace '{' found in response")

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(cleaned)):
        char = cleaned[i]
        if escape:
            escape = False
            continue
        if char == "\\":
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return cleaned[start : i + 1]

    raise ValueError("Unbalanced braces in JSON response")


def parse_and_validate(raw_text: str, schema: Type[T]) -> T:
    if not raw_text or not raw_text.strip():
        raise ValueError("Empty response string")
    json_str = extract_balanced_json(raw_text)
    data = json.loads(json_str)
    if not isinstance(data, dict):
        raise ValueError("Parsed JSON root must be an object")
    return schema.model_validate(data)


def _log_structured_call(task: str, provider: str, model: str, latency_ms: float, status: str) -> None:
    record = {
        "task": task,
        "provider": provider,
        "model": model,
        "latency_ms": round(latency_ms, 2),
        "status": status,
    }
    sys.stdout.write(json.dumps(record) + "\n")
    sys.stdout.flush()


def structured(
    task: str,
    schema: Type[T],
    messages: list[dict[str, str]],
    prompt_version: str,
    temperature: float = 0.7,
    timeout: float = 30.0,
    provider: BaseLLMProvider | None = None,
) -> T:
    """Execute LLM call with retry, backoff, parsing, repair retry, and structured logging."""
    llm = provider or get_provider()
    provider_name = llm.__class__.__name__
    model_name = getattr(llm, "model", getattr(llm, "mode", "default"))

    max_retries = 2
    raw_response = ""
    last_exception: Exception | None = None

    for attempt in range(max_retries + 1):
        start_time = time.time()
        try:
            raw_response = llm.generate(
                task=task,
                messages=messages,
                temperature=temperature,
                timeout=timeout,
            )
            latency_ms = (time.time() - start_time) * 1000

            if not raw_response or not raw_response.strip():
                _log_structured_call(task, provider_name, model_name, latency_ms, "empty")
                raise AIUnavailableError("Provider returned empty response")

            _log_structured_call(task, provider_name, model_name, latency_ms, "ok")
            break
        except (TimeoutError, Exception) as exc:
            latency_ms = (time.time() - start_time) * 1000
            err_msg = str(exc).lower()

            is_rate_limit = "429" in err_msg or "rate limit" in err_msg
            is_server_error = any(code in err_msg for code in ["500", "502", "503", "504"]) or "server error" in err_msg
            is_timeout = isinstance(exc, TimeoutError) or "timeout" in err_msg or "timed out" in err_msg

            status_label = "rate_limit" if is_rate_limit else ("timeout" if is_timeout else "error")
            _log_structured_call(task, provider_name, model_name, latency_ms, status_label)

            last_exception = exc
            if attempt < max_retries and (is_rate_limit or is_server_error or is_timeout):
                # Check for Retry-After
                retry_after_match = re.search(r"retry-after:\s*(\d+)", err_msg)
                if retry_after_match:
                    sleep_sec = float(retry_after_match.group(1))
                else:
                    sleep_sec = (2 ** attempt) * 0.5 + random.uniform(0.1, 0.4)
                time.sleep(sleep_sec)
                continue
            else:
                raise AIUnavailableError(f"LLM call failed after retries: {exc}") from exc

    # Attempt parse and Pydantic validation
    try:
        return parse_and_validate(raw_response, schema)
    except (ValueError, json.JSONDecodeError, ValidationError) as parse_err:
        # Perform ONE repair retry
        start_time = time.time()
        repair_messages = list(messages)
        repair_prompt = (
            f"Your previous response had formatting/validation errors:\n{str(parse_err)}\n"
            f"Raw output was:\n{raw_response[:500]}\n\n"
            f"Return ONLY valid JSON strictly matching the requested schema. No markdown, no prose."
        )
        repair_messages.append({"role": "user", "content": repair_prompt})

        try:
            repair_raw = llm.generate(
                task=task,
                messages=repair_messages,
                temperature=temperature,
                timeout=timeout,
            )
            latency_ms = (time.time() - start_time) * 1000
            if not repair_raw or not repair_raw.strip():
                _log_structured_call(task, provider_name, model_name, latency_ms, "repair_empty")
                raise AIInvalidResponseError("Empty response on repair retry")

            _log_structured_call(task, provider_name, model_name, latency_ms, "repair_attempt")
            return parse_and_validate(repair_raw, schema)
        except Exception as repair_exc:
            latency_ms = (time.time() - start_time) * 1000
            _log_structured_call(task, provider_name, model_name, latency_ms, "repair_failed")
            raise AIInvalidResponseError(f"Response invalid after repair retry: {repair_exc}") from repair_exc
