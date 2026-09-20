release: ## Full release workflow (main branch only)
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT_BRANCH" != "main" ]; then \
		echo "ERROR: Releases must be made from 'main' branch!"; \
		echo "Current branch: $$CURRENT_BRANCH"; \
		echo "Please switch to main and try again."; \
		exit 1; \
	fi
	@echo "On main branch."
	@echo "Pulling latest changes..."
	@git pull origin main
	@echo "Up to date with remote."
	@echo "Current status:"
	@git status --short || true
	@echo "Running tests..."
	@$(MAKE) test
	@echo "All tests passed."
	@CURRENT=$$(cat VERSION); \
	PATCH=$$(echo $$CURRENT | awk -F. '{print $$1"."$$2"."$$3+1}'); \
	MINOR=$$(echo $$CURRENT | awk -F. '{print $$1"."$$2+1".0"}'); \
	MAJOR=$$(echo $$CURRENT | awk -F. '{print $$1+1".0.0"}'); \
	echo "Current version: $$CURRENT"; \
	echo "Select version bump:"; \
	echo "  1) patch -> $$PATCH"; \
	echo "  2) minor -> $$MINOR"; \
	echo "  3) major -> $$MAJOR"; \
	echo "  4) custom"; \
	echo "  5) skip (keep $$CURRENT)"; \
	read -p "Enter choice [1-5]: " choice; \
	case $$choice in \
		1) NEW_VERSION=$$PATCH ;; \
		2) NEW_VERSION=$$MINOR ;; \
		3) NEW_VERSION=$$MAJOR ;; \
		4) read -p "Enter new version: " NEW_VERSION ;; \
		5) NEW_VERSION=$$CURRENT ;; \
		*) echo "Invalid choice, using current."; NEW_VERSION=$$CURRENT ;; \
	esac; \
	if [ "$$NEW_VERSION" != "$$CURRENT" ]; then \
		echo "Bumping version to $$NEW_VERSION..."; \
		echo "$$NEW_VERSION" > VERSION; \
		sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" frontend/package.json 2>/dev/null || \
			sed -i "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" frontend/package.json; \
		sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" backend/package.json 2>/dev/null || \
			sed -i "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" backend/package.json; \
		echo "Version bumped to $$NEW_VERSION."; \
	else \
		echo "Keeping version $$CURRENT."; \
	fi
	@echo "Preparing fresh release notes (RELEASE.md)..."
	@$(MAKE) changelog
	@NEW_VERSION=$$(cat VERSION); \
	echo "Release summary:"; \
	echo "  Version: v$$NEW_VERSION"; \
	echo "  Branch: main"; \
	echo "  Tag: v$$NEW_VERSION"; \
	echo "Changes to be committed:"; \
	git status --short; \
	true
	@read -p "Proceed with release? [y/N]: " confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
		echo "Release aborted."; \
		exit 1; \
	fi
	@NEW_VERSION=$$(cat VERSION); \
	echo "Committing release..."; \
	git add -A; \
	git commit -m "chore: release v$$NEW_VERSION" || echo "Nothing to commit."
	@echo "Changes committed."
	@echo "Pushing to remote..."
	@git push origin main
	@echo "Pushed to origin/main."
	@NEW_VERSION=$$(cat VERSION); \
	echo "Creating tag v$$NEW_VERSION..."; \
	git tag -a "v$$NEW_VERSION" -m "Release v$$NEW_VERSION"; \
	git push origin "v$$NEW_VERSION"
	@echo "Tag v$$NEW_VERSION created and pushed."
	@NEW_VERSION=$$(cat VERSION); \
	echo "Creating GitHub release..."; \
	if command -v gh &> /dev/null; then \
		gh release create "v$$NEW_VERSION" \
			--title "ExcaliDash v$$NEW_VERSION" \
			--notes-file RELEASE.md; \
		echo "GitHub release created."; \
	else \
		echo "gh CLI not installed!"; \
		echo "Install with: brew install gh"; \
		echo "Then run: gh auth login"; \
		exit 1; \
	fi
	@echo "Building and pushing Docker images..."
	@./scripts/publish-docker.sh
	@NEW_VERSION=$$(cat VERSION); \
	echo "Release complete."; \
	echo "Version: v$$NEW_VERSION"; \
	echo "Git tag pushed."; \
	echo "GitHub release created."; \
	echo "Docker images published."

