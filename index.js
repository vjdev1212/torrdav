import Koa from 'koa';
import Router from '@koa/router';
import axios from 'axios';
import dotenv from 'dotenv';
import { handlePropfind, handleGetHead } from './webdav.js';

dotenv.config();

// Configuration
const TORRSERVER_URL = process.env.TORRSERVER_URL || 'http://localhost:8090';
const PORT = parseInt(process.env.PORT || '8080', 10);
const USERNAME = process.env.WEBDAV_USERNAME || '';
const PASSWORD = process.env.WEBDAV_PASSWORD || '';

const app = new Koa();
const router = new Router();

// Authentication middleware
const authenticate = async (ctx, next) => {
  if (!USERNAME || !PASSWORD) {
    await next();
    return;
  }

  const auth = ctx.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Basic realm="TorrServer WebDAV"');
    ctx.body = 'Authentication required';
    return;
  }

  const credentials = Buffer.from(auth.substring(6), 'base64').toString();
  const [user, pass] = credentials.split(':');

  if (user !== USERNAME || pass !== PASSWORD) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Basic realm="TorrServer WebDAV"');
    ctx.body = 'Invalid credentials';
    return;
  }

  await next();
};

// Health check routes
router.get('/health', async (ctx) => {
  try {
    const response = await axios.get(`${TORRSERVER_URL}/echo`);
    ctx.body = { 
      status: 'ok', 
      torrserver: response.data,
      webdav_bridge: 'running',
      auth_enabled: !!(USERNAME && PASSWORD)
    };
  } catch (error) {
    ctx.status = 503;
    ctx.body = { 
      status: 'error', 
      message: 'Cannot connect to TorrServer',
      torrserver_url: TORRSERVER_URL
    };
  }
});

router.get('/hello', async (ctx) => {
  ctx.body = { 
    status: 'Hello from TorrDAV', 
    message: 'Application Running!'
  };
});

router.get('/ping', async (ctx) => {
  ctx.body = { 
    status: 'Ping working!', 
    message: 'Application Running!'
  };
});

router.get('', async (ctx) => {
  ctx.body = { 
    status: 'ok', 
    message: 'Application Running!'
  };
});

// Use router
app.use(router.routes());
app.use(router.allowedMethods());

// Main middleware to handle all WebDAV methods
app.use(authenticate);
app.use(async (ctx) => {
  const method = ctx.method;

  // Set common WebDAV headers
  ctx.set('DAV', '1, 2');
  ctx.set('MS-Author-Via', 'DAV');

  switch (method) {
    case 'PROPFIND':
      await handlePropfind(ctx, TORRSERVER_URL);
      break;

    case 'GET':
    case 'HEAD':
      await handleGetHead(ctx, TORRSERVER_URL);
      break;

    case 'OPTIONS':
      ctx.status = 200;
      ctx.set('Allow', 'OPTIONS, GET, HEAD, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, DELETE, LOCK, UNLOCK');
      ctx.set('Access-Control-Allow-Origin', '*');
      ctx.set('Access-Control-Allow-Methods', 'OPTIONS, GET, HEAD, PROPFIND, PROPPATCH');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, Depth, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Range, Authorization');
      ctx.body = '';
      break;

    case 'PROPPATCH':
      ctx.status = 207;
      ctx.set('Content-Type', 'application/xml; charset=utf-8');
      ctx.body = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${ctx.path}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
      break;

    case 'LOCK':
      const lockToken = `opaquelocktoken:${Date.now()}-${Math.random()}`;
      ctx.status = 200;
      ctx.set('Content-Type', 'application/xml; charset=utf-8');
      ctx.set('Lock-Token', `<${lockToken}>`);
      ctx.body = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;
      break;

    case 'UNLOCK':
      ctx.status = 204;
      ctx.body = '';
      break;

    case 'MKCOL':
    case 'DELETE':
    case 'COPY':
    case 'MOVE':
    case 'PUT':
      ctx.status = 405;
      ctx.body = 'Read-only WebDAV server';
      break;

    default:
      ctx.status = 405;
      ctx.body = 'Method not allowed';
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TorrServer WebDAV Bridge running on http://0.0.0.0:${PORT}`);
  console.log(`TorrServer: ${TORRSERVER_URL}`);
  console.log(`Auth: ${USERNAME && PASSWORD ? 'Enabled' : 'Disabled'}`);
});