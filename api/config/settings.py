from typing import List

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Settings
    API_TITLE: str = "NYC Open Routing API"
    API_DESCRIPTION: str = "Routing in NYC with pgRouting and authoritative NYC data"
    API_VERSION: str = "0.1.0"

    # Logging Configuration
    LOG_LEVEL: str = Field(default="INFO")

    # Database Configuration
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_DB: str = Field(default="routing")
    POSTGRES_HOST: str = Field(default="db")
    POSTGRES_PORT: str = Field(default="5432")

    # Constructed properties
    @property
    def DATABASE_URI(self) -> str:
        """SQLAlchemy database connection string"""
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}"
            f":{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}"
            f"/{self.POSTGRES_DB}"
        )

    @property
    def DB_PARAMS(self) -> dict:
        """Connection params for direct psycopg connections (used by traffic service)."""
        return {
            "user": self.POSTGRES_USER,
            "password": self.POSTGRES_PASSWORD,
            "dbname": self.POSTGRES_DB,
            "host": self.POSTGRES_HOST,
            "port": self.POSTGRES_PORT,
            "connect_timeout": 60,
        }

    # CORS Configuration
    ALLOW_ORIGINS: List[str] = Field(
        default_factory=lambda: ["http://localhost:3001", "http://client:3000"]
    )
    ALLOW_METHODS: List[str] = Field(default_factory=lambda: ["GET", "POST", "OPTIONS"])
    ALLOW_HEADERS: List[str] = Field(default_factory=lambda: ["*"])

    # Geosupport Configuration
    GEOSUPPORT_TIMEOUT: int = Field(
        default=5, description="Timeout for Geosupport operations in seconds"
    )

    # Search Configuration
    SEARCH_CACHE_TTL: int = Field(default=3600, description="Cache TTL in seconds (1 hour)")
    SEARCH_CACHE_MAX_SIZE: int = Field(default=100, description="Maximum cache entries")
    SEARCH_MAX_RETRIES: int = Field(default=3, description="Maximum retry attempts")
    SEARCH_RETRY_BACKOFF_BASE: float = Field(
        default=1.0, description="Base backoff delay in seconds"
    )

    # Traffic Configuration
    TRAFFIC_ENABLED: bool = Field(default=False, description="Enable live traffic data refresh")
    TRAFFIC_REFRESH_INTERVAL: int = Field(
        default=300, description="Traffic refresh interval in seconds (default: 5 min)"
    )

    # Logging config dictionary
    @property
    def LOGGING_CONFIG(self) -> dict:
        return {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "level": self.LOG_LEVEL,
                },
            },
            "loggers": {
                "geosupport.geosupport": {
                    "level": "WARNING",
                    "handlers": ["console"],
                    "propagate": False,
                },
            },
            "root": {
                "handlers": ["console"],
                "level": self.LOG_LEVEL,
            },
        }

    model_config = ConfigDict(env_file=".env", case_sensitive=True)


# Create a settings instance to be imported
settings = Settings()
