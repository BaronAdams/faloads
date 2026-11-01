FROM mcr.microsoft.com/devcontainers/base:ubuntu

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl git unzip xz-utils zip libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Install Flutter and give the Codespaces user ownership of its SDK/cache.
RUN git clone --depth 1 --branch stable https://github.com/flutter/flutter.git /opt/flutter \
    && chown -R vscode:vscode /opt/flutter

ENV PATH="/opt/flutter/bin:/opt/flutter/bin/cache/dart-sdk/bin:${PATH}"

USER vscode

# Explicitly trust the Flutter SDK Git checkout for this user.
RUN git config --global --add safe.directory /opt/flutter \
    && flutter config --enable-web \
    && flutter precache --web
