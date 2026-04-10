from dotenv import load_dotenv
import os
import time

import json

import retailcrm
from supabase import create_client

load_dotenv()
api_key = os.getenv("RETAILCRM_API_KEY")
link = os.getenv("RETAILCRM_LINK")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

client = retailcrm.v5(link, api_key)
supabase = create_client(supabase_url, supabase_key)
# response = client.orders(filters=[], limit=50)
# orders = response.get_response()["orders"]
# print(orders[0])

def fetch_orders(page=1):
    response = client.orders(filters=[], limit=50)
    orders = response.get_response()["orders"]
    return orders


def transform(order):
    total_sum = sum(
        item["quantity"] * item["initialPrice"]
        for item in order["items"]
    )

    return {
        "retailcrm_id": order["id"],
        "first_name": order["firstName"],
        "last_name": order["lastName"],
        "phone": order["phone"],
        "email": order["email"],
        "order_type": order["orderType"],
        "status": order["status"],
        "total_sum": total_sum,
        "city": order["delivery"]["address"]["city"],
        "address": order["delivery"]["address"]["text"],
        "created_at": order["createdAt"]
    }


def sync():
    page = 1

    while True:
        print("start")
        orders = fetch_orders(10)

        print(orders[0])
        if not orders:
            break

        rows = [transform(o) for o in orders]

        supabase.table("orders").upsert(rows, on_conflict="retailcrm_id").execute()

        page += 1
        time.sleep(1)


if __name__ == "__main__":
    sync()