#!/bin/bash
# Runs on the pod at boot: installs once, then serves the API on port 8000.
set -e
cd /workspace/gpu-server
pip install -q -r requirements.txt
export HF_HOME=/workspace/hf
exec uvicorn app:app --host 0.0.0.0 --port 8000
