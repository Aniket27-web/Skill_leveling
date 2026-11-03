import hashlib
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status, Response
from sqlalchemy.orm import Session
from app.ai import ResumeError, extract_resume_text
from app.ai.resume import extract_resume_profile
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import NotFoundException, UnprocessableEntityException
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import ResumeListItem, ResumeResponse

router = APIRouter(prefix="/resumes", tags=["resumes"])

MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB


async def _extract_uploaded_resume(file: UploadFile) -> tuple[str, bytes, str, dict]:
    filename = file.filename or "resume.pdf"
    lower_name = filename.lower()
    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        raise UnprocessableEntityException("Only PDF (.pdf) and DOCX (.docx) documents are supported.", code="unsupported_type")
    content = await file.read()
    if len(content) > MAX_RESUME_SIZE:
        raise UnprocessableEntityException("File size exceeds the 5 MB limit.", code="too_large")
    if not content:
        raise UnprocessableEntityException("The uploaded file is empty.", code="corrupt_file")
    if lower_name.endswith(".pdf") and not content.startswith(b"%PDF-"):
        raise UnprocessableEntityException("Invalid PDF file: Missing %PDF header bytes.", code="corrupt_file")
    if lower_name.endswith(".docx") and not content.startswith(b"PK\x03\x04"):
        raise UnprocessableEntityException("Invalid DOCX file: Missing PK archive signature.", code="corrupt_file")
    try:
        extracted_text = extract_resume_text(content, filename)
    except ResumeError as exc:
        raise UnprocessableEntityException(message=exc.message, code=exc.code)
    except Exception as exc:
        raise UnprocessableEntityException(message=f"Unable to process resume: {str(exc)}", code="corrupt_file")
    if not extracted_text or not extracted_text.strip():
        raise UnprocessableEntityException("No text could be extracted from the document.", code="no_text")
    return filename, content, extracted_text, extract_resume_profile(extracted_text)


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
    filename, content, extracted_text, profile = await _extract_uploaded_resume(file)
    sha256_hash = hashlib.sha256(content).hexdigest()

    resume = Resume(
        user_id=current_user.id,
        filename=filename,
        extracted_text=extracted_text,
        profile=profile,
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
        profile=profile,
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


@router.put("/{resume_id}", response_model=ResumeResponse)
async def replace_resume(
    resume_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResumeResponse:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise NotFoundException("Resume not found", code="not_found")
    filename, content, extracted_text, profile = await _extract_uploaded_resume(file)
    resume.filename = filename
    resume.extracted_text = extracted_text
    resume.profile = profile
    resume.sha256 = hashlib.sha256(content).hexdigest()
    db.commit()
    db.refresh(resume)
    return ResumeResponse(id=resume.id, filename=resume.filename, char_count=len(extracted_text), preview=extracted_text[:500], profile=profile)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    resume_id: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == current_user.id).first()
    if not resume:
        raise NotFoundException("Resume not found", code="not_found")
    db.delete(resume)
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    return response

