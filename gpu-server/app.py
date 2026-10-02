"""neatx-ray GPU service: TorchXRayVision (chest findings) + MedGemma (written read).

Every route except /health needs the header  Authorization: Bearer <GPU_API_TOKEN>.
"""
import base64
import io
import json
import os
import re
import time

import numpy as np
import torch
from fastapi import Depends, FastAPI, HTTPException, Request
from PIL import Image

API_TOKEN = os.environ.get("GPU_API_TOKEN", "")
MEDGEMMA_ID = os.environ.get("MEDGEMMA_ID", "google/medgemma-1.5-4b-it")
LINGSHU_ID = os.environ.get("LINGSHU_ID", "lingshu-medical-mllm/Lingshu-7B")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI()
state = {}


def auth(request: Request):
    if not API_TOKEN:
        raise HTTPException(500, "GPU_API_TOKEN is not set on the server")
    if request.headers.get("authorization", "") != f"Bearer {API_TOKEN}":
        raise HTTPException(401, "Unauthorized")


@app.on_event("startup")
def load_models():
    import torchxrayvision as xrv
    from transformers import AutoModelForImageTextToText, AutoProcessor

    state["xrv"] = xrv.models.DenseNet(weights="densenet121-res224-all").to(DEVICE).eval()
    state["processor"] = AutoProcessor.from_pretrained(MEDGEMMA_ID)
    state["medgemma"] = AutoModelForImageTextToText.from_pretrained(
        MEDGEMMA_ID, torch_dtype=torch.bfloat16, device_map=DEVICE
    ).eval()

    # Optional second reader. If it fails to load, the rest of the service still works.
    try:
        from transformers import Qwen2_5_VLForConditionalGeneration

        state["lingshu_processor"] = AutoProcessor.from_pretrained(LINGSHU_ID)
        state["lingshu"] = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            LINGSHU_ID, torch_dtype=torch.bfloat16, device_map=DEVICE
        ).eval()
    except Exception as err:  # noqa: BLE001
        state["lingshu_error"] = str(err)


def decode(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


@app.get("/health")
def health():
    return {
        "ok": "medgemma" in state,
        "device": DEVICE,
        "medgemma": MEDGEMMA_ID,
        "lingshu": "lingshu" in state,
        "lingshu_error": state.get("lingshu_error"),
    }


@app.post("/xrv", dependencies=[Depends(auth)])
async def xrv_findings(request: Request):
    """Chest X-ray findings. Body: {"image": "<base64>"}. Only meaningful for chest films."""
    import torchxrayvision as xrv

    body = await request.json()
    img = np.array(decode(body["image"]).convert("L")).astype(np.float32)
    img = xrv.datasets.normalize(img, 255)[None, ...]
    img = xrv.datasets.XRayCenterCrop()(img)
    img = xrv.datasets.XRayResizer(224)(img)
    started = time.time()
    with torch.no_grad():
        out = state["xrv"](torch.from_numpy(img)[None, ...].to(DEVICE))[0].cpu().numpy()
    pairs = [
        {"finding": name, "score": round(float(s), 3)}
        for name, s in zip(state["xrv"].pathologies, out)
        if name
    ]
    pairs.sort(key=lambda p: -p["score"])
    return {"findings": pairs, "seconds": round(time.time() - started, 2)}


JSON_SHAPE = """Reply with ONLY one JSON object, no other text, in exactly this shape:
{"region_and_view": string, "impression": string (one sentence, max 25 words),
 "confidence": "likely"|"possible"|"unlikely",
 "urgency": "urgent"|"soon"|"routine", "urgency_reason": string,
 "key_findings": [string], "next_steps": [string]}"""


@app.post("/medgemma", dependencies=[Depends(auth)])
async def medgemma(request: Request):
    """Body: {"images": ["<base64>", ...], "context": "<text from buildUserText>", "system": "<system prompt>"}."""
    body = await request.json()
    images = [decode(b) for b in body["images"]]
    system = body.get("system", "You are a radiology decision-support assistant.")
    content = [{"type": "image", "image": im} for im in images]
    content.append({"type": "text", "text": f"{body.get('context', '')}\n\n{JSON_SHAPE}"})
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system}]},
        {"role": "user", "content": content},
    ]
    proc = state["processor"]
    inputs = proc.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=True, return_dict=True, return_tensors="pt"
    ).to(DEVICE, dtype=torch.bfloat16)
    n_in = inputs["input_ids"].shape[-1]
    started = time.time()
    with torch.inference_mode():
        gen = state["medgemma"].generate(**inputs, max_new_tokens=900, do_sample=False)
    text = proc.decode(gen[0][n_in:], skip_special_tokens=True)
    match = re.search(r"\{.*\}", text, re.S)
    try:
        report = json.loads(match.group(0)) if match else None
    except json.JSONDecodeError:
        report = None
    return {
        "report": report,
        "raw": None if report else text,
        "tokens": {"input": int(n_in), "output": int(gen.shape[-1] - n_in)},
        "seconds": round(time.time() - started, 2),
    }


@app.post("/lingshu", dependencies=[Depends(auth)])
async def lingshu(request: Request):
    """Same body and reply as /medgemma, answered by Lingshu 7B."""
    if "lingshu" not in state:
        raise HTTPException(503, "Lingshu is not loaded")
    body = await request.json()
    images = [decode(b) for b in body["images"]]
    system = body.get("system", "You are a radiology decision-support assistant.")
    content = [{"type": "image"} for _ in images]
    content.append({"type": "text", "text": body.get("context", "") + "\n\n" + JSON_SHAPE})
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system}]},
        {"role": "user", "content": content},
    ]
    proc = state["lingshu_processor"]
    text = proc.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = proc(text=[text], images=images, return_tensors="pt").to(DEVICE)
    n_in = inputs["input_ids"].shape[-1]
    started = time.time()
    with torch.inference_mode():
        gen = state["lingshu"].generate(**inputs, max_new_tokens=900, do_sample=False)
    out = proc.batch_decode(gen[:, n_in:], skip_special_tokens=True)[0]
    match = re.search(r"\{.*\}", out, re.S)
    try:
        report = json.loads(match.group(0)) if match else None
    except json.JSONDecodeError:
        report = None
    return {
        "report": report,
        "raw": None if report else out,
        "tokens": {"input": int(n_in), "output": int(gen.shape[-1] - n_in)},
        "seconds": round(time.time() - started, 2),
    }
