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

print("Connected to MongoDB")

def train_content_based():
    print("Training Content-Based Filtering...")
    products = list(products_col.find({"status": "active"}))
    if not products:
        print("No active products found.")
        return []

    df = pd.DataFrame(products)
    
    def safe_str(series):
        return series.apply(lambda x: str(x) if x is not None and not pd.isna(x) else "")

    df["combined_features"] = (
        safe_str(df.get("name")) + " " +
        safe_str(df.get("brand")) + " " +
        safe_str(df.get("product_type")) + " " +
        safe_str(df.get("short_description")) + " " +
        safe_str(df.get("material")) + " " +
        safe_str(df.get("size"))
    )

    vectorizer = TfidfVectorizer(max_features=2000, stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(df["combined_features"])
    similarity = cosine_similarity(tfidf_matrix)

    content_recs = []
    top_k = 10

    for i, row in df.iterrows():
        product_slug = str(row.get("slug"))
        if not product_slug or product_slug == "nan":
            continue

        scores = list(enumerate(similarity[i]))
        scores = sorted(scores, key=lambda x: x[1], reverse=True)[1:top_k+1]

        for idx, float_score in scores:
            rec_slug = str(df.iloc[idx].get("slug"))
            if not rec_slug or rec_slug == "nan":
                continue
            content_recs.append({
                "product_slug": product_slug,
                "recommended_slug": rec_slug,
                "score": float(float_score),
                "type": "content"
            })
    return content_recs

def train_collaborative_filtering():
    print("Training Collaborative Filtering...")
    
    # 1. Fetch Data
    orders_query = {"status": {"$in": ["completed", "delivered", "shipping", "processing", "confirmed"]}}
    orders = list(orders_col.find(orders_query, {"user_id": 1}))
    details = list(order_details_col.find({}, {"order_id": 1, "variant_id": 1, "quantity": 1}))
    variants = list(variants_col.find({}, {"_id": 1, "product_id": 1}))
    products = list(products_col.find({}, {"_id": 1, "slug": 1}))
    
    print(f"Found {len(orders)} relevant orders.")
    print(f"Found {len(details)} order detail items.")

    if not orders or not details:
        print("Insufficient order data for CF (No orders or details).")
        return [], []

    # 2. Map IDs to Slugs/UserIDs
    order_user_map = {str(o["_id"]): str(o["user_id"]) for o in orders if o.get("user_id")}
    variant_product_map = {str(v["_id"]): str(v["product_id"]) for v in variants}
    product_id_slug_map = {str(p["_id"]): p["slug"] for p in products}
    
    print(f"Mapped {len(order_user_map)} orders to user IDs.")
    
    # 3. Build Interaction List
    interactions = []
    for d in details:
        oid = str(d["order_id"])
        vid = str(d["variant_id"])
        uid = order_user_map.get(oid)
        pid = variant_product_map.get(vid)
        slug = product_id_slug_map.get(pid)
        
        if uid and slug:
            interactions.append({
                "user_id": uid,
                "product_slug": slug,
                "quantity": d.get("quantity", 1)
            })
    
    print(f"Total valid user-item interactions: {len(interactions)}")

    if not interactions:
        print("No valid interactions found (Check mapping between orders, details, and variants).")
        return [], []

    df_int = pd.DataFrame(interactions)
    user_item_matrix = df_int.pivot_table(index="user_id", columns="product_slug", values="quantity", aggfunc="sum").fillna(0)
    print(f"User-Item Matrix shape: {user_item_matrix.shape}")
    
    # User-Based CF
    user_sim = cosine_similarity(user_item_matrix)
    user_sim_df = pd.DataFrame(user_sim, index=user_item_matrix.index, columns=user_item_matrix.index)
    
    user_recs = []
    for uid in user_item_matrix.index:
        # Get top similar users
        similar_users = user_sim_df[uid].sort_values(ascending=False)[1:6]
        
        # Aggregate their purchases
        recommendation_scores = pd.Series(dtype=float)
        for sim_uid, sim_score in similar_users.items():
            user_items = user_item_matrix.loc[sim_uid]
            recommendation_scores = recommendation_scores.add(user_items * sim_score, fill_value=0)
        
        # Filter items already bought by current user
        bought_items = user_item_matrix.loc[uid]
        recommendation_scores = recommendation_scores[bought_items == 0]
        
        # Get top-K
        top_items = recommendation_scores.sort_values(ascending=False).head(10)
        for slug, score in top_items.items():
            if score > 0:
                user_recs.append({
                    "user_id": ObjectId(uid),
                    "recommended_slug": slug,
                    "score": float(score),
                    "type": "user-based"
                })
                
    # Item-Based CF (Co-purchase)
    item_item_matrix = user_item_matrix.T
    item_sim = cosine_similarity(item_item_matrix)
    item_sim_df = pd.DataFrame(item_sim, index=item_item_matrix.index, columns=item_item_matrix.index)
    
    item_recs = []
    for slug in item_item_matrix.index:
        similar_items = item_sim_df[slug].sort_values(ascending=False)[1:11]
        for rec_slug, score in similar_items.items():
            if score > 0:
                item_recs.append({
                    "product_slug": slug,
                    "recommended_slug": rec_slug,
                    "score": float(score),
                    "type": "item-based"
                })
                
    return user_recs, item_recs

def main():
    content_recs = train_content_based()
    user_recs, item_recs = train_collaborative_filtering()
    
    # Save Item-based and Content-based combined
    # Priority: item-based (purchase behavior) > content-based (attributes)
    final_item_recs = []
    seen_pairs = set()
    
    for r in item_recs:
        pair = (r["product_slug"], r["recommended_slug"])
        final_item_recs.append(r)
        seen_pairs.add(pair)
        
    for r in content_recs:
        pair = (r["product_slug"], r["recommended_slug"])
        if pair not in seen_pairs:
            final_item_recs.append(r)
            
    if final_item_recs:
        recs_col.delete_many({})
        recs_col.insert_many(final_item_recs)
        recs_col.create_index("product_slug")
        recs_col.create_index([("product_slug", 1), ("score", -1)])
        print(f"Saved {len(final_item_recs)} general recommendations.")

    if user_recs:
        user_recs_col.delete_many({})
        user_recs_col.insert_many(user_recs)
        user_recs_col.create_index("user_id")
        print(f"Saved {len(user_recs)} personalized user recommendations.")

    print("Success")

if __name__ == "__main__":
    main()
