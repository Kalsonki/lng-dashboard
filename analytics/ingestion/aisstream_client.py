"""AISstream WebSocket client — LNG tanker position ingestion."""
import asyncio
import json
import logging
import websockets
from datetime import datetime, timezone
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"

# Bounding boxes covering major LNG shipping lanes
LNG_BOUNDING_BOXES = [
    # Global coverage (broad)
    [[-90, -180], [90, 180]],
]

# LNG tanker ship types per AIS spec
LNG_SHIP_TYPES = list(range(70, 90))  # All tanker types; we filter by name/type


def is_lng_vessel(msg: dict) -> bool:
    """Heuristic: is this vessel likely an LNG tanker?"""
    static = msg.get("ShipStaticData", {}) or msg.get("MetaData", {})
    ship_type = static.get("Type", 0) or 0
    name = (static.get("Name", "") or "").upper()
    # Ship type 72 = LNG tanker per AIS
    if ship_type == 72:
        return True
    # Name heuristics for LNG tankers
    lng_keywords = ["LNG", "METHANE", "GAS", "EXCALIBUR", "EXCEL", "AQUARIUS"]
    return any(kw in name for kw in lng_keywords)


async def ingest_positions(db_callback, max_messages: int = 10000):
    """
    Connect to AISstream and ingest LNG vessel positions.
    db_callback(vessel_data, position_data) is called for each valid message.
    """
    if not settings.aisstream_api_key:
        logger.warning("AISSTREAM_API_KEY not set — AIS ingestion disabled")
        return

    subscribe_msg = {
        "APIKey": settings.aisstream_api_key,
        "BoundingBoxes": LNG_BOUNDING_BOXES,
        "FiltersShipMMSI": [],
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }

    count = 0
    logger.info("Connecting to AISstream...")
    try:
        async with websockets.connect(AISSTREAM_URL) as ws:
            await ws.send(json.dumps(subscribe_msg))
            logger.info("AISstream subscribed — receiving messages")

            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    msg_type = msg.get("MessageType", "")
                    meta = msg.get("MetaData", {})
                    mmsi = str(meta.get("MMSI", "")).strip()
                    if not mmsi:
                        continue

                    if msg_type == "ShipStaticData":
                        static = msg.get("Message", {}).get("ShipStaticData", {})
                        ship_type = static.get("Type", 0)
                        name = static.get("Name", "").strip()
                        if not is_lng_vessel({"ShipStaticData": {"Type": ship_type, "Name": name}}):
                            continue
                        vessel_data = {
                            "mmsi": mmsi,
                            "name": name,
                            "imo": str(static.get("ImoNumber", "") or ""),
                            "flag": static.get("Flag", ""),
                            "vessel_type": f"type_{ship_type}",
                            "cargo_capacity_m3": None,
                        }
                        await db_callback("vessel", vessel_data, None)

                    elif msg_type == "PositionReport":
                        pos = msg.get("Message", {}).get("PositionReport", {})
                        # Only process if we think it's an LNG vessel
                        lat = pos.get("Latitude")
                        lon = pos.get("Longitude")
                        if lat is None or lon is None:
                            continue
                        if abs(lat) > 85:
                            continue  # Invalid coordinates
                        ts_str = meta.get("time_utc", "")
                        try:
                            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                        except Exception:
                            ts = datetime.now(timezone.utc)

                        position_data = {
                            "mmsi": mmsi,
                            "timestamp": ts,
                            "lat": lat,
                            "lon": lon,
                            "speed": pos.get("Sog"),
                            "heading": pos.get("TrueHeading"),
                            "course": pos.get("Cog"),
                            "nav_status": pos.get("NavigationalStatus"),
                            "source": "aisstream",
                        }
                        await db_callback("position", None, position_data)

                    count += 1
                    if count >= max_messages:
                        logger.info(f"Reached max_messages={max_messages}, stopping")
                        break

                except json.JSONDecodeError:
                    continue
                except Exception as e:
                    logger.error(f"AIS message processing error: {e}")

    except Exception as e:
        logger.error(f"AISstream connection error: {e}")
