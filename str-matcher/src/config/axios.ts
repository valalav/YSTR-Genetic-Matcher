import axios from 'axios';

// Use relative URL for production (proxied by nginx)
// In production, nginx proxies /api/ to backend
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
