import io
import re
import unicodedata
import zipfile
from .errors import ResumeError

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_DOCX_ENTRIES = 1000
MAX_UNCOMPRESSED_DOCX_SIZE = 25 * 1024 * 1024  # 25 MB
MAX_CHARS = 28000  # Approx 7000 tokens (chars / 4)

RESUME_KEYWORDS = [
    r"\beducation\b",
    r"\bskills?\b",
    r"\bexperience\b",
    r"\bprojects?\b",
    r"\bemployment\b",
    r"\bwork history\b",
    r"\bqualifications\b",
    r"\btechnical background\b",
]

PROFILE_SECTIONS = {
    "skills": re.compile(r"^(technical\s+)?skills?(\s+and\s+tools)?$", re.I),
    "projects": re.compile(r"^(selected\s+)?projects?(\s+and\s+portfolio)?$", re.I),
    "education": re.compile(r"^(education|academics|qualifications)$", re.I),
    "experience": re.compile(r"^(work\s+)?(experience|employment|work\s+history|professional\s+experience)$", re.I),
}

TECHNOLOGIES = [
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP",
    "React", "Angular", "Vue", "Node.js", "FastAPI", "Django", "Flask", "Spring", "Express",
    "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "Git", "Linux", "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy", "GraphQL", "REST",
]


def extract_resume_profile(text: str) -> dict[str, list[str]]:
    """Extract a lightweight structured profile from recognized resume sections."""
    sections: dict[str, list[str]] = {name: [] for name in PROFILE_SECTIONS}
    current: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.strip(" \t-•|")
        if not line:
            continue
        header = re.sub(r"[:|]+$", "", line).strip()
        matched = next((name for name, pattern in PROFILE_SECTIONS.items() if pattern.fullmatch(header)), None)
        if matched:
            current = matched
            continue
        if current:
            sections[current].append(line[:400])

    skill_items: list[str] = []
    for line in sections["skills"]:
        skill_items.extend(part.strip() for part in re.split(r"[,;|•]+", line) if part.strip())
    technologies = [name for name in TECHNOLOGIES if re.search(rf"(?<![\w+#]){re.escape(name)}(?![\w+#])", text, re.I)]
    return {
        "skills": list(dict.fromkeys(skill_items))[:40],
        "technologies": technologies[:40],
        "projects": sections["projects"][:12],
        "education": sections["education"][:12],
        "experience": sections["experience"][:20],
    }


def redact_contact(text: str) -> str:
    """Redact emails and phone numbers from resume text before passing to LLM."""
    # Redact email addresses
    redacted = re.sub(
        r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
        "[REDACTED_EMAIL]",
        text,
    )
    # Redact phone numbers (international, hyphenated, dotted, parenthesized)
    redacted = re.sub(
        r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b",
        "[REDACTED_PHONE]",
        redacted,
    )
    return redacted


def _normalize_text(raw_text: str) -> str:
    # Normalize unicode to NFKC
    normalized = unicodedata.normalize("NFKC", raw_text)
    # Convert various bullet points to standard dash
    normalized = re.sub(r"[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25CF\u25CB]", "\n- ", normalized)
    # Strip non-printable control characters except newline and tab
    cleaned = "".join(
        ch for ch in normalized if ch in "\n\r\t" or unicodedata.category(ch)[0] != "C"
    )
    # Normalize whitespace
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _is_garbled(text: str) -> bool:
    non_space = [c for c in text if not c.isspace()]
    if not non_space:
        return True
    alnum = [c for c in non_space if c.isalnum()]
    # If less than 45% of non-whitespace characters are alphanumeric, it is garbled
    return (len(alnum) / len(non_space)) < 0.45


def _truncate_prioritized(text: str, max_chars: int = MAX_CHARS) -> str:
    if len(text) <= max_chars:
        return text

    # Locate section headers
    section_patterns = [
        ("experience", re.compile(r"(?i)\b(experience|work history|employment)\b")),
        ("projects", re.compile(r"(?i)\b(projects?|portfolio)\b")),
        ("skills", re.compile(r"(?i)\b(skills?|technical skills|technologies)\b")),
        ("education", re.compile(r"(?i)\b(education|academics)\b")),
    ]

    # Simple priority chunking
    lines = text.split("\n")
    sections: dict[str, list[str]] = {"other": []}
    current_sec = "other"

    for line in lines:
        matched_sec = None
        for sec_name, pat in section_patterns:
            if pat.search(line) and len(line.strip()) < 50:
                matched_sec = sec_name
                break
        if matched_sec:
            current_sec = matched_sec
            if current_sec not in sections:
                sections[current_sec] = []
        sections.setdefault(current_sec, []).append(line)

    # Reassemble with priority: experience, projects, skills, education, other
    priority_order = ["experience", "projects", "skills", "education", "other"]
    assembled = []
    total_len = 0
    for sec in priority_order:
        sec_lines = sections.get(sec, [])
        for line in sec_lines:
            if total_len + len(line) + 1 > max_chars:
                break
            assembled.append(line)
            total_len += len(line) + 1
        if total_len >= max_chars:
            break

    return "\n".join(assembled)


