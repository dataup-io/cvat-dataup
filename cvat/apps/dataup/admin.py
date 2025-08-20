# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe

from cvat.apps.dataup.models import DataUpOrganization, DataUpUser
from cvat.apps.dataup.api_keys.models import DataUpAPIKey

class DataUpAPIKeyInline(admin.TabularInline):
    model = DataUpAPIKey
    extra = 0
    fields = ('name', 'label', 'preview', 'allowed_roles', 'created_at', 'last_used_at')
    readonly_fields = ('preview', 'created_at', 'last_used_at')
    
    def has_add_permission(self, request, obj=None):
        return True


@admin.register(DataUpUser)
class DataUpUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_username', 'user_email', 'user_first_name', 'user_last_name')
    list_filter = ('user__date_joined', 'user__is_active')
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('id',)
    
    def user_username(self, obj):
        return obj.user.username
    user_username.short_description = 'Username'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'
    
    def user_first_name(self, obj):
        return obj.user.first_name
    user_first_name.short_description = 'First Name'
    
    def user_last_name(self, obj):
        return obj.user.last_name
    user_last_name.short_description = 'Last Name'

@admin.register(DataUpOrganization)
class DataUpOrganizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization_name', 'organization_slug', 'api_keys_count')
    list_filter = ('organization__created_date',)
    search_fields = ('organization__name', 'organization__slug')
    readonly_fields = ('id',)
    
    inlines = [DataUpAPIKeyInline]
    
    def organization_name(self, obj):
        return obj.organization.name
    organization_name.short_description = 'Organization Name'
    
    def organization_slug(self, obj):
        return obj.organization.slug
    organization_slug.short_description = 'Organization Slug'
    
    def api_keys_count(self, obj):
        count = obj.api_keys.count()
        if count > 0:
            url = reverse('admin:dataup_dataupapikey_changelist') + f'?organization__id__exact={obj.id}'
            return format_html('<a href="{}">{} API keys</a>', url, count)
        return '0 API keys'
    api_keys_count.short_description = 'API Keys'


@admin.register(DataUpAPIKey)
class DataUpAPIKeyAdmin(admin.ModelAdmin):
    list_display = ('name', 'label', 'organization_display', 'preview_display', 'roles_display', 'created_at', 'last_used_at')
    list_filter = ('organization', 'created_at', 'last_used_at')
    search_fields = ('name', 'label', 'key')
    readonly_fields = ('id', 'preview', 'created_at', 'last_used_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'label', 'key')
        }),
        ('Organization & Permissions', {
            'fields': ('organization', 'allowed_roles')
        }),
        ('Metadata', {
            'fields': ('id', 'preview', 'created_at', 'last_used_at'),
            'classes': ('collapse',)
        })
    )
    
    def organization_display(self, obj):
        if obj.organization:
            return f"{obj.organization.organization.name} ({obj.organization.organization.slug})"
        return "Global"
    organization_display.short_description = 'Organization'
    
    def preview_display(self, obj):
        return format_html('<code>{}</code>', obj.preview)
    preview_display.short_description = 'Key Preview'
    
    def roles_display(self, obj):
        if obj.allowed_roles:
            roles = ', '.join(obj.allowed_roles)
            return format_html('<span style="color: #0066cc;">{}</span>', roles)
        return format_html('<span style="color: #999;">No roles specified</span>')
    roles_display.short_description = 'Allowed Roles'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('organization__organization')
    
    def save_model(self, request, obj, form, change):
        # Ensure preview is generated when saving
        super().save_model(request, obj, form, change)
        if not obj.preview and obj.key:
            obj.save()  # This will trigger the preview generation in the model's save method



