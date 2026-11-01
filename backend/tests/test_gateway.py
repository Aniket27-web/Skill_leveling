import pytest
from app.ai.gateway import structured
from app.ai.errors import AIUnavailableError, AIInvalidResponseError
from app.ai.providers.base import BaseLLMProvider
from app.ai.schemas import GeneratedQuestion


class MockFlakyProvider(BaseLLMProvider):
    def __init__(self, responses: list):
        self.responses = list(responses)
        self.call_count = 0

    def generate(self, task: str, messages: list[dict[str, str]], temperature: float = 0.7, timeout: float = 30.0) -> str:
        self.call_count += 1
        resp = self.responses.pop(0)
        if isinstance(resp, Exception):
            raise resp
        return resp


def test_gateway_429_then_success():
    provider = MockFlakyProvider([
        RuntimeError("429 Too Many Requests"),
        '{"text": "What is dependency injection?", "category": "skill", "source_ref": "skill: FastAPI"}'
    ])
    res = structured(
        task="questions",
        schema=GeneratedQuestion,
        messages=[{"role": "user", "content": "hi"}],
        prompt_version="v1",
        provider=provider,
    )
    assert res.text == "What is dependency injection?"
    assert provider.call_count == 2


def test_gateway_repair_succeeds():
    provider = MockFlakyProvider([
        '{"text": "Malformed json broken',
        '{"text": "Repaired question?", "category": "skill", "source_ref": "skill: Python"}'
    ])
    res = structured(
        task="questions",
        schema=GeneratedQuestion,
        messages=[{"role": "user", "content": "hi"}],
        prompt_version="v1",
        provider=provider,
    )
    assert res.text == "Repaired question?"
    assert provider.call_count == 2


def test_gateway_repair_fails_raises_invalid_response():
    provider = MockFlakyProvider([
        '{"broken": 1',
        '{"still_broken": 2'
    ])
    with pytest.raises(AIInvalidResponseError):
        structured(
            task="questions",
            schema=GeneratedQuestion,
            messages=[{"role": "user", "content": "hi"}],
            prompt_version="v1",
            provider=provider,
        )


def test_gateway_timeout_raises_unavailable():
    provider = MockFlakyProvider([
        TimeoutError("Connection timed out"),
        TimeoutError("Connection timed out"),
        TimeoutError("Connection timed out"),
    ])
    with pytest.raises(AIUnavailableError):
        structured(
            task="questions",
            schema=GeneratedQuestion,
            messages=[{"role": "user", "content": "hi"}],
            prompt_version="v1",
            provider=provider,
        )


def test_gateway_empty_raises_unavailable():
    provider = MockFlakyProvider(["", "", ""])
    with pytest.raises(AIUnavailableError):
        structured(
            task="questions",
            schema=GeneratedQuestion,
            messages=[{"role": "user", "content": "hi"}],
            prompt_version="v1",
            provider=provider,
        )
