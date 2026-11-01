import io
from pathlib import Path
import zipfile
import pytest
from app.ai.errors import ResumeError
from app.ai.resume import extract_resume_text, redact_contact

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def test_resume_text_pdf():
    pdf_bytes = (FIXTURES_DIR / "sample_resume.pdf").read_bytes()
    text = extract_resume_text(pdf_bytes, "sample_resume.pdf")
    assert len(text) >= 200
    assert "Alex Morgan" in text
    assert "Experience" in text or "experience" in text.lower()


def test_resume_docx_with_table():
    docx_bytes = (FIXTURES_DIR / "sample_resume.docx").read_bytes()
    text = extract_resume_text(docx_bytes, "sample_resume.docx")
    assert len(text) >= 200
    assert "Jordan Lee" in text
    assert "FastAPI" in text
    # Table row contents
    assert "Technologies" in text or "Backend" in text


def test_resume_scanned_pdf_no_text():
    # PDF with blank page (under 200 chars)
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 100, "Short")
    c.save()
    pdf_bytes = buf.getvalue()

    with pytest.raises(ResumeError) as exc:
        extract_resume_text(pdf_bytes, "scanned.pdf")
    assert exc.value.code == "no_text"
    assert "scanned image" in exc.value.message


def test_resume_non_resume_text():
    # Long text (>=200 chars) but no resume keywords (no education, skills, experience, projects)
    from reportlab.platypus import SimpleDocTemplate, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(
            "The quick brown fox jumps over the lazy dog. " * 15,
            styles["Normal"],
        )
    ]
    doc.build(story)
    pdf_bytes = buf.getvalue()

    with pytest.raises(ResumeError) as exc:
        extract_resume_text(pdf_bytes, "story.pdf")
    assert exc.value.code == "not_a_resume"


def test_resume_corrupt_file():
    with pytest.raises(ResumeError) as exc:
        extract_resume_text(b"not-a-valid-pdf-header-at-all", "resume.pdf")
    assert exc.value.code == "corrupt_file"


def test_resume_wrong_extension():
    with pytest.raises(ResumeError) as exc:
        extract_resume_text(b"%PDF-1.4...", "resume.txt")
    assert exc.value.code == "unsupported_type"


def test_resume_docx_zip_bomb():
    # Create a zip with > 1000 file entries
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i in range(1005):
            zf.writestr(f"word/entry_{i}.xml", b"<xml></xml>")
    zip_bytes = buf.getvalue()

    with pytest.raises(ResumeError) as exc:
        extract_resume_text(zip_bytes, "bomb.docx")
    assert exc.value.code == "corrupt_file"
    assert "safe entry limit" in exc.value.message


def test_resume_redact_contact():
    raw = "Contact me at alice.smith@work.org or call +1 (555) 349-2810 for interviews."
    redacted = redact_contact(raw)
    assert "alice.smith@work.org" not in redacted
    assert "[REDACTED_EMAIL]" in redacted
    assert "349-2810" not in redacted
    assert "[REDACTED_PHONE]" in redacted
