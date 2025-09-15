"""
Health check endpoint for LazyLedger Parser service.
This file provides a simple health check endpoint to verify the service is running.
"""

from flask import Blueprint, jsonify
import platform
import sys
import os
import time

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Simple health check endpoint that returns basic service information.
    """
    health_data = {
        'status': 'ok',
        'service': 'LazyLedger Parser',
        'timestamp': time.time(),
        'environment': {
            'python_version': sys.version,
            'platform': platform.platform(),
            'process_id': os.getpid()
        }
    }
    
    return jsonify(health_data)

# Add this Blueprint to your main Flask app
# In your app.py or main Flask file, add:
# from health import health_bp
# app.register_blueprint(health_bp)