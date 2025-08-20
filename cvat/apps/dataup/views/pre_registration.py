# from rest_framework import viewsets, status
# from rest_framework.response import Response
# from rest_framework.decorators import action
# from rest_framework.permissions import IsAuthenticated
# from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
# from django.conf import settings
# from django.utils import timezone
# import requests
# # from ..models import DataUpPreRegistrationAPIKey, DataUpOrganization
# # from ..serializers import DataUpPreRegistrationAPIKeyReadSerializer, DataUpPreRegistrationAPIKeyWriteSerializer

# class DataUPPregistrationView(viewsets.ViewSet):
#     permission_classes = [IsAuthenticated]
#     dataup_base_url = getattr(settings, 'DATAUP_BASE_URL', None)

#     def get_preregistration_api_key(self, request):
#         """Get any available preregistration API key from database"""
#         try:
#             # Get the first available preregistration API key
#             key_obj = DataUpPreRegistrationAPIKey.objects.first()
#             if not key_obj:
#                 return None, {'error': 'No preregistration API key found in database'}

#             # Update last used timestamp
#             key_obj.last_used_at = timezone.now()
#             key_obj.save()
#             return key_obj, None
#         except Exception as e:
#             return None, {'error': f'Error retrieving preregistration API key: {str(e)}'}

#     def get_organization_data(self, user):
#         """
#         Get all organization data.
#         Returns a list of all organizations.
#         """
#         organizations = []

#         # Get all organizations that have a DataUp organization
#         dataup_organizations = DataUpOrganization.objects.select_related('organization')

#         for dataup_org in dataup_organizations:
#             organizations.append({
#                 'name': dataup_org.organization.slug,
#                 'organization_id': str(dataup_org.id)  # UUID as string
#             })

#         return organizations

#     @extend_schema(
#         operation_id='dataup_preregistration',
#         summary='DataUp Pre-registration',
#         description='Send organization data to DataUp for pre-registration',
#         parameters=[],
#         responses={
#             200: OpenApiResponse(description='Pre-registration successful'),
#             400: OpenApiResponse(description='Bad request'),
#             401: OpenApiResponse(description='Unauthorized'),
#             403: OpenApiResponse(description='Forbidden'),
#             500: OpenApiResponse(description='Internal server error')
#         }
#     )
#     @action(detail=False, methods=['post'])
#     def preregister(self, request):
#         """Send organization data to DataUp for pre-registration"""
#         # Get preregistration API key from database
#         key_obj, error = self.get_preregistration_api_key(request)
#         if error:
#             return Response(error, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#         # Get organization data for the user
#         organizations = self.get_organization_data(request.user)

#         if not organizations:
#             return Response(
#                 {'error': 'No DataUp organizations found for user'},
#                 status=status.HTTP_404_NOT_FOUND
#             )

#         # Prepare data to send to DataUp
#         payload = {
#             'organizations': organizations
#         }

#         try:
#             # Send data to DataUp (assuming there's a DataUp API endpoint)
#             print("Sending preregistration request to", self.dataup_base_url)
#             if not self.dataup_base_url:
#                 return Response(
#                     {'error': 'DataUp preregistration URL not configured'},
#                     status=status.HTTP_500_INTERNAL_SERVER_ERROR
#                 )
#             dataup_url = self.dataup_base_url + "/api/v1/instances/me/pre-registered-orgs/"
#             headers = {
#                 'Content-Type': 'application/json',
#                 'X-API-Key': key_obj.key
#             }
#             print("Sending request with header:", headers, "payload", payload)
#             response = requests.post(
#                 dataup_url,
#                 json=payload,
#                 headers=headers,
#                 timeout=30
#             )

#             if response.status_code == 200:
#                 return Response({
#                     'message': 'Pre-registration successful',
#                     'organizations_sent': len(organizations)
#                 }, status=status.HTTP_200_OK)
#             else:
#                 return Response({
#                     'error': 'DataUp API error',
#                     'status_code': response.status_code,
#                     'message': response.text
#                 }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#         except requests.RequestException as e:
#             return Response({
#                 'error': 'Failed to connect to DataUp API',
#                 'message': str(e)
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#         except Exception as e:
#             return Response({
#                 'error': 'Internal server error',
#                 'message': str(e)
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#     @extend_schema(
#         operation_id='dataup_create_preregistration_key',
#         summary='Create DataUp Pre-registration API Key',
#         description='Create a new pre-registration API key for DataUp integration using a key copied from another backend.',
#         request=DataUpPreRegistrationAPIKeyWriteSerializer,
#         responses={
#             201: DataUpPreRegistrationAPIKeyReadSerializer,
#             400: OpenApiResponse(description='Bad request - invalid input data'),
#             401: OpenApiResponse(description='Unauthorized'),
#             403: OpenApiResponse(description='Forbidden'),
#             500: OpenApiResponse(description='Internal server error')
#         }
#     )
#     @action(detail=False, methods=['post'])
#     def create_key(self, request):
#         """Create a new pre-registration API key from another backend"""
#         serializer = DataUpPreRegistrationAPIKeyWriteSerializer(data=request.data)

#         if serializer.is_valid():
#             try:
#                 api_key = serializer.save()
#                 return Response(
#                     DataUpPreRegistrationAPIKeyReadSerializer(api_key).data,
#                     status=status.HTTP_201_CREATED
#                 )
#             except Exception as e:
#                 return Response({
#                     'error': 'Failed to create API key',
#                     'message': str(e)
#                 }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#         else:
#             return Response(
#                 serializer.errors,
#                 status=status.HTTP_400_BAD_REQUEST
#             )

#     @extend_schema(
#         operation_id='dataup_list_preregistration_keys',
#         summary='List all Pre-registration API Keys',
#         description='Retrieve a list of all pre-registration API keys in the system.',
#         responses={
#             200: DataUpPreRegistrationAPIKeyReadSerializer(many=True),
#             400: OpenApiResponse(description='Bad request'),
#             500: OpenApiResponse(description='Internal server error')
#         }
#     )
#     def list(self, request):
#         """List all pre-registration API keys"""
#         api_keys = DataUpPreRegistrationAPIKey.objects.all()
#         serializer = DataUpPreRegistrationAPIKeyReadSerializer(api_keys, many=True)
#         return Response(serializer.data)

#     @extend_schema(
#         operation_id='dataup_delete_preregistration_key',
#         summary='Delete a Pre-registration API Key',
#         description='Delete a pre-registration API key by its ID.',
#         responses={
#             204: OpenApiResponse(description='No content - API key deleted'),
#             404: OpenApiResponse(description='API key not found'),
#             500: OpenApiResponse(description='Internal server error')
#         }
#     )
#     def destroy(self, request, pk=None):
#         """Delete a pre-registration API key"""
#         try:
#             api_key = DataUpPreRegistrationAPIKey.objects.get(pk=pk)
#             api_key.delete()
#             return Response(status=status.HTTP_204_NO_CONTENT)
#         except DataUpPreRegistrationAPIKey.DoesNotExist:
#             return Response(status=status.HTTP_404_NOT_FOUND)