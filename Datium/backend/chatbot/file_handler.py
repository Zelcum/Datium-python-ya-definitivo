from __future__ import annotations

from typing import Tuple


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif"}


def extract_text_from_file(file_obj) -> Tuple[str, str]:
    name = getattr(file_obj, "name", "archivo")
    filename = (name or "archivo").lower()

    text = ""
    try:
        if filename.endswith(".pdf"):
            import PyPDF2

            reader = PyPDF2.PdfReader(file_obj)
            for page in reader.pages:
                text_piece = page.extract_text() or ""
                if text_piece:
                    text += text_piece + "\n"
        elif filename.endswith(".docx"):
            from docx import Document

            doc = Document(file_obj)
            for para in doc.paragraphs:
                if para.text:
                    text += para.text + "\n"
        elif filename.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            text = f"[Imagen adjunta: {name}]"
        else:
            raw = file_obj.read()
            if isinstance(raw, str):
                text = raw
            else:
                text = raw.decode("utf-8", errors="ignore")
    except Exception:
        text = ""

    label = f"[ARCHIVO: {name}]"
    return label, (text or "").strip()
