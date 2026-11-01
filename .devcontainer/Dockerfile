FROM mcr.microsoft.com/devcontainers/base:ubuntu

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl git unzip xz-utils zip libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Install Flutter, then give the Codespaces user ownership of its SDK/cache.
RUN git clone --depth 1 --branch stable https://github.com/flutter/flutter.git /opt/flutter \
    && chown -R vscode:vscode /opt/flutter

ENV PATH="/opt/flutter/bin:/opt/flutter/bin/cache/dart-sdk/bin:${PATH}"

# Flutter creates and updates files in its SDK cache; run it as the workspace user.
USER vscode
RUN flutter config --enable-web \
    && flutter precache --web
