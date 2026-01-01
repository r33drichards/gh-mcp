FROM denoland/deno:debian AS deno
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Copy Deno binary from deno image
COPY --from=deno /usr/bin/deno /usr/bin/deno

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace configuration files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace package.json files
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/mcp-server ./apps/mcp-server
COPY packages/shared ./packages/shared

# Build shared package first, then mcp-server
RUN pnpm --filter @gh-mcp/shared build && pnpm --filter @gh-mcp/mcp-server build

# Create workspace directory
RUN mkdir -p /workspace && chmod 777 /workspace

WORKDIR /app/apps/mcp-server

EXPOSE 3000

CMD ["node", "dist/index.js"]
