# SUPRA V3 Reels Worker — Node + FFmpeg + faster-whisper
FROM node:20-bookworm-slim

# System deps: ffmpeg (render/proxy), python3 (transcription)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ffmpeg python3 python3-pip python3-venv ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python venv for faster-whisper
ENV VENV=/opt/venv
RUN python3 -m venv $VENV
ENV PATH="$VENV/bin:$PATH"
ENV PYTHON_BIN="$VENV/bin/python3"
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Node deps
COPY package.json ./
RUN npm install

# Source
COPY tsconfig.json ./
COPY src ./src

ENV WORK_DIR=/tmp/supra-reels
CMD ["npm", "run", "start"]
