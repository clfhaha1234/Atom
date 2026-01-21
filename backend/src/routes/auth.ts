import express from 'express'
import { supabase } from '../lib/supabase'

const router = express.Router()

router.post('/verify', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' })
  }

  const { token } = req.body
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    
    res.json({ user: { id: user.id, email: user.email } })
  } catch (error) {
    console.error('Auth verification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
