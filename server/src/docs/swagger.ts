export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'SuperTom REST API Backend',
    version: '1.0.0',
    description: 'Production REST API for SuperTom Telegram Mining Game, deployed on Render with Supabase PostgreSQL.',
    contact: {
      name: 'SuperTom Core Team',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Root',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'System Health Check',
        responses: {
          200: { description: 'Server and database healthy' },
        },
      },
    },
    '/auth/telegram': {
      post: {
        summary: 'Authenticate with Telegram Mini App raw initData',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['initData'],
                properties: {
                  initData: { type: 'string', description: 'Raw Telegram WebApp.initData string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully. Returns JWT access and refresh tokens.' },
          401: { description: 'Invalid HMAC signature or expired timestamp' },
        },
      },
    },
    '/user/me': {
      get: {
        summary: 'Get authenticated player profile and stats',
        responses: { 200: { description: 'Player profile' } },
      },
    },
    '/user/balance': {
      get: {
        summary: 'Get Poops and USDT equivalent balance',
        responses: { 200: { description: 'Balance breakdown' } },
      },
    },
    '/mining/status': {
      get: {
        summary: 'Get real-time accumulated Poop mining rate and unclaimed earnings',
        responses: { 200: { description: 'Mining status' } },
      },
    },
    '/mining/claim': {
      post: {
        summary: 'Atomically claim accumulated Poops into player wallet balance',
        responses: { 200: { description: 'Claim successful' } },
      },
    },
    '/store/inventory': {
      get: {
        summary: 'Get player biscuit counts (Common, Silver, Gold, Diamond)',
        responses: { 200: { description: 'Inventory map' } },
      },
    },
    '/store/purchase': {
      post: {
        summary: 'Purchase biscuits with Poops currency',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['biscuitId', 'quantity'],
                properties: {
                  biscuitId: { type: 'string', enum: ['common', 'silver', 'gold', 'diamond'] },
                  quantity: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Purchase completed' } },
      },
    },
    '/store/feed': {
      post: {
        summary: 'Feed biscuits to King Tom to permanently increase hourly mining output',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['biscuitId'],
                properties: {
                  biscuitId: { type: 'string', enum: ['common', 'silver', 'gold', 'diamond'] },
                  count: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Tom fed successfully' } },
      },
    },
    '/spin/status': {
      get: {
        summary: 'Get milestone timer cooldown (2h/4h/8h) and eligibility',
        responses: { 200: { description: 'Wheel status' } },
      },
    },
    '/spin/claim': {
      post: {
        summary: 'Spin lucky wheel with cryptographically secure RNG and claim reward',
        responses: { 200: { description: 'Reward credited' } },
      },
    },
    '/missions': {
      get: {
        summary: 'Get quest catalogue with player completion progress',
        responses: { 200: { description: 'Missions list' } },
      },
    },
    '/missions/{id}/verify': {
      post: {
        summary: 'Verify mission completion via Telegram Bot API',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Verification result' } },
      },
    },
    '/missions/{id}/claim': {
      post: {
        summary: 'Claim mission bounty reward',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Reward credited' } },
      },
    },
    '/referrals/stats': {
      get: {
        summary: 'Get player referral code, friends invited, and commission earnings',
        responses: { 200: { description: 'Referral stats' } },
      },
    },
    '/payouts/history': {
      get: {
        summary: 'Get player USDT TRC20 withdrawal history',
        responses: { 200: { description: 'Payout history' } },
      },
    },
    '/payouts/request': {
      post: {
        summary: 'Request USDT TRC20 withdrawal (min 2,000 Poops = 1.00 USDT)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['walletAddress', 'amountPoops'],
                properties: {
                  walletAddress: { type: 'string', description: 'Valid TRON TRC20 wallet address' },
                  amountPoops: { type: 'integer', minimum: 2000 },
                  network: { type: 'string', default: 'TRC20' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Withdrawal submitted for admin review' } },
      },
    },
  },
};
