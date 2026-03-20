import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "BambuLab 3D AI Studio"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/bambulab3d"
    )
    SECRET_KEY: str = "change-this-in-production"
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./output"
    MAX_UPLOAD_SIZE_MB: int = 100

    class Config:
        env_file = ".env"
        extra = "allow"

    @property
    def db_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


settings = Settings()
