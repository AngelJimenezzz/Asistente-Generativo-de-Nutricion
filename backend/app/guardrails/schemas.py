from enum import Enum

from app.models.base import CamelModel


class Severity(str, Enum):
    BLOCKING = "blocking"
    WARNING = "warning"


class GuardrailViolation(CamelModel):
    code: str
    severity: Severity
    message: str


class GuardrailReport(CamelModel):
    passed: bool
    violations: list[GuardrailViolation] = []
