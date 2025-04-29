from fastapi import FastAPI
from api.router.v1.chat_route import router as chat_router

app = FastAPI()

app.include_router(chat_router)