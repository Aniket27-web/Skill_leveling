"""Report rendering module. (P4 implements the final PDF design, P1 wires the route)."""

from typing import Any, Dict


def render_report(session: Dict[str, Any]) -> bytes:
    """Generate a valid placeholder PDF report for an interview session."""
    session_id = session.get("id", "unknown")
    overall = session.get("overall_score", "N/A")
    summary = session.get("summary", {})
    summary_text = summary.get("text", "") if isinstance(summary, dict) else ""

    text = f"AI Mock Interview Report\nSession ID: {session_id}\nOverall Score: {overall}/10\nSummary: {summary_text}"
    escaped_text = text.replace("(", "\\(").replace(")", "\\)").encode("latin-1", "replace")

    stream_content = b"BT /F1 12 Tf 50 700 Td (" + escaped_text + b") Tj ET"
    stream_len = len(stream_content)

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >> endobj\n"
        b"4 0 obj << /Length " + str(stream_len).encode("ascii") + b" >>\nstream\n"
        + stream_content
        + b"\nendstream\nendobj\n"
        b"xref\n"
        b"0 5\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000300 00000 n \n"
        b"trailer << /Size 5 /Root 1 0 R >>\n"
        b"startxref\n"
        b"400\n"
        b"%%EOF\n"
    )
    return pdf

