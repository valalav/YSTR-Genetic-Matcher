"""
CUDA-Accelerated Haplogroup Predictor Service
High-performance Y-chromosome haplogroup prediction using GPU acceleration
"""

import os
import time
import json
import logging
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager

import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import redis
import joblib
from prometheus_client import Counter, Histogram, generate_latest
from prometheus_client import CollectorRegistry, CONTENT_TYPE_LATEST

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model storage
models = {}
device = None
redis_client = None

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

# Prometheus metrics
PREDICTION_COUNTER = Counter('haplogroup_predictions_total', 'Total predictions made')
PREDICTION_LATENCY = Histogram('haplogroup_prediction_duration_seconds', 'Prediction latency')
ERROR_COUNTER = Counter('haplogroup_prediction_errors_total', 'Total prediction errors')

class HaplogroupCNNModel(nn.Module):
    """
    Convolutional Neural Network for haplogroup prediction
    Optimized for CUDA acceleration
    """

    def __init__(self, input_size: int = 37, num_classes: int = 200, dropout: float = 0.3):
        super(HaplogroupCNNModel, self).__init__()

        self.input_size = input_size
        self.num_classes = num_classes

        # Feature extraction layers
        self.feature_extractor = nn.Sequential(
            nn.Linear(input_size, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.BatchNorm1d(256),

            nn.Linear(256, 512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.BatchNorm1d(512),

            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.BatchNorm1d(256),
        )

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_classes)
        )

        # Attention mechanism for marker importance
        self.attention = nn.Sequential(
            nn.Linear(input_size, input_size),
            nn.Softmax(dim=1)
        )

    def forward(self, x):
        # Apply attention to input markers
        attention_weights = self.attention(x)
        x_weighted = x * attention_weights

        # Feature extraction
        features = self.feature_extractor(x_weighted)

        # Classification
        output = self.classifier(features)

        return output, attention_weights

