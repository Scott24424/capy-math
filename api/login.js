import { serve } from './_lib/http.js'
import { login } from './_lib/handlers.js'

export const POST = serve(login)
