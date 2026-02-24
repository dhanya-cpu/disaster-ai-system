import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

def generate_synthetic_data(n=1000):
    """Generate synthetic disaster dataset for training."""
    np.random.seed(42)
    disaster_types = ['Flood', 'Earthquake', 'Cyclone', 'Drought', 'Landslide']

    data = pd.DataFrame({
        'disaster_type': np.random.choice(disaster_types, n),
        'deaths': np.random.exponential(scale=200, size=n).astype(int),
        'affected': np.random.exponential(scale=50000, size=n).astype(int),
        'damage_usd': np.random.exponential(scale=5_000_000, size=n),
    })
    return data

def compute_severity_score(df: pd.DataFrame) -> pd.DataFrame:
    """Feature engineering: compute severity score from raw columns."""
    df = df.copy()
    df['severity_score'] = (
        0.5 * np.log1p(df['deaths']) +
        0.3 * np.log1p(df['affected']) +
        0.2 * np.log1p(df['damage_usd'])
    )
    return df

def assign_severity_class(df: pd.DataFrame) -> pd.DataFrame:
    """Convert numeric severity score into Low / Medium / High classes."""
    df = df.copy()
    low    = df['severity_score'].quantile(0.33)
    high   = df['severity_score'].quantile(0.66)

    def classify(score):
        if score <= low:
            return 'Low'
        elif score <= high:
            return 'Medium'
        else:
            return 'High'

    df['severity_class'] = df['severity_score'].apply(classify)
    return df

def encode_features(df: pd.DataFrame):
    """Label-encode disaster_type and return encoder."""
    le = LabelEncoder()
    df = df.copy()
    df['disaster_type_enc'] = le.fit_transform(df['disaster_type'])
    return df, le

def get_features_and_labels(df: pd.DataFrame):
    """Return X (features) and y (labels) ready for training."""
    X = df[['disaster_type_enc', 'deaths', 'affected', 'damage_usd', 'severity_score']]
    y = df['severity_class']
    return X, y

def build_pipeline():
    """Full pipeline: generate → engineer → encode → split."""
    df = generate_synthetic_data()
    df = compute_severity_score(df)
    df = assign_severity_class(df)
    df, le = encode_features(df)
    X, y = get_features_and_labels(df)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    return X_train, X_test, y_train, y_test, le