"""Shared constants: roles, document types, workflow statuses and allowed transitions."""

ROLE_EXECUTIVE = "executive"
ROLE_MANAGER = "manager"

DOC_TYPES = ("invoice", "packing_list", "bill_of_lading")
DOC_LABELS = {
    "invoice": "Commercial Invoice",
    "packing_list": "Packing List",
    "bill_of_lading": "Bill of Lading",
}

DRAFT = "draft"
DOCS_UPLOADED = "documents_uploaded"
AI_PROCESSING = "ai_processing"
NEEDS_REVIEW = "needs_review"
READY = "ready_for_approval"
APPROVED = "approved"
REJECTED = "rejected"
EXPORTED = "exported"

STATUS_LABELS = {
    DRAFT: "Draft",
    DOCS_UPLOADED: "Documents Uploaded",
    AI_PROCESSING: "AI Processing",
    NEEDS_REVIEW: "Needs Review",
    READY: "Ready for Approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    EXPORTED: "Exported",
}

ALLOWED_TRANSITIONS = {
    DRAFT: {DOCS_UPLOADED},
    DOCS_UPLOADED: {AI_PROCESSING},
    AI_PROCESSING: {NEEDS_REVIEW, DOCS_UPLOADED},
    NEEDS_REVIEW: {READY, DOCS_UPLOADED, AI_PROCESSING},
    READY: {APPROVED, REJECTED, NEEDS_REVIEW},
    REJECTED: {NEEDS_REVIEW, READY, DOCS_UPLOADED, AI_PROCESSING},
    APPROVED: {EXPORTED},
    EXPORTED: set(),
}

UPLOAD_ALLOWED_STATUSES = {DRAFT, DOCS_UPLOADED, NEEDS_REVIEW, REJECTED}
EXTRACT_ALLOWED_STATUSES = {DOCS_UPLOADED, AI_PROCESSING, NEEDS_REVIEW, REJECTED}
EDIT_ALLOWED_STATUSES = {NEEDS_REVIEW, REJECTED, READY}
SUBMIT_ALLOWED_STATUSES = {NEEDS_REVIEW, REJECTED}
EXPORT_ALLOWED_STATUSES = {APPROVED, EXPORTED}


class WorkflowError(Exception):
    """Raised when an action is not allowed in the shipment's current state."""

    def __init__(self, message: str, blockers: list | None = None):
        super().__init__(message)
        self.message = message
        self.blockers = blockers or []
