# c:\projects\DNA-utils-universal\ystr_predictor\models\optimized_predictor.py
from sklearn.model_selection import KFold, cross_validate
from sklearn.metrics import make_scorer, f1_score, accuracy_score
import optuna
from optuna.integration import OptunaSearchCV
import xgboost as xgb
import lightgbm as lgb
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
import logging

class OptimizedHierarchicalPredictor:
    def __init__(self):
        self.level_models = {}
        self.best_params = {}
        self.scalers = {}
        self.feature_names = None
        self.is_trained = False
        
        # ���������� ������� ��� ������
        self.scoring = {
            'accuracy': make_scorer(accuracy_score),
            'macro_f1': make_scorer(f1_score, average='macro'),
            'weighted_f1': make_scorer(f1_score, average='weighted')
        }

    def _create_objective(self, X, y, algorithm: str):
        """������� objective ������� ��� Optuna"""
        def objective(trial):
            if algorithm == 'rf':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                    'max_depth': trial.suggest_int('max_depth', 5, 30),
                    'min_samples_split': trial.suggest_int('min_samples_split', 2, 10),
                    'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 5),
                }
                model = RandomForestClassifier(**params, n_jobs=-1, random_state=42)
                
            elif algorithm == 'xgb':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                    'max_depth': trial.suggest_int('max_depth', 3, 10),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                    'subsample': trial.suggest_float('subsample', 0.6, 1.0),
                    'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
                }
                model = xgb.XGBClassifier(**params, random_state=42)
                
            elif algorithm == 'lgb':
                params = {
                    'n_estimators': trial.suggest_int('n_estimators', 50, 300),
                    'num_leaves': trial.suggest_int('num_leaves', 20, 100),
                    'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                    'feature_fraction': trial.suggest_float('feature_fraction', 0.6, 1.0),
                }
                model = lgb.LGBMClassifier(**params, random_state=42)

            # �����-���������
            cv_results = cross_validate(
                model, X, y,
                cv=KFold(n_splits=5, shuffle=True, random_state=42),
                scoring=self.scoring,
                n_jobs=-1
            )
            
            # ���������� ������� �������� macro f1
            return cv_results['test_macro_f1'].mean()
            
        return objective

    def _optimize_hyperparameters(self, X, y, level: str):
        """������������ �������������� ��� ����������� ������"""
        logging.info(f"\nOptimizing hyperparameters for {level} level...")
        
        # �������� �������� � ����������� �� ������
        if level == 'root':
            algorithm = 'rf'  # RandomForest ��� �������� ������
        elif level == 'major':
            algorithm = 'lgb'  # LightGBM ��� ��������������
        else:
            algorithm = 'xgb'  # XGBoost ��� �������������
            
        # ������� study ��� �����������
        study = optuna.create_study(direction='maximize')
        objective = self._create_objective(X, y, algorithm)
        
        # ��������� �����������
        study.optimize(objective, n_trials=20)
        
        logging.info(f"Best parameters for {level}: {study.best_params}")
        self.best_params[level] = study.best_params
        
        # ������� ������ � ������� �����������
        if algorithm == 'rf':
            return RandomForestClassifier(
                **study.best_params,
                n_jobs=-1,
                random_state=42
            )
        elif algorithm == 'xgb':
            return xgb.XGBClassifier(
                **study.best_params,
                random_state=42
            )
        else:
            return lgb.LGBMClassifier(
                **study.best_params,
                random_state=42
            )

    def _evaluate_model(self, model, X, y, level: str):
        """��������� ������ � ������� �����-���������"""
        cv_results = cross_validate(
            model, X, y,
            cv=KFold(n_splits=5, shuffle=True, random_state=42),
            scoring=self.scoring,
            n_jobs=-1
        )
        
        metrics = {
            'accuracy': cv_results['test_accuracy'].mean(),
            'macro_f1': cv_results['test_macro_f1'].mean(),
            'weighted_f1': cv_results['test_weighted_f1'].mean(),
            'std_accuracy': cv_results['test_accuracy'].std(),
            'std_macro_f1': cv_results['test_macro_f1'].std(),
            'std_weighted_f1': cv_results['test_weighted_f1'].std()
        }
        
        logging.info(f"\n{level} level cross-validation results:")
        for metric, value in metrics.items():
            logging.info(f"{metric}: {value:.4f}")
            
        return metrics

    def train(self, X: pd.DataFrame, haplo_column: str) -> Dict[str, Dict[str, float]]:
        """������� ���������������� ������������� ������"""
        self.feature_names = X.drop(haplo_column, axis=1).columns.tolist()
        metrics = {}
        
        for level in ['root', 'major', 'terminal']:
            # �������������� ������ ��� ������
            y_level = X[haplo_column].apply(
                lambda x: x.split('-')[0] if level == 'root' else 
                         '-'.join(x.split('-')[:2]) if level == 'major' else x
            )
            
            # ������������ �������������� � ������� ������
            model = self._optimize_hyperparameters(
                X.drop(haplo_column, axis=1),
                y_level,
                level
            )
            
            # ��������� ������
            metrics[level] = self._evaluate_model(
                model,
                X.drop(haplo_column, axis=1),
                y_level,
                level
            )
            
            # ������� ��������� ������ �� ���� ������
            model.fit(X.drop(haplo_column, axis=1), y_level)
            self.level_models[level] = model
            
        self.is_trained = True
        return metrics

    def predict(self, X: pd.DataFrame) -> List[Dict[str, object]]:
        """������ ������������ �� ���� ������� ��������"""
        if not self.is_trained:
            raise Exception("Model is not trained yet")
            
        results = []
        
        # ������� ������
        missing_features = [f for f in self.feature_names if f not in X.columns]
        if missing_features:
            for feature in missing_features:
                X[feature] = 0
        X = X[self.feature_names]
        
        # �������� ������������ ��� ������� ������
        for level in ['root', 'major', 'terminal']:
            model = self.level_models[level]
            
            # �������� ������������ � �����������
            predictions = model.predict(X)
            probabilities = model.predict_proba(X)
            
            # ��������� ����������
            for i, (pred, probs) in enumerate(zip(predictions, probabilities)):
                top_indices = np.argsort(probs)[-3:][::-1]
                
                result = {
                    'level': level,
                    'prediction': pred,
                    'probability': float(probs[top_indices[0]]),
                    'alternatives': [
                        {
                            'haplogroup': model.classes_[idx],
                            'probability': float(probs[idx])
                        }
                        for idx in top_indices[1:]
                    ]
                }
                results.append(result)
                
        return results

    def get_feature_importance(self, level: str = None) -> Dict[str, float]:
        """���������� �������� ��������� ��� ���������� ������ ��� ���� �������"""
        if not self.is_trained:
            raise Exception("Model is not trained yet")
            
        importance_dict = {}
        
        levels = [level] if level else ['root', 'major', 'terminal']
        
        for lvl in levels:
            model = self.level_models[lvl]
            
            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
            else:
                continue
                
            importance_dict[lvl] = dict(
                sorted(
                    zip(self.feature_names, importances),
                    key=lambda x: x[1],
                    reverse=True
                )
            )
            
        return importance_dict