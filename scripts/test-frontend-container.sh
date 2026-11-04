#!/bin/sh
# Exercise the actual image, including the listener used by pre-0.6.3 deployments.
set -eu

IMAGE="${1:?usage: test-frontend-container.sh IMAGE}"
CONTAINER=""
cleanup() {
    if [ -n "$CONTAINER" ]; then
        docker rm -f "$CONTAINER" >/dev/null
    fi
}
trap cleanup EXIT INT TERM

check_image() {
    CONTAINER=$(docker run -d --network none \
        -e BACKEND_URL=127.0.0.1:8000 "$@" "$IMAGE")
    uid=$(docker exec "$CONTAINER" id -u)
    if [ "$uid" = 0 ]; then
        echo "frontend must run as non-root" >&2
        exit 1
    fi
    for port in 80 8080; do
        attempt=0
        until docker exec "$CONTAINER" wget -q --spider "http://127.0.0.1:$port/"; do
            attempt=$((attempt + 1))
            if [ "$attempt" -ge 15 ]; then
                docker logs "$CONTAINER"
                echo "frontend port $port failed" >&2
                exit 1
            fi
            sleep 1
        done
        # Check that the application, rather than a default nginx page, is served.
        docker exec "$CONTAINER" wget -qO- "http://127.0.0.1:$port/" | grep -q 'id="root"'
        echo "passed: $IMAGE port $port, uid $uid"
    done
    cleanup
    CONTAINER=""
}

check_image
# A namespace sysctl supports low ports even without capabilities or privilege escalation.
check_image --cap-drop ALL --security-opt no-new-privileges \
    --sysctl net.ipv4.ip_unprivileged_port_start=0
