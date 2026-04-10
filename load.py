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
    retailcrm_id = order["id"]
    
    # Extract items
    items_rows = []
    for item in order.get("items", []):
        items_rows.append({
            "product_name": item.get("offer", {}).get("name") or item.get("offer", {}).get("product", {}).get("name", ""),
            "quantity": int(item.get("quantity", 0)),
            "price": float(item.get("initialPrice", 0)),
        })

    # Calculate total sum
    total_sum = sum(
        item.get("quantity", 0) * item.get("initialPrice", 0)
        for item in order.get("items", [])
    )

    order_row = {
        "retailcrm_id": retailcrm_id,
        "first_name": order.get("firstName", ""),
        "last_name": order.get("lastName", ""),
        "phone": order.get("phone", ""),
        "email": order.get("email", ""),
        "order_type": order.get("orderType", ""),
        "status": order.get("status", ""),
        "total_sum": total_sum,
        "city": (order.get("delivery") or {}).get("address", {}).get("city", ""),
        "address": (order.get("delivery") or {}).get("address", {}).get("text", ""),
        "created_at": order.get("createdAt")
    }
    
    return order_row, items_rows


def sync():
    page = 1

    while True:
        print(f"Syncing page {page}...")
        orders = fetch_orders(page)

        if not orders:
            break

        all_order_rows = []
        all_order_items_map = {} # retailcrm_id -> items
        
        for o in orders:
            order_row, items_rows = transform(o)
            all_order_rows.append(order_row)
            all_order_items_map[order_row["retailcrm_id"]] = items_rows

        # 1. Upsert orders and get their DB IDs
        response = supabase.table("orders").upsert(all_order_rows, on_conflict="retailcrm_id").execute()
        db_orders = response.data
        
        # 2. Update items
        final_item_rows = []
        for db_order in db_orders:
            rcrm_id = db_order["retailcrm_id"]
            internal_order_id = db_order["id"]
            
            # Map internal ID to its items
            order_items = all_order_items_map.get(rcrm_id, [])
            for item in order_items:
                item["order_id"] = internal_order_id
                final_item_rows.append(item)
            
            # Delete old items for this order
            supabase.table("order_items").delete().eq("order_id", internal_order_id).execute()
        
        # 3. Insert all new items
        if final_item_rows:
            supabase.table("order_items").insert(final_item_rows).execute()

        print(f"Synced {len(db_orders)} orders and {len(final_item_rows)} items")
        
        page += 1
        time.sleep(1)


if __name__ == "__main__":
    sync()