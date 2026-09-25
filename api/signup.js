import { serve } from './_lib/http.js'
import { signup } from './_lib/handlers.js'

export const POST = serve(signup)
