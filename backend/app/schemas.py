"""Request bodies (Pydantic). Responses are built by app/serializers.py."""
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True)]


class LoginRequest(BaseModel):
    username: Text = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)


class ShipmentCreate(BaseModel):
    shipment_ref: Text | None = Field(default=None, pattern=r"^[A-Za-z0-9-]{3,30}$")
    importer_name: Text = Field(min_length=2, max_length=200)
    origin_country: Text = Field(min_length=2, max_length=100)
    destination: Text | None = Field(default=None, max_length=200)


class FieldUpdate(BaseModel):
    value: str | None = Field(default=None, max_length=1000)
    verified: bool | None = None


class ResolveRequest(BaseModel):
    note: Text = Field(min_length=5, max_length=1000)


class ApprovalRequest(BaseModel):
    comment: Text | None = Field(default=None, max_length=1000)
