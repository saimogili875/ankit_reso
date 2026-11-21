"""
Core middleware components for AdeptEduverse API.
"""

class NormalizeSlashMiddleware:
    """
    Ensures that incoming API requests without a trailing slash are normalized
    by appending a slash internally to request.path_info and request.path.
    This prevents Django's CommonMiddleware from throwing a RuntimeError on POST/PUT
    requests with APPEND_SLASH=True or causing redirect loops on proxied requests.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info or ''
        # If it's an API route or endpoint without a trailing slash and without a file extension (e.g. .ico, .json, .png)
        if path and not path.endswith('/'):
            last_segment = path.split('/')[-1]
            if '.' not in last_segment:
                request.path_info = path + '/'
                request.path = request.path_info
        return self.get_response(request)
