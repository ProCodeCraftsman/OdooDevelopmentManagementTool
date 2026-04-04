import pytest
import os

os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only-32chars"
os.environ["FERNET_KEY"] = "test-fernet-key-must-be-32-bytes!!"

from app.services.auth_service import AuthService


class TestAuthService:
    def test_hash_password_creates_hash(self):
        service = AuthService()
        hashed = service.hash_password("testpassword")
        assert hashed != "testpassword"
        assert len(hashed) > 0

    def test_hash_password_different_each_time(self):
        service = AuthService()
        hash1 = service.hash_password("testpassword")
        hash2 = service.hash_password("testpassword")
        assert hash1 != hash2

    def test_verify_password_correct(self):
        service = AuthService()
        hashed = service.hash_password("testpassword")
        assert service.verify_password("testpassword", hashed) is True

    def test_verify_password_incorrect(self):
        service = AuthService()
        hashed = service.hash_password("testpassword")
        assert service.verify_password("wrongpassword", hashed) is False

    def test_create_access_token_returns_string(self):
        service = AuthService()
        token = service.create_access_token({"sub": "testuser"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_includes_data(self):
        service = AuthService()
        token = service.create_access_token({"sub": "testuser"})
        decoded = service.decode_token(token)
        assert decoded is not None
        assert decoded.get("sub") == "testuser"

    def test_decode_token_invalid_returns_none(self):
        service = AuthService()
        result = service.decode_token("invalid-token")
        assert result is None

    def test_decode_token_returns_exp(self):
        service = AuthService()
        token = service.create_access_token({"sub": "testuser"})
        decoded = service.decode_token(token)
        assert decoded is not None
        assert "exp" in decoded

    def test_access_token_has_expiration(self):
        service = AuthService()
        token = service.create_access_token({"sub": "testuser"})
        decoded = service.decode_token(token)
        assert decoded is not None
        assert decoded.get("exp") is not None


class TestPasswordHashing:
    def test_special_characters_in_password(self):
        service = AuthService()
        password = "P@ssw0rd!#$%^&*()"
        hashed = service.hash_password(password)
        assert service.verify_password(password, hashed) is True

    def test_unicode_password(self):
        service = AuthService()
        password = "密码密码123"
        hashed = service.hash_password(password)
        assert service.verify_password(password, hashed) is True

    def test_long_password(self):
        service = AuthService()
        password = "a" * 100
        hashed = service.hash_password(password)
        assert service.verify_password(password, hashed) is True
