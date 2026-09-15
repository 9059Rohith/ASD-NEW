"""Production configuration contract tests."""
import pytest
from pydantic import ValidationError

from app.config import Settings


def production_settings(**overrides):
    values = {
        "APP_ENV": "production",
        "MONGODB_URL": "mongodb+srv://app.example.test/speakeasy",
        "JWT_SECRET_KEY": "a-production-secret-that-is-long-enough",
        "ADMIN_EMAIL": "admin@speakeasy.example",
        "ADMIN_PASSWORD": "A-secure-password-123",
        "COOKIE_SECURE": True,
        "COOKIE_SAMESITE": "none",
        "CORS_ORIGINS": "https://speakeasy.example",
        "TRUSTED_HOSTS": "api.speakeasy.example",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_cors_and_host_lists_are_normalized():
    config = Settings(
        _env_file=None,
        CORS_ORIGIN="https://app.example.com/",
        CORS_ORIGINS="https://app.example.com, https://preview.example.com",
        TRUSTED_HOSTS="app.example.com, api.example.com",
    )
    assert config.cors_origins == ["https://app.example.com", "https://preview.example.com"]
    assert config.trusted_hosts == ["app.example.com", "api.example.com"]


def test_development_accepts_both_local_browser_origins():
    config = Settings(_env_file=None, APP_ENV="development", CORS_ORIGIN="")

    assert "http://localhost:5173" in config.cors_origins
    assert "http://127.0.0.1:5173" in config.cors_origins


def test_production_rejects_short_or_default_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="production", JWT_SECRET_KEY="too-short")


def test_production_requires_secure_cookies_and_real_admin_password():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            APP_ENV="production",
            JWT_SECRET_KEY="x" * 48,
            ADMIN_PASSWORD="A-secure-password-123",
            COOKIE_SECURE=False,
        )


def test_cloudinary_feature_flag_is_explicit():
    config = Settings(_env_file=None)
    assert config.cloudinary_enabled is False


@pytest.mark.parametrize(
    "override",
    [
        {"MONGODB_URL": "mongodb://localhost:27017"},
        {"MONGODB_URL": "mongodb://127.0.0.1:27017"},
        {"ADMIN_EMAIL": "admin@example.com"},
        {"CORS_ORIGINS": "http://speakeasy.example"},
        {"CORS_ORIGINS": "*"},
        {"TRUSTED_HOSTS": "localhost"},
        {"TRUSTED_HOSTS": "*"},
        {"EXPOSE_DEV_CODES": True},
        {"MONGODB_TLS_ALLOW_INVALID_CERTIFICATES": True},
    ],
)
def test_production_rejects_unsafe_deployment_values(override):
    with pytest.raises(ValidationError):
        production_settings(**override)


def test_production_rejects_partial_cloudinary_configuration():
    with pytest.raises(ValidationError):
        production_settings(CLOUDINARY_CLOUD_NAME="configured-alone")
