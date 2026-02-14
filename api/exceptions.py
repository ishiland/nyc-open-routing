"""
Domain-specific exceptions for the routing application.

These exceptions provide better error handling and separation of concerns
between service logic and HTTP response formatting.
"""

class RoutingError(Exception):
    """Base exception for routing-related errors."""
    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class InvalidCoordinatesError(RoutingError):
    """Raised when coordinates are invalid or out of bounds."""
    pass


class RouteNotFoundError(RoutingError):
    """Raised when no route can be found between origin and destination."""
    pass


class DatabaseError(RoutingError):
    """Raised when database operations fail."""
    pass
