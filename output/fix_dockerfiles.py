import os

base_dir = '/home/babar/Music/Velocity-main/velocity-backend'
services = [
    'api-gateway', 'auth-service', 'user-service', 'ride-service',
    'carpool-service', 'parcel-service', 'notification-service', 'subscription-service'
]

for s in services:
    df_path = os.path.join(base_dir, s, 'Dockerfile')
    if os.path.exists(df_path):
        with open(df_path, 'r') as f:
            content = f.read()
        
        # Switch away from alpine to standard node for reliable DNS
        content = content.replace('FROM node:18-alpine', 'FROM node:18-bullseye-slim')
        
        with open(df_path, 'w') as f:
            f.write(content)

print("Dockerfiles updated")
