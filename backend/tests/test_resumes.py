import io
import pytest
from fastapi.testclient import TestClient
from app.ai import ResumeError


def test_upload_resume_pdf_success(client: TestClient, auth_headers_a: dict):
    # Valid minimal PDF magic bytes
    pdf_bytes = b"%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>> %%EOF"
    files = {"file": ("my_resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    resp = client.post("/api/resumes", headers=auth_headers_a, files=files)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["filename"] == "my_resume.pdf"
    assert data["char_count"] > 0
    assert "preview" in data
    assert len(data["preview"]) <= 500


def test_upload_resume_docx_success(client: TestClient, auth_headers_a: dict):
    # Valid minimal DOCX PK signature
    docx_bytes = b"PK\x03\x04" + b"\x00" * 20
    files = {"file": ("resume.docx", io.BytesIO(docx_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}

    resp = client.post("/api/resumes", headers=auth_headers_a, files=files)
    assert resp.status_code == 201
    data = resp.json()
    assert data["filename"] == "resume.docx"


def test_upload_resume_invalid_extension(client: TestClient, auth_headers_a: dict):
    txt_bytes = b"Hello this is a plain text file"
    files = {"file": ("notes.txt", io.BytesIO(txt_bytes), "text/plain")}

    resp = client.post("/api/resumes", headers=auth_headers_a, files=files)
    assert resp.status_code == 422
    err = resp.json()
    assert err["error"]["code"] == "unsupported_type"


def test_upload_resume_corrupt_magic_bytes(client: TestClient, auth_headers_a: dict):
    bad_pdf = b"NOT_A_REAL_PDF"
    files = {"file": ("fake.pdf", io.BytesIO(bad_pdf), "application/pdf")}

    resp = client.post("/api/resumes", headers=auth_headers_a, files=files)
    assert resp.status_code == 422
    err = resp.json()
    assert err["error"]["code"] == "corrupt_file"


def test_upload_resume_too_large(client: TestClient, auth_headers_a: dict):
    # Over 5 MB (5 * 1024 * 1024 + 10)
    large_pdf = b"%PDF-" + b"0" * (5 * 1024 * 1024 + 10)
    files = {"file": ("large.pdf", io.BytesIO(large_pdf), "application/pdf")}

    resp = client.post("/api/resumes", headers=auth_headers_a, files=files)
    assert resp.status_code == 422
    err = resp.json()
    assert err["error"]["code"] == "too_large"


def test_upload_resume_ai_error(client: TestClient, auth_headers_a: dict, monkeypatch):
    import app.routers.resumes as r_mod

    def fake_extract(data, filename):
        raise ResumeError("not_a_resume", "The uploaded file does not appear to be a resume.")

    monkeypatch.setattr(r_mod, "extract_resume_text", fake_extract)

    pdf_bytes = b"%PDF-1.4\nvalid header"
    files = {"file": ("valid.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    resp = client.post("/api/resumes", headers=auth_headers_a, files=files)
    assert resp.status_code == 422
    err = resp.json()
    assert err["error"]["code"] == "not_a_resume"


def test_list_resumes_scoped_to_user(
    client: TestClient, auth_headers_a: dict, auth_headers_b: dict
):
    pdf_bytes = b"%PDF-1.4\nvalid header"
    files_a = {"file": ("user_a_resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    client.post("/api/resumes", headers=auth_headers_a, files=files_a)

    files_b = {"file": ("user_b_resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    client.post("/api/resumes", headers=auth_headers_b, files=files_b)

    # Check User A's resumes
    resp_a = client.get("/api/resumes", headers=auth_headers_a)
    assert resp_a.status_code == 200
    resumes_a = resp_a.json()
    assert all("user_b" not in r["filename"] for r in resumes_a)
    assert any("user_a" in r["filename"] for r in resumes_a)

