from bson.objectid import ObjectId
from typing import Any

def is_valid_object_id(id_string: Any) -> bool:
    """Check if a string is a valid MongoDB ObjectID"""
    if not id_string:
        return False
        
    try:
        ObjectId(str(id_string))
        return True
    except:
        return False