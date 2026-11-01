import hashlib
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session
from app.ai import ResumeError, extract_resume_text
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import UnprocessableEntityException
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import ResumeListItem, ResumeResponse

router = APIRouter(prefix="/resumes", tags=["resumes"])

MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post(
    "",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResumeResponse:
    filename = file.filename or "resume.pdf"
    lower_name = filename.lower()

    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        raise UnprocessableEntityException(
            message="Only PDF (.pdf) and DOCX (.docx) documents are supported.",
            code="unsupported_type",
        )

    content = await file.read()
    if len(content) > MAX_RESUME_SIZE:
        raise UnprocessableEntityException(
            message="File size exceeds the 5 MB limit.",
            code="too_large",
        )

    if len(content) == 0:
        raise UnprocessableEntityException(
            message="The uploaded file is empty.",
            code="corrupt_file",
        )

    # Magic byte validation
    if lower_name.endswith(".pdf") and not content.startswith(b"%PDF-"):
        raise UnprocessableEntityException(
            message="Invalid PDF file: Missing %PDF header bytes.",
            code="corrupt_file",
        )
    if lower_name.endswith(".docx") and not content.startswith(b"PK\x03\x04"):
        raise UnprocessableEntityException(
            message="Invalid DOCX file: Missing PK archive signature.",
            code="corrupt_file",
        )

    try:
        extracted_text = extract_resume_text(content, filename)
    except ResumeError as re:
        raise UnprocessableEntityException(message=re.message, code=re.code)
    except Exception as e:
        raise UnprocessableEntityException(
            message=f"Unable to process resume: {str(e)}",
            code="corrupt_file",
        )

    if not extracted_text or not extracted_text.strip():
        raise UnprocessableEntityException(
            message="No text could be extracted from the document.",
            code="no_text",
        )

    sha256_hash = hashlib.sha256(content).hexdigest()

    resume = Resume(
        user_id=current_user.id,
        filename=filename,
        extracted_text=extracted_text,
        sha256=sha256_hash,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return ResumeResponse(
        id=resume.id,
        filename=resume.filename,
        char_count=len(extracted_text),
        preview=extracted_text[:500],
    )


@router.get("", response_model=List[ResumeListItem])
def list_resumes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ResumeListItem]:
    resumes = (
        db.query(Resume)
        .filter(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
        .all()
    )
    return resumes
