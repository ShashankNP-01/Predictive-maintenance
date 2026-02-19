from flask import Flask, render_template, jsonify, request
import pickle
import pandas as pd
import numpy as np
from datetime import datetime
import json
import os

app = Flask(__name__)

# Get the directory of the current script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load model and data
MODEL_PATH = os.path.join(SCRIPT_DIR, "final_predictive_maintenance_model.pkl")
DATA_PATH = os.path.join(SCRIPT_DIR, "ai4i2020.csv")

try:
    model = pickle.load(open(MODEL_PATH, "rb"))
    df = pd.read_csv(DATA_PATH)
    print("Model and data loaded successfully!")
except Exception as e:
    print(f"Error loading model or data: {e}")
    model = None
    df = None

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/overview')
def get_overview():
    """Get overall health metrics"""
    if df is None:
        return jsonify({"error": "Data not loaded"}), 500

    # Get predictions for all machines
    feature_cols = [col for col in df.columns if col not in ['UDI', 'Product ID', 'Type', 'Machine failure', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF']]

    if model is not None:
        try:
            predictions = model.predict(df[feature_cols])
            prediction_proba = model.predict_proba(df[feature_cols])[:, 1] if hasattr(model, 'predict_proba') else predictions
        except:
            predictions = np.random.randint(0, 2, len(df))
            prediction_proba = np.random.random(len(df))
    else:
        predictions = np.random.randint(0, 2, len(df))
        prediction_proba = np.random.random(len(df))

    # Calculate metrics
    total_machines = len(df)
    healthy_machines = int(np.sum(predictions == 0))
    at_risk_machines = int(np.sum(predictions == 1))

    # Risk levels based on probability
    low_risk = int(np.sum((prediction_proba > 0) & (prediction_proba <= 0.3)))
    medium_risk = int(np.sum((prediction_proba > 0.3) & (prediction_proba <= 0.7)))
    high_risk = int(np.sum(prediction_proba > 0.7))

    # Calculate average health score (inverse of failure probability)
    avg_health = float(100 * (1 - np.mean(prediction_proba)))

    return jsonify({
        "total_machines": total_machines,
        "healthy_machines": healthy_machines,
        "at_risk_machines": at_risk_machines,
        "avg_health_score": round(avg_health, 2),
        "risk_distribution": {
            "low": low_risk,
            "medium": medium_risk,
            "high": high_risk
        }
    })

@app.route('/api/machines_at_risk')
def get_machines_at_risk():
    """Get list of machines at risk"""
    if df is None or model is None:
        return jsonify({"error": "Data or model not loaded"}), 500

    feature_cols = [col for col in df.columns if col not in ['UDI', 'Product ID', 'Type', 'Machine failure', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF']]

    try:
        predictions = model.predict(df[feature_cols])
        prediction_proba = model.predict_proba(df[feature_cols])[:, 1] if hasattr(model, 'predict_proba') else predictions
    except:
        predictions = np.random.randint(0, 2, len(df))
        prediction_proba = np.random.random(len(df))

    # Create dataframe with results
    results_df = df.copy()
    results_df['failure_risk'] = prediction_proba
    results_df['prediction'] = predictions

    # Filter machines at risk and sort by risk
    at_risk_df = results_df[results_df['prediction'] == 1].sort_values('failure_risk', ascending=False)

    # Get top 20 machines at risk
    machines_list = []
    for idx, row in at_risk_df.head(20).iterrows():
        risk_level = "High" if row['failure_risk'] > 0.7 else "Medium" if row['failure_risk'] > 0.3 else "Low"
        machines_list.append({
            "id": str(row.get('UDI', idx)),
            "product_id": str(row.get('Product ID', 'N/A')),
            "type": str(row.get('Type', 'N/A')),
            "risk_score": round(float(row['failure_risk'] * 100), 2),
            "risk_level": risk_level,
            "temperature": round(float(row.get('Air temperature [K]', 0)), 2),
            "rotational_speed": round(float(row.get('Rotational speed [rpm]', 0)), 2),
            "torque": round(float(row.get('Torque [Nm]', 0)), 2),
            "tool_wear": round(float(row.get('Tool wear [min]', 0)), 2)
        })

    return jsonify({"machines": machines_list})

@app.route('/api/feature_analysis')
def get_feature_analysis():
    """Get feature statistics and correlations"""
    if df is None:
        return jsonify({"error": "Data not loaded"}), 500

    feature_cols = [col for col in df.columns if col not in ['UDI', 'Product ID', 'Type', 'Machine failure', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF']]

    # Calculate correlations with target if available
    correlations = {}
    if 'Machine failure' in df.columns:
        for col in feature_cols:
            if df[col].dtype in ['int64', 'float64']:
                corr = df[col].corr(df['Machine failure'])
                correlations[col] = abs(float(corr)) if not pd.isna(corr) else 0
    else:
        # If no target, use dummy correlations
        for col in feature_cols:
            correlations[col] = float(np.random.random())

    # Get feature statistics
    feature_stats = {}
    for col in feature_cols:
        if df[col].dtype in ['int64', 'float64']:
            feature_stats[col] = {
                "mean": float(df[col].mean()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max())
            }

    return jsonify({
        "correlations": correlations,
        "statistics": feature_stats
    })

@app.route('/api/time_series')
def get_time_series():
    """Get time series data for trends"""
    if df is None:
        return jsonify({"error": "Data not loaded"}), 500

    # Group data by batches (simulate time periods)
    batch_size = max(1, len(df) // 20)
    time_series = []

    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        time_series.append({
            "period": f"Batch {i//batch_size + 1}",
            "avg_temperature": float(batch.get('Air temperature [K]', pd.Series([0])).mean()),
            "avg_rotational_speed": float(batch.get('Rotational speed [rpm]', pd.Series([0])).mean()),
            "avg_torque": float(batch.get('Torque [Nm]', pd.Series([0])).mean()),
            "avg_tool_wear": float(batch.get('Tool wear [min]', pd.Series([0])).mean())
        })

    return jsonify({"time_series": time_series})

@app.route('/api/predict', methods=['POST'])
def predict_single():
    """Make prediction for a single machine"""
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.json
    feature_cols = [col for col in df.columns if col not in ['UDI', 'Product ID', 'Type', 'Machine failure', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF']]

    try:
        # Create input array
        input_data = np.array([[float(data.get(col, 0)) for col in feature_cols]])
        prediction = model.predict(input_data)[0]

        if hasattr(model, 'predict_proba'):
            probability = model.predict_proba(input_data)[0][1]
        else:
            probability = float(prediction)

        risk_level = "High" if probability > 0.7 else "Medium" if probability > 0.3 else "Low"

        return jsonify({
            "prediction": int(prediction),
            "probability": float(probability),
            "risk_level": risk_level,
            "status": "Failure Risk" if prediction == 1 else "Healthy"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)



