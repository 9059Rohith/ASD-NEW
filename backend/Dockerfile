FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-core.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements-core.txt

COPY scripts/download_phoneme_model.py ./scripts/download_phoneme_model.py
RUN python scripts/download_phoneme_model.py

COPY app ./app
COPY models/vowel-classifier ./models/vowel-classifier
COPY models/diphthong-classifier ./models/diphthong-classifier
RUN mkdir -p /app/uploads

EXPOSE 10000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers ${WEB_CONCURRENCY:-1}"]