class EnsemblePredictor:
    """
    Ensemble predictor combining multiple models and methods
    """

    def __init__(self, device):
        self.device = device
        self.cnn_model = None
        self.xgb_model = None
        self.lgb_model = None
        self.haplogroup_encoder = None
        self.marker_scaler = None

    def load_models(self, model_path: str, version: str = "v2.1"):
        """Load all ensemble models"""
        try:
            model_dir = os.path.join(model_path, version)

            # Load CNN model
            cnn_path = os.path.join(model_dir, "cnn_model.pth")
            if os.path.exists(cnn_path):
                checkpoint = torch.load(cnn_path, map_location=self.device)
                self.cnn_model = HaplogroupCNNModel(
                    input_size=checkpoint['input_size'],
                    num_classes=checkpoint['num_classes']
                )
                self.cnn_model.load_state_dict(checkpoint['model_state_dict'])
                self.cnn_model.to(self.device)
                self.cnn_model.eval()
                logger.info(f"✅ Loaded CNN model from {cnn_path}")

            # Load XGBoost model
            xgb_path = os.path.join(model_dir, "xgb_model.joblib")
            if os.path.exists(xgb_path):
                self.xgb_model = joblib.load(xgb_path)
                logger.info(f"✅ Loaded XGBoost model from {xgb_path}")

            # Load LightGBM model
            lgb_path = os.path.join(model_dir, "lgb_model.joblib")
            if os.path.exists(lgb_path):
                self.lgb_model = joblib.load(lgb_path)
                logger.info(f"✅ Loaded LightGBM model from {lgb_path}")

            # Load encoders and scalers
            encoder_path = os.path.join(model_dir, "haplogroup_encoder.joblib")
            if os.path.exists(encoder_path):
                self.haplogroup_encoder = joblib.load(encoder_path)

            scaler_path = os.path.join(model_dir, "marker_scaler.joblib")
            if os.path.exists(scaler_path):
                self.marker_scaler = joblib.load(scaler_path)

            logger.info(f"🚀 All models loaded for version {version}")

        except Exception as e:
            logger.error(f"❌ Error loading models: {e}")
            raise

    def preprocess_markers(self, markers: List[float]) -> np.ndarray:
        """Preprocess marker data"""
        # Convert to numpy array and handle missing values
        markers_array = np.array(markers, dtype=np.float32)

        # Replace -1 (missing) with median values
        missing_mask = markers_array == -1
        if missing_mask.any() and self.marker_scaler:
            # Use median from training data
            median_values = getattr(self.marker_scaler, 'median_', None)
            if median_values is not None:
                markers_array[missing_mask] = median_values[missing_mask]

        # Scale markers if scaler is available
        if self.marker_scaler:
            markers_array = self.marker_scaler.transform(markers_array.reshape(1, -1))[0]

        return markers_array

    def predict_cnn(self, markers: np.ndarray) -> tuple:
        """CNN prediction"""
        if self.cnn_model is None:
            return None, None

        try:
            with torch.no_grad():
                x = torch.FloatTensor(markers).unsqueeze(0).to(self.device)
                output, attention = self.cnn_model(x)

                # Get probabilities
                probabilities = torch.softmax(output, dim=1)
                confidence, predicted_idx = torch.max(probabilities, 1)

                # Get top 5 predictions
                top_probs, top_indices = torch.topk(probabilities, 5, dim=1)

                return {
                    'prediction_idx': predicted_idx.item(),
                    'confidence': confidence.item(),
                    'top_predictions': [(idx.item(), prob.item())
                                      for idx, prob in zip(top_indices[0], top_probs[0])],
                    'attention_weights': attention.cpu().numpy()[0].tolist()
                }

        except Exception as e:
            logger.error(f"CNN prediction error: {e}")
            return None

    def predict_xgb(self, markers: np.ndarray) -> dict:
        """XGBoost prediction"""
        if self.xgb_model is None:
            return None

        try:
            # Get prediction probabilities
            probabilities = self.xgb_model.predict_proba(markers.reshape(1, -1))[0]
            predicted_idx = np.argmax(probabilities)
            confidence = probabilities[predicted_idx]

            # Get top 5
            top_indices = np.argsort(probabilities)[-5:][::-1]
            top_predictions = [(idx, probabilities[idx]) for idx in top_indices]

            return {
                'prediction_idx': predicted_idx,
                'confidence': confidence,
                'top_predictions': top_predictions
            }

        except Exception as e:
            logger.error(f"XGBoost prediction error: {e}")
            return None

    def predict_lgb(self, markers: np.ndarray) -> dict:
        """LightGBM prediction"""
        if self.lgb_model is None:
            return None

        try:
            probabilities = self.lgb_model.predict_proba(markers.reshape(1, -1))[0]
            predicted_idx = np.argmax(probabilities)
            confidence = probabilities[predicted_idx]

            top_indices = np.argsort(probabilities)[-5:][::-1]
            top_predictions = [(idx, probabilities[idx]) for idx in top_indices]

            return {
                'prediction_idx': predicted_idx,
                'confidence': confidence,
                'top_predictions': top_predictions
            }

        except Exception as e:
            logger.error(f"LightGBM prediction error: {e}")
            return None

    def ensemble_predict(self, markers: List[float], use_ensemble: bool = True,
                        min_confidence: float = 0.7) -> dict:
        """Main ensemble prediction method"""
        start_time = time.time()

        # Preprocess markers
        processed_markers = self.preprocess_markers(markers)

        predictions = {}

        # Get predictions from all models
        if self.cnn_model:
            predictions['cnn'] = self.predict_cnn(processed_markers)

        if self.xgb_model and use_ensemble:
            predictions['xgb'] = self.predict_xgb(processed_markers)

        if self.lgb_model and use_ensemble:
            predictions['lgb'] = self.predict_lgb(processed_markers)

        # Filter out None predictions
        valid_predictions = {k: v for k, v in predictions.items() if v is not None}

        if not valid_predictions:
            raise ValueError("No valid predictions available")

        # Ensemble combination
        if len(valid_predictions) == 1 or not use_ensemble:
            # Use single best model (CNN preferred)
            best_model = 'cnn' if 'cnn' in valid_predictions else list(valid_predictions.keys())[0]
            final_prediction = valid_predictions[best_model]
        else:
            # Weighted ensemble
            final_prediction = self.combine_predictions(valid_predictions)

        # Convert prediction index to haplogroup name
        if self.haplogroup_encoder:
            haplogroup = self.haplogroup_encoder.inverse_transform([final_prediction['prediction_idx']])[0]

            # Convert alternatives
            alternatives = []
            for idx, conf in final_prediction['top_predictions'][:5]:
                if conf >= min_confidence * 0.5:  # Lower threshold for alternatives
                    alt_haplogroup = self.haplogroup_encoder.inverse_transform([idx])[0]
                    alternatives.append({
                        'haplogroup': alt_haplogroup,
                        'confidence': float(conf)
                    })
        else:
            haplogroup = f"unknown_{final_prediction['prediction_idx']}"
            alternatives = []

        processing_time = (time.time() - start_time) * 1000

        return {
            'prediction': haplogroup,
            'confidence': float(final_prediction['confidence']),
            'alternatives': alternatives,
            'processing_time_ms': processing_time,
            'features_used': len(markers),
            'model_info': {
                'models_used': list(valid_predictions.keys()),
                'ensemble_used': use_ensemble and len(valid_predictions) > 1,
                'attention_weights': final_prediction.get('attention_weights')
            }
        }

    def combine_predictions(self, predictions: dict) -> dict:
        """Combine multiple model predictions using weighted voting"""
        # Model weights (CNN gets highest weight due to attention mechanism)
        weights = {'cnn': 0.6, 'xgb': 0.25, 'lgb': 0.15}

        # Aggregate top predictions with weights
        combined_scores = {}

        for model, pred in predictions.items():
            weight = weights.get(model, 0.1)

            for idx, conf in pred['top_predictions']:
                if idx not in combined_scores:
                    combined_scores[idx] = 0
                combined_scores[idx] += conf * weight

        # Find best combined prediction
        best_idx = max(combined_scores.keys(), key=lambda x: combined_scores[x])
        best_confidence = combined_scores[best_idx]

        # Sort all predictions by combined score
        sorted_predictions = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)

        return {
            'prediction_idx': best_idx,
            'confidence': best_confidence,
            'top_predictions': sorted_predictions[:5],
            'attention_weights': predictions.get('cnn', {}).get('attention_weights')
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup application"""
    global models, device, redis_client

    # Initialize CUDA
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"🚀 Using device: {device}")

    if torch.cuda.is_available():
        logger.info(f"🎮 CUDA devices available: {torch.cuda.device_count()}")
        for i in range(torch.cuda.device_count()):
            logger.info(f"  Device {i}: {torch.cuda.get_device_name(i)}")

    # Initialize Redis
    try:
        redis_client = redis.Redis.from_url(
            os.getenv('REDIS_URL', 'redis://localhost:6379'),
            decode_responses=True
        )
        redis_client.ping()
        logger.info("✅ Connected to Redis")
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}")
        redis_client = None

    # Load models
    model_path = os.getenv('MODEL_PATH', './models')
    available_versions = ['v2.1', 'v2.0', 'v1.9']  # Available model versions

    for version in available_versions:
        try:
            predictor = EnsemblePredictor(device)
            predictor.load_models(model_path, version)
            models[version] = predictor
            logger.info(f"✅ Loaded models for version {version}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to load models for version {version}: {e}")

    if not models:
        logger.error("❌ No models loaded! Service will not function properly.")

    yield

    # Cleanup
    logger.info("🔄 Shutting down CUDA predictor service...")

# Initialize FastAPI app
app = FastAPI(
    title="CUDA Haplogroup Predictor",
    description="High-performance Y-chromosome haplogroup prediction using GPU acceleration",
    version="2.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    memory_info = {}

    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            memory_info[f"gpu_{i}"] = {
                "allocated_mb": torch.cuda.memory_allocated(i) / 1024**2,
                "cached_mb": torch.cuda.memory_reserved(i) / 1024**2,
                "max_allocated_mb": torch.cuda.max_memory_allocated(i) / 1024**2
            }

    return HealthResponse(
        status="healthy" if models else "no_models",
        cuda_available=torch.cuda.is_available(),
        gpu_count=torch.cuda.device_count() if torch.cuda.is_available() else 0,
        model_versions=list(models.keys()),
        memory_usage=memory_info
    )

@app.post("/predict", response_model=PredictionResponse)
async def predict_haplogroup(request: PredictionRequest):
    """Predict haplogroup from STR markers"""
    start_time = time.time()

    try:
        PREDICTION_COUNTER.inc()

        # Validate input
        if len(request.markers) != 37:  # Standard marker count
            raise HTTPException(
                status_code=400,
                detail=f"Expected 37 markers, got {len(request.markers)}"
            )

        # Get model
        if request.model_version not in models:
            available_versions = list(models.keys())
            if not available_versions:
                raise HTTPException(status_code=503, detail="No models available")
            # Use latest available version
            model_version = available_versions[0]
            logger.warning(f"Model version {request.model_version} not found, using {model_version}")
        else:
            model_version = request.model_version

        predictor = models[model_version]

        # Make prediction
        with PREDICTION_LATENCY.time():
            result = predictor.ensemble_predict(
                markers=request.markers,
                use_ensemble=request.use_ensemble,
                min_confidence=request.min_confidence
            )

        # Cache result if Redis is available
        if redis_client:
            cache_key = f"prediction:{hash(str(request.markers))}:{model_version}"
            try:
                redis_client.setex(cache_key, 3600, json.dumps(result))  # Cache for 1 hour
            except Exception as e:
                logger.warning(f"Cache write failed: {e}")

        return PredictionResponse(**result)

    except HTTPException:
        ERROR_COUNTER.inc()
        raise
    except Exception as e:
        ERROR_COUNTER.inc()
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.post("/clear-cache")
async def clear_cache():
    """Clear prediction cache"""
    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis not available")

    try:
        keys = redis_client.keys("prediction:*")
        if keys:
            redis_client.delete(*keys)

        return {"message": f"Cleared {len(keys)} cache entries"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8080)),
        workers=1,  # Single worker for GPU usage
        log_level="info"
    )