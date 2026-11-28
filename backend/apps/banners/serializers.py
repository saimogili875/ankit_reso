from rest_framework import serializers
from .models import BannerSlide
from .services import process_and_upload_banner_image, delete_banner_image

class BannerSlidePublicSerializer(serializers.ModelSerializer):
    """
    Public read-only serializer for active banner slides on homepage and login page.
    """
    class Meta:
        model = BannerSlide
        fields = [
            'id',
            'image',
            'alt_text',
            'title',
            'caption',
            'link_url',
            'duration_seconds',
            'placement',
            'order',
        ]
        read_only_fields = fields


class BannerSlideAdminSerializer(serializers.ModelSerializer):
    """
    Full administration serializer for managing banner slides with image upload & validation.
    """
    image_file = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = BannerSlide
        fields = [
            'id',
            'image',
            'image_key',
            'image_file',
            'title',
            'caption',
            'link_url',
            'alt_text',
            'duration_seconds',
            'placement',
            'order',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'image', 'image_key', 'created_at', 'updated_at']

    def validate_duration_seconds(self, value):
        if value < 2 or value > 30:
            raise serializers.ValidationError("Duration must be between 2 and 30 seconds.")
        return value

    def validate(self, attrs):
        placement = attrs.get('placement', getattr(self.instance, 'placement', BannerSlide.Placement.HOME))
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', True))

        if is_active:
            exclude_id = self.instance.pk if self.instance else None
            BannerSlide.validate_active_limit(placement, exclude_id=exclude_id)

        # On create, image_file is required
        if not self.instance and not attrs.get('image_file'):
            raise serializers.ValidationError({'image_file': "An image file is required for creating a banner slide."})

        return attrs

    def create(self, validated_data):
        image_file = validated_data.pop('image_file', None)
        if not image_file:
            raise serializers.ValidationError({'image_file': "An image file is required."})

        image_url, image_key = process_and_upload_banner_image(image_file)
        validated_data['image'] = image_url
        validated_data['image_key'] = image_key

        return super().create(validated_data)

    def update(self, instance, validated_data):
        image_file = validated_data.pop('image_file', None)
        if image_file:
            # Delete previous object from Cloudflare R2
            if instance.image_key:
                delete_banner_image(instance.image_key)
            # Process and upload replacement image
            image_url, image_key = process_and_upload_banner_image(image_file)
            validated_data['image'] = image_url
            validated_data['image_key'] = image_key

        return super().update(instance, validated_data)


class BannerReorderSerializer(serializers.Serializer):
    """
    Serializer for bulk reordering banner slides.
    Accepts a list of slide IDs in the desired order.
    """
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text="Ordered list of BannerSlide UUIDs"
    )
