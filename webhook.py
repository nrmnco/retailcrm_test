from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
import logging
import httpx

from supabase import create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
THRESHOLD = 50_000

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RetailCRM Webhook")


def transform(order: dict) -> dict:
    """Transform a RetailCRM order payload into the Supabase row format."""
    items = order.get("items", [])
    total_sum = sum(
        item.get("quantity", 0) * item.get("initialPrice", 0)
        for item in items
    )

    return {
        "retailcrm_id": order.get("id"),
        "first_name": order.get("firstName", ""),
        "last_name": order.get("lastName", ""),
        "phone": order.get("phone", ""),
        "email": order.get("email", ""),
        "order_type": order.get("orderType", ""),
        "status": order.get("status", ""),
        "total_sum": total_sum,
        "city": order.get("delivery", {}).get("address", {}).get("city", ""),
        "address": order.get("delivery", {}).get("address", {}).get("text", ""),
        "created_at": order.get("createdAt"),
    }


async def send_telegram(row: dict):
    """Send a Telegram alert for high-value orders (> 50 000 ₸)."""
    text = (
        f"🛒 <b>Новый крупный заказ!</b>\n\n"
        f"<b>ID:</b> {row['retailcrm_id']}\n"
        f"<b>Клиент:</b> {row['first_name']} {row['last_name']}\n"
        f"<b>Телефон:</b> {row['phone']}\n"
        f"<b>Сумма:</b> {row['total_sum']:,.0f} ₸\n"
        f"<b>Город:</b> {row['city']}\n"
        f"<b>Статус:</b> {row['status']}"
    )
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "HTML",
        })
        resp.raise_for_status()
    logger.info("Telegram alert sent for order %s", row["retailcrm_id"])


@app.post("/webhook/order/create")
async def on_order_create(request: Request):
    """
    Webhook endpoint triggered by RetailCRM when a new order is created.
    """
    body = await request.body()
    try:
        payload = await request.json()
    except Exception as e:
        logger.error("Failed to decode JSON from webhook: %s", e)
        logger.error("Raw body: %s", body.decode(errors='replace'))
        return JSONResponse(status_code=400, content={"status": "error", "message": "Invalid JSON"})

    logger.info("Received order.create webhook")
    
    order = payload.get("order")
    if not order:
        logger.warning("No 'order' data found in payload: %s", payload)
        # Fallback to payload itself if order is missing but data is present (sometimes happens with different CRM versions)
        order = payload if "id" in payload else None

    if not order:
        return JSONResponse(status_code=400, content={"status": "error", "message": "Missing order data"})

    row = transform(order)

    try:
        supabase.table("orders").upsert(row, on_conflict="retailcrm_id").execute()
        logger.info("Order %s upserted to Supabase", row["retailcrm_id"])

        if row["total_sum"] > THRESHOLD:
            await send_telegram(row)
    except Exception as e:
        logger.error("Error processing order %s: %s", row.get("retailcrm_id"), e)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

    return {"status": "ok", "retailcrm_id": row["retailcrm_id"]}


@app.get("/health")
async def health():
    return {"status": "healthy"}
