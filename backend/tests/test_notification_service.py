from types import SimpleNamespace

import pytest

from app.services import notification_service
from app.services.notification_service import NotificationService


class _Response:
    def raise_for_status(self) -> None:
        return None


class _AsyncClient:
    calls = []

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, url, *, json, headers):
        self.calls.append({"url": url, "json": json, "headers": headers})
        return _Response()


@pytest.mark.asyncio
async def test_send_email_uses_resend_when_configured(monkeypatch):
    _AsyncClient.calls.clear()
    monkeypatch.setattr(notification_service.httpx, "AsyncClient", _AsyncClient)
    monkeypatch.setattr(
        notification_service,
        "get_settings",
        lambda: SimpleNamespace(
            RESEND_API_KEY="re_test",
            RESEND_FROM_EMAIL="Goal Portal <notify@example.com>",
            RESEND_REPLY_TO="support@example.com",
            SMTP_HOST=None,
            SMTP_FROM_EMAIL=None,
        ),
    )

    service = NotificationService()

    await service._send_email(["manager@example.com"], "Subject", "Body")

    assert _AsyncClient.calls == [
        {
            "url": "https://api.resend.com/emails",
            "json": {
                "from": "Goal Portal <notify@example.com>",
                "to": ["manager@example.com"],
                "subject": "Subject",
                "text": "Body",
                "reply_to": "support@example.com",
            },
            "headers": {"Authorization": "Bearer re_test"},
        }
    ]
