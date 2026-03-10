import os
from pymongo import MongoClient
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()


MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["ecommerce"]

products_col = db["products"]
recs_col = db["recommendations"]

print("Connected MongoDB")


products = list(products_col.find({"status": "active"}))
if not products:
    print("No active products found.")
    exit()

df = pd.DataFrame(products)
print("Total products:", len(df))

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


recommendations = []
top_k = 10 # Increase top_k slightly to handle out-of-stock filtering in node

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
            
        recommendations.append({
            "product_slug": product_slug,
            "recommended_slug": rec_slug,
            "score": float(float_score)
        })

print("Generated recs pairs:", len(recommendations))


if recommendations:
    recs_col.delete_many({})
    recs_col.insert_many(recommendations)
    print("Saved to MongoDB")


recs_col.create_index("product_slug")
recs_col.create_index({"score": -1})
print("Done")
