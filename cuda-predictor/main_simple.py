"""
Simplified Haplogroup Predictor Service for testing without GPU
Provides mock predictions for development and testing
"""

import os
import time
import json
import logging
from typing import List, Dict, Optional, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PredictionRequest(BaseModel):
    markers: List[float] = Field(..., description="STR marker values vector")
    model_version: str = Field(default="v2.1", description="Model version to use")
    use_ensemble: bool = Field(default=True, description="Use ensemble prediction")
    min_confidence: float = Field(default=0.7, ge=0.0, le=1.0)

class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    alternatives: List[Dict[str, Any]]
    processing_time_ms: float
    features_used: int
    model_info: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    cuda_available: bool
    gpu_count: int
    model_versions: List[str]
    memory_usage: Dict[str, float]

# Mock haplogroup data for testing
MOCK_HAPLOGROUPS = [
    'R1a1a1b1a1a3a',
    'R1b1a2a1a2c1',
    'R1a1a1b1a2a2',
    'I1a2a1a1a4a1a',
    'N1a1a1a1a2a',
    'J2a1a1a2b2a1',
    'E1b1a1a1f1a',
    'G2a2a1a2a1a2b1',
    'Q1a2a1a1',
    'T1a1a1b2a1a'
]

# Initialize FastAPI app
app = FastAPI(
    title="YSTR Haplogroup Predictor (Mock)",
    description="Simplified haplogroup prediction service for testing",
    version="2.1.0-mock"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def mock_predict_haplogroup(markers: List[float]) -> PredictionResponse:
    """Generate mock prediction based on markers"""
    start_time = time.time()

    # Simple mock logic based on marker patterns
    marker_sum = sum(m for m in markers if m > 0)
    marker_avg = marker_sum / len([m for m in markers if m > 0]) if any(m > 0 for m in markers) else 12

    # Determine mock haplogroup based on marker characteristics
    if marker_avg < 12:
        primary_haplo = 'I1a2a1a1a4a1a'
        confidence = 0.85
    elif marker_avg < 14:
        primary_haplo = 'R1a1a1b1a1a3a'
        confidence = 0.92
    elif marker_avg < 16:
        primary_haplo = 'R1b1a2a1a2c1'
        confidence = 0.78
    elif marker_avg < 18:
        primary_haplo = 'N1a1a1a1a2a'
        confidence = 0.81
    else:
        primary_haplo = 'J2a1a1a2b2a1'
        confidence = 0.76

    # Add some randomization
    confidence += random.uniform(-0.1, 0.1)
    confidence = max(0.5, min(0.98, confidence))

    # Generate alternatives
    available_haplos = [h for h in MOCK_HAPLOGROUPS if h != primary_haplo]
    alternatives = []

    for i in range(4):
        alt_haplo = random.choice(available_haplos)
        alt_confidence = confidence * random.uniform(0.3, 0.8)
        alternatives.append({
            'haplogroup': alt_haplo,
            'confidence': round(alt_confidence, 3)
        })
        available_haplos.remove(alt_haplo)

    processing_time = (time.time() - start_time) * 1000

    # Add small delay to simulate processing
    time.sleep(0.01)

    return PredictionResponse(
        prediction=primary_haplo,
        confidence=round(confidence, 3),
        alternatives=alternatives,
        processing_time_ms=round(processing_time + 15, 1),  # Mock processing time
        features_used=len([m for m in markers if m > 0]),
        model_info={
            'models_used': ['mock_cnn', 'mock_xgb'] if len(markers) > 20 else ['mock_cnn'],
            'ensemble_used': len(markers) > 20,
            'mock_mode': True
        }
    )

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        cuda_available=False,  # Mock mode
        gpu_count=0,
        model_versions=["v2.1-mock", "v2.0-mock"],
        memory_usage={
            "cpu_mb": random.uniform(100, 200),
            "ram_mb": random.uniform(500, 1000)
        }
    )

@app.post("/predict", response_model=PredictionResponse)
async def predict_haplogroup(request: PredictionRequest):
    """Predict haplogroup from STR markers"""
    try:
        # Validate input
        if len(request.markers) != 37:
            raise HTTPException(
                status_code=400,
                detail=f"Expected 37 markers, got {len(request.markers)}"
            )

        # Generate mock prediction
        result = mock_predict_haplogroup(request.markers)

        logger.info(f"Mock prediction: {result.prediction} (confidence: {result.confidence})")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "message": "YSTR Haplogroup Predictor Mock Service",
        "version": "2.1.0-mock",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8080))

    logger.info("🚀 Starting YSTR Haplogroup Predictor Mock Service")
    logger.info(f"📍 Port: {port}")
    logger.info("⚠️  Running in MOCK MODE (no GPU required)")
    logger.info("📊 Endpoints:")
    logger.info("  GET  /health - Health check")
    logger.info("  POST /predict - Predict haplogroup")
    logger.info("  GET  /docs - API documentation")

    uvicorn.run(
        "main_simple:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )