# --- build args (shared) ------------------------------------------------------
    ARG PIP_VERSION=24.0
    ARG BASE_IMAGE=ubuntu:22.04

    # --- common build base (toolchain + headers) ---------------------------------
    FROM ${BASE_IMAGE} AS build-image-base

    RUN apt-get update && \
        DEBIAN_FRONTEND=noninteractive apt-get --no-install-recommends install -yq \
            curl g++ gcc git make nasm pkg-config \
            python3-dev python3-pip \
            libgeos-dev libldap2-dev libsasl2-dev \
            libxml2-dev libxmlsec1-dev libxmlsec1-openssl \
            libhdf5-dev cargo \
        && rm -rf /var/lib/apt/lists/*

    ARG PIP_VERSION
    ENV PIP_DISABLE_PIP_VERSION_CHECK=1
    RUN --mount=type=cache,target=/root/.cache/pip/http \
        python3 -m pip install -U pip==${PIP_VERSION}

    # --- build wheels for all Python deps (allow binary for av) -------------------
    FROM build-image-base AS build-image

    COPY cvat/requirements/ /tmp/cvat/requirements/
    COPY utils/dataset_manifest/requirements.txt /tmp/utils/dataset_manifest/requirements.txt

    ARG CVAT_CONFIGURATION="production"

    # Build wheels for the full app + dataset_manifest (no source build of av)
    # Still avoid source builds for lxml/xmlsec (they need system headers at runtime anyway)
    RUN --mount=type=cache,target=/root/.cache/pip/http-v2 \
        DATUMARO_HEADLESS=1 python3 -m pip wheel --no-deps --no-binary lxml,xmlsec \
            -r /tmp/cvat/requirements/${CVAT_CONFIGURATION}.txt \
            -r /tmp/utils/dataset_manifest/requirements.txt \
            -w /tmp/wheelhouse

FROM golang:1.25.5 AS build-smokescreen

RUN git clone --filter=blob:none --no-checkout https://github.com/stripe/smokescreen.git
RUN cd smokescreen && git checkout eb1ac09 && go build -o /tmp/smokescreen

    # --- final runtime image ------------------------------------------------------
    FROM ${BASE_IMAGE}

    ARG http_proxy
    ARG https_proxy
    ARG no_proxy
    ARG socks_proxy
    ARG TZ="Etc/UTC"

    ENV TERM=xterm \
        http_proxy=${http_proxy} \
        https_proxy=${https_proxy} \
        no_proxy=${no_proxy} \
        socks_proxy=${socks_proxy} \
        LANG='C.UTF-8' \
        LC_ALL='C.UTF-8' \
        TZ=${TZ}

    ARG USER="django"
    ARG CVAT_CONFIGURATION="production"
    ENV DJANGO_SETTINGS_MODULE="cvat.settings.${CVAT_CONFIGURATION}"

    # Minimal runtime libs
    RUN apt-get update && \
        DEBIAN_FRONTEND=noninteractive apt-get --no-install-recommends install -yq \
            bzip2 ca-certificates curl git \
            libgeos-c1v5 libgl1 libgomp1 \
            libldap-2.5-0 libsasl2-2 \
            libpython3.10 \
            libxml2 libxmlsec1 libxmlsec1-openssl \
            nginx p7zip-full poppler-utils \
            python3 python3-venv supervisor tzdata unrar wait-for-it \
        && ln -fs /usr/share/zoneinfo/${TZ} /etc/localtime && \
        dpkg-reconfigure -f noninteractive tzdata && \
        rm -rf /var/lib/apt/lists/* && \
        echo 'application/wasm wasm' >> /etc/mime.types

    # Install smokescreen
    COPY --from=build-smokescreen /tmp/smokescreen /usr/local/bin/smokescreen

# Add a non-root user
ENV USER=${USER}
ENV HOME /home/${USER}
RUN adduser --uid=1000 --shell /bin/bash --disabled-password --gecos "" ${USER}

    # Optional ClamAV
    ARG CLAM_AV="no"
    RUN if [ "$CLAM_AV" = "yes" ]; then \
            apt-get update && \
            apt-get --no-install-recommends install -yq clamav libclamunrar9 && \
            sed -i 's/ReceiveTimeout 30/ReceiveTimeout 300/g' /etc/clamav/freshclam.conf && \
            freshclam && \
            chown -R ${USER}:${USER} /var/lib/clamav && \
            rm -rf /var/lib/apt/lists/* ; \
        fi

    # Python venv + wheels
    RUN python3 -m venv /opt/venv
    ENV PATH="/opt/venv/bin:${PATH}"

    # setuptools note for google-cloud-storage (as in your original)
    RUN python -m pip install --upgrade setuptools
    ARG PIP_VERSION
    ARG PIP_DISABLE_PIP_VERSION_CHECK=1
    RUN python -m pip install -U pip==${PIP_VERSION}

    # Install prebuilt wheels (includes av wheel from PyPI)
    RUN --mount=type=bind,from=build-image,source=/tmp/wheelhouse,target=/mnt/wheelhouse \
        python -m pip install --no-index /mnt/wheelhouse/*.whl

    # Optional debugpy for VS Code
    ARG CVAT_DEBUG_ENABLED
    RUN if [ "${CVAT_DEBUG_ENABLED}" = 'yes' ]; then \
            python3 -m pip install --no-cache-dir debugpy; \
        fi

    # Remove pip in final image (per your policy)
    RUN python -m pip uninstall -y pip

# Install and initialize CVAT, copy all necessary files
COPY cvat/nginx.conf /etc/nginx/nginx.conf
COPY --chown=${USER} supervisord/ ${HOME}/supervisord
COPY --chown=${USER} backend_entrypoint.d/ ${HOME}/backend_entrypoint.d
COPY --chown=${USER} manage.py rqscheduler.py backend_entrypoint.sh wait_for_deps.sh ${HOME}/
COPY --chown=${USER} utils/ ${HOME}/utils
COPY --chown=${USER} cvat/ ${HOME}/cvat
COPY --chown=${USER} components/analytics/clickhouse/init.py ${HOME}/components/analytics/clickhouse/init.py

    # Coverage hook (optional)
    ARG COVERAGE_PROCESS_START
    RUN if [ "${COVERAGE_PROCESS_START}" ]; then \
            echo "import coverage; coverage.process_startup()" > /opt/venv/lib/python3.10/site-packages/coverage_subprocess.pth; \
        fi

# RUN all commands below as 'django' user.
# Use numeric UID/GID so that the image is compatible with the Kubernetes runAsNonRoot setting.
USER 1000:1000
WORKDIR ${HOME}

    RUN mkdir -p data share keys logs /tmp/supervisord static

    EXPOSE 8080
    ENTRYPOINT ["./backend_entrypoint.sh"]
