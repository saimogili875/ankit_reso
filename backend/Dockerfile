FROM python:3.11-slim

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

# Copy requirements & install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY . /app/

RUN SECRET_KEY=build-only VIDEO_STREAMING_SECRET=build-only-video DJANGO_SETTINGS_MODULE=config.settings.prod \
    python manage.py collectstatic --noinput

# Expose Django REST server port
EXPOSE 10000
EXPOSE 8000

# Default command to run migrations, ensure admin user exists, and start gunicorn WSGI server
CMD ["sh", "-c", "python manage.py migrate --noinput; python manage.py ensure_admin; gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers 3 --timeout 120"]
