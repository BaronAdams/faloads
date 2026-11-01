FROM mcr.microsoft.com/devcontainers/base:ubuntu

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl git unzip xz-utils zip libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Install Flutter, fix SDK ownership, and trust this checkout system-wide.
RUN git clone --depth 1 --branch stable https://github.com/flutter/flutter.git /opt/flutter \
    && chown -R vscode:vscode /opt/flutter \
    && git config --system --add safe.directory /opt/flutter

ENV PATH="/opt/flutter/bin:/opt/flutter/bin/cache/dart-sdk/bin:${PATH}"

USER vscode
RUN flutter config --enable-web \
    && flutter precache --web
