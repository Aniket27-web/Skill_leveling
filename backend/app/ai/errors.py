class ResumeError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

    def to_dict(self) -> dict:
        return {"error": {"code": self.code, "message": self.message}}


class AIUnavailableError(Exception):
    """Raised when LLM provider is down, timed out, rate limited, or returned empty response after retries."""
    def __init__(self, message: str = "AI service is currently unavailable. Please try again."):
        super().__init__(message)
        self.code = "ai_unavailable"
        self.message = message


class AIInvalidResponseError(Exception):
    """Raised when LLM returns invalid JSON or schema violations that persist after repair retry."""
    def __init__(self, message: str = "Failed to parse valid structured response from AI service."):
        super().__init__(message)
        self.code = "ai_invalid_response"
        self.message = message
