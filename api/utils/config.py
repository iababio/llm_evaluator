import os
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api.config")


class Config:
    """
    Configuration class for managing application settings.
    
    This class handles loading environment variables,
    providing default values, and configuring services.
    """
    
    # Default configuration values
    DEFAULT_CONFIG = {
        "OPENAI_MODEL": "gpt-4o",
        "LOG_LEVEL": "INFO",
        "ENABLE_TOOL_CALLS": True,
        "STREAM_TIMEOUT_SECONDS": 60,
        "DATABASE_URI": "mongodb://localhost:27017/",
        "DATABASE_NAME": "llm_eval",
    }
    
    def __init__(self, env_file: str = ".env.local"):
        """
        Initialize configuration by loading environment variables.
        
        Args:
            env_file: Path to the .env file
        """
        load_dotenv(env_file)
        self._validate_required_env_vars()
        
        self._openai_client = None
    
    def _validate_required_env_vars(self):
        """Validate that required environment variables are present."""
        required_vars = ["OPENAI_API_KEY"]
        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        
        if missing_vars:
            error_message = f"Missing required environment variables: {', '.join(missing_vars)}"
            logger.error(error_message)
            raise ValueError(error_message)
    
    @property
    def openai_client(self) -> OpenAI:
        """Get or initialize the OpenAI client."""
        if self._openai_client is None:
            self._openai_client = OpenAI(
                api_key=os.environ.get("OPENAI_API_KEY")
            )
        return self._openai_client
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value from environment or defaults.
        
        Args:
            key: Configuration key to retrieve
            default: Default value if not found
            
        Returns:
            Configuration value
        """
        env_value = os.environ.get(key)
        if env_value is not None:
            return env_value
        
        return self.DEFAULT_CONFIG.get(key, default)
    
    @property
    def openai_model(self) -> str:
        """Get the configured OpenAI model name."""
        return self.get("OPENAI_MODEL")
    
    @property
    def database_uri(self) -> str:
        """Get the configured database URI."""
        return self.get("DATABASE_URI")
    
    @property
    def database_name(self) -> str:
        """Get the configured database name."""
        return self.get("DATABASE_NAME")
    
    @property
    def enable_tool_calls(self) -> bool:
        """Check if tool calls are enabled."""
        value = self.get("ENABLE_TOOL_CALLS")
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes")
        return bool(value)
    
    @property
    def stream_timeout(self) -> int:
        """Get the configured stream timeout in seconds."""
        timeout = self.get("STREAM_TIMEOUT_SECONDS")
        try:
            return int(timeout)
        except (ValueError, TypeError):
            return 60  # Default timeout
    
    def as_dict(self) -> Dict[str, Any]:
        """
        Get all configuration as a dictionary.
        
        Returns:
            Dictionary of configuration values
        """
        config_dict = {}
        for key in self.DEFAULT_CONFIG:
            config_dict[key] = self.get(key)
        
        for key, value in os.environ.items():
            if key.startswith("APP_"):
                config_dict[key] = value
        
        return config_dict
    
    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'Config':
        """
        Create a Config instance from a dictionary.
        
        Args:
            config_dict: Dictionary of configuration values
            
        Returns:
            Config instance
        """
        instance = cls(env_file=None)
        
        for key, value in config_dict.items():
            os.environ[key] = str(value)
        
        return instance


config = Config()

client = config.openai_client
DEFAULT_MODEL = config.openai_model
