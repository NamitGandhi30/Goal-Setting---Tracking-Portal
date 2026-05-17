"""Notification delivery for Phase 3 workflow events."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Iterable

import httpx

from app.core.config import get_settings


class NotificationService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def goal_submitted(
        self,
        manager_email: str | None,
        manager_name: str | None,
        employee_name: str,
        cycle_id: str,
    ) -> None:
        link = f"{self.settings.APP_FRONTEND_URL}/dashboard/approvals"
        await self._send_email(
            [manager_email],
            "Goals submitted for review",
            f"{employee_name} submitted goals for review.\n\nOpen approvals: {link}",
        )
        await self._send_teams(
            "Goals submitted",
            f"{employee_name} submitted goals for {manager_name or 'manager'} review.",
            link,
        )

    async def goal_reviewed(
        self,
        employee_email: str | None,
        employee_name: str,
        goal_title: str,
        approved: bool,
        goal_id: str,
    ) -> None:
        status = "approved" if approved else "returned"
        link = f"{self.settings.APP_FRONTEND_URL}/dashboard/goals?goal_id={goal_id}"
        await self._send_email(
            [employee_email],
            f"Goal {status}",
            f"Your goal '{goal_title}' was {status}.\n\nOpen goal sheet: {link}",
        )

    async def checkin_reminder(
        self,
        recipients: Iterable[str | None],
        cycle_id: str,
        phase: str,
    ) -> None:
        link = f"{self.settings.APP_FRONTEND_URL}/dashboard/tracking?cycle_id={cycle_id}&phase={phase}"
        await self._send_email(
            recipients,
            f"{phase} check-in reminder",
            f"Please complete your {phase} check-in.\n\nOpen tracking: {link}",
        )

    async def _send_email(
        self,
        recipients: Iterable[str | None],
        subject: str,
        body: str,
    ) -> None:
        to_addresses = [email for email in recipients if email]
        if not to_addresses or not self.settings.SMTP_HOST or not self.settings.SMTP_FROM_EMAIL:
            return

        message = EmailMessage()
        message["From"] = self.settings.SMTP_FROM_EMAIL
        message["To"] = ", ".join(to_addresses)
        message["Subject"] = subject
        message.set_content(body)

        def send() -> None:
            with smtplib.SMTP(self.settings.SMTP_HOST, self.settings.SMTP_PORT, timeout=10) as smtp:
                if self.settings.SMTP_USE_TLS:
                    smtp.starttls()
                if self.settings.SMTP_USERNAME and self.settings.SMTP_PASSWORD:
                    smtp.login(self.settings.SMTP_USERNAME, self.settings.SMTP_PASSWORD)
                smtp.send_message(message)

        import anyio

        await anyio.to_thread.run_sync(send)

    async def _send_teams(self, title: str, text: str, link: str) -> None:
        if not self.settings.TEAMS_WEBHOOK_URL:
            return
        payload = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": title,
            "themeColor": "2563EB",
            "title": title,
            "text": text,
            "potentialAction": [
                {
                    "@type": "OpenUri",
                    "name": "Open goal portal",
                    "targets": [{"os": "default", "uri": link}],
                }
            ],
        }
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(self.settings.TEAMS_WEBHOOK_URL, json=payload)
