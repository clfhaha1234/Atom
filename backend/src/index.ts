import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import chatRoutes from './routes/chat'
import chatStreamRoutes from './routes/chat-stream'
import chatFixRoutes from './routes/chat-fix'
import authRoutes from './routes/auth'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/chat', chatRoutes)
app.use('/api/chat', chatStreamRoutes)
app.use('/api/chat', chatFixRoutes)
app.use('/api/auth', authRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
