# Imagen para publicar el sitio y el estudio editorial del CERI.
# Los datos que cambian (contenido, imágenes subidas, cuentas y respaldos) viven en /data:
# monta ahí un volumen persistente o se perderán al actualizar la imagen.
FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    CERI_DATA_DIR=/data

WORKDIR /app
COPY --chown=root:root . .
RUN addgroup -S ceri && adduser -S ceri -G ceri \
 && mkdir -p /data && chown ceri:ceri /data

USER ceri
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/salud >/dev/null || exit 1
CMD ["node", "herramientas/servidor.js"]
