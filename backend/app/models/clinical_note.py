"""Clinician-authored guidance attached to an assigned child profile."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClinicalNoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=2000)
    next_target: Optional[str] = Field(default=None, max_length=64)
    caregiver_visible: bool = True

    @field_validator("text")
    @classmethod
    def text_must_contain_words(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Clinical note cannot be empty")
        return value

