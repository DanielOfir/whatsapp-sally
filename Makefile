IMAGE_NAME := whatsapp-bridge
IMAGE_TAG  := local
DEV_COMPOSE := docker/docker-compose.dev.yml
PORT := 3002

.PHONY: build run stop logs health test-webhook clean build-multi

## Build the Docker image for the current platform
build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) -f docker/Dockerfile .

## Build and start the container using docker-compose.dev.yml
run:
	docker compose -f $(DEV_COMPOSE) up --build -d

## Stop the dev container
stop:
	docker compose -f $(DEV_COMPOSE) down

## Tail container logs
logs:
	docker compose -f $(DEV_COMPOSE) logs -f

## Check the health endpoint
health:
	@curl -sf http://localhost:$(PORT)/health | python3 -m json.tool || echo "Service not responding"

## Send a test webhook (usage: make test-webhook ACTION=add ITEM=חלב)
ACTION ?= list
ITEM ?=
test-webhook:
	@curl -sf -X POST http://localhost:$(PORT)/webhook/ha-event \
		-H "Content-Type: application/json" \
		-d '{"action":"$(ACTION)","item":"$(ITEM)"}' | python3 -m json.tool

## Remove local image and stopped containers
clean:
	docker compose -f $(DEV_COMPOSE) down --rmi local -v
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true

## Build multi-arch image (amd64 + arm64) to test CI parity
build-multi:
	docker buildx build --platform linux/amd64,linux/arm64 -t $(IMAGE_NAME):$(IMAGE_TAG) -f docker/Dockerfile .
