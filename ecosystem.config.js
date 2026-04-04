module.exports = {
  apps: [
    { 
      name: 'api-gateway', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/api-gateway', 
      env: { 
        PORT: 3000,
        JWT_SECRET: 'velocity_jwt_secret_key',
        AUTH_SERVICE_URL: 'http://localhost:3001',
        USER_SERVICE_URL: 'http://localhost:3002',
        RIDE_SERVICE_URL: 'http://localhost:3003',
        CARPOOL_SERVICE_URL: 'http://localhost:3004',
        PARCEL_SERVICE_URL: 'http://localhost:3005',
        NOTIFICATION_SERVICE_URL: 'http://localhost:3006',
        SUBSCRIPTION_SERVICE_URL: 'http://localhost:3007'
      } 
    },
    { 
      name: 'auth-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/auth-service', 
      env: { 
        PORT: 3001,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_auth?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        JWT_REFRESH_SECRET: 'velocity_refresh_secret_key',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: 'amqp://admin:password@localhost:5672'
      } 
    },
    { 
      name: 'user-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/user-service', 
      env: { 
        PORT: 3002,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_users?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        REDIS_URL: 'redis://localhost:6379',
        PROFILE_CACHE_TTL: 300
      } 
    },
    { 
      name: 'ride-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/ride-service', 
      env: { 
        PORT: 3003,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_rides?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: 'amqp://admin:password@localhost:5672',
        ESTIMATE_CACHE_TTL: 120,
        DRIVER_LOCK_TTL: 10000,
        SUBSCRIPTION_SERVICE_URL: 'http://localhost:3007'
      } 
    },
    { 
      name: 'carpool-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/carpool-service', 
      env: { 
        PORT: 3004,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_carpool?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        RABBITMQ_URL: 'amqp://admin:password@localhost:5672',
        POOL_LIST_CACHE_TTL: 30,
        REDIS_URL: 'redis://localhost:6379',
        SUBSCRIPTION_SERVICE_URL: 'http://localhost:3007'
      } 
    },
    { 
      name: 'parcel-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/parcel-service', 
      env: { 
        PORT: 3005,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_parcels?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        RABBITMQ_URL: 'amqp://admin:password@localhost:5672',
        SUBSCRIPTION_SERVICE_URL: 'http://localhost:3007'
      } 
    },
    { 
      name: 'notification-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/notification-service', 
      env: { 
        PORT: 3006,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_notifications?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        RABBITMQ_URL: 'amqp://admin:password@localhost:5672'
      } 
    },
    { 
      name: 'subscription-service', 
      script: 'src/index.js', 
      cwd: '/home/babar/Music/Velocity-main/velocity-backend/subscription-service', 
      env: { 
        PORT: 3007,
        MONGODB_URI: 'mongodb://admin:password@localhost:27017/velocity_subscriptions?authSource=admin',
        JWT_SECRET: 'velocity_jwt_secret_key',
        REDIS_URL: 'redis://localhost:6379',
        RABBITMQ_URL: 'amqp://admin:password@localhost:5672',
        PLANS_CACHE_TTL: 3600
      } 
    }
  ]
};