pre-release: ## Pre-release workflow (prerelease/pre-release branch only)
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT_BRANCH" != "prerelease" ] && [ "$$CURRENT_BRANCH" != "pre-release" ]; then \
		echo "ERROR: Pre-releases must be made from 'prerelease' or 'pre-release' branch!"; \
		echo "Current branch: $$CURRENT_BRANCH"; \
		echo "Please switch to the prerelease branch and try again."; \
		exit 1; \
	fi
	@echo "On pre-release branch."
	@echo "Pulling latest changes..."
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); git pull origin "$$CURRENT_BRANCH"
	@echo "Up to date with remote."
	@echo "Current status:"
	@git status --short || true
	@echo "Running tests..."
	@$(MAKE) test
	@echo "All tests passed."
	@CURRENT=$$(cat VERSION); \
	PATCH=$$(echo $$CURRENT | awk -F. '{print $$1"."$$2"."$$3+1}'); \
	MINOR=$$(echo $$CURRENT | awk -F. '{print $$1"."$$2+1".0"}'); \
	MAJOR=$$(echo $$CURRENT | awk -F. '{print $$1+1".0.0"}'); \
	echo "Current version: $$CURRENT"; \
	echo "Select version bump:"; \
	echo "  1) patch -> $$PATCH-dev"; \
	echo "  2) minor -> $$MINOR-dev"; \
	echo "  3) major -> $$MAJOR-dev"; \
	echo "  4) custom"; \
	echo "  5) skip (keep $$CURRENT-dev)"; \
	read -p "Enter choice [1-5]: " choice; \
	case $$choice in \
		1) NEW_VERSION=$$PATCH ;; \
		2) NEW_VERSION=$$MINOR ;; \
		3) NEW_VERSION=$$MAJOR ;; \
		4) read -p "Enter new version (without -dev suffix): " NEW_VERSION ;; \
		5) NEW_VERSION=$$CURRENT ;; \
		*) echo "Invalid choice, using current."; NEW_VERSION=$$CURRENT ;; \
	esac; \
	if [ "$$NEW_VERSION" != "$$CURRENT" ]; then \
		echo "Bumping version to $$NEW_VERSION..."; \
		echo "$$NEW_VERSION" > VERSION; \
		sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" frontend/package.json 2>/dev/null || \
			sed -i "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" frontend/package.json; \
		sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" backend/package.json 2>/dev/null || \
			sed -i "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" backend/package.json; \
		echo "Version bumped to $$NEW_VERSION."; \
	else \
		echo "Keeping version $$CURRENT."; \
	fi
	@echo "Preparing fresh pre-release notes (RELEASE.md)..."
	@$(MAKE) changelog PRERELEASE=1
	@NEW_VERSION=$$(cat VERSION); \
	echo "Pre-release summary:"; \
	echo "  Version: v$$NEW_VERSION-dev"; \
	echo "  Branch: pre-release"; \
	echo "  Tag: v$$NEW_VERSION-dev (pre-release)"; \
	echo "Changes to be committed:"; \
	git status --short; \
	true
	@read -p "Proceed with pre-release? [y/N]: " confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
		echo "Pre-release aborted."; \
		exit 1; \
	fi
	@NEW_VERSION=$$(cat VERSION); \
	echo "Committing pre-release..."; \
	git add -A; \
	git commit -m "chore: pre-release v$$NEW_VERSION-dev" || echo "Nothing to commit."
	@echo "Changes committed."
	@echo "Pushing to remote..."
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); git push origin "$$CURRENT_BRANCH"
	@CURRENT_BRANCH=$$(git rev-parse --abbrev-ref HEAD); echo "Pushed to origin/$$CURRENT_BRANCH."
	@NEW_VERSION=$$(cat VERSION); \
	PRE_TAG="v$$NEW_VERSION-dev"; \
	echo "Creating tag $$PRE_TAG..."; \
	git tag -a "$$PRE_TAG" -m "Pre-release $$PRE_TAG"; \
	git push origin "$$PRE_TAG"
	@echo "Tag $$PRE_TAG created and pushed."
	@NEW_VERSION=$$(cat VERSION); \
	PRE_TAG="v$$NEW_VERSION-dev"; \
	echo "Creating GitHub pre-release..."; \
	if command -v gh &> /dev/null; then \
		gh release create "$$PRE_TAG" \
			--title "ExcaliDash $$PRE_TAG (Pre-release)" \
			--notes-file RELEASE.md \
			--prerelease; \
		echo "GitHub pre-release created."; \
	else \
		echo "gh CLI not installed!"; \
		echo "Install with: brew install gh"; \
		echo "Then run: gh auth login"; \
		exit 1; \
	fi
	@echo "Building and pushing Docker images..."
	@./scripts/publish-docker-prerelease.sh
	@NEW_VERSION=$$(cat VERSION); \
	echo "Pre-release complete."; \
	echo "Version: v$$NEW_VERSION-dev"; \
	echo "Git tag pushed."; \
	echo "GitHub pre-release created."; \
	echo "Docker images published."

release-docker: ## Build and push release Docker images
	./scripts/publish-docker.sh

pre-release-docker: ## Build and push pre-release Docker images
	./scripts/publish-docker-prerelease.sh

dev-release: ## Build and push custom dev release (usage: make dev-release NAME=issue38)
	@if [ -z "$(NAME)" ]; then \
		echo "ERROR: NAME parameter is required!"; \
		echo "Usage: make dev-release NAME=<custom-name>"; \
		echo "Example: make dev-release NAME=issue38"; \
		echo "  This will create tags like: 0.3.1-dev-issue38"; \
		exit 1; \
	fi
	@echo "Building custom dev release: $(NAME)"
	@./scripts/publish-docker-dev.sh $(NAME)

