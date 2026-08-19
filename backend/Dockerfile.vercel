FROM python:3.12-slim

# Tesseract (+ lingua italiana per i referti) e libmagic, richieste da
# pytesseract/python-magic — non incluse nel runtime Python nativo di Render.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ita \
    libmagic1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Le Vercel Functions hanno il filesystem dell'immagine in sola lettura e
# consentono scritture solo nello scratch space /tmp. Questi valori restano
# sovrascrivibili a runtime quando si collega uno storage persistente.
ENV DATABASE_URL=sqlite:////tmp/volleyref.db \
    STORAGE_DIR=/tmp/volleyref-storage

# Vercel instrada i container sulla porta 80 se PORT non e configurata.
EXPOSE 80
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-80}"]
