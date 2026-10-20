FROM nginxinc/nginx-unprivileged:1.28-alpine
USER root
RUN mkdir -p /logs && chown -R 101:101 /logs
USER 101
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
