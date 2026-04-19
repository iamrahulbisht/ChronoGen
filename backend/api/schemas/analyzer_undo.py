from pydantic import BaseModel

class UndoRedoRequest(BaseModel):
    job_id: str
