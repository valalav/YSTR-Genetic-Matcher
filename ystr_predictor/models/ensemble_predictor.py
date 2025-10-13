# c:\projects\DNA-utils-universal\ystr_predictor\models\ensemble_predictor.py
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
import xgboost as xgb
import lightgbm as lgb
import catboost as cb
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import f1_score
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
import logging
from joblib import dump, load
from pathlib import Path

class EnsemblePredictor:
    def __init__(self):
        self.base_models = {
            'rf': RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                n_jobs=-1,
                random_state=42
            ),
            'xgb': xgb.XGBClassifier(
                n_estimators=100,
                max_depth=7,
                learning_rate=0.1,
                random_state=42
            ),
            'lgb': lgb.LGBMClassifier(
                n_estimators=100,
                num_leaves=31,
                random_state=42
            ),
            'cat': cb.CatBoostClassifier(
                iterations=100,
                depth=6,
                learning_rate=0.1,
                random_state=42,
                verbose=False
            ),
            'mlp': MLPClassifier(
                hidden_layer_sizes=(100, 50),
                max_iter=300,
                random_state=42
            )
        }
        
        self.level_ensembles = {}
        self.meta_models = {}
        self.scalers = {}
        self.feature_names = None
        self.is_trained = False
        self.class_weights = {}
        
    def _get_stacking_predictions(self, models: Dict, X: np.ndarray, 
                                y: np.ndarray = None) -> np.ndarray:
        """�������� ������������ ������� ������� ��� ��������"""
        n_samples = X.shape[0]
        n_classes = len(np.unique(y)) if y is not None else len(models[list(models.keys())[0]].classes_)
        
        # ������ ��� �������� ������������
        S = np.zeros((n_samples, len(models) * n_classes))
        
        if y is not None:  # ����� ��������
            skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
            
            for model_idx, (name, model) in enumerate(models.items()):
                S_i = np.zeros((n_samples, n_classes))
                
                for train_idx, val_idx in skf.split(X, y):
                    X_train, X_val = X[train_idx], X[val_idx]
                    y_train = y[train_idx]
                    
                    # ������� ������ � �������� ������������
                    model.fit(X_train, y_train)
                    S_i[val_idx] = model.predict_proba(X_val)
                    
                # ��������� ������������
                start_idx = model_idx * n_classes
                end_idx = start_idx + n_classes
                S[:, start_idx:end_idx] = S_i
                
        else:  # ����� ������������
            for model_idx, (name, model) in enumerate(models.items()):
                start_idx = model_idx * n_classes
                end_idx = start_idx + n_classes
                S[:, start_idx:end_idx] = model.predict_proba(X)
                
        return S
        
    def train(self, X: pd.DataFrame, y_dict: Dict[str, pd.Series]) -> Dict[str, Dict[str, float]]:
        """������� �������� ������� ��� ������� ������ ��������"""
        self.feature_names = X.columns.tolist()
        metrics = {}
        
        for level, y in y_dict.items():
            logging.info(f"\nTraining ensemble for {level} level...")
            
            # ������������ ������
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            self.scalers[level] = scaler
            
            # ��������� ���� �������
            class_counts = np.bincount(y)
            self.class_weights[level] = dict(
                enumerate(len(y) / (len(class_counts) * class_counts))
            )
            
            # ������� ������� ������
            level_models = {}
            for name, model in self.base_models.items():
                if hasattr(model, 'class_weight'):
                    model.set_params(class_weight=self.class_weights[level])
                model.fit(X_scaled, y)
                level_models[name] = model
                
            self.level_ensembles[level] = level_models
            
            # �������� ����-��������
            S_train = self._get_stacking_predictions(level_models, X_scaled, y)
            
            # ������� ����-������
            meta_model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=3,
                learning_rate=0.1,
                random_state=42
            )
            meta_model.fit(S_train, y)
            self.meta_models[level] = meta_model
            
            # ��������� ��������
            y_pred = self.predict_level(X, level)
            metrics[level] = {
                'macro_f1': f1_score(y, y_pred, average='macro'),
                'weighted_f1': f1_score(y, y_pred, average='weighted')
            }
            
            logging.info(f"Level {level} metrics:")
            for metric_name, value in metrics[level].items():
                logging.info(f"{metric_name}: {value:.4f}")
                
        self.is_trained = True
        return metrics
        
    def predict_level(self, X: pd.DataFrame, level: str) -> np.ndarray:
        """������ ������������ ��� ����������� ������"""
        if not self.is_trained:
            raise Exception("Model is not trained yet")
            
        # ������������ ������
        X_scaled = self.scalers[level].transform(X)
        
        # �������� ������������ ������� �������
        S_test = self._get_stacking_predictions(
            self.level_ensembles[level], 
            X_scaled
        )
        
        # �������� ��������� ������������
        return self.meta_models[level].predict(S_test)
    
    def predict_proba_level(self, X: pd.DataFrame, level: str) -> np.ndarray:
        """���������� ����������� ��� ����������� ������"""
        if not self.is_trained:
            raise Exception("Model is not trained yet")
            
        # ������������ ������
        X_scaled = self.scalers[level].transform(X)
        
        # �������� ������������ ������� �������
        S_test = self._get_stacking_predictions(
            self.level_ensembles[level], 
            X_scaled
        )
        
        # �������� �����������
        return self.meta_models[level].predict_proba(S_test)
        
    def predict(self, X: pd.DataFrame) -> Dict[str, List[Dict]]:
        """������ ������������ �� ���� �������"""
        results = {}
        
        for level in self.level_ensembles.keys():
            probas = self.predict_proba_level(X, level)
            predictions = []
            
            for sample_probas in probas:
                top_indices = np.argsort(sample_probas)[-3:][::-1]
                pred = {
                    'haplogroup': self.meta_models[level].classes_[top_indices[0]],
                    'probability': float(sample_probas[top_indices[0]]),
                    'alternatives': [
                        {
                            'haplogroup': self.meta_models[level].classes_[idx],
                            'probability': float(sample_probas[idx])
                        }
                        for idx in top_indices[1:]
                    ]
                }
                predictions.append(pred)
                
            results[level] = predictions
            
        return results
        
    def save_model(self, path: str = "models/saved/"):
        """��������� ������"""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        
        for level in self.level_ensembles.keys():
            level_path = path / level
            level_path.mkdir(exist_ok=True)
            
            # ��������� ������� ������
            for name, model in self.level_ensembles[level].items():
                dump(model, level_path / f"{name}_model.joblib")
                
            # ��������� ����-������ � �������
            dump(self.meta_models[level], level_path / "meta_model.joblib")
            dump(self.scalers[level], level_path / "scaler.joblib")
            
        # ��������� ����� ������
        dump({
            'feature_names': self.feature_names,
            'class_weights': self.class_weights
        }, path / "metadata.joblib")
        
    def load_model(self, path: str = "models/saved/"):
        """��������� ������"""
        path = Path(path)
        
        metadata = load(path / "metadata.joblib")
        self.feature_names = metadata['feature_names']
        self.class_weights = metadata['class_weights']
        
        for level_path in path.glob("*"):
            if level_path.is_dir():
                level = level_path.name
                self.level_ensembles[level] = {}
                
                # ��������� ������� ������
                for model_path in level_path.glob("*_model.joblib"):
                    name = model_path.stem.replace("_model", "")
                    if name != "meta":
                        self.level_ensembles[level][name] = load(model_path)
                        
                # ��������� ����-������ � �������
                self.meta_models[level] = load(level_path / "meta_model.joblib")
                self.scalers[level] = load(level_path / "scaler.joblib")
                
        self.is_trained = True