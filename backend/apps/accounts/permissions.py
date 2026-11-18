from rest_framework import permissions

class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to active authenticated users who have ADMIN role
    or are superusers.
    """
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and
            user.is_authenticated and
            user.is_active and
            (getattr(user, 'role', None) == 'ADMIN' or user.is_superuser)
        )


class IsStudent(permissions.BasePermission):
    """
    Allows access only to active authenticated students.
    """
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and
            user.is_authenticated and
            user.is_active and
            getattr(user, 'role', None) == 'STUDENT'
        )
