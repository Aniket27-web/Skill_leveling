from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_avatar_health():
    response = client.get("/api/avatar/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Photorealistic" in data["engine"]
    assert "hardware" in data
    assert "gpu" in data["hardware"]
    assert "supported_states" in data
    assert "SPEAKING" in data["supported_states"]
    assert "visemes" in data
    assert "aa" in data["visemes"]


def test_avatar_states():
    # Valid state
    resp = client.get("/api/avatar/states/listening")
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "LISTENING"
    assert "description" in data

    # Speaking state
    resp_sp = client.get("/api/avatar/states/speaking")
    assert resp_sp.status_code == 200
    assert resp_sp.json()["state"] == "SPEAKING"

    # Invalid state
    resp_inv = client.get("/api/avatar/states/unknown_state")
    assert resp_inv.status_code == 400


def test_avatar_render_job():
    payload = {
        "text": "Hello candidate, let's begin your technical interview.",
        "state": "SPEAKING",
        "duration_sec": 1.0,
    }
    resp = client.post("/api/avatar/render", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert "check_status_url" in data

    job_id = data["job_id"]
    status_resp = client.get(f"/api/avatar/status/{job_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["job_id"] == job_id
    assert status_data["status"] in ["queued", "processing", "completed"]


def test_avatar_status_not_found():
    resp = client.get("/api/avatar/status/non-existent-uuid")
    assert resp.status_code == 404

