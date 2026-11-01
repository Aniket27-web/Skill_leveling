"""Reports package for generating interview evaluation PDF documents."""

try:
    from app.reports.render import render_report
except ImportError:
    from .render import render_report

__all__ = ["render_report"]

