from kafka import KafkaProducer
import json
import requests
producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

event = requests.get("http://localhost:3000/api/products").json()

producer.send("user_events", event)
producer.flush()

print("event sent")