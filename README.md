# Blog CMS De 7

Node.js, MySQL, phpMyAdmin and Nginx with security headers.

Run setup.ps1 (Windows) or setup.sh, then docker compose up -d --build.
Website: http://localhost:8080. Admin: /quan-tri. Credentials are in generated .env (never commit).

Prometheus: localhost:9090. Grafana: localhost:3000. Exporters monitor containers, Nginx and MySQL; dashboard provisioned automatically.
