import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from bson import ObjectId
from dotenv import load_dotenv
import re

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["ecommerce"]

products_col = db["products"]
variants_col = db["product_variants"]
orders_col = db["orders"]
order_details_col = db["order_detail"]
recs_col = db["recommendations"]
user_recs_col = db["user_recommendations"]

USER_FIELD = "account_id"

print("Connected to MongoDB")


# =========================
# CLEAN TEXT
# =========================
def clean_text(text):
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return text


# =========================
# CONTENT-BASED
# =========================
def train_content_based():
    products = list(products_col.find({"status": "active"}))
    df = pd.DataFrame(products)

    def safe(series):
        return series.apply(lambda x: str(x) if x else "")

    df["text"] = (
        safe(df.get("name")).apply(clean_text) + " " +
        safe(df.get("brand")).apply(clean_text) + " " +
        safe(df.get("product_type")).apply(clean_text) + " " +
        safe(df.get("short_description")).apply(clean_text)
    )

    vectorizer = TfidfVectorizer(max_features=2000)
    tfidf = vectorizer.fit_transform(df["text"])

    sim = cosine_similarity(tfidf)

    content_recs = {}
    for i, row in df.iterrows():
        slug = row["slug"]
        scores = list(enumerate(sim[i]))
        scores = sorted(scores, key=lambda x: x[1], reverse=True)[1:11]

        content_recs[slug] = [
            (df.iloc[idx]["slug"], float(score))
            for idx, score in scores
        ]

    return content_recs


# =========================
# ITEM-BASED (MAIN ENGINE)
# =========================
def train_item_based():
    orders = list(orders_col.find({}, {USER_FIELD: 1}))
    details = list(order_details_col.find({}))
    variants = list(variants_col.find({}))
    products = list(products_col.find({}, {"_id": 1, "slug": 1}))

    order_user = {
        str(o["_id"]): str(o.get(USER_FIELD))
        if o.get(USER_FIELD) else None
        for o in orders
    }
    variant_product = {str(v["_id"]): str(v["product_id"]) for v in variants}
    product_slug = {str(p["_id"]): p["slug"] for p in products}

    interactions = []

    for d in details:
        oid = str(d["order_id"])
        vid = str(d["variant_id"])

        uid = order_user.get(oid)
        pid = variant_product.get(vid)
        slug = product_slug.get(pid)

        if uid and uid != "None" and slug:
            interactions.append({
                "account_id": uid,
                "product_slug": slug
            })

    df = pd.DataFrame(interactions)

    if df.empty:
        return {}

    matrix = pd.crosstab(df["account_id"], df["product_slug"])

    item_sim = cosine_similarity(matrix.T)
    item_sim_df = pd.DataFrame(
        item_sim,
        index=matrix.columns,
        columns=matrix.columns
    )

    item_recs = {}
    for slug in item_sim_df.index:
        sims = item_sim_df[slug].sort_values(ascending=False)[1:11]
        item_recs[slug] = list(zip(sims.index, sims.values))

    return item_recs


# =========================
# POPULAR PRODUCTS
# =========================
def get_popular_products():
    pipeline = [
        {
            "$match": {
                "variant_id": {"$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$variant_id",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]

    result = list(order_details_col.aggregate(pipeline))

    product_ids = set()
    for r in result:
        vid = r["_id"]
        try:
            if vid:
                variant = variants_col.find_one({"_id": ObjectId(vid)})
                if variant and variant.get("product_id"):
                    product_ids.add(ObjectId(variant["product_id"]))
        except:
            continue

    if not product_ids:
        return []

    products = list(products_col.find({
        "_id": {"$in": list(product_ids)}
    }))

    return [p["slug"] for p in products if p.get("slug")]


# =========================
# BUILD USER RECS (SMART)
# =========================
def build_user_recommendations(item_recs, content_recs):
    orders = list(orders_col.find({}, {USER_FIELD: 1}))
    details = list(order_details_col.find({}))
    variants = list(variants_col.find({}))
    products = list(products_col.find({}, {"_id": 1, "slug": 1}))

    order_user = {
        str(o["_id"]): str(o.get(USER_FIELD))
        if o.get(USER_FIELD) else None
        for o in orders
    }
    variant_product = {str(v["_id"]): str(v["product_id"]) for v in variants}
    product_slug = {str(p["_id"]): p["slug"] for p in products}

    user_items = {}

    for d in details:
        oid = str(d["order_id"])
        vid = str(d["variant_id"])

        uid = order_user.get(oid)
        pid = variant_product.get(vid)
        slug = product_slug.get(pid)

        if uid and uid != "None" and slug:
            user_items.setdefault(uid, set()).add(slug)

    popular = get_popular_products()
    user_recs = []

    for uid, items in user_items.items():
        if not uid or uid == "None":
            continue

        recs = []

        for item in items:
            # ưu tiên item-based
            recs += item_recs.get(item, [])

            # fallback content-based
            if not recs:
                recs += content_recs.get(item, [])

        # unique + sort
        seen = set()
        final = []
        for slug, score in recs:
            if slug not in seen and slug not in items:
                seen.add(slug)
                final.append((slug, score))

        final = sorted(final, key=lambda x: x[1], reverse=True)[:10]

        # fallback nếu vẫn thiếu
        if len(final) < 5:
            for p in popular[:5]:
                if p not in items and p not in [s for s, _ in final]:
                    final.append((p, 0.1))

        for slug, score in final:
            try:
                user_recs.append({
                    "user_id": ObjectId(uid),
                    "recommended_slug": slug,
                    "score": float(score),
                    "type": "hybrid"
                })
            except Exception as e:
                print(f"Skip uid={uid}: {e}")
                continue

    return user_recs


# =========================
# MAIN
# =========================
def main():
    print("Training content...")
    content_recs = train_content_based()
    print(f"Content recs: {len(content_recs)} products")

    print("Training item-based...")
    item_recs = train_item_based()
    print(f"Item recs: {len(item_recs)} products")

    print("Building user recs...")
    user_recs = build_user_recommendations(item_recs, content_recs)
    print(f"User recs: {len(user_recs)} records")

    if user_recs:
        user_recs_col.delete_many({})
        user_recs_col.insert_many(user_recs)
        user_recs_col.create_index("user_id")
        print(f"Saved {len(user_recs)} user recommendations")
    else:
        print("No recommendations generated")

    print("DONE")


if __name__ == "__main__":
    main()