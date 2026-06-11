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
