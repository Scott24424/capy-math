import { serve } from './_lib/http.js'
import { logout } from './_lib/handlers.js'

export const POST = serve(logout)