def _extract_pdf(data: bytes) -> str:
    extracted = ""
    # Attempt extraction via pdfplumber
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
            extracted = "\n".join(pages).strip()
    except Exception:
        extracted = ""

    # Fallback to pypdf if pdfplumber failed or returned empty
    if not extracted:
        try:
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(data))
            pages = [p.extract_text() or "" for p in reader.pages]
            extracted = "\n".join(pages).strip()
        except Exception as e:
            raise ResumeError("corrupt_file", f"Failed to parse PDF document: {e}")

    return extracted


def _extract_docx(data: bytes) -> str:
    # Zip bomb & safety verification
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            infolist = zf.infolist()
            if len(infolist) > MAX_DOCX_ENTRIES:
                raise ResumeError("corrupt_file", "DOCX archive exceeds safe entry limit.")
            total_size = sum(info.file_size for info in infolist)
            if total_size > MAX_UNCOMPRESSED_DOCX_SIZE:
                raise ResumeError("corrupt_file", "DOCX archive exceeds uncompressed size limit.")
    except zipfile.BadZipFile:
        raise ResumeError("corrupt_file", "Corrupt or malformed DOCX file.")

    try:
        import docx

        doc = docx.Document(io.BytesIO(data))
        parts = []
        for p in doc.paragraphs:
            if p.text.strip():
                parts.append(p.text.strip())

        # Extract table cells including nested content
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    # Deduplicate repeated merged cell text in a row
                    unique_cells = []
                    for c in cells:
                        if not unique_cells or c != unique_cells[-1]:
                            unique_cells.append(c)
                    parts.append(" | ".join(unique_cells))

        return "\n".join(parts)
    except Exception as e:
        if isinstance(e, ResumeError):
            raise
        raise ResumeError("corrupt_file", f"Failed to extract DOCX document: {e}")


def extract_resume_text(data: bytes, filename: str) -> str:
    """Validate, parse, normalize, and extract text from PDF/DOCX resumes."""
    lower_fn = filename.lower()
    if not (lower_fn.endswith(".pdf") or lower_fn.endswith(".docx")):
        raise ResumeError("unsupported_type", "Only .pdf and .docx file formats are supported.")

    if len(data) > MAX_FILE_SIZE:
        raise ResumeError("too_large", f"Resume file size exceeds maximum limit of 5 MB.")

    if len(data) < 4:
        raise ResumeError("corrupt_file", "File is empty or truncated.")

    # Magic byte check
    if lower_fn.endswith(".pdf"):
        if not data.startswith(b"%PDF"):
            # Check within the first 1024 bytes in case of header offset
            if b"%PDF" not in data[:1024]:
                raise ResumeError("corrupt_file", "File content does not match PDF signature.")
        raw_text = _extract_pdf(data)
    else:  # .docx
        if not data.startswith(b"PK\x03\x04"):
            raise ResumeError("corrupt_file", "File content does not match DOCX/ZIP signature.")
        raw_text = _extract_docx(data)

    normalized = _normalize_text(raw_text)

    # Under 200 chars check
    if len(normalized) < 200:
        raise ResumeError(
            "no_text",
            "We couldn't read text from this file; it may be a scanned image. Upload a text-based PDF or DOCX.",
        )

    # Garbled check
    if _is_garbled(normalized):
        raise ResumeError(
            "no_text",
            "We couldn't read text from this file; it may be a scanned image. Upload a text-based PDF or DOCX.",
        )

    # Keywords check
    has_keyword = any(re.search(pat, normalized, re.IGNORECASE) for pat in RESUME_KEYWORDS)
    if not has_keyword:
        raise ResumeError(
            "not_a_resume",
            "The document does not appear to be a resume. Missing standard sections like education, experience, or skills.",
        )

    # Prioritized truncation
    final_text = _truncate_prioritized(normalized, MAX_CHARS)
    return final_text
