# TorrTV

A simple IPTV wrapper for TorrServer that generates M3U8 playlists compatible with most IPTV players.

## Why?

TorrServer's native playlist endpoint is not compatible with most IPTV players. TorrTV bridges this gap by providing standard M3U8 playlists.

## Quick Start

### Docker Compose

```yaml
name: 'torrdav'
version: '3'
services:
  torrdav:
    build:
      context: .
      dockerfile: Dockerfile
    image: jarvisnexus/torrdav:latest
    container_name: torrdav
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - TORRSERVER_URL=http://192.168.1.10:5665
      - HOST=0.0.0.0
    restart: always
```

Run with:
```bash
docker-compose up -d
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `TORRSERVER_URL` - Default TorrServer URL (default: http://192.168.1.10:5665)
- `HOST` - Server host (default: 0.0.0.0)

## API Endpoints

- `GET /torrents` - List all torrents
- `GET /torrents/:hash` - Get single torrent
- `GET /playlist/all` - M3U playlist for all torrents
- `GET /playlist/:hash` - M3U playlist for specific torrent

## Dynamic TorrServer URL

TorrTV supports dynamic TorrServer URL configuration using the `url` query parameter. This allows you to generate playlists for different network environments without changing the server configuration.

### Usage

Add `?url=<torrserver-url>` to any endpoint:

```
http://192.168.1.10:3000/playlist/all?url=http://torrserver-url:5665
```

### Environment-Specific Examples

#### 1. **Home/LAN Network**
When accessing from your local network:
```
http://192.168.1.10:3000/playlist/all?url=http://192.168.1.10:5665
```

#### 2. **VPN Access**
When connected via VPN with internal IP:
```
http://192.168.1.10:3000/playlist/all?url=http://10.8.0.5:5665
```

#### 3. **Tunnel (Cloudflare/Ngrok)**
When accessing through a tunnel service:
```
http://192.168.1.10:3000/playlist/all?url=https://mytorrserver.example.com
```

#### 4. **Internet/Public Access**
When accessing from external network with port forwarding:
```
http://192.168.1.10:3000/playlist/all?url=http://123.45.67.89:5665
```

#### 5. **Domain Name**
When using a custom domain:
```
http://192.168.1.10:3000/playlist/all?url=http://torrserver.mydomain.com:5665
```

### Complete Endpoint Examples

#### All Torrents with Custom URL
```
http://192.168.1.10:3000/playlist/all?url=http://custom-torrserver:5665
```

#### Specific Torrent with Custom URL
```
http://192.168.1.10:3000/playlist/{hash}?url=http://custom-torrserver:5665
```

#### Get Torrents List with Custom URL
```
http://192.168.1.10:3000/torrents?url=http://custom-torrserver:5665
```

### Alternative: Using HTTP Header

You can also pass the TorrServer URL via HTTP header:

```bash
curl -H "X-TorrServer-URL: http://custom-torrserver:5665" \
  http://192.168.1.10:3000/playlist/all
```

### Priority Order

The TorrServer URL is determined in this order:
1. Query parameter `?url=`
2. HTTP header `X-TorrServer-URL`
3. Environment variable `TORRSERVER_URL`

## Use Cases

### Multi-Environment Setup

Create different playlist URLs for different scenarios:

**At Home:**
```
http://torrdav.local:3000/playlist/all?url=http://torrserver.local:5665
```

**On Mobile (VPN):**
```
http://torrdav.local:3000/playlist/all?url=http://10.8.0.5:5665
```

**Away from Home (Tunnel):**
```
http://torrdav.myserver.com:3000/playlist/all?url=https://torrserver-tunnel.myserver.com
```

### IPTV Player Configuration

Add the appropriate playlist URL to your IPTV player based on your current network:

**TiviMate Example:**
- Home: `http://192.168.1.10:3000/playlist/all?url=http://192.168.1.10:5665`
- Away: `http://myserver.com:3000/playlist/all?url=https://tunnel.myserver.com`

## Basic Usage

Add the playlist URL to your IPTV player:

**Default TorrServer (from environment):**
```
http://192.168.1.10:3000/playlist/all
```

**Custom TorrServer URL:**
```
http://192.168.1.10:3000/playlist/all?url=http://your-torrserver:5665
```

Or use a specific torrent:
```
http://192.168.1.10:3000/playlist/{hash}?url=http://your-torrserver:5665
```
## License

MIT