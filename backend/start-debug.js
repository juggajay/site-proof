// Simple script to start the server on a different port for debugging
process.env.PORT = '4004'
process.env.DATABASE_URL = 'file:./dev.db'
process.env.JWT_SECRET = 'dev-secret-change-in-production'

import('./dist/index.js')
