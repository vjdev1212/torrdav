# TorrDAV

**TorrDAV** is a lightweight **WebDAV bridge for TorrServer**. It exposes torrents as standard folders and files so they can be streamed directly in any WebDAV-supported media player.

## Why TorrDAV?

Most media players already support WebDAV but cannot talk to TorrServer directly. TorrDAV sits in between and makes TorrServer content look like a normal WebDAV file system.

If a client supports WebDAV, it will work with TorrDAV.

## Supported Clients

* Infuse (iOS / Apple TV)
* VidHub
* SenPlayer
* Kodi
* VLC
* nPlayer
* Any generic WebDAV client

## Quick Start

### Docker Compose

```yaml
name: 'TorrDAV'
version: '3'
services:
  torrdav:
    image: vjdev1212/torrdav:latest
    container_name: torrdav
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - TORRSERVER_URL=http://192.168.1.10:5665
      - HOST=0.0.0.0
    restart: always
```

```bash
docker-compose up -d
```

## Configuration

| Variable         | Description        | Default                    |
| ---------------- | ------------------ | -------------------------- |
| `PORT`           | WebDAV server port | `3000`                     |
| `TORRSERVER_URL` | TorrServer address | `http://192.168.1.10:5665` |
| `HOST`           | Bind address       | `0.0.0.0`                  |

## Usage

Connect your WebDAV client to:

```
http://<host>:3000/
```

Example:

```
http://192.168.1.10:3000/
```

Each torrent appears as a folder, with media files inside that can be streamed and seeked normally.

## Notes

* TorrDAV does not download files fully
* TorrServer handles buffering and caching
* Performance depends on network and TorrServer

## License

MIT
