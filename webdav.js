import axios from 'axios';
import { 
  getFilesFromTorrent, 
  flattenFilePath, 
  escapeXml, 
  getContentType 
} from './helpers.js';
import { getTorrentsList } from './torrserver.js';

// PROPFIND handler
export async function handlePropfind(ctx, torrserverUrl) {
  const path = decodeURIComponent(ctx.path);
  const depth = ctx.headers.depth || '0';
  
  console.log(`[PROPFIND] Path: ${path}, Depth: '${depth}', User-Agent: ${ctx.headers['user-agent']}`);

  try {
    // Root directory
    if (path === '/' || path === '') {
      const torrents = await getTorrentsList(torrserverUrl);
      
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
        console.log(`[ROOT] Listing ${torrents.length} torrents...`);
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

    const pathParts = path.split('/').filter(p => p).map(p => decodeURIComponent(p));
    
    // Torrent folder
    if (pathParts.length === 1) {
      const torrents = await getTorrentsList(torrserverUrl);
      const torrent = torrents.find(t => {
        const name = t.title || t.name || t.hash;
        return name === pathParts[0];
      });

      if (!torrent) {
        console.log(`[TORRENT] Not found: ${pathParts[0]}`);
        ctx.status = 404;
        ctx.body = 'Torrent not found';
        return;
      }

      console.log(`[TORRENT] Found: ${torrent.title || torrent.name}, Hash: ${torrent.hash}`);
      
      const files = getFilesFromTorrent(torrent);
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
          const displayFileName = flattenFilePath(file.path);
          const encodedFileName = encodeURIComponent(displayFileName);
          const ext = displayFileName.toLowerCase().split('.').pop();
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
        <D:displayname>${escapeXml(displayFileName)}</D:displayname>
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

    // File request within a torrent
    if (pathParts.length >= 2) {
      const torrents = await getTorrentsList(torrserverUrl);
      const torrent = torrents.find(t => {
        const name = t.title || t.name || t.hash;
        return name === pathParts[0];
      });

      if (!torrent) {
        ctx.status = 404;
        ctx.body = 'Torrent not found';
        return;
      }

      const files = getFilesFromTorrent(torrent);
      const requestedFile = pathParts.slice(1).join('/');
      
      const file = files.find(f => 
        f.path === requestedFile || 
        flattenFilePath(f.path) === requestedFile
      );

      if (!file) {
        ctx.status = 404;
        ctx.body = 'File not found';
        return;
      }

      const displayFileName = flattenFilePath(file.path);
      const ext = displayFileName.toLowerCase().split('.').pop();
      const contentType = getContentType(ext);
      const timestamp = torrent.timestamp ? new Date(torrent.timestamp * 1000) : new Date();

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/${encodeURIComponent(pathParts[0])}/${encodeURIComponent(displayFileName)}</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
        <D:getcontentlength>${file.length || 0}</D:getcontentlength>
        <D:getlastmodified>${timestamp.toUTCString()}</D:getlastmodified>
        <D:creationdate>${timestamp.toISOString()}</D:creationdate>
        <D:displayname>${escapeXml(displayFileName)}</D:displayname>
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
export async function handleGetHead(ctx, torrserverUrl) {
  const path = decodeURIComponent(ctx.path);
  const pathParts = path.split('/').filter(p => p).map(p => decodeURIComponent(p));

  if (pathParts.length < 2) {
    ctx.status = 404;
    ctx.body = 'Not found';
    return;
  }

  try {
    const torrents = await getTorrentsList(torrserverUrl);
    const torrent = torrents.find(t => {
      const name = t.title || t.name || t.hash;
      return name === pathParts[0];
    });

    if (!torrent) {
      ctx.status = 404;
      ctx.body = 'Torrent not found';
      return;
    }

    const files = getFilesFromTorrent(torrent);
    const requestedFile = pathParts.slice(1).join('/');
    
    const file = files.find(f => 
      f.path === requestedFile || 
      flattenFilePath(f.path) === requestedFile
    );

    if (!file) {
      console.log(`[STREAM] File not found: ${requestedFile}`);
      ctx.status = 404;
      ctx.body = 'File not found';
      return;
    }

    const displayFileName = flattenFilePath(file.path);
    const ext = displayFileName.toLowerCase().split('.').pop();
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
    const streamUrl = `${torrserverUrl}/play/${torrent.hash}/${file.id}`;
    console.log(`[STREAM] ${streamUrl} (Range: ${ctx.headers.range || 'none'})`);

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