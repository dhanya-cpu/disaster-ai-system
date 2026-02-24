import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from data_pipeline import build_pipeline

def train_and_save():
    print("🔄 Running data pipeline...")
    X_train, X_test, y_train, y_test, le = build_pipeline()

    print("🧠 Training RandomForestClassifier...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        random_state=42,
        class_weight='balanced'
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print(f"\n✅ Accuracy: {acc:.4f}")
    print("\n📊 Classification Report:")
    print(classification_report(y_test, y_pred))

    # Save model and encoder
    joblib.dump(model, 'model.pkl')
    joblib.dump(le, 'label_encoder.pkl')
    print("\n✅ model.pkl and label_encoder.pkl saved successfully!")

if __name__ == '__main__':
    train_and_save()