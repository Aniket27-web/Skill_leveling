"""PDF Report Generator for AI Mock Interview Coach.

Implements `render_report(session: dict) -> bytes` using ReportLab.
Features:
- Cover header with session metadata (date, difficulty, target role)
- Prominent overall score display
- Executive summary with top strengths and focus areas
- Bar chart of per-question scores (ReportLab Drawing)
- Question-by-question breakdown with dimensions, strengths, improvements, ideal outline
- Robustness: text escaping (xml.sax.saxutils.escape), long answer wrapping,
  unicode support with fallback, null/empty answer handling, up to 15 questions,
  and dynamic page numbering ("Page X of Y").
"""

from __future__ import annotations

import io
import os
import xml.sax.saxutils
from datetime import datetime
from typing import Any, List, Optional, Tuple

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Font Setup (Unicode TTF font with fallback to Helvetica)
# ---------------------------------------------------------------------------

FONT_NORMAL = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"

def _init_fonts() -> Tuple[str, str, str]:
    """Attempt to register a Unicode TTF font; fallback to Helvetica."""
    candidates = [
        # Windows standard fonts
        ("ArialUnicode", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/ariali.ttf"),
        ("SegoeUnicode", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeuii.ttf"),
        ("CalibriUnicode", "C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf", "C:/Windows/Fonts/calibrii.ttf"),
        # Linux standard fonts
        ("DejaVuUnicode", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"),
        ("LiberationUnicode", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"),
        # macOS standard fonts
        ("MacArial", "/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf", "/Library/Fonts/Arial Italic.ttf"),
    ]

    for prefix, norm_p, bold_p, ital_p in candidates:
        if os.path.exists(norm_p):
            try:
                norm_name = f"{prefix}-Regular"
                bold_name = f"{prefix}-Bold"
                ital_name = f"{prefix}-Italic"

                pdfmetrics.registerFont(TTFont(norm_name, norm_p))
                if os.path.exists(bold_p):
                    pdfmetrics.registerFont(TTFont(bold_name, bold_p))
                else:
                    bold_name = norm_name

                if os.path.exists(ital_p):
                    pdfmetrics.registerFont(TTFont(ital_name, ital_p))
                else:
                    ital_name = norm_name

                return norm_name, bold_name, ital_name
            except Exception:
                continue

    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"

FONT_NORMAL, FONT_BOLD, FONT_ITALIC = _init_fonts()


# ---------------------------------------------------------------------------
# Utility: Text escaping & formatting
# ---------------------------------------------------------------------------

def safe_text(val: Any) -> str:
    """Safely convert any value to string, escape XML characters, and preserve newlines."""
    if val is None:
        return ""
    s = str(val)
    # xml escape & < > " '
    escaped = xml.sax.saxutils.escape(s, entities={'"': "&quot;", "'": "&apos;"})
    # Replace newlines with break tags for ReportLab Paragraph
    return escaped.replace("\n", "<br/>")


def safe_date(date_val: Any) -> str:
    """Format ISO date string to human readable format."""
    if not date_val:
        return "N/A"
    try:
        dt_str = str(date_val).replace("Z", "+00:00")
        dt = datetime.fromisoformat(dt_str)
        return dt.strftime("%B %d, %Y • %I:%M %p UTC")
    except Exception:
        return str(date_val)


# ---------------------------------------------------------------------------
# Dynamic Page Numbering Canvas ("Page X of Y")
# ---------------------------------------------------------------------------

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas that writes dynamic 'Page X of Y' in the running footer."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[dict[str, Any]] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int) -> None:
        self.saveState()
        page_w, page_h = self._pagesize

        # Running header (on pages 2+)
        if self._pageNumber > 1:
            self.setFont(FONT_NORMAL, 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(36, page_h - 25, "AI Mock Interview Coach — Evaluation Report")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(36, page_h - 28, page_w - 36, page_h - 28)

        # Running footer (all pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 32, page_w - 36, 32)

        self.setFont(FONT_NORMAL, 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(36, 20, "Confidential • Prepared by AI Mock Interview Coach")

        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - 36, 20, page_str)

        self.restoreState()


# ---------------------------------------------------------------------------
# Bar Chart Flowable
# ---------------------------------------------------------------------------

def create_score_chart(questions: List[dict[str, Any]], available_width: float = 540) -> Drawing:
    """Generate a ReportLab VerticalBarChart representing per-question scores."""
    d = Drawing(available_width, 140)

    # Background panel
    d.add(Rect(0, 0, available_width, 140, fillColor=colors.HexColor("#F8FAFC"),
               strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1, rx=6, ry=6))

    # Title inside drawing
    d.add(String(16, 118, "Per-Question Score Overview", fontName=FONT_BOLD,
                 fontSize=11, fillColor=colors.HexColor("#1E293B")))

    if not questions:
        d.add(String(available_width / 2 - 50, 60, "No questions evaluated",
                     fontName=FONT_NORMAL, fontSize=10, fillColor=colors.HexColor("#94A3B8")))
        return d

    scores = []
    cat_names = []
    for idx, q in enumerate(questions):
        raw_score = q.get("score")
        val = float(raw_score) if raw_score is not None else 0.0
        scores.append(val)
        cat_names.append(f"Q{idx + 1}")

    chart = VerticalBarChart()
    chart.x = 42
    chart.y = 22
    chart.height = 78
    chart.width = available_width - 64
    chart.data = [scores]
    chart.categoryAxis.categoryNames = cat_names
    chart.categoryAxis.labels.fontSize = 8
    chart.categoryAxis.labels.fontName = FONT_BOLD
    chart.categoryAxis.labels.fillColor = colors.HexColor("#475569")
    chart.categoryAxis.visibleTicks = 0

    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 10
    chart.valueAxis.valueStep = 2
    chart.valueAxis.labels.fontSize = 8
    chart.valueAxis.labels.fontName = FONT_NORMAL
    chart.valueAxis.labels.fillColor = colors.HexColor("#64748B")

    # Bar appearance
    chart.bars[0].fillColor = colors.HexColor("#2563EB")
    chart.bars[0].strokeColor = colors.HexColor("#1D4ED8")
    chart.bars[0].strokeWidth = 0.5

    d.add(chart)
    return d


# ---------------------------------------------------------------------------
# Main Report Builder
# ---------------------------------------------------------------------------

def render_report(session: dict[str, Any]) -> bytes:
    """Render a comprehensive interview evaluation report into a PDF binary.

    Args:
        session: Dict conforming to GET /api/sessions/{id} shape plus overall_score,
                 summary, and created_at.

    Returns:
        bytes starting with b"%PDF"
    """
    buffer = io.BytesIO()

    # 36pt = 0.5in margins on Letter (612 x 792 pt) -> available width: 540 pt
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=42,
    )

    content_w = 540.0
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CoverTitle",
        fontName=FONT_BOLD,
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0F172A"),
    )
    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        fontName=FONT_NORMAL,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B"),
    )
    section_h1 = ParagraphStyle(
        "SectionH1",
        fontName=FONT_BOLD,
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        fontName=FONT_NORMAL,
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
    )
    body_bold = ParagraphStyle(
        "ReportBodyBold",
        fontName=FONT_BOLD,
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
    )
    meta_label_style = ParagraphStyle(
        "MetaLabel",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#64748B"),
    )
    meta_val_style = ParagraphStyle(
        "MetaVal",
        fontName=FONT_NORMAL,
        fontSize=9.5,
        leading=12.5,
        textColor=colors.HexColor("#0F172A"),
    )
    bullet_green = ParagraphStyle(
        "BulletGreen",
        fontName=FONT_NORMAL,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#065F46"),
        leftIndent=12,
        firstLineIndent=-12,
    )
    bullet_amber = ParagraphStyle(
        "BulletAmber",
        fontName=FONT_NORMAL,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#92400E"),
        leftIndent=12,
        firstLineIndent=-12,
    )
    bullet_slate = ParagraphStyle(
        "BulletSlate",
        fontName=FONT_NORMAL,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        leftIndent=12,
        firstLineIndent=-12,
    )
    answer_style = ParagraphStyle(
        "CandidateAnswer",
        fontName=FONT_NORMAL,
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#1E293B"),
        backColor=colors.HexColor("#F8FAFC"),
        borderColor=colors.HexColor("#CBD5E1"),
        borderWidth=0.5,
        borderPadding=7,
        spaceBefore=2,
        spaceAfter=6,
    )

    story: List[Any] = []

    # -----------------------------------------------------------------------
    # 1. Header / Cover Banner
    # -----------------------------------------------------------------------
    header_table_data = [
        [
            Paragraph("AI Mock Interview Coach", title_style),
            Paragraph(
                f"<b>Status:</b> {safe_text(session.get('status', 'completed')).upper()}",
                ParagraphStyle("StatusTag", fontName=FONT_BOLD, fontSize=10,
                               textColor=colors.HexColor("#2563EB"), alignment=2),
            ),
        ],
        [
            Paragraph("Comprehensive Candidate Performance & Evaluation Report", subtitle_style),
            Paragraph(f"Session #{safe_text(str(session.get('id', 'N/A'))[:8])}",
                      ParagraphStyle("SessTag", fontName=FONT_NORMAL, fontSize=9,
                                     textColor=colors.HexColor("#64748B"), alignment=2)),
        ],
    ]
    header_table = Table(header_table_data, colWidths=[360, 180])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"),
                            spaceAfter=10, spaceBefore=2))

    # -----------------------------------------------------------------------
    # 2. Metadata Grid
    # -----------------------------------------------------------------------
    target_role = session.get("target_role") or "General Software Engineering"
    difficulty = (session.get("difficulty") or "Medium").capitalize()
    created_date = safe_date(session.get("created_at"))
    timer_secs = session.get("timer_seconds")
    timer_label = f"{timer_secs}s / question" if timer_secs else "Untimed"
    total_q = session.get("num_questions", len(session.get("questions", [])))

    meta_cells = [
        [
            Paragraph("TARGET ROLE", meta_label_style),
            Paragraph("DIFFICULTY", meta_label_style),
            Paragraph("QUESTIONS", meta_label_style),
            Paragraph("TIMER", meta_label_style),
            Paragraph("DATE COMPLETED", meta_label_style),
        ],
        [
            Paragraph(safe_text(target_role), meta_val_style),
            Paragraph(safe_text(difficulty), meta_val_style),
            Paragraph(f"{total_q} questions", meta_val_style),
            Paragraph(safe_text(timer_label), meta_val_style),
            Paragraph(safe_text(created_date), meta_val_style),
        ],
    ]
    meta_table = Table(meta_cells, colWidths=[130, 80, 80, 90, 160])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#EDF2F7")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # -----------------------------------------------------------------------
    # 3. Overall Score & Executive Summary
    # -----------------------------------------------------------------------
    overall_score = session.get("overall_score")
    score_display = f"{float(overall_score):.1f}" if overall_score is not None else "N/A"

    score_badge_style = ParagraphStyle(
        "ScoreNum",
        fontName=FONT_BOLD,
        fontSize=30,
        leading=34,
        textColor=colors.HexColor("#1E3A8A"),
        alignment=1,
    )
    score_sub_style = ParagraphStyle(
        "ScoreSub",
        fontName=FONT_BOLD,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2563EB"),
        alignment=1,
    )

    summary_obj = session.get("summary")
    summary_text = summary_obj.get("text") if isinstance(summary_obj, dict) else None
    if not summary_text:
        summary_text = "Overall session evaluation completed. Detailed per-question metrics are provided below."

    score_card_data = [
        [
            Paragraph(score_display, score_badge_style),
            Paragraph(f"<b>Executive Summary</b><br/>{safe_text(summary_text)}", body_style),
        ],
        [
            Paragraph("OUT OF 10", score_sub_style),
            "",
        ],
    ]
    score_table = Table(score_card_data, colWidths=[110, 430])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EFF6FF")),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#BFDBFE")),
        ("INNERGRID", (0, 0), (0, -1), 0, colors.transparent),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("SPAN", (1, 0), (1, 1)),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 10))

    # Top Strengths & Focus Areas side-by-side
    top_strengths = summary_obj.get("top_strengths") if isinstance(summary_obj, dict) else []
    focus_areas = summary_obj.get("focus_areas") if isinstance(summary_obj, dict) else []

    strengths_paragraphs: List[Any] = [Paragraph("<b>Top Strengths</b>", ParagraphStyle(
        "SH", fontName=FONT_BOLD, fontSize=10, textColor=colors.HexColor("#065F46")))]
    if top_strengths:
        for st in top_strengths:
            strengths_paragraphs.append(Paragraph(f"• {safe_text(st)}", bullet_green))
    else:
        strengths_paragraphs.append(Paragraph("• No key strengths specified.", bullet_green))

    focus_paragraphs: List[Any] = [Paragraph("<b>Focus Areas</b>", ParagraphStyle(
        "FH", fontName=FONT_BOLD, fontSize=10, textColor=colors.HexColor("#92400E")))]
    if focus_areas:
        for fa in focus_areas:
            focus_paragraphs.append(Paragraph(f"• {safe_text(fa)}", bullet_amber))
    else:
        focus_paragraphs.append(Paragraph("• No immediate focus areas specified.", bullet_amber))

    strength_focus_table = Table([[strengths_paragraphs, focus_paragraphs]], colWidths=[265, 265])
    strength_focus_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#ECFDF5")),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#FFFBEB")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#A7F3D0")),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#FDE68A")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(strength_focus_table)
    story.append(Spacer(1, 12))

    # -----------------------------------------------------------------------
    # 4. Bar Chart: Per-Question Scores
    # -----------------------------------------------------------------------
    questions = session.get("questions") or []
    chart_drawing = create_score_chart(questions, available_width=content_w)
    story.append(chart_drawing)
    story.append(Spacer(1, 16))

    # -----------------------------------------------------------------------
    # 5. Detailed Question Analysis
    # -----------------------------------------------------------------------
    story.append(Paragraph("Detailed Question Breakdown", section_h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"),
                            spaceAfter=10, spaceBefore=2))

    for idx, q in enumerate(questions):
        q_num = q.get("order_index", idx + 1)
        category = safe_text((q.get("category") or "general").capitalize())
        raw_score = q.get("score")
        score_txt = f"{raw_score}/10" if raw_score is not None else "Unscored"
        eval_status = q.get("eval_status", "done")

        # Question header bar
        q_header_data = [
            [
                Paragraph(f"<b>Question {q_num} of {len(questions)}</b> &nbsp;•&nbsp; <font color='#64748B'>Category: {category}</font>",
                          ParagraphStyle("QH", fontName=FONT_BOLD, fontSize=10, textColor=colors.HexColor("#0F172A"))),
                Paragraph(f"Score: <b>{score_txt}</b>",
                          ParagraphStyle("QS", fontName=FONT_BOLD, fontSize=10,
                                         textColor=colors.HexColor("#2563EB") if raw_score is not None else colors.HexColor("#DC2626"),
                                         alignment=2)),
            ]
        ]
        q_head_table = Table(q_header_data, colWidths=[400, 140])
        q_head_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ]))

        # Question prompt & Answer
        q_text = q.get("text") or "(No question text)"
        answer_text = q.get("answer_text")
        if not answer_text or not str(answer_text).strip():
            answer_display = "<font color='#94A3B8'><i>No answer provided (timed out or skipped).</i></font>"
        else:
            answer_display = safe_text(answer_text)

        # Question prompt flowable
        q_prompt_p = Paragraph(f"<b>Question:</b><br/>{safe_text(q_text)}", body_style)

        # Keep question header and question text together so they don't break across pages
        story.append(KeepTogether([q_head_table, Spacer(1, 4), q_prompt_p, Spacer(1, 4)]))

        # Candidate response
        story.append(Paragraph("<b>Candidate's Response:</b>", meta_label_style))
        story.append(Paragraph(answer_display, answer_style))
        story.append(Spacer(1, 4))

        # Dimension scores bar (Relevance, Accuracy, Depth, Clarity)
        dims = q.get("dimensions") or {}
        dim_data = [
            [
                Paragraph("<b>Relevance</b>", meta_label_style),
                Paragraph("<b>Accuracy</b>", meta_label_style),
                Paragraph("<b>Depth</b>", meta_label_style),
                Paragraph("<b>Clarity</b>", meta_label_style),
            ],
            [
                Paragraph(f"{dims.get('relevance', 'N/A')}/10", body_bold),
                Paragraph(f"{dims.get('accuracy', 'N/A')}/10", body_bold),
                Paragraph(f"{dims.get('depth', 'N/A')}/10", body_bold),
                Paragraph(f"{dims.get('clarity', 'N/A')}/10", body_bold),
            ]
        ]
        dim_table = Table(dim_data, colWidths=[135, 135, 135, 135])
        dim_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        story.append(dim_table)
        story.append(Spacer(1, 4))

        # Strengths & Improvements
        q_strengths = q.get("strengths") or []
        q_improvements = q.get("improvements") or []
        missed_points = q.get("missed_points") or []
        ideal_outline = q.get("ideal_outline") or []

        feedback_cells: List[Any] = []
        if q_strengths:
            feedback_cells.append(Paragraph("<b>Strengths:</b>", ParagraphStyle(
                "StrLbl", fontName=FONT_BOLD, fontSize=8.5, textColor=colors.HexColor("#065F46"))))
            for st in q_strengths:
                feedback_cells.append(Paragraph(f"• {safe_text(st)}", bullet_green))
            feedback_cells.append(Spacer(1, 3))

        if q_improvements:
            feedback_cells.append(Paragraph("<b>Areas for Improvement:</b>", ParagraphStyle(
                "ImpLbl", fontName=FONT_BOLD, fontSize=8.5, textColor=colors.HexColor("#92400E"))))
            for imp in q_improvements:
                feedback_cells.append(Paragraph(f"• {safe_text(imp)}", bullet_amber))
            feedback_cells.append(Spacer(1, 3))

        if missed_points:
            feedback_cells.append(Paragraph("<b>Missed Key Points:</b>", ParagraphStyle(
                "MisLbl", fontName=FONT_BOLD, fontSize=8.5, textColor=colors.HexColor("#B91C1C"))))
            for mp in missed_points:
                feedback_cells.append(Paragraph(f"• {safe_text(mp)}", ParagraphStyle(
                    "BulletRed", fontName=FONT_NORMAL, fontSize=9, leading=13,
                    textColor=colors.HexColor("#7F1D1D"), leftIndent=12, firstLineIndent=-12)))
            feedback_cells.append(Spacer(1, 3))

        if ideal_outline:
            feedback_cells.append(Paragraph("<b>Ideal Answer Outline:</b>", meta_label_style))
            for io_item in ideal_outline:
                feedback_cells.append(Paragraph(f"• {safe_text(io_item)}", bullet_slate))

        if not feedback_cells:
            feedback_cells.append(Paragraph("<i>No feedback recorded for this question.</i>", body_style))

        feedback_table = Table([[feedback_cells]], colWidths=[540])
        feedback_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#FAFAFA")),
            ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(feedback_table)
        story.append(Spacer(1, 14))

    # Build PDF with dynamic NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
