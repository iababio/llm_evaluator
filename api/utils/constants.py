"""
Application-wide constants used across different modules.
"""

# Sentiment Analysis constants
SENTIMENTS = [
    'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion',
    'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment',
    'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness',
    'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise',
    'neutral'
]

# Sentiment analysis processing config
MAX_CHUNK_LENGTH = 4000  # Maximum tokens per chunk
CHUNK_TIMEOUT = 25.0     # Timeout for individual chunk analysis in seconds
SENTIMENT_MODEL = "gpt-3.5-turbo"  # Faster model for sentiment analysis