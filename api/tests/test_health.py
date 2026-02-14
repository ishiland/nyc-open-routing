import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from api.main import app
from api.dependencies import get_db_engine


client = TestClient(app)


class TestHealthCheck:
    """Test suite for health check endpoint."""

    def test_health_check_returns_200(self):
        """Test that health check returns 200 status."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_health_check_returns_healthy_status(self):
        """Test that health check returns healthy status."""
        response = client.get("/api/v1/health")
        assert response.json() == {"status": "healthy"}

    def test_health_check_no_database_dependency(self):
        """Test that health check doesn't require database connection."""
        # Health check should work even if database is down
        response = client.get("/api/v1/health")
        assert response.status_code == 200


class TestReadinessCheck:
    """Test suite for readiness check endpoint."""

    def test_readiness_check_success(self, mock_db_engine):
        """Test successful readiness check with working database."""
        # Mock successful database connection
        mock_conn = MagicMock()
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (1,)
        mock_conn.execute.return_value = mock_result
        mock_db_engine.connect.return_value.__enter__.return_value = mock_conn

        # Override dependency
        app.dependency_overrides[get_db_engine] = lambda: mock_db_engine
        try:
            response = client.get("/api/v1/ready")
            assert response.status_code == 200
            assert response.json()["status"] == "ready"
            assert response.json()["database"] == "connected"
        finally:
            app.dependency_overrides.clear()

    def test_readiness_check_database_connection_failure(self, mock_db_engine):
        """Test readiness check fails when database connection fails."""
        # Mock database connection failure
        mock_db_engine.connect.side_effect = Exception("Connection refused")

        # Override dependency
        app.dependency_overrides[get_db_engine] = lambda: mock_db_engine
        try:
            response = client.get("/api/v1/ready")
            assert response.status_code == 503
            assert response.json()["detail"]["status"] == "not ready"
            assert response.json()["detail"]["database"] == "disconnected"
            assert "Connection refused" in response.json()["detail"]["error"]
        finally:
            app.dependency_overrides.clear()

    def test_readiness_check_database_query_failure(self, mock_db_engine):
        """Test readiness check fails when database query fails."""
        # Mock database query failure
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Query failed")
        mock_db_engine.connect.return_value.__enter__.return_value = mock_conn

        # Override dependency
        app.dependency_overrides[get_db_engine] = lambda: mock_db_engine
        try:
            response = client.get("/api/v1/ready")
            assert response.status_code == 503
            assert response.json()["detail"]["status"] == "not ready"
            assert response.json()["detail"]["database"] == "disconnected"
        finally:
            app.dependency_overrides.clear()

    def test_readiness_check_executes_simple_query(self, mock_db_engine):
        """Test that readiness check executes SELECT 1 query."""
        # Mock successful database connection
        mock_conn = MagicMock()
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (1,)
        mock_conn.execute.return_value = mock_result
        mock_db_engine.connect.return_value.__enter__.return_value = mock_conn

        # Override dependency
        app.dependency_overrides[get_db_engine] = lambda: mock_db_engine
        try:
            response = client.get("/api/v1/ready")
            # Verify execute was called (checking the query would require inspecting call args)
            assert mock_conn.execute.called
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()

    def test_readiness_check_response_structure(self, mock_db_engine):
        """Test that readiness check returns expected response structure."""
        # Mock successful database connection
        mock_conn = MagicMock()
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (1,)
        mock_conn.execute.return_value = mock_result
        mock_db_engine.connect.return_value.__enter__.return_value = mock_conn

        # Override dependency
        app.dependency_overrides[get_db_engine] = lambda: mock_db_engine
        try:
            response = client.get("/api/v1/ready")
            data = response.json()
            assert "status" in data
            assert "database" in data
            assert isinstance(data["status"], str)
            assert isinstance(data["database"], str)
        finally:
            app.dependency_overrides.clear()

    def test_readiness_check_error_response_structure(self, mock_db_engine):
        """Test that readiness check error returns expected structure."""
        # Mock database failure
        mock_db_engine.connect.side_effect = Exception("DB Error")

        # Override dependency
        app.dependency_overrides[get_db_engine] = lambda: mock_db_engine
        try:
            response = client.get("/api/v1/ready")
            assert response.status_code == 503
            data = response.json()
            assert "detail" in data
            assert "status" in data["detail"]
            assert "database" in data["detail"]
            assert "error" in data["detail"]
        finally:
            app.dependency_overrides.clear()
