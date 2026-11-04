#!/bin/sh
# Alpine-based image uses /bin/sh (busybox ash), not bash
set -e

# Set default backend URL if not provided (host:port format, no protocol)
export BACKEND_URL="${BACKEND_URL:-backend:8000}"

echo "Configuring nginx with BACKEND_URL: ${BACKEND_URL}"

# Replace only our custom placeholder and preserve nginx runtime vars like $http_upgrade
ESCAPED_BACKEND_URL=$(printf '%s\n' "$BACKEND_URL" | sed 's/[\/&]/\\&/g')
# Docker's embedded DNS accepts service names directly. Other platforms may
# rely on libc search domains, so preserve their startup name resolution.
BACKEND_RESOLVER_CONFIG=""
BACKEND_RESOLVE=""
if awk '$1 == "nameserver" && $2 == "127.0.0.11" { found = 1 } END { exit !found }' /etc/resolv.conf; then
    BACKEND_RESOLVER_CONFIG="resolver 127.0.0.11 valid=5s ipv6=off;"
    BACKEND_RESOLVE="resolve"
fi
sed -e "s/__BACKEND_URL__/${ESCAPED_BACKEND_URL}/g" \
    -e "s/__BACKEND_RESOLVER_CONFIG__/${BACKEND_RESOLVER_CONFIG}/g" \
    -e "s/__BACKEND_RESOLVE__/${BACKEND_RESOLVE}/g" \
    /etc/nginx/nginx.conf.template > /tmp/nginx.conf

# Validate the generated nginx configuration before starting
echo "Validating nginx configuration..."
if ! nginx -t -c /tmp/nginx.conf; then
    echo "ERROR: nginx configuration validation failed" >&2
    exit 1
fi

# Execute the main command (nginx)
exec "$@"
