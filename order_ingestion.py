from dotenv import load_dotenv
import os

import json

import retailcrm


load_dotenv()
api_key = os.getenv("RETAILCRM_API_KEY")
link = os.getenv("RETAILCRM_LINK")

orders = json.load(open("mock_orders.json"))

client = retailcrm.v5(link, api_key)

for order in orders:
    result = client.order_create(order)

