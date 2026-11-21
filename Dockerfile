FROM python:3.12-slim

# Prevent Python from writing .pyc files & buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.prod
ENV PORT=10000

WORKDIR /app

# Install system dependencies needed for psycopg2 compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements & install dependencies
COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source code to container
COPY backend/ /app/

# Collect static files for WhiteNoise at build time (using build-only dummy SECRET_KEY and VIDEO_STREAMING_SECRET)
RUN SECRET_KEY=build-only VIDEO_STREAMING_SECRET=build-only DJANGO_SETTINGS_MODULE=config.settings.prod \
    python manage.py collectstatic --noinput

# Create and switch to non-root user
RUN adduser --disabled-password --gecos '' --no-create-home appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose Render web service port (Render default is 10000, fallback 8000)
EXPOSE 10000
EXPOSE 8000

# Run database migrations on start, ensure admin user exists, and launch Gunicorn binding to 0.0.0.0:$PORT
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py ensure_admin || true) && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers ${WEB_CONCURRENCY:-2} --threads 2 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - --timeout 120"]
