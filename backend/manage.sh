#!/bin/bash

# BidKore API Management Script
# Usage: ./manage.sh [start|stop|restart|status|logs|monitor]

case "$1" in
    start)
        echo "🚀 Starting BidKore API..."
        pm2 start ecosystem.config.cjs --env production
        ;;
    stop)
        echo "🛑 Stopping BidKore API..."
        pm2 stop bidkore-api
        ;;
    restart)
        echo "🔄 Restarting BidKore API..."
        pm2 restart bidkore-api
        ;;
    status)
        echo "📊 BidKore API Status:"
        pm2 status bidkore-api
        ;;
    logs)
        echo "📝 BidKore API Logs:"
        pm2 logs bidkore-api --lines 50
        ;;
    monitor)
        echo "📈 Opening PM2 Monitor..."
        pm2 monit
        ;;
    ssl-renew)
        echo "🔐 Renewing SSL certificates..."
        sudo certbot renew --nginx
        ;;
    ssl-status)
        echo "🔐 SSL Certificate Status:"
        sudo certbot certificates
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|monitor|ssl-renew|ssl-status}"
        echo ""
        echo "Commands:"
        echo "  start      - Start the BidKore API"
        echo "  stop       - Stop the BidKore API"
        echo "  restart    - Restart the BidKore API"
        echo "  status     - Show API status"
        echo "  logs       - Show API logs"
        echo "  monitor    - Open PM2 monitoring dashboard"
        echo "  ssl-renew  - Renew SSL certificates"
        echo "  ssl-status - Show SSL certificate status"
        exit 1
        ;;
esac
