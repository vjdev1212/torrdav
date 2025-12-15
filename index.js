import Koa from 'koa';
import Router from '@koa/router';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
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

// Helper function to get torrents list from TorrServer
async function getTorrentsList() {
  try {
    const response = await axios.post(`${TORRSERVER_URL}/torrents`, {
      action: 'list'
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching torrents:', error.message);
    return [];
  }
}

// Helper function to get torrent status with file stats
async function getTorrentStatus(hash) {
  try {
    const response = await axios.post(`${TORRSERVER_URL}/torrents`, {
      action: 'get',
      hash: hash
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching torrent status:', error.message);
    return null;
  }
}

// Helper function to determine content type
function getContentType(ext) {
  const types = {
    'mp4': 'video/mp4',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'm4v': 'video/x-m4v',
    'ts': 'video/mp2t',
    'mp3': 'audio/mpeg',
    'flac': 'audio/flac',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'ogg': 'audio/ogg',
    'wma': 'audio/x-ms-wma',
    'srt': 'application/x-subrip',
    'ass': 'text/x-ssa',
    'ssa': 'text/x-ssa',
    'sub': 'text/x-microdvd',
    'vtt': 'text/vtt',
    'idx': 'application/x-idx',
    'nfo': 'text/plain',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp'
  };
  return types[ext] || 'application/octet-stream';
}

// PROPFIND handler
async function handlePropfind(ctx) {
  const path = decodeURIComponent(ctx.path);
  const depth = ctx.headers.depth || '0';
  
  console.log(`PROPFIND request for: ${path}, depth: ${depth}`);

  try {
    // Root directory
    if (path === '/' || path === '') {
      const torrents = await getTorrentsList();
      
      let xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:displayname>TorrServer</D:displayname>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;

      if (depth !== '0') {
        for (const torrent of torrents) {
          const torrentName = torrent.title || torrent.name || torrent.hash;
          const encodedName = encodeURIComponent(torrentName);
          const timestamp = torrent.timestamp ? new Date(torrent.timestamp * 1000) : new Date();
          
          xmlResponse += `
  <D:response>
    <D:href>/${encodedName}/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${timestamp.toUTCString()}</D:getlastmodified>
        <D:creationdate>${timestamp.toISOString()}</D:creationdate>
        <D:displayname>${torrentName}</D:displayname>
        <D:getcontentlength>0</D:getcontentlength>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
        }
      }

      xmlResponse += `</D:multistatus>`;
      
      ctx.status = 207;
      ctx.set('Content-Type', 'application/xml; charset=utf-8');
      ctx.set('DAV', '1, 2');
      ctx.body = xmlResponse;
      return;
    }

    // Parse path
    const pathParts = path.split('/').filter(p => p).map(p => decodeURIComponent(p));
    
    // Torrent directory
    if (pathParts.length === 1) {
      const torrents = await getTorrentsList();
      const torrent = torrents.find(t => {
        const name = t.title || t.name || t.hash;
        return name === pathParts[0];
      });

      if (!torrent) {
        ctx.status = 404;
        ctx.body = 'Torrent not found';
        return;
      }

      const torrentStatus = await getTorrentStatus(torrent.hash);
      const files = torrentStatus?.file_stats || [];
      const timestamp = torrent.timestamp ? new Date(torrent.timestamp * 1000) : new Date();
      
      let xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/${encodeURIComponent(pathParts[0])}/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${timestamp.toUTCString()}</D:getlastmodified>
        <D:creationdate>${timestamp.toISOString()}</D:creationdate>
        <D:displayname>${pathParts[0]}</D:displayname>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;

      if (depth !== '0') {
        for (const file of files) {
          const fileName = file.path;
          const encodedFileName = encodeURIComponent(fileName);
          const ext = fileName.toLowerCase().split('.').pop();
          const contentType = getContentType(ext);
          
          xmlResponse += `
  <D:response>
    <D:href>/${encodeURIComponent(pathParts[0])}/${encodedFileName}</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getcontentlength>${file.length || 0}</D:getcontentlength>
        <D:getlastmodified>${timestamp.toUTCString()}</D:getlastmodified>
        <D:creationdate>${timestamp.toISOString()}</D:creationdate>
        <D:displayname>${fileName}</D:displayname>
        <D:getcontenttype>${contentType}</D:getcontenttype>
        <D:getetag>"${torrent.hash}-${file.id}"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
        }
      }

      xmlResponse += `</D:multistatus>`;
      
      ctx.status = 207;
      ctx.set('Content-Type', 'application/xml; charset=utf-8');
      ctx.set('DAV', '1, 2');
      ctx.body = xmlResponse;
      return;
    }

    // File request
    if (pathParts.length === 2) {
      const torrents = await getTorrentsList();
      const torrent = torrents.find(t => {
        const name = t.title || t.name || t.hash;
        return name === pathParts[0];
      });

      if (!torrent) {
        ctx.status = 404;
        ctx.body = 'Torrent not found';
        return;
      }

      const torrentStatus = await getTorrentStatus(torrent.hash);
      const files = torrentStatus?.file_stats || [];
      const file = files.find(f => f.path === pathParts[1]);

      if (!file) {
        ctx.status = 404;
        ctx.body = 'File not found';
        return;
      }

      const ext = file.path.toLowerCase().split('.').pop();
      const contentType = getContentType(ext);
      const timestamp = torrent.timestamp ? new Date(torrent.timestamp * 1000) : new Date();

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/${encodeURIComponent(pathParts[0])}/${encodeURIComponent(pathParts[1])}</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getcontentlength>${file.length || 0}</D:getcontentlength>
        <D:getlastmodified>${timestamp.toUTCString()}</D:getlastmodified>
        <D:creationdate>${timestamp.toISOString()}</D:creationdate>
        <D:displayname>${file.path}</D:displayname>
        <D:getcontenttype>${contentType}</D:getcontenttype>
        <D:getetag>"${torrent.hash}-${file.id}"</D:getetag>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

      ctx.status = 207;
      ctx.set('Content-Type', 'application/xml; charset=utf-8');
      ctx.set('DAV', '1, 2');
      ctx.body = xmlResponse;
      return;
    }

    ctx.status = 404;
    ctx.body = 'Not found';
  } catch (error) {
    console.error('PROPFIND error:', error);
    ctx.status = 500;
    ctx.body = 'Internal server error';
  }
}

// GET/HEAD handler for streaming
async function handleGetHead(ctx) {
  const path = decodeURIComponent(ctx.path);
  const pathParts = path.split('/').filter(p => p).map(p => decodeURIComponent(p));

  if (pathParts.length !== 2) {
    ctx.status = 404;
    ctx.body = 'Not found';
    return;
  }

  try {
    const torrents = await getTorrentsList();
    const torrent = torrents.find(t => {
      const name = t.title || t.name || t.hash;
      return name === pathParts[0];
    });

    if (!torrent) {
      ctx.status = 404;
      ctx.body = 'Torrent not found';
      return;
    }

    const torrentStatus = await getTorrentStatus(torrent.hash);
    const files = torrentStatus?.file_stats || [];
    const file = files.find(f => f.path === pathParts[1]);

    if (!file) {
      ctx.status = 404;
      ctx.body = 'File not found';
      return;
    }

    const ext = file.path.toLowerCase().split('.').pop();
    const contentType = getContentType(ext);

    // HEAD request
    if (ctx.method === 'HEAD') {
      ctx.status = 200;
      ctx.set('Content-Type', contentType);
      ctx.set('Content-Length', file.length.toString());
      ctx.set('Accept-Ranges', 'bytes');
      ctx.set('ETag', `"${torrent.hash}-${file.id}"`);
      ctx.set('Cache-Control', 'no-cache');
      ctx.body = '';
      return;
    }

    // GET request - stream file
    const streamUrl = `${TORRSERVER_URL}/play/${torrent.hash}/${file.id}`;
    console.log(`Streaming: ${streamUrl}`);

    const headers = {};
    if (ctx.headers.range) {
      headers.Range = ctx.headers.range;
    }
    if (ctx.headers['user-agent']) {
      headers['User-Agent'] = ctx.headers['user-agent'];
    }

    const response = await axios({
      method: 'GET',
      url: streamUrl,
      responseType: 'stream',
      headers: headers,
      validateStatus: () => true,
      maxRedirects: 5
    });

    ctx.status = response.status;
    ctx.set('Content-Type', response.headers['content-type'] || contentType);
    
    if (response.headers['content-length']) {
      ctx.set('Content-Length', response.headers['content-length']);
    } else if (file.length) {
      ctx.set('Content-Length', file.length.toString());
    }
    
    if (response.headers['content-range']) {
      ctx.set('Content-Range', response.headers['content-range']);
    }
    
    ctx.set('Accept-Ranges', response.headers['accept-ranges'] || 'bytes');
    ctx.set('Cache-Control', 'no-cache');
    ctx.set('ETag', `"${torrent.hash}-${file.id}"`);
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    ctx.body = response.data;
  } catch (error) {
    console.error('Stream error:', error.message);
    ctx.status = 500;
    ctx.body = 'Stream error';
  }
}

// Health check
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
      await handlePropfind(ctx);
      break;

    case 'GET':
    case 'HEAD':
      await handleGetHead(ctx);
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
      // Return success but don't change properties (read-only)
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
  console.log(`
╔════════════════════════════════════════════════════════════╗
║      TorrServer Full WebDAV Bridge - Running               ║
╠════════════════════════════════════════════════════════════╣
║  WebDAV Server: http://0.0.0.0:${PORT}                    
║  TorrServer:    ${TORRSERVER_URL}                    
║  Health Check:  http://0.0.0.0:${PORT}/health             
║  Auth:          ${USERNAME && PASSWORD ? 'Enabled (Basic Auth)' : 'Disabled'}
╠════════════════════════════════════════════════════════════╣
║  WEBDAV FEATURES:                                          ║
║  ✅ PROPFIND (browse files)                               ║
║  ✅ GET/HEAD (stream & info)                              ║
║  ✅ OPTIONS (capabilities)                                ║
║  ✅ PROPPATCH (metadata)                                  ║
║  ✅ LOCK/UNLOCK (locking)                                 ║
║  ✅ Range requests (seeking)                              ║
║  ✅ ETags (caching)                                       ║
║  ✅ Basic Auth (optional)                                 ║
║  📖 Read-only mode                                        ║
╠════════════════════════════════════════════════════════════╣
║  INFUSE SETUP:                                             ║
║  1. Add network share (WebDAV)                             ║
║  2. Server: <your-server-ip>:${PORT}                      
║  3. Path: / (or leave blank)                               ║
║  4. Auth: ${USERNAME && PASSWORD ? 'Username/Password' : 'None'}                                   ║
╠════════════════════════════════════════════════════════════╣
║  COMPATIBLE WITH:                                          ║
║  • Infuse (iOS/tvOS/macOS)                                 ║
║  • VLC                                                     ║
║  • Kodi                                                    ║
║  • Windows Explorer                                        ║
║  • macOS Finder                                            ║
║  • Linux file managers                                     ║
╚════════════════════════════════════════════════════════════╝
  `);
});