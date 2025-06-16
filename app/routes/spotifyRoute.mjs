import express from 'express';
import axios from 'axios';
import querystring from 'querystring';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Spotify OAuth Configuration
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  REDIRECT_URI,
  AUTH_URI,
  TOKEN_URI,
  API_BASE_URL
} = process.env;

// 1. Redirect to Spotify Login Page
router.get('/login', (req, res) => {
  const scope = 'user-read-private user-read-email'; // Add required scopes
  const queryParams = querystring.stringify({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: scope,
    show_dialog: true // Optional: Force login dialog every time
  });

  res.redirect(`${AUTH_URI}?${queryParams}`);
});

// 2. Handle Callback After Spotify Authorization
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: 'Spotify authorization failed' });
  }

  try {
    // Exchange authorization code for access token
    const authOptions = {
      method: 'post',
      url: TOKEN_URI,
      data: querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const response = await axios(authOptions);
    const { access_token, refresh_token, expires_in } = response.data;

    // You can now:
    // - Store tokens securely (in DB or session)
    // - Redirect to frontend with tokens
    // - Make API requests to Spotify

    // Example: Get user profile
    const userData = await axios.get(`${API_BASE_URL}me`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    res.json({
      access_token,
      refresh_token,
      expires_in,
      user: userData.data
    });

  } catch (err) {
    console.error('Spotify token exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to authenticate with Spotify' });
  }
});

// 3. Refresh Token (Optional)
router.get('/refresh_token', async (req, res) => {
  const { refresh_token } = req.query;

  try {
    const response = await axios.post(TOKEN_URI, querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    res.json(response.data);
  } catch (err) {
    res.status(400).json({ error: 'Invalid refresh token' });
  }
});

export default router;