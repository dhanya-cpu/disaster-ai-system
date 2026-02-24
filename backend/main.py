import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from optimizer import optimize_resources
from data_pipeline import compute_severity_score

# ── Load model & encoder ──────────────────────────────────────────────────────
model = joblib.load('model.pkl')
le    = joblib.load('label_encoder.pkl')

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Disaster Resource Allocation API",
    description="ML-based severity prediction + LP optimization for disaster relief",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ───────────────────────────────────────────────────────────────────
class PredictInput(BaseModel):
    disaster_type: str
    deaths: int
    affected: int
    damage_usd: float

class OptimizeInput(BaseModel):
    severity_level: str
    budget: float

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Disaster AI System is live 🚀"}

@app.post("/predict")
def predict(data: PredictInput):
    try:
        # Encode disaster type
        if data.disaster_type not in le.classes_:
            raise HTTPException(status_code=400, detail=f"Unknown disaster type: {data.disaster_type}")

        disaster_enc = le.transform([data.disaster_type])[0]

        # Compute severity score
        import pandas as pd
        row = pd.DataFrame([{
            'deaths':      data.deaths,
            'affected':    data.affected,
            'damage_usd':  data.damage_usd
        }])
        row = compute_severity_score(row)
        severity_score = row['severity_score'].values[0]

        # Build feature vector
        features = np.array([[
            disaster_enc,
            data.deaths,
            data.affected,
            data.damage_usd,
            severity_score
        ]])

        severity_level = model.predict(features)[0]
        probabilities  = model.predict_proba(features)[0]
        confidence     = round(float(max(probabilities)) * 100, 2)

        return {
            "severity_level": severity_level,
            "confidence_pct": confidence,
            "severity_score": round(float(severity_score), 4)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/optimize")
def optimize(data: OptimizeInput):
    try:
        result = optimize_resources(data.severity_level, data.budget)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))