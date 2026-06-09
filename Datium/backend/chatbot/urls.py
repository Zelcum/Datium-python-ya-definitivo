from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat_view_main'),
    path('chat/', views.chat_view, name='chat_view'),
    path('conversations/', views.conversations_view, name='conversations'),
    path('conversations/<int:conversation_id>/', views.conversation_history_view, name='conversation_history'),
    path('execute/', views.execute_action_view, name='execute_action'),
    path('status/', views.model_status, name='model_status'),
    path('chatbots/', views.chatbots_view, name='chatbots'),
    path('history/', views.chat_view, name='get_history_global'),
    path('history/<int:system_id>/', views.chat_view, name='get_history'),
    path('history/clear/', views.chat_view, name='clear_history_global'),
    path('history/<int:system_id>/clear/', views.chat_view, name='clear_history'),
    path('settings/', views.ai_settings_view, name='ai_settings'),
    path('openclaw-bridge/', views.openclaw_bridge_view, name='openclaw_bridge'),
    path('share-targets/', views.share_targets_view, name='share_targets'),
]
