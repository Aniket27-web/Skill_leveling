from typing import Any, Dict
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class BadRequestException(AppException):
    def __init__(self, message: str, code: str = "bad_request") -> None:
        super().__init__(status.HTTP_400_BAD_REQUEST, code, message)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Not authenticated", code: str = "unauthorized") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, code, message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "not_found") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, code, message)


class ConflictException(AppException):
    def __init__(self, message: str = "Resource conflict", code: str = "conflict") -> None:
        super().__init__(status.HTTP_409_CONFLICT, code, message)


class UnprocessableEntityException(AppException):
    def __init__(self, message: str, code: str = "validation_error") -> None:
        super().__init__(422, code, message)


class RateLimitException(AppException):
    def __init__(self, message: str = "Too many requests. Please try again later.", code: str = "rate_limit") -> None:
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, code, message)


class BadGatewayException(AppException):
    def __init__(self, message: str = "Upstream AI service unavailable", code: str = "ai_unavailable") -> None:
        super().__init__(status.HTTP_502_BAD_GATEWAY, code, message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Map common status codes to appropriate error codes
        code_map = {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            409: "conflict",
            422: "validation_error",
            429: "rate_limit",
            500: "internal_error",
            502: "bad_gateway",
        }
        code = code_map.get(exc.status_code, "http_error")
        message = str(exc.detail) if isinstance(exc.detail, str) else "An HTTP error occurred"
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": code, "message": message}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        if errors:
            first_err = errors[0]
            loc = " -> ".join(str(l) for l in first_err.get("loc", []) if l != "body")
            msg = first_err.get("msg", "Invalid input")
            full_msg = f"{loc}: {msg}" if loc else msg
        else:
            full_msg = "Validation failed for request parameters or body."

        return JSONResponse(
            status_code=422,
            content={"error": {"code": "validation_error", "message": full_msg}},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Never leak internal stack trace in response
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": {"code": "internal_error", "message": "An internal server error occurred."}},
        )
