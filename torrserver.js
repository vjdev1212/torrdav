import axios from 'axios';

// Get torrents list from TorrServer
export async function getTorrentsList(torrserverUrl) {
  try {
    const response = await axios.post(`${torrserverUrl}/torrents`, {
      action: 'list'
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching torrents:', error.message);
    return [];
  }
}