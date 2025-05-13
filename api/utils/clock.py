from datetime import datetime, tzinfo
from typing import Optional

class Clock:
    """
    A clock abstraction for dependency injection and easier testing.
    """
    def __init__(self, tz: Optional[tzinfo] = None):
        """
        Initialize a clock with optional timezone.
        
        Args:
            tz: Optional timezone to use for datetime operations
        """
        self.tz = tz
        
    def now(self) -> datetime:
        """
        Get the current datetime.
        
        Returns:
            Current datetime object
        """
        return datetime.now(self.tz)
    
    @property
    def hour(self) -> int:
        """
        Get the current hour (0-23).
        
        Returns:
            Current hour as integer
        """
        return self.now().hour
    
    @property
    def day_of_week(self) -> int:
        """
        Get the current day of week (0-6, where 0 is Monday).
        
        Returns:
            Current day of week as integer
        """
        return self.now().weekday() 