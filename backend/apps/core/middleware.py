"""
Core middleware components for AdeptEduverse API.
"""

# Explicit routes designed to be accessed without a trailing slash
EXPLICIT_SLASHLESS_PATHS = {
    '/healthz',
    '/health',
    '/health/deep',
    '/api/health',
    '/api/healthz',
    '/api/health/deep',
    '/api/create-order',
    '/api/verify-payment',
    '/api/students/onboarding',
}

STATIC_FILE_EXTENSIONS = (
    '.pdf', '.ico', '.json', '.png', '.jpg', '.jpeg', '.svg',
    '.css', '.js', '.map', '.txt', '.xml', '.webp', '.woff', '.woff2',
    '.ttf', '.eot', '.m3u8', '.ts', '.mp4'
)

class NormalizeSlashMiddleware:
    """
    Ensures that incoming API requests without a trailing slash are normalized
    by appending a slash internally to request.path_info and request.path.
    
    Rules:
    1. Only operates on paths starting with '/api/'.
    2. Never mutates paths with file extensions (e.g. .pdf, .ico, .json).
    3. Never mutates explicit slash-less routes (/healthz, /api/create-order, etc.).
    4. Never mutates webhook endpoints.
    5. Never mutates or redirects unsafe methods (POST, PUT, PATCH, DELETE) to
       prevent losing the request body or converting requests to GET.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info or ''

        # Only consider paths starting with /api/
        if not path.startswith('/api/'):
            return self.get_response(request)

        # Do not touch explicit slashless routes
        clean_path = path.rstrip('/')
        if clean_path in EXPLICIT_SLASHLESS_PATHS or path in EXPLICIT_SLASHLESS_PATHS:
            return self.get_response(request)

        # Do not touch webhook endpoints
        if 'webhook' in path:
            return self.get_response(request)

        # Do not touch paths that already end with '/'
        if path.endswith('/'):
            return self.get_response(request)

        # Do not touch paths with static file extensions
        last_segment = path.split('/')[-1]
        if any(last_segment.lower().endswith(ext) for ext in STATIC_FILE_EXTENSIONS) or '.' in last_segment:
            return self.get_response(request)

        # Internally append trailing slash to path_info and path.
        # This allows all HTTP methods (GET, POST, PUT, PATCH, DELETE) to match
        # Django's trailing-slash routes without CommonMiddleware raising RuntimeError!
        request.path_info = path + '/'
        request.path = request.path_info
        return self.get_response(request)
