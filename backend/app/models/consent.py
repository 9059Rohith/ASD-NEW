"""Purpose-specific voice-data consent schemas."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ConsentPurpose = Literal[
    "recording_retention",
    "clinician_sharing",
    "deidentified_research",
]


class ConsentUpdate(BaseModel):
    """One append-only consent decision made by a caregiver."""

    model_config = ConfigDict(extra="forbid")

    purpose: ConsentPurpose
    granted: bool
    policy_version: str = Field(default="2026-08-30", min_length=1, max_length=40)

