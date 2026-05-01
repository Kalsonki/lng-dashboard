from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://lng_user:lng_password@localhost:5432/lng_dashboard"
    eia_api_key: str = ""
    gie_api_key: str = ""
    aisstream_api_key: str = ""
    debug: bool = True
    port: int = 8000

    # Regional country mappings
    europe_countries: list[str] = [
        "GBR", "DEU", "FRA", "NLD", "BEL", "ESP", "PRT", "ITA", "GRC",
        "POL", "LTU", "LVA", "EST", "FIN", "SWE", "DNK", "NOR", "TUR",
        "HRV", "SVN", "SVK", "CZE", "AUT", "HUN", "ROU", "BGR", "MLT",
        "CYP", "IRL", "ISL",
    ]
    asia_countries: list[str] = [
        "JPN", "KOR", "CHN", "TWN", "IND", "SGP", "THA", "MYS", "IDN",
        "PHL", "VNM", "PAK", "BGD", "LKA", "ARE", "KWT", "QAT", "OMN",
        "BHR", "ISR", "JOR", "EGY",
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
