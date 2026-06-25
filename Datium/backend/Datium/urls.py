
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('chatbot/', include('chatbot.urls')),
    
    # Frontend Routes
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('index.html', TemplateView.as_view(template_name='index.html')),
    path('login.html', TemplateView.as_view(template_name='login.html')),
    path('register.html', TemplateView.as_view(template_name='register.html')),
    path('dashboard.html', TemplateView.as_view(template_name='dashboard.html')),
    path('profile.html', TemplateView.as_view(template_name='profile.html')),
    path('system.html', TemplateView.as_view(template_name='system.html')),
    path('system_form.html', TemplateView.as_view(template_name='system_form.html')),
    path('table.html', TemplateView.as_view(template_name='table.html')),
    path('table_form.html', TemplateView.as_view(template_name='table_form.html'), name='table_form'),
    path('chat.html', TemplateView.as_view(template_name='chat.html'), name='chat'),
    path('connections.html', TemplateView.as_view(template_name='connections.html')),
    path('audit.html', TemplateView.as_view(template_name='audit.html')),
    path('stats.html', TemplateView.as_view(template_name='stats.html')),
    path('admin.html', TemplateView.as_view(template_name='admin.html')),
    path('payment_simulation.html', TemplateView.as_view(template_name='payment_simulation.html')),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

import sys
from django.core.management import call_command
import threading
import traceback
import os

def auto_migrate():
    log_path = r"c:\Users\Nico9\Desktop\Datium-python-ya-definitivo\Datium\backend\mig_out2.txt"
    with open(log_path, "a") as f:
        f.write("Starting auto-migrate thread...\n")
        try:
            call_command('migrate')
            f.write("[DATIUM AUTO-MIGRATE] Migrations applied successfully. DB is ready.\n")
        except Exception as e:
            f.write(f"[DATIUM AUTO-MIGRATE] Error: {e}\n")
            f.write(traceback.format_exc() + "\n")

if 'runserver' in sys.argv or 'daphne' in sys.argv or 'gunicorn' in sys.argv:
    threading.Thread(target=auto_migrate, daemon=True).start()
