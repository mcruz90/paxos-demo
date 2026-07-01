"""Unit tests for API authentication middleware — bearer token enforcement."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch) -> TestClient:
    """TestClient with API_SECRET_KEY set to a known test value."""
    monkeypatch.setenv("API_SECRET_KEY", "test-secret-key")
    from main import app
    return TestClient(app, raise_server_exceptions=False)


def test_missing_auth_header_returns_401(client: TestClient) -> None:
    response = client.post("/api/appeal/generate", json={})
    assert response.status_code == 401


def test_wrong_scheme_returns_401(client: TestClient) -> None:
    """Basic auth scheme should be rejected — only Bearer is accepted."""
    response = client.post(
        "/api/appeal/generate",
        json={},
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert response.status_code == 401


def test_wrong_token_returns_401(client: TestClient) -> None:
    response = client.post(
        "/api/appeal/generate",
        json={},
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert response.status_code == 401


def test_valid_token_returns_not_401(client: TestClient) -> None:
    """A valid bearer token must not return 401 (may return 422 for bad body — that's fine)."""
    response = client.post(
        "/api/appeal/generate",
        json={},
        headers={"Authorization": "Bearer test-secret-key"},
    )
    assert response.status_code != 401


def test_health_endpoint_requires_no_auth(client: TestClient) -> None:
    """GET /health must not require authentication."""
    response = client.get("/health")
    assert response.status_code == 200


def test_all_api_routes_require_auth(client: TestClient) -> None:
    """No route under /api/* should respond with 200/422 when the auth header is missing."""
    api_routes = ["/api/appeal/generate"]
    for route in api_routes:
        response = client.post(route, json={})
        assert response.status_code == 401, f"{route} returned {response.status_code} without auth"


def test_token_comparison_uses_constant_time_compare(client: TestClient, monkeypatch) -> None:
    """Token check must use hmac.compare_digest (constant-time), not `!=`, to avoid a
    timing side-channel that leaks API_SECRET_KEY byte-by-byte (backend-security-debt item 3)."""
    import hmac as hmac_module

    import main

    calls: list[tuple[str, str]] = []
    real_compare_digest = hmac_module.compare_digest

    def spy_compare_digest(a, b):
        calls.append((a, b))
        return real_compare_digest(a, b)

    monkeypatch.setattr(main.hmac, "compare_digest", spy_compare_digest)

    client.post(
        "/api/appeal/generate",
        json={},
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert calls, "hmac.compare_digest was never called — token compared with a non-constant-time operator"
