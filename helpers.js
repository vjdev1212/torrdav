

// Get file list from torrent data
export function getFilesFromTorrent(torrent) {
  if (torrent.data) {
    try {
      const parsedData = JSON.parse(torrent.data);
      if (parsedData.TorrServer && parsedData.TorrServer.Files && parsedData.TorrServer.Files.length > 0) {
        console.log(`[FILES] ${torrent.title}: Parsed from data (${parsedData.TorrServer.Files.length} files)`);
        return parsedData.TorrServer.Files;
      }
    } catch (error) {
      console.log(`[ERROR] Failed to parse data for ${torrent.title}:`, error.message);
    }
  }
  
  console.log(`[FILES] ${torrent.title}: No files found!`);
  return [];
}

// Flatten file paths for display
export function flattenFilePath(filePath) {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

// Escape XML special characters
export function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Determine content type from file extension
export function getContentType(ext) {
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