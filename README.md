Velocity

Velocity is a ride-hailing and logistics platform with a React frontend and a microservices backend.

## Quick Start (Docker)

This repository includes a Docker Compose setup for the backend services in `velocity-backend/`.

### Prerequisites

- Docker
- Docker Compose
- Node.js + npm (for frontend)

### Run the backend services

```bash
cd /home/babar/Music/Velocity-main/velocity-backend
docker compose up --build
```

This will start:

- `mongodb` on `localhost:27017`
- `redis` on `localhost:6380`
- `rabbitmq` on `localhost:5672`
- `api-gateway` on `http://localhost:3000`
- `auth-service` on `http://localhost:3001`
- `user-service` on `http://localhost:3002`
- `ride-service` on `http://localhost:3003`
- `carpool-service` on `http://localhost:3004`
- `parcel-service` on `http://localhost:3005`
- `notification-service` on `http://localhost:3006`
- `subscription-service` on `http://localhost:3007`
- `driver-service` on `http://localhost:3008`

RabbitMQ management UI is available at:

```text
http://localhost:15672
username: admin
password: password
```

### Run the frontend

The frontend is located in `output/`.

```bash
cd /home/babar/Music/Velocity-main/output
npm install
npm run dev
```

Then open the frontend in your browser at the local Vite URL shown in the terminal (usually `http://localhost:5173`).

> Note: the UI is built with React and Vite. For full functionality, keep the backend services running in `velocity-backend/` while you use the frontend.

### Notes

- The backend uses the API gateway at `http://localhost:3000`.
- Environment variables are configured inside `velocity-backend/docker-compose.yml`.
- If you want to restart services cleanly:

```bash
docker compose down
```

### Optional: run backend in detached mode

```bash
docker compose up --build -d
```

To view logs:

```bash
docker compose logs -f
```

